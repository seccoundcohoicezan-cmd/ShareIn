import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, limitOr429 } from '@/lib/http'
import { asChannel } from '@/lib/program-param'
import { collectedFeed, FEED_PAGE } from '@/lib/service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const limited = limitOr429(req, 'collected', 3000)
  if (limited) return limited
  const program = asChannel(req.nextUrl.searchParams.get('program') ?? 'golden')
  if (!program) return jsonError(404, 'Program tidak ditemukan.')
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get('offset')) || 0)
  return NextResponse.json(await collectedFeed(offset, FEED_PAGE, program), { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } })
}
