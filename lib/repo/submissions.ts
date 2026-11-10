import { cached, invalidate } from '../cache'
import type { Platform, Submission, SubmissionStatus } from '../types'
import { getStore } from './index'
import { normalizeStatus } from '../status'
import { appendThenRead, recordToRow, rowToRecord, type Cell } from './store'

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

async function header() {
  if (!lastHeader) await listSubmissionsFresh()
  return lastHeader!
}

export async function appendSubmissions(items: Submission[]): Promise<void> {
  const h = await header()
  await getStore().append('submissions', items.map((s) => recordToRow(h, toRecord(s))))
  invalidate('submissions')
  invalidate('progress')
}

/** Appends and returns the fresh list in one round trip (used to settle races right after writing). */
export async function appendSubmissionsAndList(items: Submission[]): Promise<StoredSubmission[]> {
  const h = await header()
  const data = await appendThenRead(getStore(), 'submissions', items.map((s) => recordToRow(h, toRecord(s))))
  invalidate('submissions')
  invalidate('progress')
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
}

/** Links counted as collected for a platform (pending + approved). */
export function countCollected(all: Submission[], platform: Platform): number {
  return all.filter((s) => s.platform === platform && (s.status === 'pending' || s.status === 'approved')).length
}

export function findDuplicate(all: Submission[], sourceKey: string): Submission | null {
  return all.find((s) => s.source_key === sourceKey && s.status !== 'void') ?? null
}
