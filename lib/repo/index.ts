import os from 'node:os'
import path from 'node:path'
import { capCacheTtl } from '../cache'
import { primaryPoster } from '../primary/client'
import { getPrimaryEngine, isPrimaryHost } from '../primary/local'
import { AppsScriptStore } from './apps-script-store'
import { LocalStore } from './memory-store'
import type { TableStore } from './store'

// Web App of apps-script/Code.js bound to the ShareIn spreadsheet. Not secret: every call needs APPS_SCRIPT_SECRET.
export const DEFAULT_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbw9WV3F-s8f_kj0OIbaiEj0_Zc6n8o8R4EtmTAyh4OXgDD9EKkRE4kfBrUuhMBfP8s/exec'

// Process-wide singleton (shared by all server bundles), so read batching and caches are shared too.
const g = globalThis as unknown as { __shareinStore?: TableStore | null }

// The self-hosted ShareIn server that holds the primary database (lib/primary). Not secret: every call
// needs APPS_SCRIPT_SECRET. DATA_PRIMARY_URL=off talks to the Google Sheet directly, as before.
export const DEFAULT_PRIMARY_URL = 'https://sharein.194-238-23-221.sslip.io/api/internal/store'

export function primaryDataUrl(): string | null {
  const v = process.env.DATA_PRIMARY_URL
  if (v === 'off' || process.env.NODE_ENV === 'test') return null
  return v || DEFAULT_PRIMARY_URL
}

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
    const sheetUrl = process.env.APPS_SCRIPT_URL || DEFAULT_APPS_SCRIPT_URL
    const secret = process.env.APPS_SCRIPT_SECRET!
    const primaryUrl = primaryDataUrl()
    if (isPrimaryHost()) {
      // This server IS the database: Code.js in-process, the sheet only receives copies.
      const engine = getPrimaryEngine(sheetUrl, secret, dataDir())
      store = new AppsScriptStore('primary://local', secret, (_u, body) => engine.handle(body), { readTtlMs: 0, kind: 'primary' })
      capCacheTtl(3000)
    } else if (primaryUrl) {
      store = new AppsScriptStore(primaryUrl, secret, primaryPoster({ url: sheetUrl }), { readTtlMs: 250, kind: 'primary' })
      capCacheTtl(5000)
    } else {
      store = new AppsScriptStore(sheetUrl, secret)
    }
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
