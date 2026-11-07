import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { jsonError, limitOr429, readJson } from '@/lib/http'
import { getAdapter } from '@/lib/metrics'
import { getSettings } from '@/lib/repo/settings'
import { parseAndResolve } from '@/lib/resolve'

const schema = z.object({ url: z.string().trim().min(1).max(500) })

export async function POST(req: NextRequest) {
  const limited = limitOr429(req, 'metrics', 10)
  if (limited) return limited
  const body = schema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, 'Tempel link konten dulu.')
  const settings = await getSettings()
  if (settings.metrics_adapter === 'off') return NextResponse.json({ ok: false, reason: 'off' })
  const link = await parseAndResolve(body.data.url)
  if (typeof link === 'string') return NextResponse.json({ ok: false, reason: 'invalid_url' })
  const m = await getAdapter(settings.metrics_adapter).fetch(link.url, link.platform)
  if (!m) return NextResponse.json({ ok: false, reason: 'unavailable' })
  return NextResponse.json({ ok: true, likes: m.likes, comments: m.comments })
}
