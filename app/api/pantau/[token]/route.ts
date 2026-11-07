import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, limitOr429 } from '@/lib/http'
import { tracking } from '@/lib/participant-service'
import { setUserCookie } from '@/lib/user-session'

export const dynamic = 'force-dynamic'

// Live tracking: read straight from the spreadsheet on every call (the page polls every 15 s).
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const limited = limitOr429(req, 'pantau', 40)
  if (limited) return limited
  const data = await tracking(params.token)
  if (!data) return jsonError(404, 'Kode pantau tidak ditemukan. Periksa lagi kodenya.')
  const res = NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
  // Opening the unique link logs the participant in on this device.
  return setUserCookie(res, data.token)
}
