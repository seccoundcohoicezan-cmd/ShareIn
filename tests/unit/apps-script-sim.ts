// Runs the real apps-script/Code.js in a Node VM against an in-memory spreadsheet,
// so AppsScriptStore can be tested end-to-end without Google.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { appsScriptGlobals, MemorySpreadsheet } from '@/lib/primary/memory-sheet'

export function createAppsScriptSim(secret: string) {
  const ss = new MemorySpreadsheet(true)
  let lockHeld = false
  const ctx = vm.createContext(
    appsScriptGlobals(ss, { waitLock: () => { if (lockHeld) throw new Error('lock busy'); lockHeld = true }, releaseLock: () => { lockHeld = false } }),
  )
  vm.runInContext(`var API_SECRET = ${JSON.stringify(secret)};`, ctx)
  vm.runInContext(readFileSync(path.join(__dirname, '../../apps-script/Code.js'), 'utf8'), ctx)
  const doPost = vm.runInContext('doPost', ctx) as (e: unknown) => { getContent(): string }
  return {
    sheets: ss.sheets,
    /** Replaces a tab's header row, e.g. to mimic a sheet created before a column existed. */
    setHeader: (name: string, header: string[]) => {
      ss.sheets.get(name)!.grid[0] = [...header]
    },
    poster: async (_url: string, body: string) => ({ status: 200, text: doPost({ postData: { contents: body } }).getContent() }),
  }
}
