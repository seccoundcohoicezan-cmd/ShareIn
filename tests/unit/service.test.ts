import { beforeEach, describe, expect, it } from 'vitest'
import { applyFilters, review, toCsv } from '@/lib/admin-service'
import { invalidate } from '@/lib/cache'
import { setStore } from '@/lib/repo'
import { LocalStore } from '@/lib/repo/memory-store'
import { getSettingsFresh, saveSettings } from '@/lib/repo/settings'
import { listSubmissionsFresh } from '@/lib/repo/submissions'
import { SheetsStore, type SheetsClient } from '@/lib/repo/sheets-store'
import type { Row, TableName, TableStore } from '@/lib/repo/store'
import { checkBatch, checkSubmission, createBatch, createSubmission, batchSchema, collectedFeed, getProgress, type SubmissionInput } from '@/lib/service'
import { FakeSheets } from './fake-sheets'
import { AppsScriptStore } from '@/lib/repo/apps-script-store'
import { createAppsScriptSim } from './apps-script-sim'

let n = 0
function input(over: Partial<SubmissionInput> = {}): SubmissionInput {
  n++
  return {
    submitter_name: 'Rina',
    whatsapp: '081234567890',
    platform: 'tiktok',
    source_url: `https://www.tiktok.com/@akun/video/73000000000000${String(n).padStart(5, '0')}?is_from_webapp=1`,
    sharein_url: 'https://sharein.id/c/abc123',
    likes: '120.000',
    comments: 6200,
    organic_declared: true,
    checked_declared: true,
    has_screenshot: false,
    metrics_source: 'manual',
    ...over,
  }
}

describe.each([
  ['memory', () => new LocalStore(null) as TableStore],
  ['sheets (fake API)', () => new SheetsStore(new FakeSheets().client as unknown as SheetsClient, 'sheet-id') as TableStore],
  ['Apps Script (real Code.js)', () => new AppsScriptStore('https://sim', 'k'.repeat(40), createAppsScriptSim('k'.repeat(40)).poster) as TableStore],
])('submission flow on %s store', (_name, make) => {
  beforeEach(() => {
    setStore(make())
    invalidate()
  })

  it('saves a valid submission as pending with normalized URL', async () => {
    const r = await createSubmission(input())
    expect(r.ok).toBe(true)
    const [row] = await listSubmissionsFresh()
    expect(row.status).toBe('pending')
    expect(row.source_url).not.toContain('is_from_webapp')
    expect(row.likes).toBe(120000)
    expect(row.source_key).toMatch(/^tt:/)
  })

  it('rejects the same link twice as duplicate (any period)', async () => {
    const i = input()
    expect((await createSubmission(i)).ok).toBe(true)
    const s = await getSettingsFresh()
    await saveSettings({ ...s, period_id: 'next-period' })
    const again = await createSubmission({ ...i, submitter_name: 'Budi', source_url: i.source_url.split('?')[0] + '?utm_source=wa' })
    expect(again.ok).toBe(false)
    expect(!again.ok && again.checks.map((c) => c.id)).toContain('not_duplicate')
  })

  it('no target: people submitting at once all get in, far beyond the old limits', async () => {
    const results = await Promise.all(Array.from({ length: 30 }, (_, i) => createSubmission(input({ submitter_name: `Orang ${i}` }))))
    expect(results.every((r) => r.ok)).toBe(true)
    expect((await getProgress()).progress.find((p) => p.platform === 'tiktok')).toMatchObject({ used: 30 })
  })

  it('two people submitting the same link at once: only one gets in', async () => {
    const i = input()
    const [a, b] = await Promise.all([createSubmission(i), createSubmission({ ...i, submitter_name: 'Budi' })])
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
  })

  it('closed period blocks check and submit', async () => {
    const s = await getSettingsFresh()
    await saveSettings({ ...s, period_open: false })
    expect((await checkSubmission(input())).checks[0]).toMatchObject({ id: 'period_open', pass: false })
    expect((await createSubmission(input())).ok).toBe(false)
  })

  it('batch: up to 10 saved in one go with the same identity', async () => {
    const items = Array.from({ length: 10 }, () => input())
    const r = await createBatch(items)
    expect(r.ok).toBe(true)
    expect(r.ok && r.results.every((x) => x.ok)).toBe(true)
    expect(await listSubmissionsFresh()).toHaveLength(10)
    expect(batchSchema.safeParse({ submitter_name: 'Rina', whatsapp: '081234567890', items: Array.from({ length: 11 }, () => ({ platform: 'tiktok', source_url: 'x' })) }).success).toBe(false)
    expect(batchSchema.safeParse({ submitter_name: 'Rina', whatsapp: '081234567890', items: [] }).success).toBe(false)
  })

  it('batch: one bad link means nothing is saved, and each item reports its own problem', async () => {
    const good = input()
    const r = await createBatch([good, input({ source_url: 'https://www.instagram.com/p/C1aBcD2eFgH/' }), input({ likes: 5 })])
    expect(r.ok).toBe(false)
    if (r.ok) throw new Error('expected failure')
    expect(r.items.map((i) => i.ok)).toEqual([true, false, false])
    expect(r.items[1].checks.find((c) => c.id === 'url_valid')?.message).toContain('instagram.com/reel/')
    expect(r.items[2].checks.find((c) => c.id === 'min_like')?.pass).toBe(false)
    expect(await listSubmissionsFresh()).toHaveLength(0)
  })

  it('batch: same link twice in the list is refused, platform comes from each link', async () => {
    const a = input()
    const reel = input({ platform: 'tiktok', source_url: 'https://www.instagram.com/reel/DeDMIOTB2WD/?utm_source=ig_web_copy_link&dlrf=NTc4MTIwNjQ2YQ==', comments: 3000 })
    const dup = await checkBatch([a, { ...a, source_url: a.source_url.split('?')[0] }])
    expect(dup.items[1].checks.find((c) => c.id === 'not_duplicate')?.message).toBe('Link ini sama dengan konten nomor 1 di daftar ini.')
    const r = await createBatch([a, reel])
    expect(r.ok).toBe(true)
    expect((await listSubmissionsFresh()).map((s) => s.platform)).toEqual(['tiktok', 'reels'])
  })

  it('auto-approve on: valid submission is approved by the system, invalid is still refused', async () => {
    const s = await getSettingsFresh()
    await saveSettings({ ...s, auto_approve_golden: true })
    const ok = await createSubmission(input())
    expect(ok.ok && ok.submission).toMatchObject({ status: 'approved', reviewed_by: 'otomatis' })
    expect(ok.ok && ok.submission.reviewed_at).not.toBe('')
    expect((await createSubmission(input({ likes: 99999 }))).ok).toBe(false)
    expect((await listSubmissionsFresh()).length).toBe(1)
  })

  it('public feed: newest first, shortened names, no WhatsApp, rejected links hidden', async () => {
    const a = await createSubmission(input({ submitter_name: 'Rina Utami Sari' }))
    const b = await createSubmission(input({ submitter_name: 'Budi' }))
    const c = await createSubmission(input({ submitter_name: 'Citra', platform: 'reels', source_url: 'https://www.instagram.com/reel/DeDMIOTB2WD/', comments: 3000 }))
    if (!a.ok || !b.ok || !c.ok) throw new Error('expected ok')
    await review([b.submission.id], 'reject', 'Bukan dari FYP', 'admin@x.id')
    const feed = await collectedFeed()
    expect(feed).toMatchObject({ total: 2, tiktok: 1, reels: 1 })
    expect(feed.items.map((i) => i.name).sort()).toEqual(['Citra', 'Rina U.'])
    expect(JSON.stringify(feed)).not.toContain('628')
    expect(JSON.stringify(feed)).not.toContain('Utami')
    expect((await collectedFeed(1, 12)).items).toHaveLength(1)
  })
})

