import { NextResponse, type NextRequest } from 'next/server'
import { revokeApiKey } from '@/lib/api-key-service'
import { jsonError, requireAdmin, sameOrigin } from '@/lib/http'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const s = await requireAdmin(req, ['owner'])
  if (s instanceof NextResponse) return s
  return (await revokeApiKey(params.id, s.email)) ? NextResponse.json({ ok: true }) : jsonError(404, 'Kunci tidak ditemukan.')
}
