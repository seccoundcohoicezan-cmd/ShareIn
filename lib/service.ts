import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { cached } from './cache'
import { normalizeName, parseCount } from './format'
import { withLock } from './lock'
import { getSettings, getSettingsFresh } from './repo/settings'
import {
  appendSubmissionsAndList,
  countCollected,
  findDuplicate,
  isCollected,
  listSubmissionsCached,
  listSubmissionsFresh,
  updateSubmissions,
  type StoredSubmission,
} from './repo/submissions'
import { parseAndResolve, type Fetcher, type Resolver } from './resolve'
import { autoApprove, channelOpen } from './settings-schema'
import { AUTO_REVIEWER, type Channel, type CheckResult, type Platform, type Settings, type Submission } from './types'
import { runChecks } from './validate'
import { maskName, normalizeWhatsapp } from './identity'
import type { ParsedLink } from './url'

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
  program: z.enum(['golden', 'pelatihan', 'duta']).default('golden'),
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
  const duplicate = typeof link !== 'string' && link.source_key ? findDuplicate(all, link.source_key, input.program) : null
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
    { settings, link, duplicate, open: channelOpen(settings, input.program) },
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

export const MAX_BATCH = 10

const sharedFields = submissionSchema.pick({ submitter_name: true, whatsapp: true, organic_declared: true, checked_declared: true, has_screenshot: true, program: true })
const itemFields = submissionSchema.pick({ platform: true, source_url: true, sharein_url: true, likes: true, comments: true, metrics_source: true, api_likes: true, api_comments: true })

export const batchSchema = sharedFields.extend({
  items: z.array(itemFields).min(1, 'Tambahkan minimal satu konten.').max(MAX_BATCH, `Maksimal ${MAX_BATCH} konten sekali kirim.`),
})
export type BatchInput = z.infer<typeof batchSchema>

export function expandBatch(b: BatchInput): SubmissionInput[] {
  const { items, ...shared } = b
  return items.map((i) => ({ ...shared, ...i }))
}

/** Evaluates a batch in order: a link repeated within the batch is refused like any duplicate. */
function evaluateBatch(inputs: SubmissionInput[], settings: Settings, all: Submission[], links: Link[]) {
  const seen = new Map<string, number>()
  return inputs.map((input, i) => {
    const link = links[i]
    const platform = typeof link !== 'string' ? link.platform : input.platform
    const ev = evaluate({ ...input, platform }, settings, all, link)
    const key = typeof link !== 'string' ? link.source_key : null
    const earlier = key ? seen.get(key) : undefined
    if (earlier !== undefined) {
      const c = ev.result.checks.find((x) => x.id === 'not_duplicate')!
      c.pass = false
      c.message = `Link ini sama dengan konten nomor ${earlier + 1} di daftar ini.`
      ev.result.ok = false
    }
    if (key && earlier === undefined) seen.set(key, i)
    return { ...ev, platform }
  })
}

export interface BatchCheckResult {
  ok: boolean
  items: CheckResult[]
}

export async function checkBatch(inputs: SubmissionInput[], net?: NetOpts): Promise<BatchCheckResult> {
  const [settings, all, links] = await Promise.all([getSettings(), listSubmissionsCached(), Promise.all(inputs.map((i) => parseAndResolve(i.source_url, net)))])
  const items = evaluateBatch(inputs, settings, all, links).map((e) => e.result)
  return { ok: items.every((i) => i.ok), items }
}

export type BatchCreateResult = { ok: false; items: CheckResult[] } | { ok: true; results: CreateResult[] }

/**
 * Validates the whole batch with fresh data (nothing is saved unless every item passes), appends all
 * rows in one request, then re-reads to settle races between server instances: the earliest row wins
 * a duplicate.
 */
