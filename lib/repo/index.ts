import os from 'node:os'
import path from 'node:path'
import { AppsScriptStore } from './apps-script-store'
import { LocalStore } from './memory-store'
import { createSheetsClient, SheetsStore } from './sheets-store'
import type { TableStore } from './store'

// Web App of apps-script/Code.js bound to the ShareIn spreadsheet. Not secret: every call needs APPS_SCRIPT_SECRET.
export const DEFAULT_APPS_SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbw9WV3F-s8f_kj0OIbaiEj0_Zc6n8o8R4EtmTAyh4OXgDD9EKkRE4kfBrUuhMBfP8s/exec'

let store: TableStore | null = null

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
  if (store) return store
  if (appsScriptConfigured()) {
    store = new AppsScriptStore(process.env.APPS_SCRIPT_URL || DEFAULT_APPS_SCRIPT_URL, process.env.APPS_SCRIPT_SECRET!)
  } else if (sheetsConfigured()) {
    store = new SheetsStore(
      createSheetsClient(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!, process.env.GOOGLE_PRIVATE_KEY!),
      process.env.SHEET_ID!,
    )
  } else {
    store = new LocalStore(dataDir())
  }
  return store
}

/** True when data is not persisted to Google Sheets. */
export function isDemoStore(): boolean {
  const k = getStore().kind
  return k === 'file' || k === 'memory'
}

/** Test hook. */
export function setStore(s: TableStore | null) {
  store = s
}
