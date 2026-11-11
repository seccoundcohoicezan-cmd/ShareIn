import { cached } from './cache'
import { participantsTable } from './repo/programs'
import { strip } from './repo/records'
import { getSettings } from './repo/settings'
import { isCollected, listSubmissionsCached } from './repo/submissions'
import { autoApprove, channelOpen, targetFor } from './settings-schema'
import type { Program, Settings, Submission } from './types'
import { weekOf, type Week } from './week'

/**
 * Pelatihan = "draw": collect N TikTok + N Reels links (approved, since the round started) to enter
 * the spin wheel. Duta = "weekly": N TikTok + N Reels links (waiting or approved) every Monday–Sunday.
 */
export type ProgressMode = 'draw' | 'weekly'

export const modeOf = (p: Program): ProgressMode => (p === 'pelatihan' ? 'draw' : 'weekly')

export interface Target {
  tiktok: number
  reels: number
}

interface Window {
  start: number
  end: number
  week: Week | null
  since: string
}

function windowFor(settings: Settings, program: Program, now: Date): Window {
  if (modeOf(program) === 'weekly') {
    const week = weekOf(now)
    return { start: Date.parse(week.start), end: Date.parse(week.end), week, since: week.start }
  }
  const since = settings.pelatihan_round_start
  return { start: since ? Date.parse(since) : 0, end: Infinity, week: null, since }
}

function inWindow(s: Submission, program: Program, w: Window) {
  const t = Date.parse(s.created_at)
  return s.program === program && isCollected(s) && t >= w.start && t < w.end
}

/** Counted links: approved only for the draw (an admin vouched for them), waiting + approved for the weekly duty. */
const counts = (s: Submission, mode: ProgressMode) => (mode === 'draw' ? s.status === 'approved' : true)

function tally(mine: Submission[], mode: ProgressMode, target: Target) {
  const done = mine.filter((s) => counts(s, mode))
  const tiktok = done.filter((s) => s.platform === 'tiktok').length
  const reels = done.filter((s) => s.platform === 'reels').length
  // Waiting links not yet counted (draw mode only), per platform for the progress chips.
  const waiting = mine.filter((s) => !counts(s, mode) && s.status === 'pending')
  return {
    tiktok,
    reels,
    waiting: { tiktok: waiting.filter((s) => s.platform === 'tiktok').length, reels: waiting.filter((s) => s.platform === 'reels').length },
    pending: mine.filter((s) => s.status === 'pending').length,
    met: tiktok >= target.tiktok && reels >= target.reels && target.tiktok + target.reels > 0,
  }
}

export interface Progress {
  program: Program
  mode: ProgressMode
  target: Target
  tiktok: number
  reels: number
  /** Links still waiting for review (in draw mode they count once approved). */
  pending: number
  /** Waiting links not counted yet, per platform (always 0 in weekly mode, where waiting links count). */
  waiting: Target
  met: boolean
  week: Week | null
  since: string
}

export function progressFor(all: Submission[], settings: Settings, program: Program, whatsapp: string, now = new Date()): Progress {
  const mode = modeOf(program)
  const w = windowFor(settings, program, now)
  const target = targetFor(settings, program)
  const mine = all.filter((s) => s.whatsapp === whatsapp && inWindow(s, program, w))
  return { program, mode, target, ...tally(mine, mode, target), week: w.week, since: w.since }
}

function perPerson(all: Submission[], settings: Settings, program: Program, now: Date) {
  const mode = modeOf(program)
  const w = windowFor(settings, program, now)
  const target = targetFor(settings, program)
  const groups = new Map<string, Submission[]>()
  for (const s of all) if (inWindow(s, program, w)) groups.set(s.whatsapp, [...(groups.get(s.whatsapp) ?? []), s])
  return { mode, w, target, groups, tallies: new Map(Array.from(groups, ([wa, mine]) => [wa, tally(mine, mode, target)])) }
}

export interface ProgramSummary {
  open: boolean
  /** New links are approved without admin review. */
  auto: boolean
  mode: ProgressMode
  target: Target
  week: Week | null
  since: string
  /** People with at least one link in the window. */
  active: number
  /** People who reached the target (draw: entered the spin wheel). */
  met: number
  links: number
}

export function summarize(all: Submission[], settings: Settings, program: Program, now = new Date()): ProgramSummary {
  const { mode, w, target, groups, tallies } = perPerson(all, settings, program, now)
  return {
    open: channelOpen(settings, program),
    auto: autoApprove(settings, program),
    mode,
    target,
    week: w.week,
    since: w.since,
    active: groups.size,
    met: Array.from(tallies.values()).filter((t) => t.met).length,
    links: Array.from(groups.values()).reduce((n, g) => n + g.length, 0),
  }
}

export function programSummary(program: Program): Promise<ProgramSummary> {
  return cached(`program:${program}`, async () => {
    const [settings, all] = await Promise.all([getSettings(), listSubmissionsCached()])
    return summarize(all, settings, program)
  })
}

export interface RecapRow {
  id: string
  name: string
  whatsapp: string
  token: string
  tiktok: number
  reels: number
  pending: number
  met: boolean
}

/**
 * Admin recap: everyone who sent links to this program (or every registered participant when
 * `everyone`), with their count in the current window. Unmet first so reminders are easy to send.
 */
export async function recap(program: Program, everyone = false, now = new Date()) {
  const [settings, all, people] = await Promise.all([getSettings(), listSubmissionsCached(), participantsTable.list()])
  const { mode, w, target, tallies } = perPerson(all, settings, program, now)
  const members = new Set(all.filter((s) => s.program === program).map((s) => s.whatsapp))
  const empty = { tiktok: 0, reels: 0, waiting: { tiktok: 0, reels: 0 }, pending: 0, met: false }
  const rows: RecapRow[] = people
    .map(strip)
    .filter((p) => everyone || members.has(p.whatsapp) || tallies.has(p.whatsapp))
    .map((p) => {
      const t = tallies.get(p.whatsapp) ?? empty
      return { id: p.id, name: p.name, whatsapp: p.whatsapp, token: p.token, tiktok: t.tiktok, reels: t.reels, pending: t.pending, met: t.met }
    })
    .sort((a, b) => Number(a.met) - Number(b.met) || a.tiktok + a.reels - (b.tiktok + b.reels) || a.name.localeCompare(b.name))
  return { mode, target, week: w.week, since: w.since, rows }
}
