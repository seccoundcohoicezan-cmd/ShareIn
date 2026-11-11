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
  it('a new participant submitting costs 3 spreadsheet requests (was 9), the two writes in parallel', async () => {
    const { invalidate } = await import('@/lib/cache')
    const { setStore } = await import('@/lib/repo')
    const { ensureParticipant } = await import('@/lib/participant-service')
    const { participantsTable } = await import('@/lib/repo/programs')
    const { getSettingsFresh } = await import('@/lib/repo/settings')
    const { listSubmissionsFresh } = await import('@/lib/repo/submissions')
    const { createBatch } = await import('@/lib/service')
    const sim = createAppsScriptSim(SECRET)
    setStore(new AppsScriptStore('https://sim', SECRET, sim.poster))
    invalidate()
    await getSettingsFresh() // sheet already set up, as in production
    const calls: string[] = []
    setStore(new AppsScriptStore('https://sim', SECRET, async (u, b) => {
      calls.push((JSON.parse(b).ops as { action: string }[]).map((o) => o.action).join('+'))
      return sim.poster(u, b)
    }))
    invalidate()
    const input = { submitter_name: 'A', whatsapp: '081234567890', platform: 'tiktok' as const, source_url: 'https://www.tiktok.com/@a/video/7400000000000012345', sharein_url: '', likes: null, comments: null, organic_declared: true, checked_declared: true, has_screenshot: false, metrics_source: 'manual' as const, program: 'golden' as const }
    await Promise.all([participantsTable.list(), getSettingsFresh(), listSubmissionsFresh()])
    const [r] = await Promise.all([createBatch([input]), ensureParticipant('A', '081234567890')])
    expect(r.ok).toBe(true)
    expect(calls.sort()).toEqual(['append', 'append', 'read+read+read'])
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
    await Promise.all([getSettingsFresh(), listAdmins(), getStore().ensureSchema()]) // warmed server, page loaded
    calls.length = 0

    const r = await createAdmin({ email: 'baru@x.id', role: 'owner', password: 'sandi-panjang-123' }, 'owner@x')
    expect(r).toEqual({ admins: [{ email: 'baru@x.id', role: 'owner', active: true }] })
    expect(calls).toEqual(['append+append'])

    calls.length = 0
    const s = await getSettingsFresh()
    calls.length = 0
    await saveSettings({ ...s, duta_week_tiktok: 7 }, { actor: 'owner@x' })
    expect(calls).toEqual(['update+append'])
    expect((await getSettings()).duta_week_tiktok).toBe(7) // primed, no re-read
    expect(calls).toHaveLength(1)
    const log = await getStore().read('audit_log')
    expect(log.rows.map((x) => x[2])).toEqual(['admin.create', 'settings.update'])
  })
})
