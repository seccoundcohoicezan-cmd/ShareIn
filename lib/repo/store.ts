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
  spins: ['id', 'created_at', 'program', 'round_start', 'participant_id', 'name', 'whatsapp', 'prize', 'entries', 'drawn_by', 'deleted'],
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
  /** Appends to several tables and returns each of them afterwards, in one round trip. */
  appendManyAndRead?(parts: { table: TableName; rows: Row[] }[]): Promise<TableData[]>
  /** Several appends/updates (possibly to different tables) in one round trip. */
  writeBatch?(ops: WriteOp[]): Promise<void>
  /** Changes some columns of rows found by key in one round trip, without reading the table first. */
  patch?(table: TableName, req: PatchRequest): Promise<PatchResult>
  /** Drops any cached read of the table (stores that share reads). */
  forget?(table: TableName): void
}

export type WriteOp =
  | { action: 'append'; table: TableName; rows: Row[] }
  | { action: 'update'; table: TableName; updates: { index: number; row: Row }[] }

/** Runs writes in one request where the store supports it, otherwise one after another. */
export async function writeAll(store: TableStore, ops: WriteOp[]): Promise<void> {
  const real = ops.filter((o) => (o.action === 'append' ? o.rows.length : o.updates.length) > 0)
  if (!real.length) return
  if (store.writeBatch) return store.writeBatch(real)
  for (const o of real) {
    if (o.action === 'append') await store.append(o.table, o.rows)
    else await store.update(o.table, o.updates)
  }
}

/** One audit_log row, for writing together with the change it describes. */
export function auditOp(actor: string, action: string, target: string, before: unknown, after: unknown): WriteOp {
  return { action: 'append', table: 'audit_log', rows: [[new Date().toISOString(), actor, action, target, JSON.stringify(before ?? ''), JSON.stringify(after ?? '')]] }
}

export interface PatchRequest {
  key: string
  patches: { id: string; values: Record<string, Cell> }[]
  /** Rows whose column holds one of these (lower-case) values are left alone and reported missing. */
  skip?: Record<string, string[]>
  /** Writes one audit row per change (changed columns before/after) in the same request. */
  log?: { table: TableName; actor: string; action: string; time: string }
}

export interface PatchResult {
  items: { index: number; record: Record<string, string> }[]
  missing: string[]
}

export async function appendManyThenRead(store: TableStore, parts: { table: TableName; rows: Row[] }[]): Promise<TableData[]> {
  if (store.appendManyAndRead) return store.appendManyAndRead(parts)
  const out: TableData[] = []
  for (const p of parts) out.push(await appendThenRead(store, p.table, p.rows))
  return out
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
