import type { MetricsAdapter } from './index'
import { extract } from './index'

// Runs an actor synchronously and reads its dataset items. Actor ids: APIFY_TIKTOK_ACTOR / APIFY_REELS_ACTOR.
export const apifyAdapter: MetricsAdapter = {
  async fetch(url, platform) {
    const token = process.env.METRICS_API_KEY
    const actor = platform === 'tiktok' ? process.env.APIFY_TIKTOK_ACTOR : process.env.APIFY_REELS_ACTOR
    if (!token || !actor) return null
    const input = platform === 'tiktok' ? { postURLs: [url], resultsPerPage: 1 } : { directUrls: [url], resultsLimit: 1 }
    try {
      const res = await fetch(
        `https://api.apify.com/v2/acts/${encodeURIComponent(actor)}/run-sync-get-dataset-items?timeout=25`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify(input),
          signal: AbortSignal.timeout(30000),
          cache: 'no-store',
        },
      )
      if (!res.ok) return null
      const items = (await res.json()) as unknown[]
      return Array.isArray(items) && items.length ? extract(items[0]) : null
    } catch {
      return null
    }
  },
}
