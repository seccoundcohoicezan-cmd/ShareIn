// Load-test stand-in for the Apps Script Web App: runs the real apps-script/Code.js (via the unit-test
// sim) behind HTTP with Google-like behaviour: ~1 s per call plus per-op cost, at most 30 executions at
// once (more → "too many simultaneous invocations"), and writes serialized by LockService (25 s wait).
import { createServer } from 'node:http'
import { createAppsScriptSim } from '../unit/apps-script-sim'

const PORT = Number(process.env.SIM_PORT || 39200)
const SECRET = process.env.APPS_SCRIPT_SECRET || 'x'.repeat(40)
const BASE_MS = Number(process.env.SIM_BASE_MS || 900)
const PER_OP_MS = Number(process.env.SIM_OP_MS || 120)
const WRITE_MS = Number(process.env.SIM_WRITE_MS || 450)
const MAX_CONCURRENT = Number(process.env.SIM_MAX || 30)

const sim = createAppsScriptSim(SECRET)
let running = 0
let lockTail: Promise<void> = Promise.resolve()
const stats = { calls: 0, ops: 0, rejected: 0, lockTimeouts: 0, peak: 0, writes: 0 }
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const jitter = (ms: number) => ms * (0.8 + Math.random() * 0.5)

createServer(async (req, res) => {
  if (req.url === '/stats') {
    res.end(JSON.stringify(stats))
    return
  }
  let body = ''
  for await (const c of req) body += c
  stats.calls++
  if (running >= MAX_CONCURRENT) {
    stats.rejected++
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ ok: false, error: 'Service invoked too many times in a short time: exec qps. Try Utilities.sleep(1000) between calls.' }))
    return
  }
  running++
  stats.peak = Math.max(stats.peak, running)
  try {
    const ops = (JSON.parse(body).ops ?? []) as { action: string }[]
    stats.ops += ops.length
    const writes = ops.some((o) => o.action !== 'read')
    await sleep(jitter(BASE_MS + PER_OP_MS * ops.length))
    if (!writes) {
      const out = await sim.poster('', body)
      res.writeHead(out.status, { 'content-type': 'application/json' })
      res.end(out.text)
      return
    }
    stats.writes++
    // LockService.getScriptLock().waitLock(25000)
    const prev = lockTail
    let release!: () => void
    lockTail = new Promise<void>((r) => (release = r))
    const timedOut = await Promise.race([prev.then(() => false), sleep(25_000).then(() => true)])
    try {
      if (timedOut) {
        stats.lockTimeouts++
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: false, error: 'Lock timeout: another process was holding the lock for too long.' }))
        return
      }
      await sleep(jitter(WRITE_MS))
      const out = await sim.poster('', body)
      res.writeHead(out.status, { 'content-type': 'application/json' })
      res.end(out.text)
    } finally {
      release()
    }
  } finally {
    running--
  }
}).listen(PORT, '127.0.0.1', () => console.log('apps-script sim on', PORT))
