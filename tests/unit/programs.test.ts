import { beforeEach, describe, expect, it } from 'vitest'
import { invalidate } from '@/lib/cache'
import { participantFromSso } from '@/lib/participant-service'
import { setStore, getStore } from '@/lib/repo'
import { AppsScriptStore } from '@/lib/repo/apps-script-store'
import { LocalStore } from '@/lib/repo/memory-store'
import { participantsTable } from '@/lib/repo/programs'
import { saveSettings, getSettingsFresh } from '@/lib/repo/settings'
import { listSubmissionsFresh } from '@/lib/repo/submissions'
import type { TableStore } from '@/lib/repo/store'
import { collectedFeed, createBatch, getProgress, type SubmissionInput } from '@/lib/service'
import type { Channel } from '@/lib/types'
import { inWeek, weekOf } from '@/lib/week'
import { programSummary, progressFor, recap, summarize } from '@/lib/progress'
import { deleteSpins, draw, publicWinners, resetRound, wheel } from '@/lib/spin'
import { review } from '@/lib/admin-service'
import { createAppsScriptSim } from './apps-script-sim'

const SECRET = 'p'.repeat(40)
let n = 0
function link(program: Channel, wa = '081234567890', name = 'Rina Utami', platform: 'tiktok' | 'reels' = 'tiktok'): SubmissionInput {
  n++
  return {
    submitter_name: name, whatsapp: wa, platform,
    source_url: platform === 'tiktok' ? `https://www.tiktok.com/@a/video/75000000000000${String(n).padStart(5, '0')}` : `https://www.instagram.com/reel/Reel${String(n).padStart(6, '0')}/`,
    sharein_url: '', likes: null, comments: null, organic_declared: true, checked_declared: true, has_screenshot: false, metrics_source: 'manual', program,
  }
}

describe('week boundaries (WIB, Monday–Sunday)', () => {
  it('Sunday 23:59 WIB is still the same week; Monday 00:00 WIB starts a new one', () => {
    const sunday = new Date('2026-11-15T16:59:00Z') // Sun 23:59 WIB
    const monday = new Date('2026-11-15T17:00:00Z') // Mon 00:00 WIB
    expect(weekOf(sunday).start).toBe('2026-11-08T17:00:00.000Z')
    expect(weekOf(monday).start).toBe('2026-11-15T17:00:00.000Z')
    expect(inWeek('2026-11-15T16:59:59Z', weekOf(sunday))).toBe(true)
    expect(inWeek('2026-11-15T17:00:00Z', weekOf(sunday))).toBe(false)
  })
})

