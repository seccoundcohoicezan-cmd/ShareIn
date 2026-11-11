import { invalidate } from '../cache'
import { getStore } from './index'
import { appendThenRead, recordToRow, rowToRecord, writeHeader, type Cell, type TableName, type WriteOp } from './store'

export type Stored<T> = T & { _index: number }

/** Typed access to a table whose rows map 1:1 to records by header name. */
export function recordTable<T extends { id: string }>(
  table: TableName,
  from: (rec: Record<string, string>) => T,
  to: (v: T) => Record<string, Cell>,
) {
  let header: string[] | null = null
  async function list(): Promise<Stored<T>[]> {
    const data = await getStore().read(table)
    header = data.header
    return data.rows
      .map((r, i) => ({ ...from(rowToRecord(data.header, r)), _index: i }))
      .filter((x) => x.id)
  }
  async function head() {
    if (!header) await list()
    header = await writeHeader(getStore(), table, header)
    return header
  }
  return {
    list,
    async append(items: T[]) {
      const h = await head()
      await getStore().append(table, items.map((v) => recordToRow(h, to(v))))
      invalidate(table)
    },
    /** Appends and returns the refreshed list (one round trip on Apps Script). */
    async appendAndList(items: T[]): Promise<Stored<T>[]> {
      const h = await head()
      const data = await appendThenRead(getStore(), table, items.map((v) => recordToRow(h, to(v))))
      invalidate(table)
      header = data.header
      return data.rows.map((r, i) => ({ ...from(rowToRecord(data.header, r)), _index: i })).filter((x) => x.id)
    },
    /** Rows to append, for a combined write with other tables. */
    async rowsFor(items: T[]): Promise<{ table: TableName; rows: Cell[][] }> {
      const h = await head()
      return { table, rows: items.map((v) => recordToRow(h, to(v))) }
    },
    /** Parses a table returned by a combined write and clears its cache. */
    fromTable(data: { header: string[]; rows: string[][] }): Stored<T>[] {
      invalidate(table)
      header = data.header
      return data.rows.map((r, i) => ({ ...from(rowToRecord(data.header, r)), _index: i })).filter((x) => x.id)
    },
    /** Write operations for batching with other writes (e.g. the audit row) via writeAll. */
    async appendOp(items: T[]): Promise<WriteOp> {
      const h = await head()
      return { action: 'append', table, rows: items.map((v) => recordToRow(h, to(v))) }
    },
    async updateOp(items: Stored<T>[]): Promise<WriteOp> {
      const h = await head()
      return { action: 'update', table, updates: items.map((v) => ({ index: v._index, row: recordToRow(h, to(v)) })) }
    },
    async update(items: Stored<T>[]) {
      const h = await head()
      await getStore().update(
        table,
        items.map((v) => ({ index: v._index, row: recordToRow(h, to(v)) })),
      )
      invalidate(table)
    },
  }
}

export function strip<T>(v: Stored<T>): T {
  const { _index, ...rest } = v
  void _index
  return rest as T
}
