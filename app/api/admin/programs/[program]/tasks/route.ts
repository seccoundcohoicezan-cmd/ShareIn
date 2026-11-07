import { revalidatePublic } from '@/lib/revalidate'
import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, readJson, requireAdmin, sameOrigin } from '@/lib/http'
import { asProgram } from '@/lib/program-param'
import { listTasks, saveTask, taskSchema } from '@/lib/program-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { program: string } }) {
  const s = await requireAdmin(req)
  if (s instanceof NextResponse) return s
  const program = asProgram(params.program)
  if (!program) return jsonError(404, 'Program tidak ditemukan.')
  return NextResponse.json({ tasks: await listTasks(program, false) })
}

export async function POST(req: NextRequest, { params }: { params: { program: string } }) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const s = await requireAdmin(req, ['owner'])
  if (s instanceof NextResponse) return s
  const program = asProgram(params.program)
  if (!program) return jsonError(404, 'Program tidak ditemukan.')
  const body = taskSchema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, body.error.issues[0]?.message ?? 'Data tidak valid.')
  revalidatePublic()
  return NextResponse.json({ ok: true, task: await saveTask(program, body.data, s.email) }, { status: 201 })
}
