import { beforeEach, describe, expect, it } from 'vitest'
import { createApiKey, listApiKeys, revokeApiKey, verifyApiKey } from '@/lib/api-key-service'
import { invalidate } from '@/lib/cache'
import { findGolden, goldenSummary, goldenListSchema, listGolden, selectGolden } from '@/lib/golden-api'
import { getStore, setStore } from '@/lib/repo'
import { LocalStore } from '@/lib/repo/memory-store'
import { createSubmission, type SubmissionInput } from '@/lib/service'
import type { Submission } from '@/lib/types'

const input = (n: number, over: Partial<SubmissionInput> = {}): SubmissionInput => ({
  submitter_name: 'Rina', whatsapp: '081234567890', platform: 'tiktok',
  source_url: `https://www.tiktok.com/@a/video/74000000000000${String(n).padStart(5, '0')}`, sharein_url: 'https://sharein.id/c/x',
  likes: 120000, comments: 6000, organic_declared: true, checked_declared: true, has_screenshot: false, metrics_source: 'manual', program: 'golden', ...over,
})

beforeEach(() => {
  setStore(new LocalStore(null))
  invalidate()
})

describe('API keys', () => {
  it('shows the key once, stores only a hash, and revocation takes effect', async () => {
    const { key, item } = await createApiKey('Sistem A', 'owner@x.id')
    expect(key).toMatch(/^si_live_[\w-]{32}$/)
    expect(item).not.toHaveProperty('key_hash')
    expect(JSON.stringify((await getStore().read('api_keys')).rows)).not.toContain(key)
    expect((await verifyApiKey(key))?.name).toBe('Sistem A')
    expect(await verifyApiKey('si_live_salah')).toBeNull()
    expect(await verifyApiKey('')).toBeNull()
    expect(JSON.stringify(await listApiKeys())).not.toContain('key_hash')
    expect(await revokeApiKey(item.id, 'owner@x.id')).toBe(true)
    expect(await verifyApiKey(key)).toBeNull()
    expect(await revokeApiKey(item.id, 'owner@x.id')).toBe(false)
  })
})

describe('Golden Ticket API data', () => {
  it('lists, filters and pages submissions without internal rows', async () => {
    await createSubmission(input(1))
    await createSubmission(input(2, { platform: 'reels', source_url: 'https://www.instagram.com/reel/C1aBcD2eFgH/', comments: 4000 }))
    await createSubmission(input(3))
    const all = await listGolden(goldenListSchema.parse({}))
    expect(all).toMatchObject({ total: 3, next_offset: null })
    expect(all.items[0]).toMatchObject({ status: 'pending', whatsapp: '6281234567890', likes: 120000 })
    expect(Object.keys(all.items[0])).not.toContain('_index')
    expect((await listGolden(goldenListSchema.parse({ platform: 'reels' }))).total).toBe(1)
    const p1 = await listGolden(goldenListSchema.parse({ limit: '2' }))
    expect(p1).toMatchObject({ next_offset: 2 })
    expect((await listGolden(goldenListSchema.parse({ limit: '2', offset: '2' }))).items).toHaveLength(1)
    expect(await findGolden(all.items[0].id)).toMatchObject({ id: all.items[0].id })
    expect(await findGolden('sub_tidak_ada')).toBeNull()
  })

  it('updated_since catches later reviews, void rows stay hidden', () => {
    const base = { period_id: 'p', submitter_name: 'A', whatsapp: '', platform: 'tiktok', source_url: '', source_key: '', sharein_url: '', likes: 1, comments: 1, metrics_source: 'manual', organic_declared: true, screenshot_url: '', reject_reason: '', reviewed_by: '', needs_review: false, program: 'golden' } as const
    const rows: Submission[] = [
      { ...base, id: 'a', created_at: '2026-11-01T00:00:00Z', status: 'approved', reviewed_at: '2026-11-08T00:00:00Z' },
      { ...base, id: 'b', created_at: '2026-11-02T00:00:00Z', status: 'pending', reviewed_at: '' },
      { ...base, id: 'c', created_at: '2026-11-09T00:00:00Z', status: 'void', reviewed_at: '' },
    ]
    const r = selectGolden(rows, goldenListSchema.parse({ updated_since: '2026-11-05T00:00:00Z' }))
    expect(r.items.map((i) => i.id)).toEqual(['a'])
    expect(goldenListSchema.safeParse({ updated_since: 'kemarin' }).success).toBe(false)
    expect(goldenListSchema.safeParse({ limit: '501' }).success).toBe(false)
  })

  it('summary reports the running prize, collected links and counts', async () => {
    await createSubmission(input(1))
    invalidate()
    const r = await goldenSummary(Date.parse('2026-11-20T12:00:00Z'))
    expect(r.prize.current).toBeGreaterThan(2_000_000)
    expect(r.prize.current).toBeLessThan(5_000_000)
    expect(r.collected).toEqual({ total: 1, tiktok: 1, reels: 0 })
    expect(r.counts).toMatchObject({ total: 1, pending: 1 })
    expect(r.auto_approve).toBe(false)
  })
})
