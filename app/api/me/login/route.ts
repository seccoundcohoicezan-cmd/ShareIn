import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { jsonError, limitOr429, readJson } from '@/lib/http'
import { participantByToken } from '@/lib/participant-service'
import { setUserCookie } from '@/lib/user-session'

// Room for Apps Script busy-retries during a burst (Vercel's default limit is shorter).
export const maxDuration = 60

const schema = z.object({ link: z.string().trim().min(1).max(300) })

/** Log in by pasting the unique monitoring link (or just its code). */
export async function POST(req: NextRequest) {
  const limited = limitOr429(req, 'me-login', 600)
  if (limited) return limited
  const body = schema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, 'Tempel link pantau atau kodenya.')
  const code = body.data.link.match(/pantau\/([A-Za-z0-9-]+)/)?.[1] ?? body.data.link
  const me = await participantByToken(code)
  if (!me) return jsonError(404, 'Link pantau tidak dikenali. Periksa lagi atau isi nama dan WhatsApp.')
  const res = NextResponse.json({ user: { name: me.name, whatsapp: me.whatsapp, token: me.token } })
  return setUserCookie(res, me.token)
}
