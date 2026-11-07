// Runs the real apps-script/Code.js in a Node VM against an in-memory spreadsheet,
// so AppsScriptStore can be tested end-to-end without Google.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'

class FakeRange {
  constructor(private sh: FakeSheet, private r: number, private c: number, private nr: number, private nc: number) {}
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
      row.forEach((cell, j) => {
        let s = String(cell)
        if (s.startsWith('=')) throw new Error('formula written: ' + s)
        if (s.startsWith("'")) s = s.slice(1) // leading apostrophe = forced text, hidden by Sheets
        target[this.c - 1 + j] = s
      })
    })
    return this
  }
  setNumberFormat() { return this }
  setFontWeight() { return this }
  getDataValidation() { return this.sh.validation }
  setDataValidation(v: unknown) { this.sh.validation = v; return this }
}

class FakeSheet {
  grid: string[][] = []
  validation: unknown = null
  rules: unknown[] = []
  getConditionalFormatRules() { return this.rules }
  setConditionalFormatRules(r: unknown[]) { this.rules = r }
  constructor(public name: string) {}
  getLastRow() {
    for (let i = this.grid.length - 1; i >= 0; i--) if (this.grid[i]?.some((c) => c !== '' && c !== undefined)) return i + 1
    return 0
  }
  getLastColumn() {
    return Math.max(0, ...this.grid.map((r) => (r ? r.length : 0)))
  }
  getMaxRows() { return Math.max(1000, this.grid.length) }
  getRange(r: number, c: number, nr = 1, nc = 1) { return new FakeRange(this, r, c, nr, nc) }
  setFrozenRows() {}
}

export function createAppsScriptSim(secret: string) {
  const sheets = new Map<string, FakeSheet>()
  let lockHeld = false
  const ss = {
    getName: () => 'ShareIn (sim)',
    getSheetByName: (n: string) => sheets.get(n) ?? null,
    insertSheet: (n: string) => { const s = new FakeSheet(n); sheets.set(n, s); return s },
  }
  const ctx = vm.createContext({
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
    LockService: { getScriptLock: () => ({ waitLock: () => { if (lockHeld) throw new Error('lock busy'); lockHeld = true }, releaseLock: () => { lockHeld = false } }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (t: string) => ({ setMimeType: () => ({ getContent: () => t }) }),
    },
    Logger: { log: () => {} },
  })
  vm.runInContext(`var API_SECRET = ${JSON.stringify(secret)};`, ctx)
  vm.runInContext(readFileSync(path.join(__dirname, '../../apps-script/Code.js'), 'utf8'), ctx)
  const doPost = vm.runInContext('doPost', ctx) as (e: unknown) => { getContent(): string }
  return {
    sheets,
    poster: async (_url: string, body: string) => ({ status: 200, text: doPost({ postData: { contents: body } }).getContent() }),
  }
}
