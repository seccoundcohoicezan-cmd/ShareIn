import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { jsonError, limitOr429, readJson } from '@/lib/http'
import { parseAndResolve } from '@/lib/resolve'
import { LINK_RULE_MESSAGE } from '@/lib/url'

const schema = z.object({ url: z.string().trim().min(1).max(500) })

export async function POST(req: NextRequest) {
  const limited = limitOr429(req, 'parse')
  if (limited) return limited
  const body = schema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, 'Tempel link konten dulu.')
  const r = await parseAndResolve(body.data.url)
  if (typeof r === 'string') {
    const message =
      r === 'not_https'
        ? 'Link harus diawali https://.'
        : r === 'unresolved'
          ? 'Link pendek tidak bisa dibuka. Salin link lengkap dari browser.'
          : LINK_RULE_MESSAGE
    return NextResponse.json({ ok: false, reason: r, message })
  }
  return NextResponse.json({ ok: true, platform: r.platform, url: r.url, source_key: r.source_key })
}
