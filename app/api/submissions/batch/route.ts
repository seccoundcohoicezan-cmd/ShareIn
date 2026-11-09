import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, limitOr429 } from '@/lib/http'
import { ensureParticipant } from '@/lib/participant-service'
import { revalidatePublic } from '@/lib/revalidate'
import { batchSchema, checkBatch, createBatch, expandBatch } from '@/lib/service'
import { MAX_SCREENSHOT_BYTES, saveScreenshot, sniffImage } from '@/lib/storage'
import { setUserCookie } from '@/lib/user-session'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const limited = limitOr429(req, 'submit', 10)
  if (limited) return limited
  const form = await req.formData().catch(() => null)
  if (!form) return jsonError(400, 'Data tidak terbaca. Muat ulang halaman lalu coba lagi.')
  let raw: unknown
  try {
    raw = JSON.parse(String(form.get('data') ?? ''))
  } catch {
    return jsonError(400, 'Data tidak terbaca. Muat ulang halaman lalu coba lagi.')
  }
  const f = form.get('screenshot')
  const file = f && typeof f !== 'string' && f.size > 0 ? f : null
  const parsed = batchSchema.safeParse(raw)
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? 'Data tidak lengkap.')
  const inputs = expandBatch({ ...parsed.data, has_screenshot: Boolean(file) })

  let buf: Buffer | null = null
  let mime: ReturnType<typeof sniffImage> = null
  if (file) {
    if (file.size > MAX_SCREENSHOT_BYTES) return jsonError(400, 'Tangkapan layar maksimal 2 MB. Kecilkan atau potong gambarnya.')
    buf = Buffer.from(await file.arrayBuffer())
    mime = sniffImage(buf)
    if (!mime) return jsonError(400, 'Tangkapan layar harus JPG, PNG, atau WebP.')
  }

  // Avoid storing a screenshot for a batch that is going to be refused.
  const pre = await checkBatch(inputs)
  if (!pre.ok) return NextResponse.json({ ok: false, items: pre.items }, { status: 422 })

  let screenshotUrl = ''
  if (buf && mime) {
    try {
      screenshotUrl = await saveScreenshot(buf, mime)
    } catch (e) {
      console.error('screenshot upload failed', (e as Error).message)
      return jsonError(502, 'Tangkapan layar gagal diunggah. Coba lagi sebentar lagi.')
    }
  }

  const result = await createBatch(inputs, undefined, screenshotUrl)
  if (!result.ok) return NextResponse.json({ ok: false, items: result.items }, { status: 422 })
  revalidatePublic()
  const saved = result.results.flatMap((r) => (r.ok ? [r.submission] : []))
  const me = saved.length ? await ensureParticipant(saved[0].submitter_name, saved[0].whatsapp) : null
  const res = NextResponse.json(
    {
      ok: true,
      saved: saved.length,
      status: saved[0]?.status,
      token: me?.token,
      results: result.results.map((r) => (r.ok ? { ok: true, id: r.submission.id } : { ok: false, checks: r.checks })),
    },
    { status: saved.length ? 201 : 409 },
  )
  return me ? setUserCookie(res, me.token) : res
}
