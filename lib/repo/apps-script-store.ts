import { cellToString, TABLES, type Row, type TableData, type TableName, type TableStore } from './store'

type Op =
  | { action: 'ensure'; tables: Record<string, readonly string[]> }
  | { action: 'read'; table: TableName }
  | { action: 'append'; table: TableName; rows: string[][] }
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

/** Google Sheets through the bound Apps Script Web App (apps-script/Code.js), authenticated by a shared secret. */
export class AppsScriptStore implements TableStore {
  readonly kind = 'apps_script' as const
  private ensured: Promise<void> | null = null

  constructor(private url: string, private secret: string, private post: Poster = defaultPoster) {}

  private async call<T>(op: Op): Promise<T> {
    let lastErr: unknown
    for (let attempt = 0; attempt < (op.action === 'read' ? 2 : 1); attempt++) {
      try {
        const res = await this.post(this.url, JSON.stringify({ secret: this.secret, ...op }))
        let data: { ok: boolean; error?: string; results?: T[] }
        try {
          data = JSON.parse(res.text)
        } catch {
          throw new Error(`Apps Script membalas ${res.status} bukan JSON (izin belum diberikan atau URL salah)`)
        }
        if (!data.ok) throw new Error(`Apps Script: ${data.error}`)
        return data.results![0]
      } catch (e) {
        lastErr = e
      }
    }
    throw lastErr
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

  async read(table: TableName): Promise<TableData> {
    await this.ensureSchema()
    const r = await this.call<{ header: string[]; rows: string[][] }>({ action: 'read', table })
    return { header: r.header.length ? r.header : [...TABLES[table]], rows: r.rows }
  }

  async append(table: TableName, rows: Row[]) {
    await this.ensureSchema()
    await this.call({ action: 'append', table, rows: rows.map((r) => r.map(cellToString)) })
  }

  async update(table: TableName, updates: { index: number; row: Row }[]) {
    if (!updates.length) return
    await this.ensureSchema()
    await this.call({ action: 'update', table, updates: updates.map((u) => ({ index: u.index, row: u.row.map(cellToString) })) })
  }
}
