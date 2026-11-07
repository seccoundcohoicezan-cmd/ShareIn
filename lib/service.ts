import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { cached } from './cache'
import { normalizeName, parseCount } from './format'
import { withLock } from './lock'
import { getSettings, getSettingsFresh } from './repo/settings'
import {
  appendSubmission,
  countUsed,
  findDuplicate,
  listSubmissionsCached,
  listSubmissionsFresh,
  updateSubmissions,
} from './repo/submissions'
import { parseAndResolve, type Fetcher, type Resolver } from './resolve'
import { qtyTarget } from './settings-schema'
import type { CheckResult, Platform, Settings, Submission } from './types'
import { runChecks } from './validate'
import { normalizeWhatsapp } from './identity'

export const submissionSchema = z.object({
  submitter_name: z.string().trim().min(2, 'Isi nama minimal 2 huruf.').max(60, 'Nama maksimal 60 karakter.'),
  whatsapp: z.string().trim().max(20).default(''),
  platform: z.enum(['tiktok', 'reels']),
  source_url: z.string().trim().max(500),
  sharein_url: z.string().trim().max(500).default(''),
  likes: z.union([z.number(), z.string()]).nullable().default(null),
  comments: z.union([z.number(), z.string()]).nullable().default(null),
  organic_declared: z.boolean().default(false),
  checked_declared: z.boolean().default(false),
  has_screenshot: z.boolean().default(false),
  metrics_source: z.enum(['manual', 'api']).optional().default('manual'),
  api_likes: z.number().nullable().optional(),
  api_comments: z.number().nullable().optional(),
})

export type SubmissionInput = z.infer<typeof submissionSchema>

export interface NetOpts {
  fetcher?: Fetcher
  resolver?: Resolver
}

type Link = Awaited<ReturnType<typeof parseAndResolve>>

function evaluate(input: SubmissionInput, settings: Settings, all: Submission[], link: Link) {
  const likes = parseCount(input.likes)
  const comments = parseCount(input.comments)
  const duplicate = typeof link !== 'string' && link.source_key ? findDuplicate(all, link.source_key) : null
  const result = runChecks(
    {
      platform: input.platform,
      likes,
      comments,
      sharein_url: input.sharein_url,
      organic_declared: input.organic_declared,
      checked_declared: input.checked_declared,
      has_screenshot: input.has_screenshot,
    },
    { settings, link, duplicate, used: countUsed(all, settings.period_id, input.platform) },
  )
  // One person = one WhatsApp number; it keys the personal monitoring link.
  if (!normalizeWhatsapp(input.whatsapp)) {
    result.checks.unshift({ id: 'identity', pass: false, message: 'Isi nomor WhatsApp aktif, contoh 081234567890. Nomor ini jadi akun & link pantauanmu.' })
    result.ok = false
  }
  return { result, likes, comments }
}

export async function checkSubmission(input: SubmissionInput, net?: NetOpts): Promise<CheckResult> {
  const settings = await getSettings()
  const all = await listSubmissionsCached()
  const link = await parseAndResolve(input.source_url, net)
  return evaluate(input, settings, all, link).result
}

export type CreateResult = { ok: true; submission: Submission } | { ok: false; checks: CheckResult['checks'] }

function newId() {
  return 'sub_' + randomBytes(9).toString('base64url')
}

function apiDiffers(input: SubmissionInput, likes: number, comments: number) {
  const off = (user: number, api: number | null | undefined) =>
    typeof api === 'number' && api > 0 && Math.abs(user - api) / api > 0.2
  return off(likes, input.api_likes) || off(comments, input.api_comments)
}

/**
 * Re-validates with fresh data, appends, then re-reads to settle races between server
 * instances: the earliest row wins a duplicate, and rows beyond the QTY target are voided.
 */
