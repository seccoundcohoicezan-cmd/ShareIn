import { NextResponse, type NextRequest } from 'next/server'
import { changePassword, changePasswordSchema } from '@/lib/account-service'
import { jsonError, readJson, requireAdmin, sameOrigin } from '@/lib/http'
import { rateLimit } from '@/lib/ratelimit'

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const s = await requireAdmin(req)
  if (s instanceof NextResponse) return s
  if (!rateLimit(`pw:${s.email}`, 5, 15 * 60_000).ok) return jsonError(429, 'Terlalu banyak percobaan. Coba lagi 15 menit lagi.')
  const body = changePasswordSchema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, body.error.issues[0]?.message ?? 'Data tidak valid.')
  const err = await changePassword(s.email, body.data.current, body.data.next)
  return err ? jsonError(400, err) : NextResponse.json({ ok: true })
}
