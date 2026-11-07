import { parseSourceUrl } from './url'

/** Official embed player URL for a TikTok video / Instagram Reel link; null for other links. */
export function embedUrl(url: string): string | null {
  const p = parseSourceUrl(url)
  if (typeof p === 'string' || !p.source_key) return null
  const [kind, id] = p.source_key.split(':')
  if (kind === 'tt') return `https://www.tiktok.com/embed/v2/${id}`
  if (kind === 'ig') return `https://www.instagram.com/${p.url.includes('/p/') ? 'p' : 'reel'}/${id}/embed/`
  return null
}
