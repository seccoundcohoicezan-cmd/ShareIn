import { revalidatePublic } from '@/lib/revalidate'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { jsonError, readJson, requireAdmin, sameOrigin } from '@/lib/http'
import { asProgram } from '@/lib/program-param'
import { spin } from '@/lib/program-service'

const schema = z.object({ prize: z.number().int().min(1000, 'Isi nominal hadiah minimal Rp1.000.').max(1_000_000_000) })

export async function POST(req: NextRequest, { params }: { params: { program: string } }) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const s = await requireAdmin(req, ['owner'])
  if (s instanceof NextResponse) return s
  const program = asProgram(params.program)
  if (!program) return jsonError(404, 'Program tidak ditemukan.')
  const body = schema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, body.error.issues[0]?.message ?? 'Data tidak valid.')
  const r = await spin(program, body.data.prize, s.email)
  if (!r.ok) return jsonError(409, r.message)
  revalidatePublic()
  return NextResponse.json(r)
}