describe.each([
  ['memory', () => new LocalStore(null) as TableStore],
  ['Apps Script (real Code.js)', () => new AppsScriptStore('https://sim', SECRET, createAppsScriptSim(SECRET).poster) as TableStore],
])('Pelatihan & Duta link system on %s', (_n, make) => {
  beforeEach(() => {
    setStore(make())
    invalidate()
  })

  it('links are kept per program: same video may go to Duta and Golden, but not twice to Duta', async () => {
    const duta = link('duta')
    const r1 = await createBatch([duta])
    expect(r1.ok).toBe(true)
    const again = await createBatch([{ ...duta }])
    expect(again.ok).toBe(false)
    const golden = await createBatch([{ ...duta, program: 'golden' }])
    expect(golden.ok).toBe(true)
    const all = await listSubmissionsFresh()
    expect(all.map((s) => s.program).sort()).toEqual(['duta', 'golden'])
    // Golden numbers and feeds only show Golden links.
    expect((await getProgress()).progress.find((p) => p.platform === 'tiktok')!.used).toBe(1)
    expect((await collectedFeed(0, 12, 'duta')).total).toBe(1)
    expect((await collectedFeed(0, 12, 'pelatihan')).total).toBe(0)
  })

  it('closing a program and auto-approve follow that program’s own settings', async () => {
    const s = await getSettingsFresh()
    await saveSettings({ ...s, duta_open: false, auto_approve_pelatihan: true })
    const closed = await createBatch([link('duta')])
    expect(closed.ok).toBe(false)
    if (!closed.ok) expect(closed.items[0].checks.find((c) => c.id === 'period_open')?.pass).toBe(false)
    const auto = await createBatch([link('pelatihan')])
    expect(auto.ok && auto.results[0].ok && auto.results[0].submission.status).toBe('approved')
    const golden = await createBatch([link('golden')])
    expect(golden.ok && golden.results[0].ok && golden.results[0].submission.status).toBe('pending')
  })

  it('Duta: N TikTok + N Reels every week (waiting + approved), recap with unmet first', async () => {
    const s = await getSettingsFresh()
    await saveSettings({ ...s, duta_week_tiktok: 2, duta_week_reels: 1 })
    await createBatch([link('duta'), link('duta'), link('duta', undefined, undefined, 'reels')])
    await createBatch([link('duta', '081298765432', 'Budi'), link('duta', '081298765432', 'Budi')])
    await createBatch([link('pelatihan', '081298765432', 'Budi')])
    const [all, settings] = await Promise.all([listSubmissionsFresh(), getSettingsFresh()])
    expect(progressFor(all, settings, 'duta', '6281234567890')).toMatchObject({ mode: 'weekly', tiktok: 2, reels: 1, met: true })
    // Two TikTok but no Reels: not met.
    expect(progressFor(all, settings, 'duta', '6281298765432')).toMatchObject({ tiktok: 2, reels: 0, met: false })
    // A new week starts from zero.
    const nextWeek = new Date(Date.now() + 7 * 86_400_000)
    expect(progressFor(all, settings, 'duta', '6281234567890', nextWeek)).toMatchObject({ tiktok: 0, reels: 0, met: false })
    invalidate()
    expect(await programSummary('duta')).toMatchObject({ mode: 'weekly', target: { tiktok: 2, reels: 1 }, active: 2, met: 1, links: 5 })
    expect(summarize(all, settings, 'pelatihan')).toMatchObject({ mode: 'draw', active: 1, met: 0 })
    const { ensureParticipant } = await import('@/lib/participant-service')
    await ensureParticipant('Rina Utami', '081234567890')
    await ensureParticipant('Budi', '081298765432')
    await ensureParticipant('Sari', '081311112222')
    const r = await recap('duta')
    expect(r.rows.map((x) => [x.name, x.tiktok, x.reels, x.met])).toEqual([['Budi', 2, 0, false], ['Rina Utami', 2, 1, true]])
    expect((await recap('duta', true)).rows[0].name).toBe('Sari')
  })

  it('Pelatihan: approved 5 TikTok + 5 Reels → on the spin wheel; draw, history, delete, reset', async () => {
    const s = await getSettingsFresh()
    await saveSettings({ ...s, pelatihan_need_tiktok: 2, pelatihan_need_reels: 1 })
    const { ensureParticipant } = await import('@/lib/participant-service')
    for (const [wa, name] of [['081234567890', 'Rina Utami'], ['081298765432', 'Budi Santoso']]) {
      await ensureParticipant(name, wa)
      await createBatch([link('pelatihan', wa, name), link('pelatihan', wa, name), link('pelatihan', wa, name, 'reels')])
    }
    // Waiting links do not count yet.
    expect((await wheel('pelatihan')).entries).toHaveLength(0)
    expect((await draw('pelatihan', '', 'o'))).toEqual({ error: expect.stringContaining('Belum ada') })
    const all = await listSubmissionsFresh()
    await review(all.map((x) => x.id), 'approve', '', 'o')
    invalidate()
    const w = await wheel('pelatihan')
    expect(w.entries.map((e) => e.name).sort()).toEqual(['Budi Santoso', 'Rina Utami'])

    const first = await draw('pelatihan', 'Voucher', 'owner@x')
    if ('error' in first) throw new Error(first.error)
    expect(first.entries).toHaveLength(2)
    expect(first.spin).toMatchObject({ prize: 'Voucher', entries: 2, drawn_by: 'owner@x' })
    // The winner leaves the wheel for this round.
    const after = await wheel('pelatihan')
    expect(after.entries.map((e) => e.name)).toEqual(w.entries.map((e) => e.name).filter((x) => x !== first.spin.name))
    expect(after.history).toHaveLength(1)
    expect((await publicWinners('pelatihan'))[0]).toMatchObject({ prize: 'Voucher', name: expect.stringMatching(/^(Rina U\.|Budi S\.)$/) })

    // Deleting the history puts the winner back on the wheel.
    expect(await deleteSpins([first.spin.id], 'owner@x')).toBe(1)
    expect((await wheel('pelatihan')).entries).toHaveLength(2)
    expect(await publicWinners('pelatihan')).toHaveLength(0)

    // Reset: a new round, everyone collects again from zero.
    await draw('pelatihan', '', 'owner@x')
    await resetRound('owner@x')
    invalidate()
    const fresh = await wheel('pelatihan')
    expect(fresh.round).not.toBe('')
    expect(fresh.entries).toHaveLength(0)
    expect(fresh.history).toHaveLength(1) // history kept
    const [subs, settings] = await Promise.all([listSubmissionsFresh(), getSettingsFresh()])
    expect(progressFor(subs, settings, 'pelatihan', '6281234567890')).toMatchObject({ tiktok: 0, reels: 0, met: false })
  })

  it('turning auto-approve on approves links already waiting in that program only', async () => {
    const { approveWaiting } = await import('@/lib/admin-service')
    await createBatch([link('pelatihan'), link('pelatihan', undefined, undefined, 'reels')])
    await createBatch([link('duta')])
    const before = await getSettingsFresh()
    const after = { ...before, auto_approve_pelatihan: true }
    await saveSettings(after)
    expect(await approveWaiting(before, after)).toBe(2)
    const all = await listSubmissionsFresh()
    expect(all.map((x) => [x.program, x.status, x.reviewed_by]).sort()).toEqual([['duta', 'pending', ''], ['pelatihan', 'approved', 'otomatis'], ['pelatihan', 'approved', 'otomatis']])
    // Already on → nothing more to do; new links are approved on arrival.
    expect(await approveWaiting(after, after)).toBe(0)
    const r = await createBatch([link('pelatihan')])
    expect(r.ok && r.results[0].ok && r.results[0].submission.status).toBe('approved')
  })

  it('MyTopstar sign-in creates a participant once and links an existing WhatsApp account', async () => {
    const { ensureParticipant } = await import('@/lib/participant-service')
    const old = await ensureParticipant('Rina Utami', '081234567890')
    const linked = await participantFromSso({ sub: 'mt-1', name: 'Rina U.', phone: '+6281234567890' })
    expect(linked!.token).toBe(old!.token)
    expect((await participantsTable.list()).find((p) => p.token === old!.token)!.sso_sub).toBe('mt-1')
    const fresh = await participantFromSso({ sub: 'mt-2', name: 'Budi', phone: '+6281298765432' })
    expect(fresh!.whatsapp).toBe('6281298765432')
    // Same MyTopstar account again → same participant, even if the phone changed.
    expect((await participantFromSso({ sub: 'mt-2', name: 'Budi', phone: '+6281300000000' }))!.token).toBe(fresh!.token)
    expect(await participantFromSso({ sub: 'mt-3', name: 'Tanpa HP', phone: '' })).toBeNull()
    expect(await participantsTable.list()).toHaveLength(2)
  })
})

describe('older sheets', () => {
  it('a submissions tab without the program column gets it before the first write (no Duta link saved as Golden)', async () => {
    const sim = createAppsScriptSim(SECRET)
    const store = new AppsScriptStore('https://sim', SECRET, sim.poster)
    setStore(store)
    invalidate()
    await store.ensureSchema()
    // Simulate the live sheet from before this change: header without "program".
    const old = (await store.read('submissions')).header.filter((h) => h !== 'program')
    sim.setHeader('submissions', old)
    const fresh = new AppsScriptStore('https://sim', SECRET, sim.poster)
    setStore(fresh)
    invalidate()
    await listSubmissionsFresh()
    const r = await createBatch([link('duta')])
    expect(r.ok).toBe(true)
    invalidate()
    const all = await listSubmissionsFresh()
    expect(all[0].program).toBe('duta')
    expect(getStore()).toBe(fresh)
  })
})
