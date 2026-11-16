import 'server-only'
import { z } from 'zod'
import { normalizeName } from './format'
import { withLock } from './lock'
import type { SyncStatus } from './primary/engine'
import { getStore } from './repo'
import { AppsScriptStore } from './repo/apps-script-store'
import { audit } from './repo/audit'
import { getSettings } from './repo/settings'
import { listSubmissionsCached, listSubmissionsFresh, listSubmissionsRecent, patchSubmissions, updateSubmissions, type StoredSubmission } from './repo/submissions'
import { autoApprove } from './settings-schema'
import { AUTO_REVIEWER, type Channel, type Settings, type Submission } from './types'
import { participantsTable } from './repo/programs'

export const REJECT_REASONS = ['Angka tidak sesuai', 'Bukan dari FYP', 'Duplikat', 'Link ShareIn tidak valid'] as const

export const filterSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).default('all'),
  platform: z.enum(['tiktok', 'reels', 'all']).default('all'),
  period: z.string().trim().max(40).default(''),
  name: z.string().trim().max(60).default(''),
  program: z.enum(['golden', 'pelatihan', 'duta']).default('golden'),
})
export type Filters = z.infer<typeof filterSchema>

export function applyFilters(all: Submission[], f: Filters): Submission[] {
  const name = normalizeName(f.name)
  return all
    .filter((s) => s.status !== 'void' && s.program === f.program)
    .filter((s) => f.status === 'all' || s.status === f.status)
    .filter((s) => f.platform === 'all' || s.platform === f.platform)
    .filter((s) => !f.period || s.period_id === f.period)
    .filter((s) => !name || normalizeName(s.submitter_name).includes(name))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

function strip(s: StoredSubmission): Submission {
  const { _index, ...rest } = s
  void _index
  return rest
}

export async function adminList(f: Filters) {
  const all = (await listSubmissionsRecent()).map(strip)
  const periods = Array.from(new Set(all.filter((s) => s.program === f.program).map((s) => s.period_id))).filter(Boolean).sort().reverse()
  // Per-status totals for the same program/platform/period/name, so the tabs match the public counts.
  const scope = applyFilters(all, { ...f, status: 'all' })
  const counts = { all: scope.length, pending: 0, approved: 0, rejected: 0 }
  for (const s of scope) if (s.status !== 'void') counts[s.status]++
  return { items: f.status === 'all' ? scope : scope.filter((s) => s.status === f.status), periods, counts }
}

export type ChannelStats = { total: number; tiktok: number; reels: number; pending: number; approved: number; rejected: number; today: number }

const wibDay = (iso: string) => {
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? '' : new Date(t + 7 * 3600_000).toISOString().slice(0, 10)
}

/** Overview of every program for the admin home: totals, per program, last 7 days, latest links. */
export async function dashboard() {
  // Dashboard numbers: short cache (cleared on every write from the web) keeps it instant.
  const [settings, raw, people] = await Promise.all([getSettings(), listSubmissionsCached(), participantsTable.list()])
  const every = raw.map(strip).filter((s) => s.status !== 'void')
  const today = wibDay(new Date().toISOString())
  const empty = (): ChannelStats => ({ total: 0, tiktok: 0, reels: 0, pending: 0, approved: 0, rejected: 0, today: 0 })
  const byChannel: Record<Channel, ChannelStats> = { golden: empty(), pelatihan: empty(), duta: empty() }
  const all = empty()
  const days = Array.from({ length: 7 }, (_, i) => wibDay(new Date(Date.now() - (6 - i) * 86400_000).toISOString()))
  const daily = days.map((day) => ({ day, golden: 0, pelatihan: 0, duta: 0 }))
  for (const s of every) {
    const day = wibDay(s.created_at)
    for (const c of [byChannel[s.program], all]) {
      c.total++
      c[s.platform]++
      if (s.status === 'pending' || s.status === 'approved' || s.status === 'rejected') c[s.status]++
      if (day === today) c.today++
    }
    const d = daily.find((x) => x.day === day)
    if (d) d[s.program]++
  }
  return {
    settings,
    totals: { ...all, participants: people.length },
    byChannel,
    daily,
    recent: [...every].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 8),
  }
}

export const reviewSchema = z
  .object({
    action: z.enum(['approve', 'reject', 'reset']),
    reason: z.string().trim().max(200).optional().default(''),
  })
  .refine((v) => v.action !== 'reject' || v.reason.length >= 3, { message: 'Pilih atau tulis alasan penolakan.', path: ['reason'] })

export async function review(ids: string[], action: 'approve' | 'reject' | 'reset', reason: string, actor: string) {
  return withLock('submissions', async () => {
    const now = new Date().toISOString()
    const values = {
      status: action === 'approve' ? ('approved' as const) : action === 'reject' ? ('rejected' as const) : ('pending' as const),
      reject_reason: action === 'reject' ? reason : '',
      reviewed_by: action === 'reset' ? '' : actor,
      reviewed_at: action === 'reset' ? '' : now,
    }
    const patched = await patchSubmissions(ids.map((id) => ({ id, values })), { actor, action: `submission.${action}` })
    if (patched) return patched.map(strip)

    const all = await listSubmissionsFresh()
    const targets = all.filter((s) => ids.includes(s.id) && s.status !== 'void')
    const updated = targets.map((s) => ({ ...s, ...values }))
    await updateSubmissions(updated)
    await Promise.all(
      targets.map((t) => audit(actor, `submission.${action}`, t.id, { status: t.status }, { status: values.status, reason: values.reject_reason || undefined })),
    )
    return updated.map(strip)
  })
}

/**
 * Turning auto-approve on also approves links already waiting in that program, so nobody is left
 * behind because they sent a moment before the switch.
 */
export async function approveWaiting(before: Settings, after: Pick<Settings, 'auto_approve_golden' | 'auto_approve_pelatihan' | 'auto_approve_duta'>) {
  const turnedOn = (['golden', 'pelatihan', 'duta'] as const).filter((c) => autoApprove(after as Settings, c) && !autoApprove(before, c))
  if (!turnedOn.length) return 0
  const waiting = (await listSubmissionsFresh()).filter((s) => s.status === 'pending' && (turnedOn as readonly string[]).includes(s.program))
  if (!waiting.length) return 0
  return (await review(waiting.map((s) => s.id), 'approve', '', AUTO_REVIEWER)).length
}

function csvCell(v: unknown): string {
  let s = String(v ?? '')
  // Neutralize spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(items: Submission[]): string {
  const cols: (keyof Submission)[] = [
    'id', 'created_at', 'period_id', 'submitter_name', 'platform', 'source_url', 'source_key', 'sharein_url', 'likes',
    'comments', 'metrics_source', 'organic_declared', 'screenshot_url', 'status', 'reject_reason', 'reviewed_by',
    'reviewed_at', 'needs_review', 'whatsapp', 'program',
  ]
  return '﻿' + [cols.join(','), ...items.map((s) => cols.map((c) => csvCell(s[c])).join(','))].join('\r\n') + '\r\n'
}

/** Status of the copy to Google Sheets, when the primary database is in use (null otherwise). */
export async function sheetSync(): Promise<SyncStatus | null> {
  const store = getStore()
  if (store.kind !== 'primary' || !(store instanceof AppsScriptStore)) return null
  try {
    return await store.rawCall<SyncStatus>({ action: 'status' })
  } catch {
    return null
  }
}
