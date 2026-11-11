import { cached, invalidate, prime } from '../cache'
import { parseSettings, SEED_SETTINGS, serializeSettings, SETTING_KEYS } from '../settings-schema'
import type { Settings } from '../types'
import { getStore } from './index'
import { auditOp, rowToRecord, writeAll } from './store'

async function readRaw(fresh = false) {
  const store = getStore()
  if (fresh) store.forget?.('settings')
  const { header, rows } = await store.read('settings')
  const map = new Map<string, string>()
  const index = new Map<string, number>()
  // Older copies of a key (left by concurrent first-run seeding in the past): the LAST row wins.
  const stale: number[] = []
  rows.forEach((r, i) => {
    const rec = rowToRecord(header, r)
    const key = rec.key?.trim()
    if (key) {
      if (index.has(key)) stale.push(index.get(key)!)
      map.set(key, rec.value ?? '')
      index.set(key, i)
    }
  })
  return { map, index, stale }
}

/** Writes seed values for keys missing from the sheet (first run). */
export async function seedSettings(): Promise<void> {
  const { map } = await readRaw()
  const missing = SETTING_KEYS.filter((k) => !map.has(k))
  if (missing.length) await getStore().append('settings', missing.map((k) => [k, SEED_SETTINGS[k]]))
}

/**
 * Reading never writes: missing keys fall back to their defaults in parseSettings. (Seeding on read
 * made every server instance append the same keys at once, leaving duplicates.) Keys are written when
 * an admin saves the settings.
 */
export async function getSettingsFresh(): Promise<Settings> {
  const { map } = await readRaw()
  return parseSettings(map)
}

export function getSettings(): Promise<Settings> {
  return cached('settings', getSettingsFresh)
}

export async function saveSettings(next: Settings, audit?: { actor: string }): Promise<{ before: Record<string, string>; after: Record<string, string> }> {
  const { map, index, stale } = await readRaw(true)
  const after = serializeSettings(next)
  const before: Record<string, string> = {}
  const updates: { index: number; row: string[] }[] = []
  const appends: string[][] = []
  for (const key of SETTING_KEYS) {
    if (map.get(key) === after[key]) continue
    before[key] = map.get(key) ?? ''
    const i = index.get(key)
    if (i === undefined) appends.push([key, after[key]])
    else updates.push({ index: i, row: [key, after[key]] })
  }
  const changed: Record<string, string> = {}
  for (const k of Object.keys(before)) changed[k] = after[k as keyof typeof after]
  // Settings rows and their audit entry go to the spreadsheet in one request.
  await writeAll(getStore(), [
    // Blank older duplicate rows so the sheet shows each setting once.
    { action: 'update', table: 'settings', updates: [...updates, ...stale.map((i) => ({ index: i, row: ['', ''] }))] },
    { action: 'append', table: 'settings', rows: appends },
    ...(audit && Object.keys(changed).length ? [auditOp(audit.actor, 'settings.update', 'settings', before, changed)] : []),
  ])
  invalidate()
  prime('settings', parseSettings(new Map([...Array.from(map.entries()), ...Object.entries(after)])))
  return { before, after: changed }
}
