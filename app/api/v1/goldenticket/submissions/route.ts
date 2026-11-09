import { NextResponse, type NextRequest } from 'next/server'
import { goldenListSchema, listGolden } from '@/lib/golden-api'
import { requireApiKey } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const denied = await requireApiKey(req)
  if (denied) return denied
  const q = goldenListSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!q.success) return NextResponse.json({ ok: false, error: 'invalid_query', message: q.error.issues[0]?.message, field: q.error.issues[0]?.path[0] }, { status: 400 })
  return NextResponse.json({ ok: true, ...(await listGolden(q.data)) }, { headers: { 'Cache-Control': 'no-store' } })
}
