import { revalidatePublic } from '@/lib/revalidate'
import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, requireAdmin, sameOrigin } from '@/lib/http'
import { voidDraw } from '@/lib/program-service'

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const s = await requireAdmin(req, ['owner'])
  if (s instanceof NextResponse) return s
  const ok = await voidDraw(params.id, s.email)
  if (ok) revalidatePublic()
  return ok ? NextResponse.json({ ok: true }) : jsonError(404, 'Hasil undian tidak ditemukan.')
}
