import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { review } from '@/lib/admin-service'
import { jsonError, readJson, requireAdmin, sameOrigin } from '@/lib/http'

const schema = z.object({ ids: z.array(z.string().max(40)).min(1).max(200), action: z.literal('approve') })

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const s = await requireAdmin(req)
  if (s instanceof NextResponse) return s
  const body = schema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, 'Pilih setoran yang mau disetujui.')
  const items = await review(body.data.ids, 'approve', '', s.email)
  revalidatePath('/')
  return NextResponse.json({ ok: true, count: items.length })
}
