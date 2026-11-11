import 'server-only'
import { parseSettings } from './settings-schema'
import { collectedFeed, getProgress, type CollectedFeed } from './service'
import type { Channel, Program, Settings } from './types'
import { programSummary, summarize, type ProgramSummary } from './progress'
import { publicWinners, type PublicWinner } from './spin'

const EMPTY_FEED: CollectedFeed = { total: 0, tiktok: 0, reels: 0, items: [] }

/** Public pages must render even when the database is unreachable (e.g. at build time). */
export async function loadPublic(program: Channel = 'golden'): Promise<{ settings: Settings; feed: CollectedFeed }> {
  try {
    const [{ settings }, feed] = await Promise.all([getProgress(), collectedFeed(0, 12, program)])
    return { settings, feed }
  } catch (e) {
    console.error('public data unavailable', (e as Error).message)
    return { settings: parseSettings(new Map()), feed: EMPTY_FEED }
  }
}

export async function loadProgram(program: Program): Promise<{ settings: Settings; feed: CollectedFeed; summary: ProgramSummary; winners: PublicWinner[] }> {
  try {
    const [{ settings, feed }, summary, winners] = await Promise.all([
      loadPublic(program),
      programSummary(program),
      program === 'pelatihan' ? publicWinners(program) : Promise.resolve([]),
    ])
    return { settings, feed, summary, winners }
  } catch (e) {
    console.error('program data unavailable', (e as Error).message)
    const settings = parseSettings(new Map())
    return { settings, feed: EMPTY_FEED, summary: summarize([], settings, program), winners: [] }
  }
}
