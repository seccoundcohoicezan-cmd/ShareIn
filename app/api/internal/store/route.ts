import { getPrimaryEngine, isPrimaryHost } from '@/lib/primary/local'
import { DEFAULT_APPS_SCRIPT_URL, dataDir } from '@/lib/repo'

// The primary database endpoint, spoken with the Apps Script protocol ({ secret, ops }). Only the
// self-hosted server (DATA_PRIMARY=1) answers; everywhere else it does not exist.
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(req: Request) {
  const secret = process.env.APPS_SCRIPT_SECRET
  if (!isPrimaryHost() || !secret) return new Response('Not found', { status: 404 })
  const engine = getPrimaryEngine(process.env.APPS_SCRIPT_URL || DEFAULT_APPS_SCRIPT_URL, secret, dataDir())
  const out = await engine.handle(await req.text())
  return new Response(out.text, { status: out.status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
}
