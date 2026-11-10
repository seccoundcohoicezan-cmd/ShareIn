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
    await Promise.all([store.read('admins'), store.read('submissions'), store.read('tasks'), store.read('admins')])
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
    const input = { submitter_name: 'A', whatsapp: '081234567890', platform: 'tiktok' as const, source_url: 'https://www.tiktok.com/@a/video/7400000000000012345', sharein_url: '', likes: null, comments: null, organic_declared: true, checked_declared: true, has_screenshot: false, metrics_source: 'manual' as const }
    await Promise.all([participantsTable.list(), getSettingsFresh(), listSubmissionsFresh()])
    const [r] = await Promise.all([createBatch([input]), ensureParticipant('A', '081234567890')])
    expect(r.ok).toBe(true)
    expect(calls.sort()).toEqual(['append', 'append', 'read+read+read'])
  })
})
