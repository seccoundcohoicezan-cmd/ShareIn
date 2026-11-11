import { describe, expect, it } from 'vitest'
import { AppsScriptStore } from '@/lib/repo/apps-script-store'
import { createAppsScriptSim } from './apps-script-sim'

const SECRET = 'b'.repeat(40)

function counted() {
  const sim = createAppsScriptSim(SECRET)
  const calls: string[][] = []
  const poster = async (url: string, body: string) => {
    calls.push((JSON.parse(body).ops as { action: string }[]).map((o) => o.action))
    return sim.poster(url, body)
  }
  return { store: new AppsScriptStore('https://sim', SECRET, poster), calls }
}

describe('AppsScriptStore round trips', () => {
  it('first read on an empty sheet creates the tabs, later reads in the same tick share one request', async () => {
    const { store, calls } = counted()
    await store.read('settings')
    expect(calls.map((c) => c.join('+'))).toEqual(['read', 'ensure', 'read'])
    calls.length = 0
    AppsScriptStore.READ_TTL_MS = 0
    await Promise.all([store.read('admins'), store.read('submissions'), store.read('participants'), store.read('admins')])
    expect(calls).toEqual([['read', 'read', 'read']])
    AppsScriptStore.READ_TTL_MS = 3000
  })

  it('recent reads are reused, writes invalidate them, and writes check the schema only once', async () => {
    const { store, calls } = counted()
    await store.read('audit_log') // creates tabs
    calls.length = 0
    await store.read('audit_log')
    expect(calls).toEqual([]) // reused within TTL
    await store.append('audit_log', [['t', 'a', 'x', 'y', '', '']])
    await store.append('audit_log', [['t2', 'a', 'x', 'y', '', '']])
    // The schema check already ran when the first read created the tabs.
    expect(calls.map((c) => c.join('+'))).toEqual(['append', 'append'])
    const { rows } = await store.read('audit_log')
    expect(rows).toHaveLength(2) // fresh after write
  })
})

describe('submission speed', () => {
  it('on a warm server a returning participant submits with ONE spreadsheet request (was 3, before that 9)', async () => {
    const { invalidate } = await import('@/lib/cache')
    const { setStore } = await import('@/lib/repo')
    const { ensureParticipant, participantByToken } = await import('@/lib/participant-service')
    const { getSettings } = await import('@/lib/repo/settings')
    const { listSubmissionsCached, listSubmissionsFresh } = await import('@/lib/repo/submissions')
    const { createBatch } = await import('@/lib/service')
    const sim = createAppsScriptSim(SECRET)
    setStore(new AppsScriptStore('https://sim', SECRET, sim.poster))
    invalidate()
    const me = await ensureParticipant('A', '081234567890') // registered earlier
    const calls: string[] = []
    const store = new AppsScriptStore('https://sim', SECRET, async (u, b) => {
      calls.push((JSON.parse(b).ops as { action: string }[]).map((o) => o.action).join('+'))
      return sim.poster(u, b)
    })
    setStore(store)
    invalidate()
    await store.ensureSchema()
    await Promise.all([getSettings(), listSubmissionsCached(), participantByToken(me!.token)]) // warm caches
    calls.length = 0

    const input = { submitter_name: 'A', whatsapp: '081234567890', platform: 'tiktok' as const, source_url: 'https://www.tiktok.com/@a/video/7400000000000012345', sharein_url: '', likes: null, comments: null, organic_declared: true, checked_declared: true, has_screenshot: false, metrics_source: 'manual' as const, program: 'golden' as const }
    expect(await participantByToken(me!.token)).toMatchObject({ name: 'A' })
    const [r] = await Promise.all([createBatch([input]), ensureParticipant('A', '081234567890')])
    expect(r.ok).toBe(true)
    expect(calls).toEqual(['append'])

    // A duplicate that a stale cache let through is voided right after the append.
    const { prime } = await import('@/lib/cache')
    prime('submissions', [])
    const again = await createBatch([{ ...input }])
    expect(again.ok && again.results[0].ok).toBe(false)
    const rows = await listSubmissionsFresh()
    expect(rows.map((x) => x.status)).toEqual(['pending', 'void'])
  })
})

