import { revalidatePublic } from '@/lib/revalidate'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { jsonError, readJson, requireAdmin, sameOrigin } from '@/lib/http'
import { asProgram } from '@/lib/program-param'
import { reviewTaskSubmissions } from '@/lib/program-service'

const schema = z.object({ ids: z.array(z.string().max(40)).min(1).max(300) })

export async function POST(req: NextRequest, { params }: { params: { program: string } }) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const s = await requireAdmin(req)
  if (s instanceof NextResponse) return s
  const program = asProgram(params.program)
  if (!program) return jsonError(404, 'Program tidak ditemukan.')
  const body = schema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, 'Pilih setoran yang mau disetujui.')
  const items = await reviewTaskSubmissions(program, body.data.ids, 'approve', '', s.email)
  revalidatePublic()
  return NextResponse.json({ ok: true, count: items.length })
}
