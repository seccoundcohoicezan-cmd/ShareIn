import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit } from './ratelimit'
import { SESSION_COOKIE, verifySession, type Session } from './session'
import type { AdminRole } from './types'

export function clientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.ip ||
    'unknown'
  )
}

export function jsonError(status: number, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, error: message, ...extra }, { status })
}

/** 30 requests/minute/IP for public routes unless a tighter limit is given. */
export function limitOr429(req: NextRequest, bucket: string, limit = 30, windowMs = 60_000) {
  const r = rateLimit(`${bucket}:${clientIp(req)}`, limit, windowMs)
  if (r.ok) return null
  return NextResponse.json(
    { ok: false, error: `Terlalu banyak permintaan. Coba lagi dalam ${r.retryAfter} detik.` },
    { status: 429, headers: { 'Retry-After': String(r.retryAfter) } },
  )
}

export async function requireAdmin(
  req: NextRequest,
  roles: AdminRole[] = ['owner', 'reviewer'],
): Promise<Session | NextResponse> {
  const s = await verifySession(req.cookies.get(SESSION_COOKIE)?.value)
  if (!s) return jsonError(401, 'Sesi berakhir. Masuk lagi.')
  if (!roles.includes(s.role)) return jsonError(403, 'Peran kamu tidak punya akses ke fitur ini.')
  return s
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return null
  }
}

/** Blocks cross-site form posts to cookie-authenticated routes. */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === (req.headers.get('x-forwarded-host') || req.headers.get('host'))
  } catch {
    return false
  }
}

/** Authenticates server-to-server API calls: `Authorization: Bearer <key>` or `X-API-Key: <key>`. */
export async function requireApiKey(req: NextRequest): Promise<NextResponse | null> {
  const ipLimit = rateLimit(`apikey-ip:${clientIp(req)}`, 300, 60_000)
  if (!ipLimit.ok) return NextResponse.json({ ok: false, error: 'rate_limited', retry_after: ipLimit.retryAfter }, { status: 429, headers: { 'Retry-After': String(ipLimit.retryAfter) } })
  const bearer = req.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  const key = (bearer ?? req.headers.get('x-api-key') ?? '').trim()
  const { verifyApiKey } = await import('./api-key-service')
  const found = key ? await verifyApiKey(key) : null
  if (!found) return NextResponse.json({ ok: false, error: 'invalid_api_key' }, { status: 401, headers: { 'WWW-Authenticate': 'Bearer' } })
  const limit = rateLimit(`apikey:${found.id}`, 120, 60_000)
  if (!limit.ok) return NextResponse.json({ ok: false, error: 'rate_limited', retry_after: limit.retryAfter }, { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } })
  return null
}
