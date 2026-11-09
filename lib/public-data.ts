import 'server-only'
import { parseSettings } from './settings-schema'
import { collectedFeed, getProgress, type CollectedFeed } from './service'
import type { Settings } from './types'

/** Public pages must render even when the database is unreachable (e.g. at build time). */
export async function loadPublic(): Promise<{ settings: Settings; feed: CollectedFeed }> {
  try {
    const [{ settings }, feed] = await Promise.all([getProgress(), collectedFeed()])
    return { settings, feed }
  } catch (e) {
    console.error('public data unavailable', (e as Error).message)
    return { settings: parseSettings(new Map()), feed: { total: 0, tiktok: 0, reels: 0, items: [] } }
  }
}
