import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, requireAdmin, sameOrigin } from '@/lib/http'
import { revalidatePublic } from '@/lib/revalidate'
import { resetRound } from '@/lib/spin'

export const dynamic = 'force-dynamic'

/** Owner only: starts a new draw round (everyone collects again from zero). */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const s = await requireAdmin(req, ['owner'])
  if (s instanceof NextResponse) return s
  const round = await resetRound(s.email)
  revalidatePublic()
  return NextResponse.json({ ok: true, round })
}
