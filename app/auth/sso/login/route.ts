import { NextResponse, type NextRequest } from 'next/server'
import { limitOr429 } from '@/lib/http'
import { authorizationUrl, discover, newLoginState, safeReturn, SSO_COOKIE, ssoConfig } from '@/lib/mytopstar'
import { publicOrigin } from '@/lib/origin'

export const dynamic = 'force-dynamic'

const HOME = '/dutateladan/setor'

/**
 * Login initiation (OIDC Core §4): the "Masuk dengan MyTopstar" button and MyTopstar's app list both
 * start here. Registered in MyTopstar as the client's Initiate Login URI.
 */
export async function GET(req: NextRequest) {
  const limited = limitOr429(req, 'sso', 30)
  if (limited) return limited
  const origin = publicOrigin(req)
  const config = ssoConfig()
  if (!config) return NextResponse.redirect(new URL('/dutateladan?sso=belum-aktif', origin))
  const iss = req.nextUrl.searchParams.get('iss')
  if (iss && iss.replace(/\/$/, '') !== config.issuer) return NextResponse.redirect(new URL('/dutateladan?sso=gagal', origin))
  const sp = req.nextUrl.searchParams
  const state = newLoginState(safeReturn(sp.get('next') ?? sp.get('target_link_uri'), origin, HOME))
  try {
    const d = await discover(config.issuer)
    const res = NextResponse.redirect(authorizationUrl(d, config, config.redirectUri || `${origin}/auth/sso/callback`, state))
    res.cookies.set(SSO_COOKIE, JSON.stringify(state), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/auth/sso',
      maxAge: 600,
    })
    return res
  } catch (e) {
    console.error('mytopstar login failed', (e as Error).message)
    return NextResponse.redirect(new URL('/dutateladan?sso=gagal', origin))
  }
}
