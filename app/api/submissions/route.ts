import { revalidatePublic } from '@/lib/revalidate'
import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, limitOr429, readJson } from '@/lib/http'
import { checkSubmission, createSubmission, submissionSchema } from '@/lib/service'
import { MAX_SCREENSHOT_BYTES, saveScreenshot, sniffImage } from '@/lib/storage'
import { ensureParticipant } from '@/lib/participant-service'
import { setUserCookie } from '@/lib/user-session'

export async function POST(req: NextRequest) {
  const limited = limitOr429(req, 'submit', 10)
  if (limited) return limited

  let raw: unknown
  let file: File | null = null
  if ((req.headers.get('content-type') || '').includes('multipart/form-data')) {
    const form = await req.formData().catch(() => null)
    if (!form) return jsonError(400, 'Data tidak terbaca. Muat ulang halaman lalu coba lagi.')
    try {
      raw = JSON.parse(String(form.get('data') ?? ''))
    } catch {
      return jsonError(400, 'Data tidak terbaca. Muat ulang halaman lalu coba lagi.')
    }
    const f = form.get('screenshot')
    if (f && typeof f !== 'string' && f.size > 0) file = f
  } else {
    raw = await readJson(req)
  }

  const parsed = submissionSchema.safeParse(raw)
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? 'Data tidak lengkap.')
  const input = { ...parsed.data, has_screenshot: Boolean(file) }

  let buf: Buffer | null = null
  let mime: ReturnType<typeof sniffImage> = null
  if (file) {
    if (file.size > MAX_SCREENSHOT_BYTES) return jsonError(400, 'Tangkapan layar maksimal 2 MB. Kecilkan atau potong gambarnya.')
    buf = Buffer.from(await file.arrayBuffer())
    mime = sniffImage(buf)
    if (!mime) return jsonError(400, 'Tangkapan layar harus JPG, PNG, atau WebP.')
  }

  const pre = await checkSubmission(input)
  if (!pre.ok) return NextResponse.json({ ok: false, checks: pre.checks.filter((c) => !c.pass) }, { status: 422 })

  let screenshotUrl = ''
  if (buf && mime) {
    try {
      screenshotUrl = await saveScreenshot(buf, mime)
    } catch (e) {
      console.error('screenshot upload failed', (e as Error).message)
      return jsonError(502, 'Tangkapan layar gagal diunggah. Coba lagi sebentar lagi.')
    }
  }

  const result = await createSubmission(input, undefined, screenshotUrl)
  if (!result.ok) return NextResponse.json({ ok: false, checks: result.checks }, { status: 422 })
  revalidatePublic()
  const s = result.submission
  const me = await ensureParticipant(s.submitter_name, s.whatsapp)
  const res = NextResponse.json({ ok: true, id: s.id, status: s.status, created_at: s.created_at, token: me?.token }, { status: 201 })
  return me ? setUserCookie(res, me.token) : res
}
