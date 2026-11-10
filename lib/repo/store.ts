export type Cell = string | number | boolean
export type Row = Cell[]

export const TABLES = {
  settings: ['key', 'value'],
  submissions: [
    'id', 'created_at', 'period_id', 'submitter_name', 'platform', 'source_url', 'source_key', 'sharein_url',
    'likes', 'comments', 'metrics_source', 'organic_declared', 'screenshot_url', 'status', 'reject_reason',
    'reviewed_by', 'reviewed_at', 'needs_review', 'whatsapp', 'program',
  ],
  admins: ['email', 'password_hash', 'role', 'active'],
  audit_log: ['time', 'actor', 'action', 'target', 'before', 'after'],
  api_keys: ['id', 'name', 'prefix', 'key_hash', 'active', 'created_at', 'created_by'],
  participants: ['id', 'token', 'name', 'whatsapp', 'created_at', 'last_seen_at', 'sso_sub'],
} as const

export type TableName = keyof typeof TABLES

export interface TableData {
  header: string[]
  /** Data rows (sheet row = index + 2). */
  rows: string[][]
}

/** Minimal tabular storage; implemented by Google Sheets and by a local JSON file store. */
export interface TableStore {
  readonly kind: 'sheets' | 'apps_script' | 'file' | 'memory'
  ensureSchema(): Promise<void>
  read(table: TableName): Promise<TableData>
  append(table: TableName, rows: Row[]): Promise<void>
  /** Writes whole rows at the given data indexes. */
  update(table: TableName, updates: { index: number; row: Row }[]): Promise<void>
  /** Appends and returns the table afterwards, in one round trip where the backend supports it. */
  appendAndRead?(table: TableName, rows: Row[]): Promise<TableData>
  /** Drops any cached read of the table (stores that share reads). */
  forget?(table: TableName): void
}

export async function appendThenRead(store: TableStore, table: TableName, rows: Row[]): Promise<TableData> {
  if (store.appendAndRead) return store.appendAndRead(table, rows)
  await store.append(table, rows)
  return store.read(table)
}

/**
 * Header to write rows with. A header read before a new column was added would silently drop that
 * column's values, so the schema is brought up to date first.
 */
export async function writeHeader(store: TableStore, table: TableName, known: string[] | null): Promise<string[]> {
  if (known && (TABLES[table] as readonly string[]).every((c) => known.includes(c))) return known
  await store.ensureSchema()
  store.forget?.(table)
  return (await store.read(table)).header
}

export function cellToString(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE'
  return String(v)
}

/** Maps a raw row onto column names using the sheet header (column order may differ from TABLES). */
export function rowToRecord(header: string[], row: string[]): Record<string, string> {
  const rec: Record<string, string> = {}
  header.forEach((h, i) => (rec[h.trim()] = row[i] ?? ''))
  return rec
}

export function recordToRow(header: string[], rec: Record<string, Cell>): Row {
  return header.map((h) => {
    const v = rec[h.trim()]
    return v === undefined || v === null ? '' : v
  })
}
