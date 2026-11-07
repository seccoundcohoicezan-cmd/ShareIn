import { NextResponse, type NextRequest } from 'next/server'
import { patchAdmin, patchAdminSchema } from '@/lib/account-service'
import { jsonError, readJson, requireAdmin, sameOrigin } from '@/lib/http'

export async function PATCH(req: NextRequest, { params }: { params: { email: string } }) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const s = await requireAdmin(req, ['owner'])
  if (s instanceof NextResponse) return s
  const body = patchAdminSchema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, body.error.issues[0]?.message ?? 'Data tidak valid.')
  const err = await patchAdmin(decodeURIComponent(params.email), body.data, s.email)
  return err ? jsonError(400, err) : NextResponse.json({ ok: true })
}
