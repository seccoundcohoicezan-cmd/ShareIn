import { NextResponse, type NextRequest } from 'next/server'
import { adminList, filterSchema } from '@/lib/admin-service'
import { jsonError, requireAdmin } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const s = await requireAdmin(req)
  if (s instanceof NextResponse) return s
  const f = filterSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!f.success) return jsonError(400, 'Filter tidak valid.')
  return NextResponse.json(await adminList(f.data))
}
