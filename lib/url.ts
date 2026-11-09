import type { Platform } from './types'

const TRACKING_PARAMS = /^(utm_.*|igsh|igshid|is_from_webapp|sender_device|sender_web_id|is_copy_url|_r|_t|share_.*|tt_from|u_code|ug_.*|checksum|sec_user_id|social_sharing|lang|refer)$/i

export interface ParsedLink {
  platform: Platform
  url: string
  /** Stable content id ("tt:<videoId>" / "ig:<shortcode>"); null when the link is a short link that must be resolved. */
  source_key: string | null
  short: boolean
}

export type ParseError = 'invalid' | 'not_https' | 'unsupported'

export const LINK_RULE_MESSAGE = 'Link harus dari tiktok.com atau instagram.com/reel/. Tempel link dari tombol Bagikan.'

function toUrl(input: string): URL | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed)
  } catch {
    try {
      return new URL('https://' + trimmed.replace(/^\/+/, ''))
    } catch {
      return null
    }
  }
}

export function hostMatches(host: string, domain: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '')
  const d = domain.toLowerCase()
  return h === d || h.endsWith('.' + d)
}

export function isTikTokHost(host: string) {
  return hostMatches(host, 'tiktok.com')
}
export function isInstagramHost(host: string) {
  return hostMatches(host, 'instagram.com')
}

function stripTracking(u: URL): URL {
  const clean = new URL(u.toString())
  clean.hash = ''
  for (const key of Array.from(clean.searchParams.keys())) {
    if (TRACKING_PARAMS.test(key)) clean.searchParams.delete(key)
  }
  return clean
}

/** Parses a TikTok or Instagram Reels link without network access. */
export function parseSourceUrl(input: string): ParsedLink | ParseError {
  const u = toUrl(input)
  if (!u || !u.hostname.includes('.')) return 'invalid'
  if (u.protocol !== 'https:') return u.protocol === 'http:' ? 'not_https' : 'invalid'
  const host = u.hostname.toLowerCase()
  const path = u.pathname.replace(/\/+$/, '')

  if (isTikTokHost(host)) {
    const video = path.match(/\/(?:video|photo)\/(\d{8,25})/) ?? path.match(/^\/v\/(\d{8,25})(?:\.html)?$/)
    if (video) {
      const user = path.match(/^\/(@[^/]+)/)?.[1]
      const kind = path.includes('/photo/') ? 'photo' : 'video'
      const canonical = user
        ? `https://www.tiktok.com/${user}/${kind}/${video[1]}`
        : `https://www.tiktok.com/video/${video[1]}`
      return { platform: 'tiktok', url: canonical, source_key: `tt:${video[1]}`, short: false }
    }
    const isShortHost = host === 'vm.tiktok.com' || host === 'vt.tiktok.com'
    const isShortPath = /^\/t\/[A-Za-z0-9]+$/.test(path)
    if ((isShortHost && /^\/[A-Za-z0-9]+$/.test(path)) || isShortPath) {
      return { platform: 'tiktok', url: `https://${host}${path}/`, source_key: null, short: true }
    }
    return 'unsupported'
  }

  if (isInstagramHost(host)) {
    // Reels only: /reel/<code>, also /reels/<code> and /<account>/reel/<code>. Posts (/p/) are refused.
    const m = path.match(/^(?:\/(?!share\/)[A-Za-z0-9._]+)?\/(?:reel|reels)\/([A-Za-z0-9_-]{5,40})$/)
    if (m) return { platform: 'reels', url: `https://www.instagram.com/reel/${m[1]}/`, source_key: `ig:${m[1]}`, short: false }
    return 'unsupported'
  }

  return 'unsupported'
}

export interface ShareinCheck {
  ok: boolean
  url?: string
  reason?: 'empty' | 'invalid' | 'not_https' | 'domain' | 'no_path'
}

export function checkShareinUrl(input: string, domains: string[]): ShareinCheck {
  if (!input.trim()) return { ok: false, reason: 'empty' }
  const u = toUrl(input)
  if (!u || !u.hostname.includes('.')) return { ok: false, reason: 'invalid' }
  if (u.protocol !== 'https:') return { ok: false, reason: u.protocol === 'http:' ? 'not_https' : 'invalid' }
  if (!domains.some((d) => hostMatches(u.hostname, d))) return { ok: false, reason: 'domain' }
  if (u.pathname.replace(/\/+$/, '') === '') return { ok: false, reason: 'no_path' }
  return { ok: true, url: stripTracking(u).toString() }
}

export function detectPlatform(input: string): Platform | null {
  const r = parseSourceUrl(input)
  if (typeof r !== 'string') return r.platform
  const u = toUrl(input)
  if (!u) return null
  if (isTikTokHost(u.hostname)) return 'tiktok'
  if (isInstagramHost(u.hostname)) return 'reels'
  return null
}
