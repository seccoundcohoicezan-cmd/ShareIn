import { NextResponse, type NextRequest } from 'next/server'
import { createApiKey, listApiKeys, newApiKeySchema } from '@/lib/api-key-service'
import { jsonError, readJson, requireAdmin, sameOrigin } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const s = await requireAdmin(req, ['owner'])
  if (s instanceof NextResponse) return s
  return NextResponse.json({ keys: await listApiKeys() })
}

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const s = await requireAdmin(req, ['owner'])
  if (s instanceof NextResponse) return s
  const body = newApiKeySchema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, body.error.issues[0]?.message ?? 'Data tidak valid.')
  return NextResponse.json({ ok: true, ...(await createApiKey(body.data.name, s.email)) }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
}
