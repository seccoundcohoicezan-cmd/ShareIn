import 'server-only'
import { parseSettings } from './settings-schema'
import { collectedFeed, FEED_PAGE, getProgress, goldenRanking, type CollectedFeed } from './service'
import type { Leaderboard } from './leaderboard'
import type { Channel, Program, Settings } from './types'
import { programSummary, summarize, type ProgramSummary } from './progress'
import { publicWinners, type PublicWinner } from './spin'

const EMPTY_FEED: CollectedFeed = { total: 0, tiktok: 0, reels: 0, hidden: true, items: [] }

/**
 * At build time the pages must render even without the database. At runtime we rethrow instead: an
 * ISR regeneration that throws keeps serving the last good page, while a "0 links" fallback would be
 * cached for everyone and contradict the admin numbers.
 */
function fallbackOrThrow(e: unknown, what: string) {
  console.error(what, (e as Error).message)
  if (process.env.NEXT_PHASE !== 'phase-production-build') throw e
}

export async function loadPublic(program: Channel = 'golden'): Promise<{ settings: Settings; feed: CollectedFeed }> {
  try {
    const [{ settings }, feed] = await Promise.all([getProgress(), collectedFeed(0, FEED_PAGE, program)])
    return { settings, feed }
  } catch (e) {
    fallbackOrThrow(e, 'public data unavailable')
    return { settings: parseSettings(new Map()), feed: EMPTY_FEED }
  }
}

export async function loadGolden(): Promise<{ settings: Settings; feed: CollectedFeed; leaderboard: Leaderboard }> {
  try {
    const [{ settings, feed }, leaderboard] = await Promise.all([loadPublic('golden'), goldenRanking()])
    return { settings, feed, leaderboard }
  } catch (e) {
    fallbackOrThrow(e, 'golden data unavailable')
    return { settings: parseSettings(new Map()), feed: EMPTY_FEED, leaderboard: { rows: [], participants: 0 } }
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
    fallbackOrThrow(e, 'program data unavailable')
    const settings = parseSettings(new Map())
    return { settings, feed: EMPTY_FEED, summary: summarize([], settings, program), winners: [] }
  }
}
