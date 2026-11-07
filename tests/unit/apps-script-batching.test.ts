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
