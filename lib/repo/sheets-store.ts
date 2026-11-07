import { sheets as sheetsApi, auth as gauth, type sheets_v4 } from '@googleapis/sheets'
import { cellToString, TABLES, type Row, type TableData, type TableName, type TableStore } from './store'

export type SheetsClient = Pick<sheets_v4.Sheets, 'spreadsheets'>

function colLetter(n: number): string {
  let s = ''
  for (let i = n; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s
  return s
}

export function createSheetsClient(email: string, privateKey: string): SheetsClient {
  const jwt = new gauth.JWT({
    email,
    key: privateKey.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
  return sheetsApi({ version: 'v4', auth: jwt })
}

export class SheetsStore implements TableStore {
  readonly kind = 'sheets' as const
  private headers = new Map<TableName, string[]>()
  private ensured: Promise<void> | null = null

  constructor(private client: SheetsClient, private spreadsheetId: string) {}

  ensureSchema(): Promise<void> {
    this.ensured ??= this.doEnsure().catch((e) => {
      this.ensured = null
      throw e
    })
    return this.ensured
  }

  private async doEnsure() {
    const meta = await this.client.spreadsheets.get({ spreadsheetId: this.spreadsheetId, fields: 'sheets.properties.title' })
    const existing = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title ?? ''))
    const missing = (Object.keys(TABLES) as TableName[]).filter((t) => !existing.has(t))
    if (missing.length) {
      await this.client.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { requests: missing.map((title) => ({ addSheet: { properties: { title } } })) },
      })
    }
    const res = await this.client.spreadsheets.values.batchGet({
      spreadsheetId: this.spreadsheetId,
      ranges: (Object.keys(TABLES) as TableName[]).map((t) => `${t}!1:1`),
    })
    const writes: sheets_v4.Schema$ValueRange[] = []
    ;(Object.keys(TABLES) as TableName[]).forEach((t, i) => {
      const header = (res.data.valueRanges?.[i]?.values?.[0] ?? []).map(cellToString)
      const want = TABLES[t] as readonly string[]
      const merged = [...header]
      for (const col of want) if (!merged.includes(col)) merged.push(col)
      if (merged.length !== header.length) writes.push({ range: `${t}!A1`, values: [merged] })
      this.headers.set(t, merged)
    })
    if (writes.length) {
      await this.client.spreadsheets.values.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { valueInputOption: 'RAW', data: writes },
      })
    }
  }

  async read(table: TableName): Promise<TableData> {
    await this.ensureSchema()
    const res = await this.client.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${table}!A1:${colLetter(40)}`,
      valueRenderOption: 'UNFORMATTED_VALUE',
      dateTimeRenderOption: 'FORMATTED_STRING',
    })
    const values = (res.data.values ?? []).map((r) => r.map(cellToString))
    const header = values[0] ?? [...TABLES[table]]
    this.headers.set(table, header)
    return { header, rows: values.slice(1) }
  }

  async append(table: TableName, rows: Row[]) {
    await this.ensureSchema()
    await this.client.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${table}!A1`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: rows },
    })
  }

  async update(table: TableName, updates: { index: number; row: Row }[]) {
    if (!updates.length) return
    await this.ensureSchema()
    await this.client.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        valueInputOption: 'RAW',
        data: updates.map((u) => ({ range: `${table}!A${u.index + 2}`, values: [u.row] })),
      },
    })
  }

  headerOf(table: TableName): string[] {
    return this.headers.get(table) ?? [...TABLES[table]]
  }
}
