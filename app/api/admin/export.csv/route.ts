import { NextResponse, type NextRequest } from 'next/server'
import { adminList, filterSchema, toCsv } from '@/lib/admin-service'
import { jsonError, requireAdmin } from '@/lib/http'
import { audit } from '@/lib/repo/audit'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const s = await requireAdmin(req)
  if (s instanceof NextResponse) return s
  const f = filterSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!f.success) return jsonError(400, 'Filter tidak valid.')
  const { items } = await adminList(f.data)
  await audit(s.email, 'submissions.export', 'csv', f.data, { rows: items.length })
  const stamp = new Date().toISOString().slice(0, 10)
  return new NextResponse(toCsv(items), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="setoran-sharein-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
