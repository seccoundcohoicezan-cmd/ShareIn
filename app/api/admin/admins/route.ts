import { NextResponse, type NextRequest } from 'next/server'
import { createAdmin, newAdminSchema, publicAdmins } from '@/lib/account-service'
import { jsonError, readJson, requireAdmin, sameOrigin } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const s = await requireAdmin(req, ['owner'])
  if (s instanceof NextResponse) return s
  return NextResponse.json({ admins: await publicAdmins() })
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const s = await requireAdmin(req, ['owner'])
  if (s instanceof NextResponse) return s
  const body = newAdminSchema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, body.error.issues[0]?.message ?? 'Data tidak valid.')
  const r = await createAdmin(body.data, s.email)
  return 'error' in r ? jsonError(409, r.error) : NextResponse.json({ ok: true, admins: r.admins }, { status: 201 })
}
