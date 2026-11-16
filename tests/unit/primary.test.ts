import { mkdtempSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { invalidate } from '@/lib/cache'
import { primaryPoster } from '@/lib/primary/client'
import { PrimaryEngine, PRIMARY_MARKER } from '@/lib/primary/engine'
import { setStore } from '@/lib/repo'
import { AppsScriptStore } from '@/lib/repo/apps-script-store'
import { TABLES, type TableStore } from '@/lib/repo/store'
import { getSettingsFresh, saveSettings } from '@/lib/repo/settings'
import { listSubmissionsFresh } from '@/lib/repo/submissions'
import { review } from '@/lib/admin-service'
import { createBatch } from '@/lib/service'
import { createAppsScriptSim } from './apps-script-sim'

const SECRET = 's'.repeat(40)
let n = 0
function input(name: string, wa: string, platform: 'tiktok' | 'reels' = 'tiktok') {
  n++
  return [{
    submitter_name: name, whatsapp: wa, platform, program: 'pelatihan' as const,
    source_url: platform === 'tiktok' ? `https://www.tiktok.com/@a/video/75100000000000${String(n).padStart(5, '0')}` : `https://www.instagram.com/reel/Prim${String(n).padStart(6, '0')}/`,
    sharein_url: '', likes: null, comments: null, organic_declared: true, checked_declared: true, has_screenshot: false, metrics_source: 'manual' as const,
  }]
}
const tmp = () => path.join(mkdtempSync(path.join(os.tmpdir(), 'primary-')), 'primary.json')

function sheetRows(sim: ReturnType<typeof createAppsScriptSim>, t: string) {
  return sim.sheets.get(t)!.grid.filter((r) => r.some((c) => c !== ''))
}

async function setup(file: string | null = null, opts: { failFirst?: boolean } = {}) {
  const sim = createAppsScriptSim(SECRET)
  // A sheet that already has data from before the switch.
  await sim.poster('', JSON.stringify({ secret: SECRET, ops: [{ action: 'ensure', tables: TABLES }] }))
  await sim.poster('', JSON.stringify({ secret: SECRET, ops: [{ action: 'append', table: 'settings', rows: [['period_id', 'P1'], ['period_open', 'TRUE']] }] }))
  let calls = 0
  let fail = opts.failFirst ?? false
  const mirrorPost = async (u: string, body: string) => {
    calls++
    const ops = (JSON.parse(body).ops as { action: string }[]).map((o) => o.action)
    if (fail && ops.some((a) => a === 'append' || a === 'replace')) {
      fail = false
      throw new Error('jaringan putus')
    }
    return sim.poster(u, body)
  }
  const engine = new PrimaryEngine({ secret: SECRET, code: readFileSync('apps-script/Code.js', 'utf8'), file, mirror: { url: 'sheet', post: mirrorPost }, forwardDelayMs: 5 })
  const store = new AppsScriptStore('primary://local', SECRET, (_u, b) => engine.handle(b), { readTtlMs: 0, kind: 'primary' })
  setStore(store as TableStore)
  invalidate('')
  return { sim, engine, store, calls: () => calls }
}

afterEach(() => setStore(null))

describe('primary database with the sheet as a mirror', () => {
  it('copies the sheet once, answers locally, and forwards writes to the sheet', async () => {
    const { sim, engine, calls } = await setup()
    expect((await getSettingsFresh()).period_id).toBe('P1')
    await engine.drain() // forwards the takeover marker
    const afterBoot = calls()
    // Reads never reach the sheet.
    for (let i = 0; i < 5; i++) await getSettingsFresh()
    expect(calls()).toBe(afterBoot)

    const s = await getSettingsFresh()
    await saveSettings({ ...s, period_id: 'P2' }, { actor: 'uji' })
    const r = await createBatch(input('Rina Utami', '081234567890'), undefined, '', { name: 'Rina Utami', whatsapp: '081234567890' })
    expect('error' in r && r.error).toBeFalsy()
    await engine.drain()
    expect(engine.syncStatus().pending).toEqual([])
    for (const t of Object.keys(TABLES)) expect(sheetRows(sim, t)).toEqual((await engine.handle(JSON.stringify({ secret: SECRET, ops: [{ action: 'read', table: t }] })).then((x) => { const g = JSON.parse(x.text).results[0]; return [g.header, ...g.rows].filter((row: string[]) => row.some((c) => c !== '')) })))
    expect(sheetRows(sim, 'settings').some((row) => row[0] === PRIMARY_MARKER)).toBe(true)
    expect(sheetRows(sim, 'settings').find((row) => row[0] === 'period_id')?.[1]).toBe('P2')
  })

  it('overwrites manual sheet edits with the database (sheet = mirror), also after an update', async () => {
    const { sim, engine } = await setup()
    await getSettingsFresh()
    await engine.drain()
    sim.sheets.get('settings')!.grid.push(['diketik_manual', 'x'])
    const s = await getSettingsFresh()
    await saveSettings({ ...s, period_open: false }, { actor: 'uji' })
    await engine.drain()
    expect(sheetRows(sim, 'settings').some((row) => row[0] === 'diketik_manual')).toBe(false)
    expect(sheetRows(sim, 'settings').find((row) => row[0] === 'period_open')?.[1]).toBe('FALSE')
  })

  it('keeps writes when the sheet is unreachable and retries until it is in sync', async () => {
    const { sim, engine } = await setup(null, { failFirst: true })
    const s = await getSettingsFresh()
    await saveSettings({ ...s, period_id: 'P9' }, { actor: 'uji' })
    await engine.drain()
    expect(engine.syncStatus().lastError).toContain('jaringan putus')
    expect((await getSettingsFresh()).period_id).toBe('P9') // the web keeps working
    await engine.drain()
    expect(engine.syncStatus()).toMatchObject({ pending: [], lastError: null })
    expect(sheetRows(sim, 'settings').find((row) => row[0] === 'period_id')?.[1]).toBe('P9')
  })

  it('survives a restart from its file and re-sends everything once', async () => {
    const file = tmp()
    const a = await setup(file)
    const s = await getSettingsFresh()
    await saveSettings({ ...s, period_id: 'P5' }, { actor: 'uji' })
    await a.engine.drain()
    await a.engine.persistNow()
    const engine2 = new PrimaryEngine({ secret: SECRET, code: readFileSync('apps-script/Code.js', 'utf8'), file, mirror: { url: 'sheet', post: a.sim.poster }, forwardDelayMs: 5 })
    setStore(new AppsScriptStore('primary://local', SECRET, (_u, b) => engine2.handle(b), { readTtlMs: 0, kind: 'primary' }) as TableStore)
    invalidate('')
    expect((await getSettingsFresh()).period_id).toBe('P5')
    a.sim.sheets.get('settings')!.grid.splice(1) // sheet lost its rows meanwhile
    await engine2.drain()
    expect(sheetRows(a.sim, 'settings').find((row) => row[0] === 'period_id')?.[1]).toBe('P5')
  })

  it('reviews go through the primary in one call and reach the sheet', async () => {
    const { sim, engine } = await setup()
    await createBatch(input('Budi Santoso', '081299990000', 'reels'), undefined, '', { name: 'Budi Santoso', whatsapp: '081299990000' })
    const sub = (await listSubmissionsFresh())[0]
    expect(sub).toBeTruthy()
    await review([sub.id], 'reject', 'Duplikat', 'uji')
    await engine.drain()
    const h = sheetRows(sim, 'submissions')[0]
    const row = sheetRows(sim, 'submissions').find((r) => r[h.indexOf('id')] === sub.id)!
    expect(row[h.indexOf('status')]).toBe('rejected')
  })
})

describe('web servers switching to the primary', () => {
  const sheet = { url: 'sheet', post: async () => ({ status: 200, text: JSON.stringify({ ok: true, results: [{ header: ['key', 'value'], rows: [] }] }) }) }
  const body = JSON.stringify({ secret: SECRET, ops: [{ action: 'read', table: 'settings' }] })

  it('falls back to the sheet while the primary is not deployed yet', async () => {
    const post = primaryPoster(sheet, async () => ({ status: 404, text: 'Not found' }))
    expect(JSON.parse((await post('p', body)).text).ok).toBe(true)
  })

  it('after the takeover, never writes the sheet directly: a restarting primary looks busy', async () => {
    const marked = { url: 'sheet', post: async () => ({ status: 200, text: JSON.stringify({ ok: true, results: [{ header: ['key', 'value'], rows: [[PRIMARY_MARKER, '2026-11-16']] }] }) }) }
    const post = primaryPoster(marked, async () => ({ status: 502, text: 'Bad Gateway' }))
    const r = JSON.parse((await post('p', body)).text)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/try again/)
  })
})

describe('primary restarting', () => {
  it('a refused connection is retried as busy once the primary has taken over', async () => {
    const marked = { url: 'sheet', post: async () => ({ status: 200, text: JSON.stringify({ ok: true, results: [{ header: ['key', 'value'], rows: [[PRIMARY_MARKER, '2026-11-16']] }] }) }) }
    const post = primaryPoster(marked, async () => { throw Object.assign(new Error('connect ECONNREFUSED'), { code: 'ECONNREFUSED' }) })
    const r = JSON.parse((await post('p', JSON.stringify({ secret: SECRET, ops: [] }))).text)
    expect(r.error).toMatch(/try again/)
  })
})
