import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/http'
import { adminParticipants } from '@/lib/participant-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const s = await requireAdmin(req)
  if (s instanceof NextResponse) return s
  return NextResponse.json({ participants: await adminParticipants() })
}
