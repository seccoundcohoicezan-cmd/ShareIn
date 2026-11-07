import { revalidatePublic } from '@/lib/revalidate'
import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, limitOr429, readJson } from '@/lib/http'
import { asProgram } from '@/lib/program-param'
import { submitTask, taskSubmitSchema } from '@/lib/program-service'

export async function POST(req: NextRequest, { params }: { params: { program: string } }) {
  const program = asProgram(params.program)
  if (!program) return jsonError(404, 'Program tidak ditemukan.')
  const limited = limitOr429(req, 'task-submit', 10)
  if (limited) return limited
  const body = taskSubmitSchema.safeParse(await readJson(req))
  if (!body.success) {
    const issue = body.error.issues[0]
    return NextResponse.json({ ok: false, field: issue?.path[0], message: issue?.message ?? 'Data belum lengkap.' }, { status: 400 })
  }
  const r = await submitTask(program, body.data)
  if (r.ok) revalidatePublic()
  return NextResponse.json(r, { status: r.ok ? 201 : 422 })
}
