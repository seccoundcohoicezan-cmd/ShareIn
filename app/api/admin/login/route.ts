import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { authenticate } from '@/lib/auth'
import { clientIp, jsonError, readJson, sameOrigin } from '@/lib/http'
import { rateLimit, resetRateLimit } from '@/lib/ratelimit'
import { audit } from '@/lib/repo/audit'
import { SESSION_COOKIE, SESSION_TTL_S, signSession } from '@/lib/session'

const schema = z.object({ email: z.string().trim().email().max(120), password: z.string().min(1).max(200) })

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const body = schema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, 'Isi email dan sandi dengan benar.')
  const key = `login:${clientIp(req)}:${body.data.email.toLowerCase()}`
  const limit = rateLimit(key, 5, 15 * 60_000)
  if (!limit.ok) {
    return jsonError(429, `Terlalu banyak percobaan. Coba lagi dalam ${Math.ceil(limit.retryAfter / 60)} menit.`)
  }
  const admin = await authenticate(body.data.email, body.data.password)
  if (!admin) return jsonError(401, 'Email atau sandi salah. Periksa lalu coba lagi.')
  resetRateLimit(key)
  await audit(admin.email, 'admin.login', admin.email, '', '')
  const res = NextResponse.json({ ok: true, role: admin.role })
  res.cookies.set(SESSION_COOKIE, await signSession(admin), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_S,
  })
  return res
}
