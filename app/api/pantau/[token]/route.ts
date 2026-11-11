import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, limitKey, limitOr429 } from '@/lib/http'
import { tracking } from '@/lib/participant-service'
import { USER_COOKIE } from '@/lib/user-session'

// Room for Apps Script busy-retries during a burst (Vercel's default limit is shorter).
export const maxDuration = 60

export const dynamic = 'force-dynamic'

// Live tracking: read straight from the spreadsheet on every call (the page polls every 15 s).
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const limited = limitOr429(req, 'pantau', 3000)
  if (limited) return limited
  // One personal page polls every 15 s; 30 a minute leaves room for a few open tabs.
  const perLink = limitKey(`pantau-token:${params.token.toUpperCase()}`, 30)
  if (perLink) return perLink
  const data = await tracking(params.token)
  if (!data) return jsonError(404, 'Kode pantau tidak ditemukan. Periksa lagi kodenya.')
  // Opening a link does NOT log in: admins open participants' links too, and a shared link would
  // otherwise silently switch this browser to someone else. The page offers an explicit button.
  const isMe = req.cookies.get(USER_COOKIE)?.value?.toUpperCase().replace(/[^A-Z0-9]/g, '') === data.token
  return NextResponse.json({ ...data, isMe }, { headers: { 'Cache-Control': 'no-store' } })
}
