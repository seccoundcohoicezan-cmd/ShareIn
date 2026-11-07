import { revalidatePublic } from '@/lib/revalidate'
import { NextResponse, type NextRequest } from 'next/server'
import { reviewSchema } from '@/lib/admin-service'
import { jsonError, readJson, requireAdmin, sameOrigin } from '@/lib/http'
import { asProgram } from '@/lib/program-param'
import { reviewTaskSubmissions } from '@/lib/program-service'

export async function PATCH(req: NextRequest, { params }: { params: { program: string; id: string } }) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const s = await requireAdmin(req)
  if (s instanceof NextResponse) return s
  const program = asProgram(params.program)
  if (!program) return jsonError(404, 'Program tidak ditemukan.')
  const body = reviewSchema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, body.error.issues[0]?.message ?? 'Data tidak valid.')
  const [item] = await reviewTaskSubmissions(program, [params.id], body.data.action, body.data.reason, s.email)
  if (!item) return jsonError(404, 'Setoran tidak ditemukan.')
  revalidatePublic()
  return NextResponse.json({ ok: true, item })
}
