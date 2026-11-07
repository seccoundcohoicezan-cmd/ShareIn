import { cached, invalidate } from '../cache'
import { parseSettings, SEED_SETTINGS, serializeSettings, SETTING_KEYS } from '../settings-schema'
import type { Settings } from '../types'
import { getStore } from './index'
import { rowToRecord } from './store'

async function readRaw() {
  const store = getStore()
  const { header, rows } = await store.read('settings')
  const map = new Map<string, string>()
  const index = new Map<string, number>()
  rows.forEach((r, i) => {
    const rec = rowToRecord(header, r)
    const key = rec.key?.trim()
    if (key) {
      map.set(key, rec.value ?? '')
      index.set(key, i)
    }
  })
  return { map, index }
}

/** Writes seed values for keys missing from the sheet (first run). */
export async function seedSettings(): Promise<void> {
  const { map } = await readRaw()
  const missing = SETTING_KEYS.filter((k) => !map.has(k))
  if (missing.length) await getStore().append('settings', missing.map((k) => [k, SEED_SETTINGS[k]]))
}

export async function getSettingsFresh(): Promise<Settings> {
  const { map } = await readRaw()
  if (SETTING_KEYS.some((k) => !map.has(k))) {
    await seedSettings()
  }
  return parseSettings(map)
}

export function getSettings(): Promise<Settings> {
  return cached('settings', getSettingsFresh)
}

export async function saveSettings(next: Settings): Promise<{ before: Record<string, string>; after: Record<string, string> }> {
  const { map, index } = await readRaw()
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
  const store = getStore()
  await store.update('settings', updates)
  if (appends.length) await store.append('settings', appends)
  invalidate()
  const changed: Record<string, string> = {}
  for (const k of Object.keys(before)) changed[k] = after[k as keyof typeof after]
  return { before, after: changed }
}
