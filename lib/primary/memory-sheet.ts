// An in-memory stand-in for the Apps Script spreadsheet API, just enough for apps-script/Code.js.
// Production uses it to run the real Code.js as the primary database (lib/primary/engine.ts); the
// unit tests use it to exercise AppsScriptStore end-to-end without Google.

export class MemoryRange {
  constructor(private sh: MemorySheet, private r: number, private c: number, private nr: number, private nc: number) {}
  getValues() {
    const out: unknown[][] = []
    for (let i = 0; i < this.nr; i++) {
      const row: unknown[] = []
      for (let j = 0; j < this.nc; j++) row.push(this.sh.grid[this.r - 1 + i]?.[this.c - 1 + j] ?? '')
      out.push(row)
    }
    return out
  }
  setValues(v: unknown[][]) {
    if (v.length !== this.nr || v.some((r) => r.length !== this.nc)) throw new Error('dimension mismatch')
    v.forEach((row, i) => {
      const target = (this.sh.grid[this.r - 1 + i] ??= [])
      for (let k = 0; k < this.c - 1; k++) if (target[k] === undefined) target[k] = ''
      row.forEach((cell, j) => {
        let s = String(cell)
        if (s.startsWith('=') && this.sh.strict) throw new Error('formula written: ' + s)
        if (s.startsWith("'")) s = s.slice(1) // leading apostrophe = forced text, hidden by Sheets
        target[this.c - 1 + j] = s
      })
    })
    return this
  }
  clearContent() {
    for (let i = 0; i < this.nr; i++) {
      const row = this.sh.grid[this.r - 1 + i]
      if (row) for (let j = 0; j < this.nc; j++) if (this.c - 1 + j < row.length) row[this.c - 1 + j] = ''
    }
    // Trailing empty rows are dropped so the grid does not keep growing.
    while (this.sh.grid.length && !this.sh.grid[this.sh.grid.length - 1]?.some((x) => x !== '' && x !== undefined)) this.sh.grid.pop()
    return this
  }
  setNumberFormat() { return this }
  setFontWeight() { return this }
  getDataValidation() { return this.sh.validation }
  setDataValidation(v: unknown) { this.sh.validation = v; return this }
}

export class MemorySheet {
  grid: string[][] = []
  validation: unknown = null
  rules: unknown[] = []
  /** Tests: fail loudly if Code.js would ever write a formula. */
  strict = false
  constructor(public name: string) {}
  getConditionalFormatRules() { return this.rules }
  setConditionalFormatRules(r: unknown[]) { this.rules = r }
  getLastRow() {
    for (let i = this.grid.length - 1; i >= 0; i--) if (this.grid[i]?.some((c) => c !== '' && c !== undefined)) return i + 1
    return 0
  }
  getLastColumn() {
    return Math.max(0, ...this.grid.map((r) => (r ? r.length : 0)))
  }
  getMaxRows() { return Math.max(1000, this.grid.length) }
  getRange(r: number, c: number, nr = 1, nc = 1) { return new MemoryRange(this, r, c, nr, nc) }
  setFrozenRows() {}
}

export class MemorySpreadsheet {
  sheets = new Map<string, MemorySheet>()
  constructor(private strict = false) {}
  getName() { return 'ShareIn (memori)' }
  getSheetByName(n: string) { return this.sheets.get(n) ?? null }
  insertSheet(n: string) {
    const s = new MemorySheet(n)
    s.strict = this.strict
    this.sheets.set(n, s)
    return s
  }
  toJSON(): Record<string, string[][]> {
    return Object.fromEntries(Array.from(this.sheets, ([n, s]) => [n, s.grid]))
  }
  load(data: Record<string, string[][]>) {
    this.sheets.clear()
    for (const [n, grid] of Object.entries(data)) this.insertSheet(n).grid = grid.map((r) => (r ?? []).map((c) => c ?? ''))
  }
}

/** Builds the global objects Code.js expects (SpreadsheetApp, LockService, ...) around a spreadsheet. */
export function appsScriptGlobals(ss: MemorySpreadsheet, lock: { waitLock(ms: number): void; releaseLock(): void }) {
  return {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      flush: () => {},
      newDataValidation: () => {
        const b = { requireValueInList: () => b, setAllowInvalid: () => b, build: () => ({ kind: 'list' }) }
        return b
      },
      newConditionalFormatRule: () => {
        const b = { whenTextEqualTo: () => b, setBackground: () => b, setRanges: () => b, build: () => ({ kind: 'rule' }) }
        return b
      },
    },
    LockService: { getScriptLock: () => lock },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (t: string) => ({ setMimeType: () => ({ getContent: () => t }) }),
    },
    Logger: { log: () => {} },
  }
}
