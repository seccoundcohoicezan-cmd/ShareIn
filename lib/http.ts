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
