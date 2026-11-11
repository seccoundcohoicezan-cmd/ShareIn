import { cached, invalidate } from '../cache'
import type { Channel, Platform, Submission, SubmissionStatus } from '../types'
import { getStore } from './index'
import { normalizeStatus } from '../status'
import { appendThenRead, recordToRow, rowToRecord, writeHeader, type Cell, type PatchResult } from './store'

export interface StoredSubmission extends Submission {
  /** Data row index in the table. */
  _index: number
}


function toBool(v: string) {
  return v.trim().toUpperCase() === 'TRUE'
}

function fromRecord(rec: Record<string, string>, index: number): StoredSubmission {
  const status: SubmissionStatus = normalizeStatus(rec.status)
  return {
    _index: index,
    id: rec.id,
    created_at: rec.created_at,
    period_id: rec.period_id,
    submitter_name: rec.submitter_name,
    platform: rec.platform === 'reels' ? 'reels' : 'tiktok',
    source_url: rec.source_url,
    source_key: rec.source_key,
    sharein_url: rec.sharein_url,
    likes: Number(rec.likes) || 0,
    comments: Number(rec.comments) || 0,
    metrics_source: rec.metrics_source === 'api' ? 'api' : 'manual',
    organic_declared: toBool(rec.organic_declared),
    screenshot_url: rec.screenshot_url,
    status,
    reject_reason: rec.reject_reason,
    reviewed_by: rec.reviewed_by,
    reviewed_at: rec.reviewed_at,
    needs_review: toBool(rec.needs_review ?? ''),
    whatsapp: rec.whatsapp ?? '',
    program: channel(rec.program),
  }
}

function toRecord(s: Submission): Record<string, Cell> {
  return {
    id: s.id,
    created_at: s.created_at,
    period_id: s.period_id,
    submitter_name: s.submitter_name,
    platform: s.platform,
    source_url: s.source_url,
    source_key: s.source_key,
    sharein_url: s.sharein_url,
    likes: s.likes,
    comments: s.comments,
    metrics_source: s.metrics_source,
    organic_declared: s.organic_declared,
    screenshot_url: s.screenshot_url,
    status: s.status,
    reject_reason: s.reject_reason,
    reviewed_by: s.reviewed_by,
    reviewed_at: s.reviewed_at,
    needs_review: s.needs_review,
    whatsapp: s.whatsapp,
    program: s.program,
  }
}

let lastHeader: string[] | null = null

export async function listSubmissionsFresh(): Promise<StoredSubmission[]> {
  const { header, rows } = await getStore().read('submissions')
  lastHeader = header
  return rows.map((r, i) => fromRecord(rowToRecord(header, r), i)).filter((s) => s.id)
}

export function listSubmissionsCached(): Promise<StoredSubmission[]> {
  return cached('submissions', listSubmissionsFresh)
}

/**
 * For admin lists: at most 15 s old (and cleared by every write from this server), so switching
 * filters or tabs is instant instead of a fresh ~2.5 s spreadsheet read each time.
 */
export function listSubmissionsRecent(): Promise<StoredSubmission[]> {
  return cached('submissions:recent', listSubmissionsFresh, 15_000)
}

async function header() {
  if (!lastHeader) await listSubmissionsFresh()
  lastHeader = await writeHeader(getStore(), 'submissions', lastHeader)
  return lastHeader
}

function channel(v: string | undefined): Channel {
  const c = String(v ?? '').trim().toLowerCase()
  return c === 'pelatihan' || c === 'duta' ? c : 'golden'
}

export async function appendSubmissions(items: Submission[]): Promise<void> {
  const h = await header()
  await getStore().append('submissions', items.map((s) => recordToRow(h, toRecord(s))))
  invalidate('submissions')
  invalidate('progress')
  invalidate('program:')
}

/** Appends and returns the fresh list in one round trip (used to settle races right after writing). */
export async function appendSubmissionsAndList(items: Submission[]): Promise<StoredSubmission[]> {
  const h = await header()
  const data = await appendThenRead(getStore(), 'submissions', items.map((s) => recordToRow(h, toRecord(s))))
  invalidate('submissions')
  invalidate('progress')
  invalidate('program:')
  lastHeader = data.header
  return data.rows.map((r, i) => fromRecord(rowToRecord(data.header, r), i)).filter((s) => s.id)
}

export async function updateSubmissions(items: StoredSubmission[]): Promise<void> {
  const h = await header()
  await getStore().update(
    'submissions',
    items.map((s) => ({ index: s._index, row: recordToRow(h, toRecord(s)) })),
  )
  invalidate('submissions')
  invalidate('progress')
  invalidate('program:')
}

/**
 * Sets review columns on submissions by id. On Apps Script this is ONE request (find rows by id,
 * write, and log to audit_log together) instead of read + update + one append per audit row.
 * Returns null when the store has no patch support, so the caller falls back to read + update.
 */
export async function patchSubmissions(
  changes: { id: string; values: Partial<Pick<Submission, 'status' | 'reject_reason' | 'reviewed_by' | 'reviewed_at'>> }[],
  log: { actor: string; action: string },
): Promise<StoredSubmission[] | null> {
  const store = getStore()
  if (!store.patch) return null
  let r: PatchResult
  try {
    r = await store.patch('submissions', {
      key: 'id',
      patches: changes.map((c) => ({ id: c.id, values: c.values as Record<string, Cell> })),
      skip: { status: ['void'] },
      log: { table: 'audit_log', actor: log.actor, action: log.action, time: new Date().toISOString() },
    })
  } catch (e) {
    // An Apps Script deployment older than the patch op: use the slower read + update path.
    if (String((e as Error).message).includes('aksi tidak dikenal')) return null
    throw e
  }
  invalidate('submissions')
  invalidate('progress')
  invalidate('program:')
  return r.items.map((it) => fromRecord(it.record, it.index))
}

export function isCollected(s: Submission): boolean {
  return s.status === 'pending' || s.status === 'approved'
}

/** Links counted as collected for a platform in a program (pending + approved). */
export function countCollected(all: Submission[], platform: Platform, program: Channel = 'golden'): number {
  return all.filter((s) => s.program === program && s.platform === platform && isCollected(s)).length
}

/** Each program collects its own links: the same video may count once per program. */
export function findDuplicate(all: Submission[], sourceKey: string, program: Channel = 'golden'): Submission | null {
  return all.find((s) => s.program === program && s.source_key === sourceKey && s.status !== 'void') ?? null
}