export async function createBatch(inputs: SubmissionInput[], net?: NetOpts, screenshotUrl = ''): Promise<BatchCreateResult> {
  const links = await Promise.all(inputs.map((i) => parseAndResolve(i.source_url, net)))
  return withLock('submissions', async () => {
    const [settings, all] = await Promise.all([getSettingsFresh(), listSubmissionsFresh()])
    const evs = evaluateBatch(inputs.map((i) => ({ ...i, has_screenshot: Boolean(screenshotUrl) })), settings, all, links)
    if (!evs.every((e) => e.result.ok)) return { ok: false, items: evs.map((e) => e.result) }

    const createdAt = new Date().toISOString()
    const program = inputs[0].program
    const auto = autoApprove(settings, program)
    const subs = inputs.map((input, i): Submission => {
      const link = links[i] as ParsedLink
      const likes = evs[i].likes!
      const comments = evs[i].comments!
      return {
        id: newId(),
        created_at: createdAt,
        period_id: settings.period_id,
        submitter_name: input.submitter_name.trim().replace(/\s+/g, ' '),
        platform: link.platform,
        source_url: link.url,
        source_key: link.source_key!,
        sharein_url: input.sharein_url.trim(),
        likes,
        comments,
        metrics_source: input.metrics_source,
        organic_declared: true,
        screenshot_url: screenshotUrl,
        status: auto ? 'approved' : 'pending',
        reject_reason: '',
        reviewed_by: auto ? AUTO_REVIEWER : '',
        reviewed_at: auto ? createdAt : '',
        needs_review: input.metrics_source === 'api' ? false : apiDiffers(input, likes, comments),
        whatsapp: normalizeWhatsapp(input.whatsapp) ?? '',
        program,
      }
    })
    const after = await appendSubmissionsAndList(subs)
    const voids: StoredSubmission[] = []
    const results = subs.map((sub): CreateResult => {
      const mine = after.find((s) => s.id === sub.id)
      if (!mine) return { ok: true, submission: sub }
      const firstSame = after.find((s) => s.program === program && s.source_key === sub.source_key && s.status !== 'void')
      if (firstSame && firstSame.id !== sub.id) {
        voids.push({ ...mine, status: 'void', reject_reason: 'Duplikat bersamaan (otomatis)' })
        return { ok: false, checks: [{ id: 'not_duplicate', pass: false, message: 'Link ini baru saja disetor orang lain. Cari konten lain.' }] }
      }
      return { ok: true, submission: sub }
    })
    if (voids.length) await updateSubmissions(voids)
    return { ok: true, results }
  })
}

export async function createSubmission(input: SubmissionInput, net?: NetOpts, screenshotUrl = ''): Promise<CreateResult> {
  const r = await createBatch([input], net, screenshotUrl)
  if (!r.ok) return { ok: false, checks: r.items[0].checks.filter((c) => !c.pass) }
  return r.results[0]
}

export interface Progress {
  platform: Platform
  used: number
}

/** Links collected so far (pending + approved), all periods: Golden Ticket has no target. */
export async function getProgress(): Promise<{ settings: Settings; progress: Progress[] }> {
  return cached('progress', async () => {
    const settings = await getSettings()
    const all = await listSubmissionsCached()
    const progress = (['tiktok', 'reels'] as Platform[]).map((p) => ({ platform: p, used: countCollected(all, p) }))
    return { settings, progress }
  })
}

export interface CollectedItem {
  id: string
  created_at: string
  platform: Platform
  name: string
  source_url: string
  sharein_url: string
  likes: number
  comments: number
  status: 'pending' | 'approved'
}

export interface CollectedFeed {
  total: number
  tiktok: number
  reels: number
  items: CollectedItem[]
}

/** Public list of a program's collected links, newest first. Names are shortened; WhatsApp numbers never leave the server. */
export async function collectedFeed(offset = 0, limit = 12, program: Channel = 'golden'): Promise<CollectedFeed> {
  const all = (await listSubmissionsCached()).filter((s) => s.program === program && isCollected(s))
  const sorted = [...all].sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
  return {
    total: sorted.length,
    tiktok: sorted.filter((s) => s.platform === 'tiktok').length,
    reels: sorted.filter((s) => s.platform === 'reels').length,
    items: sorted.slice(offset, offset + limit).map((s) => ({
      id: s.id,
      created_at: s.created_at,
      platform: s.platform,
      name: maskName(s.submitter_name),
      source_url: s.source_url,
      sharein_url: s.sharein_url,
      likes: s.likes,
      comments: s.comments,
      status: s.status as CollectedItem['status'],
    })),
  }
}
