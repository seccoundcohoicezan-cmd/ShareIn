import 'server-only'
import { lookup } from 'node:dns/promises'
import net from 'node:net'
import { isInstagramHost, isTikTokHost, parseSourceUrl, type ParsedLink, type ParseError } from './url'

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number)
    return (
      a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19)) || a >= 224
    )
  }
  const v = ip.toLowerCase()
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7))
  return v === '::' || v === '::1' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80') || v.startsWith('ff')
}

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>
export type Resolver = (host: string) => Promise<string[]>

const defaultResolver: Resolver = async (host) => (await lookup(host, { all: true })).map((r) => r.address)

/**
 * Follows TikTok/Instagram short links with HEAD requests (3 s each, max 5 hops),
 * allowing only TikTok/Instagram hosts that resolve to public IPs (SSRF guard).
 */
export async function resolveShortLink(
  start: string,
  opts: { fetcher?: Fetcher; resolver?: Resolver; timeoutMs?: number } = {},
): Promise<string | null> {
  const fetcher = opts.fetcher ?? ((u, i) => fetch(u, i))
  const resolver = opts.resolver ?? defaultResolver
  let current = start
  for (let hop = 0; hop < 5; hop++) {
    const u = new URL(current)
    if (u.protocol !== 'https:' || !(isTikTokHost(u.hostname) || isInstagramHost(u.hostname))) return null
    const ips = await resolver(u.hostname).catch(() => [] as string[])
    if (!ips.length || ips.some(isPrivateIp)) return null
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 3000)
    let res: Response
    try {
      res = await fetcher(current, {
        method: 'HEAD',
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; ShareInIntake/1.0)' },
      })
    } catch {
      return null
    } finally {
      clearTimeout(timer)
    }
    const loc = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, current).toString()
      const parsed = parseSourceUrl(current)
      if (typeof parsed !== 'string' && parsed.source_key) return current
      continue
    }
    return null
  }
  return null
}

/** Full parse: offline parse, then short-link resolution when needed. */
export async function parseAndResolve(
  input: string,
  opts?: Parameters<typeof resolveShortLink>[1],
): Promise<ParsedLink | ParseError | 'unresolved'> {
  const first = parseSourceUrl(input)
  if (typeof first === 'string' || first.source_key) return first
  const target = await resolveShortLink(first.url, opts)
  if (!target) return 'unresolved'
  const second = parseSourceUrl(target)
  if (typeof second === 'string' || !second.source_key) return 'unresolved'
  return second
}
