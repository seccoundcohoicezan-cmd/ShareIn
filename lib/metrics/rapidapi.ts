import type { MetricsAdapter } from './index'
import { extract } from './index'

// Endpoint is configured per provider listing: RAPIDAPI_TIKTOK_URL / RAPIDAPI_REELS_URL with {url} placeholder.
export const rapidApiAdapter: MetricsAdapter = {
  async fetch(url, platform) {
    const key = process.env.METRICS_API_KEY
    const host = process.env.RAPIDAPI_HOST
    const tpl = platform === 'tiktok' ? process.env.RAPIDAPI_TIKTOK_URL : process.env.RAPIDAPI_REELS_URL
    if (!key || !host || !tpl) return null
    try {
      const res = await fetch(tpl.replace('{url}', encodeURIComponent(url)), {
        headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': host },
        signal: AbortSignal.timeout(8000),
        cache: 'no-store',
      })
      if (!res.ok) return null
      return extract(await res.json())
    } catch {
      return null
    }
  },
}
