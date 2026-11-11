import { revalidatePublic } from '@/lib/revalidate'
import { NextResponse, type NextRequest } from 'next/server'
import { review, reviewSchema } from '@/lib/admin-service'
import { jsonError, readJson, requireAdmin, sameOrigin } from '@/lib/http'

// Room for Apps Script busy-retries during a burst (Vercel's default limit is shorter).
export const maxDuration = 60

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const s = await requireAdmin(req)
  if (s instanceof NextResponse) return s
  const body = reviewSchema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, body.error.issues[0]?.message ?? 'Data tidak valid.')
  const [item] = await review([params.id], body.data.action, body.data.reason, s.email)
  if (!item) return jsonError(404, 'Setoran tidak ditemukan.')
  revalidatePublic()
  return NextResponse.json({ ok: true, item })
}
