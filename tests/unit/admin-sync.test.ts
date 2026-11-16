import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/headers', () => ({ cookies: () => ({ get: () => undefined }) }))

import { authenticate, hashPassword } from '@/lib/auth'
import { adminList, filterSchema } from '@/lib/admin-service'
import { invalidate } from '@/lib/cache'
import { setStore, getStore } from '@/lib/repo'
import { listAdmins } from '@/lib/repo/admins'
import { LocalStore } from '@/lib/repo/memory-store'
import { TABLES, type TableStore } from '@/lib/repo/store'

beforeEach(async () => {
  setStore(new LocalStore(null) as TableStore)
  invalidate('')
  await getStore().ensureSchema()
})

async function appendAdmin(email: string, pw: string) {
  await getStore().append('admins', [[email, await hashPassword(pw), 'owner', 'TRUE']])
}

describe('admin login across server instances', () => {
  it('accepts an admin added after this instance cached the list (another instance wrote the sheet)', async () => {
    await appendAdmin('owner@example.com', 'owner-pass-123')
    expect((await listAdmins()).map((a) => a.email)).toEqual(['owner@example.com'])
    // Written straight to the store, as another serverless instance would, so this cache is stale.
    await appendAdmin('baru@example.com', 'baru-pass-123')
    expect(await authenticate('Baru@Example.com', 'baru-pass-123')).toEqual({ email: 'baru@example.com', role: 'owner' })
  })

  it('tolerates whitespace pasted around the password, still rejects a wrong one', async () => {
    await appendAdmin('a@example.com', 'abcdefghij12')
    expect(await authenticate('a@example.com', ' abcdefghij12\n')).not.toBeNull()
    expect(await authenticate('a@example.com', 'abcdefghij13')).toBeNull()
  })
})

describe('review status counts', () => {
  it('counts every status for the program while the list is filtered, ignoring void rows', async () => {
    const h = TABLES.submissions
    const row = (id: string, status: string, program: string) => h.map((k) => ({ id, status, program, created_at: `2026-11-1${id}T00:00:00Z`, period_id: 'P', submitter_name: 'X', platform: 'tiktok' } as Record<string, string>)[k] ?? '')
    await getStore().append('submissions', [row('1', 'approved', ''), row('2', 'approved', ''), row('3', 'pending', ''), row('4', 'void', ''), row('5', 'rejected', 'pelatihan')])
    const r = await adminList(filterSchema.parse({ status: 'pending' }))
    expect(r.items.map((s) => s.id)).toEqual(['3'])
    expect(r.counts).toEqual({ all: 3, pending: 1, approved: 2, rejected: 0 })
  })
})

describe('dashboard overview', () => {
  it('counts every program (not only Golden), ignores void rows, and fills the last 7 days', async () => {
    const { dashboard } = await import('@/lib/admin-service')
    const h = TABLES.submissions
    const now = new Date().toISOString()
    const row = (id: string, status: string, program: string, platform = 'tiktok') => h.map((k) => ({ id, status, program, platform, created_at: now, period_id: 'P', submitter_name: 'X' } as Record<string, string>)[k] ?? '')
    await getStore().append('submissions', [row('1', 'approved', 'pelatihan'), row('2', 'approved', 'pelatihan', 'reels'), row('3', 'pending', 'duta'), row('4', 'void', ''), row('5', 'rejected', '')])
    invalidate('')
    const d = await dashboard()
    expect(d.totals).toMatchObject({ total: 4, approved: 2, pending: 1, rejected: 1, today: 4, tiktok: 3, reels: 1 })
    expect(d.byChannel.pelatihan).toMatchObject({ total: 2, approved: 2, tiktok: 1, reels: 1 })
    expect(d.byChannel.golden).toMatchObject({ total: 1, rejected: 1 })
    expect(d.daily).toHaveLength(7)
    expect(d.daily[6]).toMatchObject({ pelatihan: 2, duta: 1, golden: 1 })
    expect(d.recent).toHaveLength(4)
  })
})
