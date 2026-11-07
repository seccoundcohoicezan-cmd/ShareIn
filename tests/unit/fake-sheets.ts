// In-memory imitation of the subset of the Sheets v4 API used by SheetsStore.
type Grid = unknown[][]

function parseRange(range: string) {
  const [title, cells = 'A1'] = range.split('!')
  const m = cells.match(/^([A-Z]+)?(\d+)?/)!
  return { title, row: m[2] ? Number(m[2]) - 1 : 0 }
}

export class FakeSheets {
  tabs = new Map<string, Grid>()
  calls: string[] = []

  client = {
    spreadsheets: {
      get: async () => {
        this.calls.push('get')
        return { data: { sheets: Array.from(this.tabs.keys()).map((title) => ({ properties: { title } })) } }
      },
      batchUpdate: async ({ requestBody }: { requestBody: { requests: { addSheet: { properties: { title: string } } }[] } }) => {
        this.calls.push('batchUpdate')
        for (const r of requestBody.requests) this.tabs.set(r.addSheet.properties.title, [])
        return { data: {} }
      },
      values: {
        batchGet: async ({ ranges }: { ranges: string[] }) => ({
          data: { valueRanges: ranges.map((r) => ({ values: (this.tabs.get(parseRange(r).title) ?? []).slice(0, 1) })) },
        }),
        get: async ({ range }: { range: string }) => {
          this.calls.push('values.get')
          return { data: { values: (this.tabs.get(parseRange(range).title) ?? []).map((r) => [...r]) } }
        },
        append: async ({ range, requestBody }: { range: string; requestBody: { values: unknown[][] } }) => {
          this.calls.push('values.append')
          const grid = this.tabs.get(parseRange(range).title)!
          grid.push(...requestBody.values.map((r) => [...r]))
          return { data: {} }
        },
        batchUpdate: async ({ requestBody }: { requestBody: { data: { range: string; values: unknown[][] }[] } }) => {
          this.calls.push('values.batchUpdate')
          for (const d of requestBody.data) {
            const { title, row } = parseRange(d.range)
            const grid = this.tabs.get(title)!
            d.values.forEach((v, i) => (grid[row + i] = [...v]))
          }
          return { data: {} }
        },
      },
    },
  }
}
