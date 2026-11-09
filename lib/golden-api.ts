import { z } from 'zod'
import { goldenAmount } from './golden'
import { listSubmissionsCached, listSubmissionsFresh } from './repo/submissions'
import { getSettings } from './repo/settings'
import { getProgress } from './service'
import type { Submission } from './types'

export const goldenListSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).default('all'),
  platform: z.enum(['tiktok', 'reels', 'all']).default('all'),
  period: z.string().trim().max(40).default(''),
  updated_since: z
    .string()
    .trim()
    .default('')
    .refine((v) => !v || !Number.isNaN(Date.parse(v)), 'updated_since harus tanggal ISO 8601, contoh 2026-11-09T00:00:00Z.'),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export function toApiSubmission(s: Submission) {
  return {
    id: s.id,
    created_at: s.created_at,
    period_id: s.period_id,
    submitter_name: s.submitter_name,
    whatsapp: s.whatsapp,
    platform: s.platform,
    source_url: s.source_url,
    source_key: s.source_key,
    sharein_url: s.sharein_url,
    likes: s.likes,
    comments: s.comments,
    metrics_source: s.metrics_source,
    organic_declared: s.organic_declared,
    status: s.status,
    reject_reason: s.reject_reason,
    reviewed_by: s.reviewed_by,
    reviewed_at: s.reviewed_at,
  }
}

export function selectGolden(all: Submission[], q: z.infer<typeof goldenListSchema>) {
  const since = q.updated_since ? Date.parse(q.updated_since) : null
  const rows = all
    .filter((s) => s.status !== 'void')
    .filter((s) => q.status === 'all' || s.status === q.status)
    .filter((s) => q.platform === 'all' || s.platform === q.platform)
    .filter((s) => !q.period || s.period_id === q.period)
    .filter((s) => since === null || Math.max(Date.parse(s.created_at) || 0, Date.parse(s.reviewed_at) || 0) >= since)
    .sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
  const page = rows.slice(q.offset, q.offset + q.limit)
  const next = q.offset + page.length
  return { total: rows.length, limit: q.limit, offset: q.offset, next_offset: next < rows.length ? next : null, items: page.map(toApiSubmission) }
}

export async function listGolden(q: z.infer<typeof goldenListSchema>) {
  return selectGolden(await listSubmissionsFresh(), q)
}

export async function findGolden(id: string) {
  const s = (await listSubmissionsFresh()).find((x) => x.id === id && x.status !== 'void')
  return s ? toApiSubmission(s) : null
}

export async function goldenSummary(now = Date.now()) {
  const [{ progress }, settings, all] = await Promise.all([getProgress(), getSettings(), listSubmissionsCached()])
  const inPeriod = all.filter((s) => s.period_id === settings.period_id && s.status !== 'void')
  const count = (st: string) => inPeriod.filter((s) => s.status === st).length
  return {
    period_id: settings.period_id,
    period_open: settings.period_open,
    auto_approve: settings.auto_approve_golden,
    prize: {
      current: goldenAmount(settings, now),
      start: settings.golden_pool_start,
      end: settings.golden_pool_end,
      start_at: settings.golden_start_at,
      end_at: settings.golden_end_at,
    },
    rules: {
      tiktok: { min_like: settings.min_like_tiktok, min_comment: settings.min_comment_tiktok },
      reels: { min_like: settings.min_like_reels, min_comment: settings.min_comment_reels },
    },
    collected: { total: progress.reduce((n, p) => n + p.used, 0), tiktok: progress.find((p) => p.platform === 'tiktok')?.used ?? 0, reels: progress.find((p) => p.platform === 'reels')?.used ?? 0 },
    counts: { total: inPeriod.length, pending: count('pending'), approved: count('approved'), rejected: count('rejected') },
    generated_at: new Date(now).toISOString(),
  }
}
