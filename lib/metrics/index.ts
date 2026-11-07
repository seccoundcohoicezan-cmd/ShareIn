import type { MetricsAdapterMode, Platform } from '../types'
import { apifyAdapter } from './apify'
import { rapidApiAdapter } from './rapidapi'

export interface Metrics {
  likes: number
  comments: number
}

export interface MetricsAdapter {
  fetch(url: string, platform: Platform): Promise<Metrics | null>
}

export const offAdapter: MetricsAdapter = { fetch: async () => null }

export function getAdapter(mode: MetricsAdapterMode): MetricsAdapter {
  if (mode === 'rapidapi') return rapidApiAdapter
  if (mode === 'apify') return apifyAdapter
  return offAdapter
}

/** Picks the first numeric value found under any of the given keys (deep search). */
export function pickNumber(obj: unknown, keys: string[]): number | null {
  const stack: unknown[] = [obj]
  let guard = 0
  while (stack.length && guard++ < 5000) {
    const cur = stack.pop()
    if (!cur || typeof cur !== 'object') continue
    for (const [k, v] of Object.entries(cur as Record<string, unknown>)) {
      if (keys.includes(k) && (typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v)))) return Number(v)
      if (v && typeof v === 'object') stack.push(v)
    }
  }
  return null
}

export const LIKE_KEYS = ['digg_count', 'diggCount', 'like_count', 'likes_count', 'likesCount', 'likeCount', 'likes']
export const COMMENT_KEYS = ['comment_count', 'commentCount', 'comments_count', 'commentsCount', 'comments']

export function extract(obj: unknown): Metrics | null {
  const likes = pickNumber(obj, LIKE_KEYS)
  const comments = pickNumber(obj, COMMENT_KEYS)
  return likes === null || comments === null ? null : { likes, comments }
}
