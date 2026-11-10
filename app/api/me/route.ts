import { NextResponse, type NextRequest } from 'next/server'
import { ssoConfig } from '@/lib/mytopstar'
import { participantByToken } from '@/lib/participant-service'
import { asProgram } from '@/lib/program-param'
import { getSettings } from '@/lib/repo/settings'
import { listSubmissionsCached } from '@/lib/repo/submissions'
import { USER_COOKIE } from '@/lib/user-session'
import { weeklyProgress } from '@/lib/weekly'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

/** Logged-in participant; with ?program=pelatihan|duta also this week's progress toward the minimum. */
export async function GET(req: NextRequest) {
  const sso = Boolean(ssoConfig())
  const token = req.cookies.get(USER_COOKIE)?.value
  const me = token ? await participantByToken(token).catch(() => null) : null
  if (!me) return NextResponse.json({ user: null, sso }, { headers: NO_STORE })
  const program = asProgram(req.nextUrl.searchParams.get('program') ?? '')
  const weekly = program
    ? await Promise.all([listSubmissionsCached(), getSettings()]).then(([all, settings]) => weeklyProgress(all, settings, program, me.whatsapp)).catch(() => null)
    : null
  return NextResponse.json({ user: { name: me.name, whatsapp: me.whatsapp, token: me.token }, sso, weekly }, { headers: NO_STORE })
}
