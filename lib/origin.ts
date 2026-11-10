import type { NextRequest } from 'next/server'

/** Public origin of the request; nextUrl may carry Next's internal host behind a proxy. */
export function publicOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || req.nextUrl.host
  const proto = req.headers.get('x-forwarded-proto')?.split(',')[0] || req.nextUrl.protocol.replace(':', '')
  return `${proto}://${host}`
}
