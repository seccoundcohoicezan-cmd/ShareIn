import { NextResponse, type NextRequest } from 'next/server'
import { participantByToken } from '@/lib/participant-service'
import { USER_COOKIE } from '@/lib/user-session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.cookies.get(USER_COOKIE)?.value
  const me = token ? await participantByToken(token).catch(() => null) : null
  if (!me) return NextResponse.json({ user: null }, { headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json(
    { user: { name: me.name, whatsapp: me.whatsapp, token: me.token } },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
