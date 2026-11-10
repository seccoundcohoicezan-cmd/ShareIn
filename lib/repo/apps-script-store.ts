import { cellToString, TABLES, type Row, type TableData, type TableName, type TableStore } from './store'

type Op =
  | { action: 'ensure'; tables: Record<string, readonly string[]> }
  | { action: 'read'; table: TableName }
  | { action: 'append'; table: TableName; rows: string[][]; returnRows?: boolean }
  | { action: 'update'; table: TableName; updates: { index: number; row: string[] }[] }

export type Poster = (url: string, body: string) => Promise<{ status: number; text: string }>

const defaultPoster: Poster = async (url, body) => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    redirect: 'follow',
    cache: 'no-store',
    signal: AbortSignal.timeout(25_000),
  })
  return { status: res.status, text: await res.text() }
}

type ReadResult = { header: string[]; rows: string[][] }

/**
 * Google Sheets through the bound Apps Script Web App (apps-script/Code.js), authenticated by a shared secret.
 * Every round trip costs ~2 s, so reads are (1) coalesced: reads requested in the same tick travel in ONE
 * request, (2) shared: concurrent/very recent reads of a table reuse the same result for READ_TTL_MS,
 * and (3) never preceded by the schema check (that runs once, before the first write).
 */
export class AppsScriptStore implements TableStore {
  readonly kind = 'apps_script' as const
  static READ_TTL_MS = 3000
  private ensured: Promise<void> | null = null
  /** Tables whose sheet header already has every column: writes to them can skip the schema check. */
  private verified = new Set<TableName>()
  private recent = new Map<TableName, { at: number; data: Promise<ReadResult> }>()
  private queue: { table: TableName; resolve: (r: ReadResult) => void; reject: (e: unknown) => void }[] = []

  constructor(private url: string, private secret: string, private post: Poster = defaultPoster) {}

  private async send<T>(ops: Op[], retries = 1): Promise<T[]> {
    let lastErr: unknown
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await this.post(this.url, JSON.stringify({ secret: this.secret, ops }))
        let data: { ok: boolean; error?: string; results?: T[] }
        try {
          data = JSON.parse(res.text)
        } catch {
          throw new Error(`Apps Script membalas ${res.status} bukan JSON (izin belum diberikan atau URL salah)`)
        }
        if (!data.ok) {
          // Logical errors (missing tab, bad secret) won't fix themselves on retry.
          const err = new Error(`Apps Script: ${data.error}`)
          ;(err as Error & { final?: boolean }).final = true
          throw err
        }
        return data.results!
      } catch (e) {
        lastErr = e
        if ((e as Error & { final?: boolean }).final) break
      }
    }
    throw lastErr
  }

  private async call<T>(op: Op): Promise<T> {
    return (await this.send<T>([op], 0))[0]
  }

  private flush = async () => {
    const batch = this.queue
    this.queue = []
    const tables = Array.from(new Set(batch.map((b) => b.table)))
    try {
      let results: ReadResult[]
      try {
        results = await this.send<ReadResult>(tables.map((table) => ({ action: 'read', table })))
      } catch (e) {
        // First run on an empty spreadsheet: create the tabs, then read again.
        if (!String((e as Error).message).includes('tab tidak ada')) throw e
        this.ensured = null
        await this.ensureSchema()
        results = await this.send<ReadResult>(tables.map((table) => ({ action: 'read', table })))
      }
      const byTable = new Map(tables.map((t, i) => [t, results[i]]))
      byTable.forEach((r, t) => this.markVerified(t, r.header))
      for (const b of batch) b.resolve(byTable.get(b.table)!)
    } catch (e) {
      for (const b of batch) b.reject(e)
    }
  }

  private readRaw(table: TableName): Promise<ReadResult> {
    const hit = this.recent.get(table)
    if (hit && Date.now() - hit.at < AppsScriptStore.READ_TTL_MS) return hit.data
    const data = new Promise<ReadResult>((resolve, reject) => {
      if (this.queue.length === 0) setTimeout(this.flush, 0)
      this.queue.push({ table, resolve, reject })
    })
    this.recent.set(table, { at: Date.now(), data })
    data.catch(() => this.recent.delete(table))
    return data
  }

  ensureSchema(): Promise<void> {
    this.ensured ??= this.call({ action: 'ensure', tables: TABLES })
      .then(() => undefined)
      .catch((e) => {
        this.ensured = null
        throw e
      })
    return this.ensured
  }

  /** Drops the shared recent read of a table, so the next read reaches the sheet. */
  forget(table: TableName) {
    this.recent.delete(table)
  }

  private markVerified(table: TableName, header: string[]) {
    if ((TABLES[table] as readonly string[]).every((c) => header.includes(c))) this.verified.add(table)
  }

  private async ensureFor(table: TableName) {
    if (!this.verified.has(table)) await this.ensureSchema()
  }

  async appendAndRead(table: TableName, rows: Row[]): Promise<TableData> {
    await this.ensureFor(table)
    this.recent.delete(table)
    const r = await this.call<{ table: ReadResult }>({ action: 'append', table, rows: rows.map((x) => x.map(cellToString)), returnRows: true })
    this.markVerified(table, r.table.header)
    this.recent.set(table, { at: Date.now(), data: Promise.resolve(r.table) })
    return { header: r.table.header.length ? r.table.header : [...TABLES[table]], rows: r.table.rows.map((row) => [...row]) }
  }

  async read(table: TableName): Promise<TableData> {
    const r = await this.readRaw(table)
    return { header: r.header.length ? r.header : [...TABLES[table]], rows: r.rows.map((row) => [...row]) }
  }

  async append(table: TableName, rows: Row[]) {
    await this.ensureFor(table)
    this.recent.delete(table)
    await this.call({ action: 'append', table, rows: rows.map((r) => r.map(cellToString)) })
    this.recent.delete(table)
  }

  async update(table: TableName, updates: { index: number; row: Row }[]) {
    if (!updates.length) return
    await this.ensureFor(table)
    this.recent.delete(table)
    await this.call({ action: 'update', table, updates: updates.map((u) => ({ index: u.index, row: u.row.map(cellToString) })) })
    this.recent.delete(table)
  }
}
