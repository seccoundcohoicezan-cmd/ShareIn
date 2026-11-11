import http from 'node:http'
import https from 'node:https'
import { cellToString, TABLES, type PatchRequest, type PatchResult, type Row, type WriteOp, type TableData, type TableName, type TableStore } from './store'

type Op =
  | { action: 'ensure'; tables: Record<string, readonly string[]> }
  | { action: 'read'; table: TableName }
  | { action: 'append'; table: TableName; rows: string[][]; returnRows?: boolean }
  | { action: 'update'; table: TableName; updates: { index: number; row: string[] }[] }
  | ({ action: 'patch'; table: TableName } & Omit<PatchRequest, 'patches'> & { patches: { id: string; values: Record<string, string> }[] })

export type Poster = (url: string, body: string) => Promise<{ status: number; text: string }>

// Node's own HTTP client, not Next's patched fetch: a `no-store` fetch inside an ISR page makes Next
// abort the regeneration with "static to dynamic" (HTTP 500). Keep-alive saves a TLS handshake per call.
const agents = { http: new http.Agent({ keepAlive: true, maxSockets: 64 }), https: new https.Agent({ keepAlive: true, maxSockets: 64 }) }

function request(url: string, method: 'POST' | 'GET', body: string | null, deadline: number): Promise<{ status: number; text: string; location?: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const mod = u.protocol === 'https:' ? https : http
    const req = mod.request(
      u,
      {
        method,
        agent: u.protocol === 'https:' ? agents.https : agents.http,
        headers: body === null ? {} : { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) },
        timeout: Math.max(1000, deadline - Date.now()),
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8'), location: res.headers.location }))
        res.on('error', reject)
      },
    )
    req.on('timeout', () => req.destroy(new Error('Apps Script tidak menjawab (timeout)')))
    req.on('error', reject)
    if (body !== null) req.write(body)
    req.end()
  })
}

const defaultPoster: Poster = async (url, body) => {
  const deadline = Date.now() + 25_000
  let r = await request(url, 'POST', body, deadline)
  // The Web App answers a POST with a redirect to the result, which is fetched with GET (as browsers do).
  for (let hops = 0; r.location && r.status >= 300 && r.status < 400 && hops < 5; hops++) {
    r = await request(new URL(r.location, url).toString(), 'GET', null, deadline)
  }
  return { status: r.status, text: r.text }
}

type ReadResult = { header: string[]; rows: string[][] }

const BUSY = /too many|simultaneous|Service invoked|Lock timeout|lock busy|try again/i
const MAX_BUSY_RETRIES = 6

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
    // "Too many simultaneous invocations" and lock timeouts mean the script did NOT run, so retrying is
    // safe even for writes. Under a burst (300 people at once) they are expected; back off with jitter.
    for (let attempt = 0, busy = 0; attempt <= retries + busy; attempt++) {
      try {
        const res = await this.post(this.url, JSON.stringify({ secret: this.secret, ops }))
        let data: { ok: boolean; error?: string; results?: T[] }
        try {
          data = JSON.parse(res.text)
        } catch {
          if (res.status === 429 || res.status >= 500) throw Object.assign(new Error(`Apps Script sibuk (${res.status})`), { busy: true })
          throw new Error(`Apps Script membalas ${res.status} bukan JSON (izin belum diberikan atau URL salah)`)
        }
        if (!data.ok) {
          const err = new Error(`Apps Script: ${data.error}`) as Error & { final?: boolean; busy?: boolean }
          if (BUSY.test(String(data.error))) err.busy = true
          // Other logical errors (missing tab, bad secret) won't fix themselves on retry.
          else err.final = true
          throw err
        }
        return data.results!
      } catch (e) {
        lastErr = e
        const err = e as Error & { final?: boolean; busy?: boolean }
        if (err.final) break
        if (err.busy && busy < MAX_BUSY_RETRIES) {
          busy++
          await new Promise((r) => setTimeout(r, 400 * busy + Math.random() * 600))
          continue
        }
        // A network error on a write may have reached the sheet: never repeat a write blindly.
        if (ops.some((o) => o.action !== 'read')) break
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
      .then(() => {
        // ensure brings every tab's header up to date, so later writes skip the check.
        for (const t of Object.keys(TABLES) as TableName[]) this.verified.add(t)
      })
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

  async writeBatch(ops: WriteOp[]): Promise<void> {
    const tables = Array.from(new Set(ops.map((o) => o.table)))
    for (const t of tables) await this.ensureFor(t)
    tables.forEach((t) => this.recent.delete(t))
    await this.send(
      ops.map((o): Op =>
        o.action === 'append'
          ? { action: 'append', table: o.table, rows: o.rows.map((r) => r.map(cellToString)) }
          : { action: 'update', table: o.table, updates: o.updates.map((u) => ({ index: u.index, row: u.row.map(cellToString) })) },
      ),
      0,
    )
    tables.forEach((t) => this.recent.delete(t))
  }

  async patch(table: TableName, req: PatchRequest): Promise<PatchResult> {
    await this.ensureFor(table)
    this.recent.delete(table)
    if (req.log) this.recent.delete(req.log.table)
    const r = await this.call<PatchResult>({ action: 'patch', table, ...req, patches: req.patches.map((p) => ({ id: p.id, values: Object.fromEntries(Object.entries(p.values).map(([k, v]) => [k, cellToString(v)])) })) })
    this.recent.delete(table)
    return r
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