describe('cross-instance race (append-then-verify)', () => {
  // Simulates another server instance appending a row between our read and our append.
  class RacingStore extends LocalStore {
    raced = false
    async append(table: TableName, rows: Row[]) {
      if (table === 'submissions' && !this.raced) {
        this.raced = true
        const other = [...rows[0]]
        other[0] = 'sub_other'
        other[3] = 'Instance B'
        await super.append(table, [other])
      }
      return super.append(table, rows)
    }
  }
  beforeEach(() => invalidate())

  it('voids our row when the competing instance took the same content first', async () => {
    setStore(new RacingStore(null))
    const r = await createSubmission(input())
    expect(r.ok).toBe(false)
    expect(!r.ok && r.checks[0].id).toBe('not_duplicate')
    const rows = await listSubmissionsFresh()
    expect(rows.map((s) => s.status)).toEqual(['pending', 'void'])
  })
})

describe('sheets store details', () => {
  it('creates tabs + headers, seeds settings, and maps columns by header name', async () => {
    const fake = new FakeSheets()
    fake.tabs.set('submissions', [['status', 'id', 'custom_note']])
    setStore(new SheetsStore(fake.client as unknown as SheetsClient, 'x'))
    invalidate()
    const s = await getSettingsFresh()
    expect(s.min_like_tiktok).toBe(100000)
    expect(Array.from(fake.tabs.keys()).sort()).toEqual(['admins', 'api_keys', 'audit_log', 'participants', 'settings', 'submissions', 'task_submissions', 'tasks'])
    expect(fake.tabs.get('settings')![0]).toEqual(['key', 'value'])
    expect(fake.tabs.get('settings')!.length).toBe(1 + 18)
    const header = fake.tabs.get('submissions')![0] as string[]
    expect(header.slice(0, 3)).toEqual(['status', 'id', 'custom_note'])
    expect(header).toContain('source_key')
    await createSubmission(input())
    const row = fake.tabs.get('submissions')![1]
    expect(row[0]).toBe('pending')
    expect(String(row[1])).toMatch(/^sub_/)
    expect(row[2]).toBe('')
  })
})

describe('admin helpers', () => {
  it('filters and escapes CSV formulas', () => {
    const base = { id: 'sub_1', created_at: '2026-11-05T00:00:00Z', period_id: 'p1', submitter_name: '=HYPERLINK("x")', platform: 'tiktok', source_url: 'https://a', source_key: 'tt:1', sharein_url: 'https://s', likes: 1, comments: 2, metrics_source: 'manual', organic_declared: true, screenshot_url: '', status: 'pending', reject_reason: '', reviewed_by: '', reviewed_at: '', needs_review: false, whatsapp: '' } as const
    const items = [base, { ...base, id: 'sub_2', status: 'void' as const }, { ...base, id: 'sub_3', platform: 'reels' as const }]
    expect(applyFilters(items, { status: 'all', platform: 'tiktok', period: '', name: '' }).map((s) => s.id)).toEqual(['sub_1'])
    const csv = toCsv([base])
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`)
  })
})