export async function createSubmission(
  input: SubmissionInput,
  net?: NetOpts,
  screenshotUrl = '',
): Promise<CreateResult> {
  const link = await parseAndResolve(input.source_url, net)
  return withLock('submissions', async () => {
    const settings = await getSettingsFresh()
    const all = await listSubmissionsFresh()
    const ev = evaluate({ ...input, has_screenshot: Boolean(screenshotUrl) }, settings, all, link)
    if (!ev.result.ok || typeof link === 'string' || !link.source_key) {
      return { ok: false, checks: ev.result.checks.filter((c) => !c.pass) }
    }
    const likes = ev.likes!
    const comments = ev.comments!
    const sub: Submission = {
      id: newId(),
      created_at: new Date().toISOString(),
      period_id: settings.period_id,
      submitter_name: input.submitter_name.trim().replace(/\s+/g, ' '),
      platform: input.platform,
      source_url: link.url,
      source_key: link.source_key,
      sharein_url: input.sharein_url.trim(),
      likes,
      comments,
      metrics_source: input.metrics_source,
      organic_declared: true,
      screenshot_url: screenshotUrl,
      status: 'pending',
      reject_reason: '',
      reviewed_by: '',
      reviewed_at: '',
      needs_review: input.metrics_source === 'api' ? false : apiDiffers(input, likes, comments),
      whatsapp: normalizeWhatsapp(input.whatsapp) ?? '',
    }
    await appendSubmission(sub)
    const after = await listSubmissionsFresh()
    const mine = after.find((s) => s.id === sub.id)
    if (!mine) return { ok: true, submission: sub }
    const firstSame = after.find((s) => s.source_key === sub.source_key && s.status !== 'void')
    const active = after.filter(
      (s) =>
        s.period_id === sub.period_id &&
        s.platform === sub.platform &&
        (s.status === 'pending' || s.status === 'approved'),
    )
    const position = active.findIndex((s) => s.id === sub.id) + 1
    const target = qtyTarget(settings, sub.platform)
    if (firstSame && firstSame.id !== sub.id) {
      await updateSubmissions([{ ...mine, status: 'void', reject_reason: 'Duplikat bersamaan (otomatis)' }])
      return { ok: false, checks: [{ id: 'not_duplicate', pass: false, message: 'Link ini baru saja disetor orang lain. Cari konten lain.' }] }
    }
    if (position > target) {
      await updateSubmissions([{ ...mine, status: 'void', reject_reason: 'Kuota penuh bersamaan (otomatis)' }])
      return {
        ok: false,
        checks: [{ id: 'qty_available', pass: false, remaining: 0, message: `Target periode ini baru saja terpenuhi (${target}/${target}).` }],
      }
    }
    return { ok: true, submission: sub }
  })
}

export interface Progress {
  platform: Platform
  used: number
  target: number
  remaining: number
}

export async function getProgress(): Promise<{ settings: Settings; progress: Progress[] }> {
  return cached('progress', async () => {
    const settings = await getSettings()
    const all = await listSubmissionsCached()
    const progress = (['tiktok', 'reels'] as Platform[]).map((p) => {
      const used = countUsed(all, settings.period_id, p)
      const target = qtyTarget(settings, p)
      return { platform: p, used, target, remaining: Math.max(0, target - used) }
    })
    return { settings, progress }
  })
}

export type PublicSubmission = Pick<
  Submission,
  'id' | 'created_at' | 'period_id' | 'platform' | 'source_url' | 'sharein_url' | 'likes' | 'comments' | 'status' | 'reject_reason'
>

export async function listMine(name: string): Promise<PublicSubmission[]> {
  const key = normalizeName(name)
  if (key.length < 2) return []
  const all = await listSubmissionsFresh()
  return all
    .filter((s) => normalizeName(s.submitter_name) === key && s.status !== 'void')
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 100)
    .map(({ id, created_at, period_id, platform, source_url, sharein_url, likes, comments, status, reject_reason }) => ({
      id, created_at, period_id, platform, source_url, sharein_url, likes, comments, status, reject_reason,
    }))
}
