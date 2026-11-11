import { NextResponse, type NextRequest } from 'next/server'
import { clientIp, jsonError, limitKey, limitOr429 } from '@/lib/http'
import { normalizeWhatsapp } from '@/lib/identity'
import { listParticipantsCached, participantByToken } from '@/lib/participant-service'
import { strip } from '@/lib/repo/records'
import { revalidatePublic } from '@/lib/revalidate'
import { batchSchema, checkBatch, createBatch, expandBatch } from '@/lib/service'
import { MAX_SCREENSHOT_BYTES, saveScreenshot, sniffImage } from '@/lib/storage'
import { setUserCookie, USER_COOKIE } from '@/lib/user-session'

export const maxDuration = 60

export async function POST(req: NextRequest) {
  const limited = limitOr429(req, 'submit', 3000)
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
  // Account, settings and existing links come from short-lived caches; the only spreadsheet request
  // on a warm server is the append itself (which returns the table to settle duplicates).
  const token = req.cookies.get(USER_COOKIE)?.value
  const me = token ? await participantByToken(token) : null

  // Logged in with the unique link: identity comes from the account, not from the form.
  const body = me && raw && typeof raw === 'object' ? { ...(raw as Record<string, unknown>), submitter_name: me.name, whatsapp: me.whatsapp } : raw
  const parsed = batchSchema.safeParse(body)
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? 'Data tidak lengkap.')
  const inputs = expandBatch({ ...parsed.data, has_screenshot: Boolean(file) })
  // Per person: 12 sends a minute is plenty for a human (10 links each).
  const perPerson = limitKey(`submit-wa:${normalizeWhatsapp(parsed.data.whatsapp) ?? clientIp(req)}`, 12)
  if (perPerson) return perPerson

  let buf: Buffer | null = null
  let mime: ReturnType<typeof sniffImage> = null
  if (file) {
    if (file.size > MAX_SCREENSHOT_BYTES) return jsonError(400, 'Tangkapan layar maksimal 2 MB. Kecilkan atau potong gambarnya.')
    buf = Buffer.from(await file.arrayBuffer())
    mime = sniffImage(buf)
    if (!mime) return jsonError(400, 'Tangkapan layar harus JPG, PNG, atau WebP.')
  }

  let screenshotUrl = ''
  if (buf && mime) {
    // Avoid storing a screenshot for a batch that is going to be refused.
    const pre = await checkBatch(inputs)
    if (!pre.ok) return NextResponse.json({ ok: false, items: pre.items }, { status: 422 })
    try {
      screenshotUrl = await saveScreenshot(buf, mime)
    } catch (e) {
      console.error('screenshot upload failed', (e as Error).message)
      return jsonError(502, 'Tangkapan layar gagal diunggah. Coba lagi sebentar lagi.')
    }
  }

  // A known number already has an account (cache, no request). Otherwise the account is created in the
  // same spreadsheet write as the links.
  const known = me ? null : (await listParticipantsCached()).find((p) => p.whatsapp === normalizeWhatsapp(inputs[0].whatsapp))
  const result = await createBatch(inputs, undefined, screenshotUrl, me || known ? undefined : { name: inputs[0].submitter_name, whatsapp: inputs[0].whatsapp })
  if (!result.ok) return NextResponse.json({ ok: false, items: result.items }, { status: 422 })
  const account = me ?? (known ? strip(known) : result.participant ?? null)
  revalidatePublic()
  const saved = result.results.flatMap((r) => (r.ok ? [r.submission] : []))
  const user = saved.length ? account : null
  const res = NextResponse.json(
    {
      ok: true,
      saved: saved.length,
      status: saved[0]?.status,
      token: user?.token,
      results: result.results.map((r) => (r.ok ? { ok: true, id: r.submission.id } : { ok: false, checks: r.checks })),
    },
    { status: saved.length ? 201 : 409 },
  )
  return user ? setUserCookie(res, user.token) : res
}
