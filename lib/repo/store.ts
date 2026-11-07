export type Cell = string | number | boolean
export type Row = Cell[]

export const TABLES = {
  settings: ['key', 'value'],
  submissions: [
    'id', 'created_at', 'period_id', 'submitter_name', 'platform', 'source_url', 'source_key', 'sharein_url',
    'likes', 'comments', 'metrics_source', 'organic_declared', 'screenshot_url', 'status', 'reject_reason',
    'reviewed_by', 'reviewed_at', 'needs_review', 'whatsapp',
  ],
  admins: ['email', 'password_hash', 'role', 'active'],
  audit_log: ['time', 'actor', 'action', 'target', 'before', 'after'],
  tasks: ['id', 'program', 'title', 'description', 'proof_hint', 'active', 'order', 'created_at'],
  task_submissions: [
    'id', 'created_at', 'program', 'task_id', 'identity_key', 'name', 'whatsapp', 'proof_url', 'note', 'code',
    'status', 'reject_reason', 'reviewed_by', 'reviewed_at',
  ],
  draws: ['id', 'time', 'program', 'code', 'submission_id', 'name', 'identity_key', 'prize', 'actor', 'status'],
  participants: ['id', 'token', 'name', 'whatsapp', 'created_at', 'last_seen_at'],
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
