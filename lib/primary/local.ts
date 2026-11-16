import path from 'node:path'
import { defaultPoster } from '../repo/apps-script-store'
import { PrimaryEngine } from './engine'

// One engine per process, shared by every server bundle (route handlers, pages, instrumentation).
const g = globalThis as unknown as { __shareinPrimary?: PrimaryEngine }

export function isPrimaryHost(): boolean {
  return process.env.DATA_PRIMARY === '1'
}

export function getPrimaryEngine(sheetUrl: string, secret: string, dataDir: string): PrimaryEngine {
  if (g.__shareinPrimary) return g.__shareinPrimary
  const engine = new PrimaryEngine({ secret, file: path.join(dataDir, 'primary.json'), mirror: { url: sheetUrl, post: defaultPoster } })
  g.__shareinPrimary = engine
  // Docker stops containers with SIGTERM: save and push the last writes before exiting.
  const stop = () => {
    const done = () => process.exit(0)
    void engine.drain().then(done, done)
    setTimeout(done, 8000).unref()
  }
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)
  return engine
}
