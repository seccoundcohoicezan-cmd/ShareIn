import { invalidate } from '../cache'
import { getStore } from './index'
import { recordToRow, rowToRecord, type Cell, type TableName } from './store'

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
    return header!
  }
  return {
    list,
    async append(items: T[]) {
      const h = await head()
      await getStore().append(table, items.map((v) => recordToRow(h, to(v))))
      invalidate(table)
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
