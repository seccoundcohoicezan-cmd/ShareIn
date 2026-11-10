import 'server-only'
import { z } from 'zod'
import { normalizeName } from './format'
import { withLock } from './lock'
import { audit } from './repo/audit'
import { getSettings } from './repo/settings'
import { listSubmissionsCached, listSubmissionsFresh, updateSubmissions, type StoredSubmission } from './repo/submissions'
import type { Submission } from './types'

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
  const all = (await listSubmissionsFresh()).map(strip)
  const periods = Array.from(new Set(all.filter((s) => s.program === f.program).map((s) => s.period_id))).filter(Boolean).sort().reverse()
  return { items: applyFilters(all, f), periods }
}

export async function dashboard() {
  // Dashboard numbers: 60 s cache (cleared on every write from the web) keeps it instant.
  const [settings, raw] = await Promise.all([getSettings(), listSubmissionsCached()])
  const every = raw.map(strip).filter((s) => s.status !== 'void')
  const all = every.filter((s) => s.program === 'golden')
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10)
  const inPeriod = all.filter((s) => s.period_id === settings.period_id)
  const reviewedToday = (s: Submission) =>
    s.reviewed_at && new Date(new Date(s.reviewed_at).getTime() + 7 * 3600_000).toISOString().slice(0, 10) === today
  return {
    settings,
    stats: {
      pending: all.filter((s) => s.status === 'pending').length,
      approvedToday: all.filter((s) => s.status === 'approved' && reviewedToday(s)).length,
      rejected: inPeriod.filter((s) => s.status === 'rejected').length,
      totalPeriod: inPeriod.length,
    },
    pendingByProgram: { pelatihan: every.filter((s) => s.program === 'pelatihan' && s.status === 'pending').length, duta: every.filter((s) => s.program === 'duta' && s.status === 'pending').length },
    recent: [...all].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 5),
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
    const all = await listSubmissionsFresh()
    const targets = all.filter((s) => ids.includes(s.id) && s.status !== 'void')
    const now = new Date().toISOString()
    const updated = targets.map((s) => ({
      ...s,
      status: action === 'approve' ? ('approved' as const) : action === 'reject' ? ('rejected' as const) : ('pending' as const),
      reject_reason: action === 'reject' ? reason : '',
      reviewed_by: action === 'reset' ? '' : actor,
      reviewed_at: action === 'reset' ? '' : now,
    }))
    await updateSubmissions(updated)
    for (let i = 0; i < targets.length; i++) {
      await audit(actor, `submission.${action}`, targets[i].id, { status: targets[i].status }, {
        status: updated[i].status,
        reason: updated[i].reject_reason || undefined,
      })
    }
    return updated.map(strip)
  })
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
