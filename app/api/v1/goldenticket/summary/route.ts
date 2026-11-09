import { NextResponse, type NextRequest } from 'next/server'
import { goldenSummary } from '@/lib/golden-api'
import { requireApiKey } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = await requireApiKey(req)
  if (denied) return denied
  return NextResponse.json({ ok: true, ...(await goldenSummary()) }, { headers: { 'Cache-Control': 'no-store' } })
}
