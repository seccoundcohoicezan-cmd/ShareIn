import { beforeEach, describe, expect, it } from 'vitest'
import { applyFilters, review, toCsv } from '@/lib/admin-service'
import { invalidate } from '@/lib/cache'
import { setStore } from '@/lib/repo'
import { LocalStore } from '@/lib/repo/memory-store'
import { getSettingsFresh, saveSettings } from '@/lib/repo/settings'
import { listSubmissionsFresh } from '@/lib/repo/submissions'
import { SheetsStore, type SheetsClient } from '@/lib/repo/sheets-store'
import type { Row, TableName, TableStore } from '@/lib/repo/store'
import { checkSubmission, createSubmission, getProgress, listMine, type SubmissionInput } from '@/lib/service'
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

async function setQty(tiktok: number, reels = 15) {
  const s = await getSettingsFresh()
  await saveSettings({ ...s, qty_tiktok: tiktok, qty_reels: reels })
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

  it('two people submitting at once with 1 slot left: only one gets in', async () => {
    await setQty(1)
    const [a, b] = await Promise.all([createSubmission(input()), createSubmission(input({ submitter_name: 'Budi' }))])
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1)
    const loser = a.ok ? b : a
    expect(!loser.ok && loser.checks[0].id).toBe('qty_available')
    expect((await listSubmissionsFresh()).filter((s) => s.status === 'pending')).toHaveLength(1)
  })

  it('admin changes QTY 20 → 25 and public progress follows', async () => {
    await setQty(20)
    await createSubmission(input())
    expect((await getProgress()).progress.find((p) => p.platform === 'tiktok')).toMatchObject({ used: 1, target: 20 })
    await setQty(25)
    expect((await getProgress()).progress.find((p) => p.platform === 'tiktok')).toMatchObject({ used: 1, target: 25 })
  })

  it('closed period blocks check and submit', async () => {
    const s = await getSettingsFresh()
    await saveSettings({ ...s, period_open: false })
    expect((await checkSubmission(input())).checks[0]).toMatchObject({ id: 'period_open', pass: false })
    expect((await createSubmission(input())).ok).toBe(false)
  })

  it('rejecting frees a QTY slot; history by name hides other people', async () => {
    await setQty(1)
    const a = await createSubmission(input())
    expect((await createSubmission(input({ submitter_name: 'Budi' }))).ok).toBe(false)
    if (!a.ok) throw new Error('expected ok')
    await review([a.submission.id], 'reject', 'Bukan dari FYP', 'admin@x.id')
    expect((await createSubmission(input({ submitter_name: 'Budi' }))).ok).toBe(true)
    const mine = await listMine('  rina ')
    expect(mine).toHaveLength(1)
    expect(mine[0]).toMatchObject({ status: 'rejected', reject_reason: 'Bukan dari FYP' })
    expect(Object.keys(mine[0])).not.toContain('submitter_name')
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

  it('voids our row when the competing instance used the last QTY slot', async () => {
    const store = new RacingStore(null)
    setStore(store)
    await setQty(1)
    // Competing row is for different content: patch its source key after the fact.
    const orig = store.append.bind(store)
    store.append = async (table, rows) => {
      if (table === 'submissions' && !store.raced) {
        store.raced = true
        const other = [...rows[0]]
        other[0] = 'sub_other'
        other[6] = 'tt:999'
        await LocalStore.prototype.append.call(store, table, [other])
      }
      return LocalStore.prototype.append.call(store, table, rows)
    }
    void orig
    const r = await createSubmission(input())
    expect(r.ok).toBe(false)
    expect(!r.ok && r.checks[0].id).toBe('qty_available')
    expect((await listSubmissionsFresh()).filter((s) => s.status === 'pending')).toHaveLength(1)
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
    expect(Array.from(fake.tabs.keys()).sort()).toEqual(['admins', 'audit_log', 'draws', 'participants', 'settings', 'submissions', 'task_submissions', 'tasks'])
    expect(fake.tabs.get('settings')![0]).toEqual(['key', 'value'])
    expect(fake.tabs.get('settings')!.length).toBe(1 + 20)
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
