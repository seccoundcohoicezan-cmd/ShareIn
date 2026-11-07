import { promises as fs } from 'node:fs'
import path from 'node:path'
import { cellToString, TABLES, type Row, type TableData, type TableName, type TableStore } from './store'

type Data = Record<TableName, string[][]>

/** JSON store; persists to DATA_DIR when a directory is given, otherwise memory only (tests). */
export class LocalStore implements TableStore {
  readonly kind: 'file' | 'memory'
  private data: Data | null = null
  private writing: Promise<void> = Promise.resolve()

  constructor(private dir: string | null) {
    this.kind = dir ? 'file' : 'memory'
  }

  private file() {
    return path.join(this.dir!, 'db.json')
  }

  private async load(): Promise<Data> {
    if (this.data) return this.data
    const empty: Data = { settings: [], submissions: [], admins: [], audit_log: [] }
    if (this.dir) {
      try {
        const raw = JSON.parse(await fs.readFile(this.file(), 'utf8')) as Partial<Data>
        this.data = { ...empty, ...raw }
        return this.data
      } catch {
        /* first run */
      }
    }
    this.data = empty
    return this.data
  }

  private async persist() {
    if (!this.dir) return
    const snapshot = JSON.stringify(this.data)
    this.writing = this.writing.then(async () => {
      await fs.mkdir(this.dir!, { recursive: true })
      const tmp = this.file() + '.' + process.pid + '.tmp'
      await fs.writeFile(tmp, snapshot)
      await fs.rename(tmp, this.file())
    })
    await this.writing
  }

  async ensureSchema() {
    await this.load()
  }

  async read(table: TableName): Promise<TableData> {
    const d = await this.load()
    return { header: [...TABLES[table]], rows: d[table].map((r) => [...r]) }
  }

  async append(table: TableName, rows: Row[]) {
    const d = await this.load()
    d[table].push(...rows.map((r) => r.map(cellToString)))
    await this.persist()
  }

  async update(table: TableName, updates: { index: number; row: Row }[]) {
    const d = await this.load()
    for (const u of updates) d[table][u.index] = u.row.map(cellToString)
    await this.persist()
  }
}
