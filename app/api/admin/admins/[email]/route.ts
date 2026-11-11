import { NextResponse, type NextRequest } from 'next/server'
import { patchAdmin, patchAdminSchema } from '@/lib/account-service'
import { jsonError, readJson, requireAdmin, sameOrigin } from '@/lib/http'

export async function PATCH(req: NextRequest, { params }: { params: { email: string } }) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const s = await requireAdmin(req, ['owner'])
  if (s instanceof NextResponse) return s
  const body = patchAdminSchema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, body.error.issues[0]?.message ?? 'Data tidak valid.')
  const r = await patchAdmin(decodeURIComponent(params.email), body.data, s.email)
  return 'error' in r ? jsonError(400, r.error) : NextResponse.json({ ok: true, admins: r.admins })
}
