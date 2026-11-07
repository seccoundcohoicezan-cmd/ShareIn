import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, requireAdmin } from '@/lib/http'
import { asProgram } from '@/lib/program-param'
import { adminTaskSubmissions, taskFilterSchema } from '@/lib/program-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { program: string } }) {
  const s = await requireAdmin(req)
  if (s instanceof NextResponse) return s
  const program = asProgram(params.program)
  if (!program) return jsonError(404, 'Program tidak ditemukan.')
  const f = taskFilterSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!f.success) return jsonError(400, 'Filter tidak valid.')
  return NextResponse.json(await adminTaskSubmissions(program, f.data))
}