describe('review speed', () => {
  it('approving costs 1 spreadsheet request (was 3): rows found by id, audit written in the same request', async () => {
    const { invalidate } = await import('@/lib/cache')
    const { setStore, getStore } = await import('@/lib/repo')
    const { review } = await import('@/lib/admin-service')
    const { listSubmissionsFresh, updateSubmissions } = await import('@/lib/repo/submissions')
    const { createBatch } = await import('@/lib/service')
    const sim = createAppsScriptSim(SECRET)
    setStore(new AppsScriptStore('https://sim', SECRET, sim.poster))
    invalidate()
    const base = { submitter_name: 'A', whatsapp: '081234567890', platform: 'tiktok' as const, sharein_url: '', likes: null, comments: null, organic_declared: true, checked_declared: true, has_screenshot: false, metrics_source: 'manual' as const, program: 'golden' as const }
    await createBatch([1, 2, 3].map((i) => ({ ...base, source_url: `https://www.tiktok.com/@a/video/740000000000004000${i}` })))
    const [a, b, c] = await listSubmissionsFresh()
    await updateSubmissions([{ ...c, status: 'void' }])
    // Someone deletes a row by hand in the sheet: the id lookup still hits the right row.
    sim.sheets.get('submissions')!.grid.splice(1, 1)

    const calls: string[] = []
    setStore(new AppsScriptStore('https://sim', SECRET, async (u, body) => {
      calls.push((JSON.parse(body).ops as { action: string }[]).map((o) => o.action).join('+'))
      return sim.poster(u, body)
    }))
    invalidate()
    await listSubmissionsFresh() // the admin list was loaded before clicking
    calls.length = 0
    const out = await review([b.id, c.id, 'sub_tidak_ada'], 'reject', 'Bukan dari FYP', 'admin@x')
    expect(calls).toEqual(['patch'])
    expect(out.map((s) => [s.id, s.status, s.reject_reason, s.reviewed_by])).toEqual([[b.id, 'rejected', 'Bukan dari FYP', 'admin@x']])

    const after = await listSubmissionsFresh()
    expect(after.map((s) => [s.id, s.status])).toEqual([[b.id, 'rejected'], [c.id, 'void']])
    expect(after.find((s) => s.id === a.id)).toBeUndefined()
    const log = await getStore().read('audit_log')
    const last = log.rows[log.rows.length - 1]
    expect(last.slice(1, 4)).toEqual(['admin@x', 'submission.reject', b.id])
    expect(JSON.parse(last[4]).status).toBe('pending')
    expect(JSON.parse(last[5])).toMatchObject({ status: 'rejected', reject_reason: 'Bukan dari FYP' })
  })
})

describe('admin writes', () => {
  it('adding an admin and saving settings each write in 1 request (row + audit together)', async () => {
    const { invalidate } = await import('@/lib/cache')
    const { setStore, getStore } = await import('@/lib/repo')
    const { createAdmin } = await import('@/lib/account-service')
    const { getSettingsFresh, saveSettings, getSettings } = await import('@/lib/repo/settings')
    const { listAdmins } = await import('@/lib/repo/admins')
    const sim = createAppsScriptSim(SECRET)
    setStore(new AppsScriptStore('https://sim', SECRET, sim.poster))
    invalidate()
    await Promise.all([getSettingsFresh(), listAdmins()])
    const calls: string[] = []
    setStore(new AppsScriptStore('https://sim', SECRET, async (u, body) => {
      calls.push((JSON.parse(body).ops as { action: string }[]).map((o) => o.action).join('+'))
      return sim.poster(u, body)
    }))
    const { seedSettings } = await import('@/lib/repo/settings')
    await getStore().ensureSchema()
    await seedSettings()
    await Promise.all([getSettingsFresh(), listAdmins()]) // warmed server, page loaded
    calls.length = 0

    const r = await createAdmin({ email: 'baru@x.id', role: 'owner', password: 'sandi-panjang-123' }, 'owner@x')
    expect(r).toEqual({ admins: [{ email: 'baru@x.id', role: 'owner', active: true }] })
    expect(calls).toEqual(['append+append'])

    calls.length = 0
    const s = await getSettingsFresh()
    calls.length = 0
    await saveSettings({ ...s, duta_week_tiktok: 7 }, { actor: 'owner@x' })
    // Saving reads the sheet fresh first (row positions must be exact), then writes rows + audit at once.
    expect(calls).toEqual(['read', 'update+append'])
    expect((await getSettings()).duta_week_tiktok).toBe(7) // primed, no re-read
    expect(calls).toHaveLength(2)
    const log = await getStore().read('audit_log')
    expect(log.rows.map((x) => x[2])).toEqual(['admin.create', 'settings.update'])
  })
})

