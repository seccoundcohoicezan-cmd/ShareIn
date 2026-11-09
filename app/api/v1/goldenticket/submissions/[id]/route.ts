import { NextResponse, type NextRequest } from 'next/server'
import { findGolden } from '@/lib/golden-api'
import { requireApiKey } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const denied = await requireApiKey(req)
  if (denied) return denied
  const item = await findGolden(params.id)
  if (!item) return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 })
  return NextResponse.json({ ok: true, item }, { headers: { 'Cache-Control': 'no-store' } })
}
