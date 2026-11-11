import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, requireAdmin } from '@/lib/http'
import { asProgram } from '@/lib/program-param'
import { recap } from '@/lib/progress'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const s = await requireAdmin(req)
  if (s instanceof NextResponse) return s
  const program = asProgram(req.nextUrl.searchParams.get('program') ?? '')
  if (!program) return jsonError(404, 'Program tidak ditemukan.')
  return NextResponse.json(await recap(program, req.nextUrl.searchParams.get('semua') === '1'))
}
