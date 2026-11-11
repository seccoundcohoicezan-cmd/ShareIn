import { revalidatePublic } from '@/lib/revalidate'
import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { jsonError, readJson, requireAdmin, sameOrigin } from '@/lib/http'
import { approveWaiting } from '@/lib/admin-service'
import { getSettings, getSettingsFresh, saveSettings } from '@/lib/repo/settings'

export const dynamic = 'force-dynamic'

const count = z.number().int().min(0).max(1_000_000_000)
const schema = z.object({
  period_id: z.string().trim().min(1, 'Isi periode aktif.').max(40).regex(/^[\w.\-]+$/, 'Periode hanya huruf, angka, titik, strip.'),
  period_open: z.boolean(),
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
  golden_pool_start: count,
  golden_pool_end: count,
  golden_start_at: z.string().datetime({ offset: true, message: 'Tanggal mulai hadiah tidak valid.' }),
  golden_end_at: z.string().datetime({ offset: true, message: 'Tanggal akhir hadiah tidak valid.' }),
  pelatihan_open: z.boolean(),
  duta_open: z.boolean(),
  auto_approve_golden: z.boolean(),
  auto_approve_pelatihan: z.boolean(),
  auto_approve_duta: z.boolean(),
  pelatihan_need_tiktok: z.number().int().min(0).max(100, 'Target maksimal 100 link.'),
  pelatihan_need_reels: z.number().int().min(0).max(100, 'Target maksimal 100 link.'),
  duta_week_tiktok: z.number().int().min(0).max(100, 'Target maksimal 100 link.'),
  feed_show_links: z.boolean(),
  duta_week_reels: z.number().int().min(0).max(100, 'Target maksimal 100 link.'),
}).refine((v) => new Date(v.golden_end_at) > new Date(v.golden_start_at), {
  message: 'Tanggal akhir hadiah harus setelah tanggal mulai.',
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
  const before = await getSettingsFresh()
  // Merge onto the current values: keys this form does not edit (draw round, wheel choices) must not
  // be reverted by a settings page that was opened before they changed.
  const next = { ...before, ...body.data }
  await saveSettings(next, { actor: s.email })
  await approveWaiting(before, next)
  revalidatePublic()
  return NextResponse.json({ ok: true, settings: await getSettings() })
}