describe('300 at once', () => {
  it('concurrent senders share writes; the same link from two people is accepted once', async () => {
    const { invalidate } = await import('@/lib/cache')
    const { setStore } = await import('@/lib/repo')
    const { ensureParticipant } = await import('@/lib/participant-service')
    const { listSubmissionsFresh } = await import('@/lib/repo/submissions')
    const { participantsTable } = await import('@/lib/repo/programs')
    const { createBatch } = await import('@/lib/service')
    const sim = createAppsScriptSim(SECRET)
    const calls: string[] = []
    const store = new AppsScriptStore('https://sim', SECRET, async (u, b) => {
      calls.push((JSON.parse(b).ops as { action: string }[]).map((o) => o.action).join('+'))
      await new Promise((r) => setTimeout(r, 20)) // every call takes time, like the real Web App
      return sim.poster(u, b)
    })
    setStore(store)
    invalidate()
    await store.ensureSchema()
    calls.length = 0
    const base = { sharein_url: '', likes: null, comments: null, organic_declared: true, checked_declared: true, has_screenshot: false, metrics_source: 'manual' as const, program: 'pelatihan' as const, platform: 'tiktok' as const }
    const people = Array.from({ length: 60 }, (_, i) => ({ name: `P${i}`, wa: `0812${String(40000000 + i)}` }))
    const results = await Promise.all(
      people.flatMap((p, i) => [
        createBatch([{ ...base, submitter_name: p.name, whatsapp: p.wa, source_url: `https://www.tiktok.com/@p/video/7400000000${String(100000000 + i)}` }]),
        ensureParticipant(p.name, p.wa),
      ]),
    )
    // Two people send the very same link at the same moment.
    const same = 'https://www.tiktok.com/@same/video/7499999999999999999'
    const [a, b] = await Promise.all([
      createBatch([{ ...base, submitter_name: 'X', whatsapp: '081300000001', source_url: same }]),
      createBatch([{ ...base, submitter_name: 'Y', whatsapp: '081300000002', source_url: same }]),
    ])
    expect(results.filter((r) => r && 'ok' in r && r.ok).length).toBe(60)
    expect([a, b].filter((r) => r.ok).length).toBe(1)
    const appends = calls.filter((c) => c.includes('append')).length
    expect(appends).toBeLessThan(12) // 60 sends + 60 registrations + 2, not 122 writes
    const rows = await listSubmissionsFresh()
    expect(rows.filter((r) => r.status !== 'void')).toHaveLength(61)
    expect(new Set(rows.filter((r) => r.status !== 'void').map((r) => r.source_key)).size).toBe(61)
    expect(await participantsTable.list()).toHaveLength(60)
  })
})

describe('settings under concurrency', () => {
  it('many servers reading settings at once never append duplicate keys; saving cleans old duplicates', async () => {
    const { invalidate } = await import('@/lib/cache')
    const { setStore, getStore } = await import('@/lib/repo')
    const { getSettingsFresh, saveSettings } = await import('@/lib/repo/settings')
    const sim = createAppsScriptSim(SECRET)
    const servers = Array.from({ length: 5 }, () => new AppsScriptStore('https://sim', SECRET, sim.poster))
    // Old duplicates left by the previous seeding behaviour.
    setStore(servers[0])
    await servers[0].ensureSchema()
    await servers[0].append('settings', [['duta_week_tiktok', '3'], ['duta_week_tiktok', '8']])
    for (const s of servers) {
      setStore(s)
      invalidate()
      expect((await getSettingsFresh()).duta_week_tiktok).toBe(8) // last row wins
    }
    expect((await getStore().read('settings')).rows).toHaveLength(2) // reading wrote nothing
    invalidate()
    await saveSettings({ ...(await getSettingsFresh()), duta_week_tiktok: 9 })
    const rows = (await getStore().read('settings')).rows.filter((r) => r[0] === 'duta_week_tiktok')
    expect(rows).toEqual([['duta_week_tiktok', '9']])
  })
})
