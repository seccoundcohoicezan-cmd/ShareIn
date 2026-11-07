import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE, verifySession } from './lib/session'

// Build redirects from the incoming Host header: nextUrl may carry Next's internal hostname
// (e.g. "localhost"), which would move the browser to another origin without the session cookie.
function redirectTo(req: NextRequest, path: string) {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host
  const proto = req.headers.get('x-forwarded-proto') || req.nextUrl.protocol.replace(':', '')
  return NextResponse.redirect(new URL(path, `${proto}://${host}`))
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (pathname === '/admin/login') return NextResponse.next()
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value)
  if (!session) {
    return redirectTo(req, pathname === '/admin' ? '/admin/login' : `/admin/login?next=${encodeURIComponent(pathname)}`)
  }
  if (pathname.startsWith('/admin/pengaturan') && session.role !== 'owner') return redirectTo(req, '/admin')
  return NextResponse.next()
}

export const config = { matcher: ['/admin', '/admin/:path*'] }
