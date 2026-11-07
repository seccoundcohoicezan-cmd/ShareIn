import 'server-only'
import { parseSettings, qtyTarget } from './settings-schema'
import { getProgress, type Progress } from './service'
import type { Platform, Settings } from './types'

/** Public pages must render even when the database is unreachable (e.g. at build time). */
export async function loadPublic(): Promise<{ settings: Settings; progress: Progress[]; degraded: boolean }> {
  try {
    return { ...(await getProgress()), degraded: false }
  } catch (e) {
    console.error('public data unavailable', (e as Error).message)
    const settings = parseSettings(new Map())
    const progress = (['tiktok', 'reels'] as Platform[]).map((p) => ({
      platform: p,
      used: 0,
      target: qtyTarget(settings, p),
      remaining: qtyTarget(settings, p),
    }))
    return { settings, progress, degraded: true }
  }
}
