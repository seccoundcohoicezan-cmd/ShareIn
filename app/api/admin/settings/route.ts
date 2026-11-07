import { revalidatePath } from 'next/cache'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { jsonError, readJson, requireAdmin, sameOrigin } from '@/lib/http'
import { audit } from '@/lib/repo/audit'
import { getSettingsFresh, saveSettings } from '@/lib/repo/settings'

export const dynamic = 'force-dynamic'

const count = z.number().int().min(0).max(1_000_000_000)
const schema = z.object({
  period_id: z.string().trim().min(1, 'Isi periode aktif.').max(40).regex(/^[\w.\-]+$/, 'Periode hanya huruf, angka, titik, strip.'),
  period_open: z.boolean(),
  qty_tiktok: count,
  qty_reels: count,
  min_like_tiktok: count,
  min_comment_tiktok: count,
  min_like_reels: count,
  min_comment_reels: count,
  metrics_adapter: z.enum(['off', 'rapidapi', 'apify']),
  require_screenshot: z.boolean(),
  sharein_domains: z
    .array(z.string().trim().toLowerCase().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/, 'Domain ShareIn tidak valid, contoh sharein.id.'))
    .min(1, 'Isi minimal satu domain ShareIn.')
    .max(10),
})

export async function GET(req: NextRequest) {
  const s = await requireAdmin(req)
  if (s instanceof NextResponse) return s
  return NextResponse.json({ settings: await getSettingsFresh(), role: s.role })
}

export async function PUT(req: NextRequest) {
  if (!sameOrigin(req)) return jsonError(403, 'Permintaan ditolak.')
  const s = await requireAdmin(req, ['owner'])
  if (s instanceof NextResponse) return s
  const body = schema.safeParse(await readJson(req))
  if (!body.success) return jsonError(400, body.error.issues[0]?.message ?? 'Data tidak valid.')
  const diff = await saveSettings(body.data)
  if (Object.keys(diff.after).length) await audit(s.email, 'settings.update', 'settings', diff.before, diff.after)
  revalidatePath('/')
  revalidatePath('/aturan')
  return NextResponse.json({ ok: true, settings: await getSettingsFresh() })
}
