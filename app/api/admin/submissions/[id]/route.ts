import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { review, reviewSchema } from '@/lib/admin-service'
import { jsonError, readJson, requireAdmin, sameOrigin } from '@/lib/http'

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const s = await requireAdmin(req)
  if (s instanceof NextResponse) return s
  const body = reviewSchema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, body.error.issues[0]?.message ?? 'Data tidak valid.')
  const [item] = await review([params.id], body.data.action, body.data.reason, s.email)
  if (!item) return jsonError(404, 'Setoran tidak ditemukan.')
  revalidatePath('/')
  return NextResponse.json({ ok: true, item })
}
