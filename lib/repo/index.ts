import os from 'node:os'
import path from 'node:path'
import { AppsScriptStore } from './apps-script-store'
import { LocalStore } from './memory-store'
import type { TableStore } from './store'

// Web App of apps-script/Code.js bound to the ShareIn spreadsheet. Not secret: every call needs APPS_SCRIPT_SECRET.
export const DEFAULT_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbw9WV3F-s8f_kj0OIbaiEj0_Zc6n8o8R4EtmTAyh4OXgDD9EKkRE4kfBrUuhMBfP8s/exec'

// Process-wide singleton (shared by all server bundles), so read batching and caches are shared too.
const g = globalThis as unknown as { __shareinStore?: TableStore | null }

export function sheetsConfigured(): boolean {
  return Boolean(process.env.SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)
}

export function appsScriptConfigured(): boolean {
  return Boolean(process.env.APPS_SCRIPT_SECRET)
}

export function dataDir(): string {
  if (process.env.DATA_DIR) return process.env.DATA_DIR
  // Vercel's filesystem is read-only except /tmp (and /tmp is not persistent): demo mode only.
  return process.env.VERCEL ? path.join(os.tmpdir(), 'sharein-data') : path.join(process.cwd(), '.data')
}

export function getStore(): TableStore {
  if (g.__shareinStore) return g.__shareinStore
  let store: TableStore
  if (appsScriptConfigured()) {
    store = new AppsScriptStore(process.env.APPS_SCRIPT_URL || DEFAULT_APPS_SCRIPT_URL, process.env.APPS_SCRIPT_SECRET!)
  } else if (sheetsConfigured()) {
    // Loaded only when used: the googleapis client is heavy and slows every cold start.
    const { createSheetsClient, SheetsStore } = require('./sheets-store') as typeof import('./sheets-store')
    store = new SheetsStore(
      createSheetsClient(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!, process.env.GOOGLE_PRIVATE_KEY!),
      process.env.SHEET_ID!,
    )
  } else {
    store = new LocalStore(dataDir())
  }
  g.__shareinStore = store
  return store
}

/** True when data is not persisted to Google Sheets. */
export function isDemoStore(): boolean {
  const k = getStore().kind
  return k === 'file' || k === 'memory'
}

/** Test hook. */
export function setStore(s: TableStore | null) {
  g.__shareinStore = s
}
