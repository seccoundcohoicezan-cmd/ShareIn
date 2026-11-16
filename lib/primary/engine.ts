import { promises as fs, readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { TABLES, type TableName } from '../repo/store'
import { appsScriptGlobals, MemorySpreadsheet } from './memory-sheet'

/**
 * The primary database: the real apps-script/Code.js running in this Node process over an in-memory
 * spreadsheet, saved to a JSON file. It answers the exact Apps Script protocol in microseconds, so the
 * web never waits on Google. Every write marks its tables dirty; a background forwarder copies them to
 * the Google Sheet (append-only tail when possible, otherwise a full `replace`). The sheet is a mirror.
 */

export type Poster = (url: string, body: string) => Promise<{ status: number; text: string }>
type Grid = { header: string[]; rows: string[][] }
type Op = { action: string; table?: string; tables?: Record<string, unknown>; log?: { table?: string } }

export interface SyncStatus {
  ready: boolean
  pending: string[]
  lastSyncAt: string | null
  lastError: string | null
  lastErrorAt: string | null
  since: string | null
}

export interface EngineOptions {
  secret: string
  /** Code.js source; read from apps-script/Code.js when omitted. */
  code?: string
  /** JSON file to persist to (null = memory only). */
  file: string | null
  /** The real spreadsheet (Apps Script Web App): bootstrap source and mirror target. */
  mirror: { url: string; post: Poster } | null
  /** Wait after a write before forwarding, so bursts travel together. */
  forwardDelayMs?: number
  /** Key written into the sheet's settings tab once this database has taken over. */
  markerKey?: string
}

export const PRIMARY_MARKER = 'data_primary_since'
const TABLE_NAMES = Object.keys(TABLES) as TableName[]

export class PrimaryEngine {
  private ss = new MemorySpreadsheet()
  private doPost: (e: unknown) => { getContent(): string }
  private loading: Promise<void> | null = null
  private loaded = false
  private dirty = new Map<string, number>()
  private version = 0
  private forwarded = new Map<string, Grid>()
  private forwardTimer: NodeJS.Timeout | null = null
  private forwarding: Promise<void> | null = null
  private retryMs = 0
  private persistTimer: NodeJS.Timeout | null = null
  private writing: Promise<void> = Promise.resolve()
  private status: SyncStatus = { ready: false, pending: [], lastSyncAt: null, lastError: null, lastErrorAt: null, since: null }

  constructor(private opts: EngineOptions) {
    const ctx = vm.createContext(appsScriptGlobals(this.ss, { waitLock: () => {}, releaseLock: () => {} }))
    vm.runInContext(`var API_SECRET = ${JSON.stringify(opts.secret)};`, ctx)
    vm.runInContext(opts.code ?? readFileSync(path.join(process.cwd(), 'apps-script', 'Code.js'), 'utf8'), ctx)
    this.doPost = vm.runInContext('doPost', ctx)
  }

  /** Loads the saved file, or copies the Google Sheet on the very first start. */
  ready(): Promise<void> {
    this.loading ??= this.load().catch((e) => {
      this.loading = null
      throw e
    })
    return this.loading
  }

  private run(body: { ops: unknown[] }): { ok: boolean; error?: string; results?: unknown[] } {
    return JSON.parse(this.doPost({ postData: { contents: JSON.stringify({ secret: this.opts.secret, ...body }) } }).getContent())
  }

  private async load() {
    const file = this.opts.file
    if (file) {
      try {
        const saved = JSON.parse(await fs.readFile(file, 'utf8')) as { sheets: Record<string, string[][]>; since?: string }
        this.ss.load(saved.sheets)
        this.status.since = saved.since ?? null
        this.loaded = true
        this.status.ready = true
        // Whether the sheet caught up before the restart is unknown: send every table once.
        for (const t of this.ss.sheets.keys()) this.markDirty(t)
        return
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e
      }
    }
    if (this.opts.mirror) await this.bootstrapFromSheet()
    this.loaded = true
    this.status.ready = true
    this.status.since ??= new Date().toISOString()
    await this.persistNow()
  }

  private async bootstrapFromSheet() {
    const { url, post } = this.opts.mirror!
    const res = await post(url, JSON.stringify({ secret: this.opts.secret, ops: [{ action: 'ensure', tables: TABLES }, ...TABLE_NAMES.map((table) => ({ action: 'read', table }))] }))
    const data = JSON.parse(res.text) as { ok: boolean; error?: string; results: Grid[] }
    if (!data.ok) throw new Error(`Gagal menyalin spreadsheet: ${data.error}`)
    const since = new Date().toISOString()
    const sheets: Record<string, string[][]> = {}
    TABLE_NAMES.forEach((t, i) => {
      const g = data.results[i + 1]
      sheets[t] = g.header.length ? [g.header, ...g.rows] : [[...TABLES[t]]]
    })
    this.ss.load(sheets)
    this.status.since = since
    for (const t of TABLE_NAMES) this.forwarded.set(t, this.snapshot(t)!)
    // Mark the takeover in both copies, so web servers know not to write to the sheet directly any more.
    const marker = this.opts.markerKey ?? PRIMARY_MARKER
    const r = this.run({ ops: [{ action: 'append', table: 'settings', rows: [[marker, since]] }] })
    if (!r.ok) throw new Error(String(r.error))
    this.markDirty('settings')
  }

  private snapshot(table: string): Grid | null {
    const sh = this.ss.getSheetByName(table)
    if (!sh) return null
    const r = this.run({ ops: [{ action: 'read', table }] })
    return r.ok ? (r.results![0] as Grid) : null
  }

  /** Handles one Apps Script–style request body ({ secret, ops }). */
  async handle(body: string): Promise<{ status: number; text: string }> {
    let req: { secret?: string; ops?: Op[] }
    try {
      req = JSON.parse(body)
    } catch {
      return { status: 400, text: JSON.stringify({ ok: false, error: 'bad_json' }) }
    }
    const ops = Array.isArray(req.ops) ? req.ops : [req as Op]
    if (ops.length === 1 && ops[0].action === 'status') {
      // Same secret check as Code.js, without touching any table.
      const auth = JSON.parse(this.doPost({ postData: { contents: JSON.stringify({ secret: req.secret, ops: [] }) } }).getContent()) as { ok: boolean; error?: string }
      if (!auth.ok) return { status: 200, text: JSON.stringify(auth) }
      return { status: 200, text: JSON.stringify({ ok: true, results: [this.syncStatus()] }) }
    }
    await this.ready()
    const text = this.doPost({ postData: { contents: body } }).getContent()
    if (ops.some((o) => o.action !== 'read') && text.startsWith('{"ok":true')) {
      for (const t of writtenTables(ops)) this.markDirty(t)
      this.schedulePersist()
    }
    return { status: 200, text }
  }

  syncStatus(): SyncStatus {
    return { ...this.status, pending: Array.from(this.dirty.keys()) }
  }

  private markDirty(table: string) {
    this.dirty.set(table, ++this.version)
    this.scheduleForward(this.opts.forwardDelayMs ?? 1500)
  }

  private scheduleForward(ms: number) {
    if (!this.opts.mirror || this.forwardTimer) return
    this.forwardTimer = setTimeout(() => {
      this.forwardTimer = null
      void this.forward()
    }, ms)
    this.forwardTimer.unref?.()
  }

  /** Copies dirty tables to the Google Sheet. Safe to call any time; runs one batch at a time. */
  forward(): Promise<void> {
    if (this.forwarding) return this.forwarding
    this.forwarding = this.forwardOnce().finally(() => {
      this.forwarding = null
      if (this.dirty.size) this.scheduleForward(this.retryMs || (this.opts.forwardDelayMs ?? 1500))
    })
    return this.forwarding
  }

  private async forwardOnce() {
    if (!this.opts.mirror || !this.loaded || !this.dirty.size) return
    const batch = Array.from(this.dirty.entries())
    const ops: unknown[] = [{ action: 'ensure', tables: TABLES }]
    const snaps = new Map<string, Grid>()
    for (const [t] of batch) {
      const now = this.snapshot(t)
      if (!now) continue
      snaps.set(t, now)
      const before = this.forwarded.get(t)
      if (before && sameRow(before.header, now.header) && now.rows.length >= before.rows.length && before.rows.every((r, i) => sameRow(r, now.rows[i]))) {
        const tail = now.rows.slice(before.rows.length)
        if (tail.length) ops.push({ action: 'append', table: t, rows: tail })
      } else {
        ops.push({ action: 'replace', table: t, header: now.header, rows: now.rows })
      }
    }
    try {
      if (ops.length > 1) {
        const res = await this.opts.mirror.post(this.opts.mirror.url, JSON.stringify({ secret: this.opts.secret, ops }))
        let data: { ok: boolean; error?: string }
        try {
          data = JSON.parse(res.text)
        } catch {
          throw new Error(`Spreadsheet membalas ${res.status}`)
        }
        if (!data.ok) throw new Error(String(data.error))
      }
      for (const [t, v] of batch) {
        const snap = snaps.get(t)
        if (snap) this.forwarded.set(t, snap)
        // Written again while we were sending: keep it dirty for the next round.
        if (this.dirty.get(t) === v) this.dirty.delete(t)
      }
      this.retryMs = 0
      this.status.lastSyncAt = new Date().toISOString()
      this.status.lastError = null
    } catch (e) {
      // The sheet may be half-written after a failure: next time send whole tables.
      for (const [t] of batch) this.forwarded.delete(t)
      this.retryMs = Math.min(5 * 60_000, Math.max(5000, this.retryMs * 2))
      this.status.lastError = (e as Error).message
      this.status.lastErrorAt = new Date().toISOString()
      console.error('sheet mirror failed', (e as Error).message)
    }
  }

  private schedulePersist() {
    if (!this.opts.file || this.persistTimer) return
    this.persistTimer = setTimeout(() => {
      this.persistTimer = null
      void this.persistNow()
    }, 100)
  }

  /** Writes the database file atomically (temp file + rename). */
  async persistNow(): Promise<void> {
    const file = this.opts.file
    if (!file) return
    const snapshot = JSON.stringify({ since: this.status.since, sheets: this.ss.toJSON() })
    this.writing = this.writing.then(async () => {
      await fs.mkdir(path.dirname(file), { recursive: true })
      const tmp = `${file}.${process.pid}.tmp`
      await fs.writeFile(tmp, snapshot)
      await fs.rename(tmp, file)
    })
    return this.writing
  }

  /** Flushes the file and the sheet (graceful shutdown, tests). */
  async drain() {
    if (this.persistTimer) {
      clearTimeout(this.persistTimer)
      this.persistTimer = null
      await this.persistNow()
    }
    if (this.forwardTimer) {
      clearTimeout(this.forwardTimer)
      this.forwardTimer = null
    }
    await this.forward()
  }
}

function sameRow(a: string[] | undefined, b: string[] | undefined) {
  if (!a || !b || a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function writtenTables(ops: Op[]): string[] {
  const out = new Set<string>()
  for (const o of ops) {
    if (o.action === 'read') continue
    if (o.action === 'ensure') Object.keys(o.tables ?? {}).forEach((t) => out.add(t))
    if (o.table) out.add(o.table)
    if (o.log?.table) out.add(o.log.table)
  }
  return Array.from(out)
}
