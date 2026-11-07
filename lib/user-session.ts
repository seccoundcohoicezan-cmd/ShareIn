import type { NextResponse } from 'next/server'

// Participant "login" = their unique monitoring code, kept in an httpOnly cookie.
export const USER_COOKIE = 'si_user'

export function setUserCookie(res: NextResponse, token: string) {
  res.cookies.set(USER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 180 * 24 * 3600,
  })
  return res
}
