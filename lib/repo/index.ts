import path from 'node:path'
import { LocalStore } from './memory-store'
import { createSheetsClient, SheetsStore } from './sheets-store'
import type { TableStore } from './store'

let store: TableStore | null = null

export function sheetsConfigured(): boolean {
  return Boolean(process.env.SHEET_ID && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY)
}

export function getStore(): TableStore {
  if (store) return store
  if (sheetsConfigured()) {
    store = new SheetsStore(
      createSheetsClient(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!, process.env.GOOGLE_PRIVATE_KEY!),
      process.env.SHEET_ID!,
    )
  } else {
    store = new LocalStore(process.env.DATA_DIR || path.join(process.cwd(), '.data'))
  }
  return store
}

/** Test hook. */
export function setStore(s: TableStore | null) {
  store = s
}
