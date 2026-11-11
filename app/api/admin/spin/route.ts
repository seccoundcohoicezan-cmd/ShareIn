import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { jsonError, readJson, requireAdmin, sameOrigin } from '@/lib/http'
import { revalidatePublic } from '@/lib/revalidate'
import { deleteSpins, draw, wheel } from '@/lib/spin'

export const dynamic = 'force-dynamic'

// The spin wheel belongs to Pelatihan Content.
const PROGRAM = 'pelatihan' as const

export async function GET(req: NextRequest) {
  const s = await requireAdmin(req)
  if (s instanceof NextResponse) return s
  return NextResponse.json(await wheel(PROGRAM))
}

const drawSchema = z.object({ prize: z.string().trim().max(80).default('') })

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const s = await requireAdmin(req)
  if (s instanceof NextResponse) return s
  const body = drawSchema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, 'Nama hadiah maksimal 80 karakter.')
  const r = await draw(PROGRAM, body.data.prize, s.email)
  if ('error' in r) return jsonError(409, r.error!)
  revalidatePublic()
  return NextResponse.json({ ok: true, ...r })
}

const deleteSchema = z.object({ ids: z.array(z.string().max(40)).min(1).max(500) })

/** Owner only: removes draws from the history. */
export async function DELETE(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const s = await requireAdmin(req, ['owner'])
  if (s instanceof NextResponse) return s
  const body = deleteSchema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, 'Pilih riwayat yang mau dihapus.')
  const count = await deleteSpins(body.data.ids, s.email)
  revalidatePublic()
  return NextResponse.json({ ok: true, count })
}
