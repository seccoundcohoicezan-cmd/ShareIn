import { formatDate, formatNumber } from './format'
import { minComment, minLike } from './settings-schema'
import type { Check, CheckResult, Platform, Settings, Submission } from './types'
import { PLATFORM_LABEL } from './types'
import type { ParsedLink, ParseError } from './url'
import { checkShareinUrl, LINK_RULE_MESSAGE } from './url'

export interface CheckInput {
  platform: Platform
  likes: number | null
  comments: number | null
  sharein_url: string
  organic_declared: boolean
  checked_declared: boolean
  has_screenshot: boolean
}

export interface CheckContext {
  settings: Settings
  link: ParsedLink | ParseError | 'unresolved'
  /** Existing non-void submission with the same source_key in any period. */
  duplicate: Pick<Submission, 'created_at'> | null
}

const SHORT_PLATFORM: Record<Platform, string> = { tiktok: 'TikTok', reels: 'Reels' }

function linkCheck(input: CheckInput, link: CheckContext['link']): Check {
  if (link === 'not_https') return { id: 'url_valid', pass: false, message: 'Link harus diawali https://. Salin ulang dari tombol Bagikan.' }
  if (link === 'unresolved')
    return { id: 'url_valid', pass: false, message: 'Link pendek tidak bisa dibuka. Buka kontennya lalu salin link lengkap dari browser.' }
  if (typeof link === 'string')
    return { id: 'url_valid', pass: false, message: LINK_RULE_MESSAGE }
  if (link.platform !== input.platform)
    return {
      id: 'url_valid',
      pass: false,
      message: `Link ini dari ${PLATFORM_LABEL[link.platform]}, tapi platform yang dipilih ${PLATFORM_LABEL[input.platform]}. Ganti pilihan platform.`,
    }
  return { id: 'url_valid', pass: true }
}

function thresholdCheck(id: 'min_like' | 'min_comment', value: number | null, min: number, platform: Platform): Check {
  const noun = id === 'min_like' ? 'Like' : 'Komentar'
  if (value === null) return { id, pass: false, message: `Isi jumlah ${noun.toLowerCase()} hasil cek manual, contoh 120000.` }
  if (value < min)
    return {
      id,
      pass: false,
      message: `${noun} ${formatNumber(value)} belum cukup. ${SHORT_PLATFORM[platform]} minimal ${formatNumber(min)}.`,
    }
  return { id, pass: true }
}

export function runChecks(input: CheckInput, ctx: CheckContext): CheckResult {
  const { settings, link } = ctx
  const checks: Check[] = []

  if (!settings.period_open) {
    checks.push({ id: 'period_open', pass: false, message: 'Setoran sedang ditutup. Pantau beranda untuk periode berikutnya.' })
  }

  const url = linkCheck(input, link)
  checks.push(url)

  if (url.pass && ctx.duplicate) {
    checks.push({
      id: 'not_duplicate',
      pass: false,
      message: `Link ini sudah pernah disetor pada ${formatDate(ctx.duplicate.created_at)}. Cari konten lain.`,
    })
  } else {
    checks.push({ id: 'not_duplicate', pass: url.pass, ...(url.pass ? {} : { message: 'Perbaiki link konten dulu.' }) })
  }

  checks.push(thresholdCheck('min_like', input.likes, minLike(settings, input.platform), input.platform))
  checks.push(thresholdCheck('min_comment', input.comments, minComment(settings, input.platform), input.platform))

  const share = checkShareinUrl(input.sharein_url, settings.sharein_domains)
  const shareMsg: Record<NonNullable<typeof share.reason>, string> = {
    empty: 'Unggah kontennya ke ShareIn dulu, lalu tempel link-nya di sini.',
    invalid: 'Link ShareIn tidak terbaca. Salin ulang dari halaman konten di ShareIn.',
    not_https: 'Link ShareIn harus diawali https://.',
    domain: `Link ShareIn harus dari ${settings.sharein_domains.join(' atau ')}. Salin dari halaman konten di ShareIn.`,
    no_path: 'Itu alamat beranda ShareIn. Tempel link halaman konten yang kamu unggah.',
  }
  checks.push(share.ok ? { id: 'sharein_valid', pass: true } : { id: 'sharein_valid', pass: false, message: shareMsg[share.reason!] })

  let organic: Check = { id: 'organic', pass: true }
  if (!input.organic_declared) organic = { id: 'organic', pass: false, message: 'Centang pernyataan bahwa konten muncul organik di FYP/Beranda kamu.' }
  else if (!input.checked_declared) organic = { id: 'organic', pass: false, message: 'Centang pernyataan bahwa kamu sudah membuka link dan memeriksa angkanya.' }
  else if (settings.require_screenshot && !input.has_screenshot)
    organic = { id: 'organic', pass: false, message: 'Lampirkan tangkapan layar konten di FYP/Beranda (JPG/PNG/WebP, maks 2 MB).' }
  checks.push(organic)

  return { ok: checks.every((c) => c.pass), checks }
}
