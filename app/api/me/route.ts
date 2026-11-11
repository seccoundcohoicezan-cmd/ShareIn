import { NextResponse, type NextRequest } from 'next/server'
import { ssoConfig } from '@/lib/mytopstar'
import { participantByToken } from '@/lib/participant-service'
import { asProgram } from '@/lib/program-param'
import { getSettings } from '@/lib/repo/settings'
import { listSubmissionsCached } from '@/lib/repo/submissions'
import { USER_COOKIE } from '@/lib/user-session'
import { progressFor } from '@/lib/progress'

export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

/** Logged-in participant; with ?program=pelatihan|duta also their progress toward the target. */
export async function GET(req: NextRequest) {
  const sso = Boolean(ssoConfig())
  const token = req.cookies.get(USER_COOKIE)?.value
  const me = token ? await participantByToken(token).catch(() => null) : null
  if (!me) return NextResponse.json({ user: null, sso }, { headers: NO_STORE })
  const program = asProgram(req.nextUrl.searchParams.get('program') ?? '')
  const progress = program
    ? await Promise.all([listSubmissionsCached(), getSettings()]).then(([all, settings]) => progressFor(all, settings, program, me.whatsapp)).catch(() => null)
    : null
  return NextResponse.json({ user: { name: me.name, whatsapp: me.whatsapp, token: me.token }, sso, progress }, { headers: NO_STORE })
}
