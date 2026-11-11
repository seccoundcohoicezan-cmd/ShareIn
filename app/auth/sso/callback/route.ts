import { NextResponse, type NextRequest } from 'next/server'
import { limitOr429 } from '@/lib/http'
import { completeLogin, discover, SSO_COOKIE, ssoConfig, type LoginState } from '@/lib/mytopstar'
import { publicOrigin } from '@/lib/origin'
import { participantFromSso } from '@/lib/participant-service'
import { setUserCookie } from '@/lib/user-session'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function readState(raw: string | undefined): LoginState | null {
  try {
    const s = JSON.parse(raw ?? '') as LoginState
    return s && typeof s.state === 'string' && typeof s.verifier === 'string' && typeof s.ret === 'string' ? s : null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const limited = limitOr429(req, 'sso', 600)
  if (limited) return limited
  const origin = publicOrigin(req)
  const fail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/dutateladan?sso=${reason}`, origin))
    res.cookies.delete({ name: SSO_COOKIE, path: '/auth/sso' })
    return res
  }
  const config = ssoConfig()
  if (!config) return fail('belum-aktif')
  const sp = req.nextUrl.searchParams
  const saved = readState(req.cookies.get(SSO_COOKIE)?.value)
  // Cancelled on the consent screen, or the cookie expired: start over from the button.
  if (sp.get('error')) return fail(sp.get('error') === 'access_denied' ? 'dibatalkan' : 'gagal')
  if (!saved || !sp.get('code') || sp.get('state') !== saved.state) return fail('kedaluwarsa')
  const iss = sp.get('iss')
  if (iss && iss.replace(/\/$/, '') !== config.issuer) return fail('gagal')
  try {
    const d = await discover(config.issuer)
    const user = await completeLogin(d, config, config.redirectUri || `${origin}/auth/sso/callback`, sp.get('code')!, saved.verifier)
    const me = await participantFromSso(user)
    if (!me) return fail('tanpa-hp')
    const res = NextResponse.redirect(new URL(saved.ret, origin))
    res.cookies.delete({ name: SSO_COOKIE, path: '/auth/sso' })
    return setUserCookie(res, me.token)
  } catch (e) {
    console.error('mytopstar callback failed', (e as Error).message)
    return fail('gagal')
  }
}
