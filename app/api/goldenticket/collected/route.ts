import { NextResponse, type NextRequest } from 'next/server'
import { limitOr429 } from '@/lib/http'
import { collectedFeed } from '@/lib/service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const limited = limitOr429(req, 'collected', 60)
  if (limited) return limited
  const offset = Math.max(0, Number(req.nextUrl.searchParams.get('offset')) || 0)
  return NextResponse.json(await collectedFeed(offset, 12), { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' } })
}
