import { revalidatePublic } from '@/lib/revalidate'
import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, limitOr429, readJson } from '@/lib/http'
import { asProgram } from '@/lib/program-param'
import { submitTask, taskSubmitSchema } from '@/lib/program-service'
import { ensureParticipant } from '@/lib/participant-service'
import { setUserCookie } from '@/lib/user-session'

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
  if (!r.ok) return NextResponse.json(r, { status: 422 })
  revalidatePublic()
  const me = await ensureParticipant(body.data.name, body.data.whatsapp)
  const res = NextResponse.json({ ...r, token: me?.token }, { status: 201 })
  return me ? setUserCookie(res, me.token) : res
}
