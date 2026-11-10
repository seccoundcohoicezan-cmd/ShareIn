import { cached } from './cache'
import { participantsTable } from './repo/programs'
import { strip } from './repo/records'
import { getSettings } from './repo/settings'
import { isCollected, listSubmissionsCached } from './repo/submissions'
import { channelOpen, weeklyMin } from './settings-schema'
import type { Program, Settings, Submission } from './types'
import { inWeek, weekOf, type Week } from './week'

export interface WeeklyProgress {
  program: Program
  min: number
  /** Links sent this week that still count (waiting or approved). */
  sent: number
  approved: number
  met: boolean
  week: Week
}

function mineThisWeek(all: Submission[], program: Program, whatsapp: string, week: Week) {
  return all.filter((s) => s.program === program && s.whatsapp === whatsapp && isCollected(s) && inWeek(s.created_at, week))
}

export function weeklyProgress(all: Submission[], settings: Settings, program: Program, whatsapp: string, now = new Date()): WeeklyProgress {
  const week = weekOf(now)
  const mine = mineThisWeek(all, program, whatsapp, week)
  const min = weeklyMin(settings, program)
  return { program, min, sent: mine.length, approved: mine.filter((s) => s.status === 'approved').length, met: mine.length >= min, week }
}

export interface ProgramSummary {
  open: boolean
  min: number
  week: Week
  /** People who sent at least one link this week. */
  active: number
  /** People who reached the weekly minimum. */
  met: number
  linksThisWeek: number
  linksTotal: number
}

export function summarize(all: Submission[], settings: Settings, program: Program, now = new Date()): ProgramSummary {
  const week = weekOf(now)
  const mine = all.filter((s) => s.program === program && isCollected(s))
  const thisWeek = mine.filter((s) => inWeek(s.created_at, week))
  const perPerson = new Map<string, number>()
  for (const s of thisWeek) perPerson.set(s.whatsapp, (perPerson.get(s.whatsapp) ?? 0) + 1)
  const min = weeklyMin(settings, program)
  return {
    open: channelOpen(settings, program),
    min,
    week,
    active: perPerson.size,
    met: Array.from(perPerson.values()).filter((n) => n >= min).length,
    linksThisWeek: thisWeek.length,
    linksTotal: mine.length,
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
  sent: number
  approved: number
  pending: number
  met: boolean
}

/**
 * Weekly obligation recap for admins: everyone who ever joined this program (or any participant
 * when `everyone`), with this week's count. Unmet first so reminders are easy to send.
 */
export async function weeklyRecap(program: Program, everyone = false, now = new Date()) {
  const [settings, all, people] = await Promise.all([getSettings(), listSubmissionsCached(), participantsTable.list()])
  const week = weekOf(now)
  const min = weeklyMin(settings, program)
  const members = new Set(all.filter((s) => s.program === program).map((s) => s.whatsapp))
  const rows: RecapRow[] = people
    .map(strip)
    .filter((p) => everyone || members.has(p.whatsapp))
    .map((p) => {
      const mine = mineThisWeek(all, program, p.whatsapp, week)
      const approved = mine.filter((s) => s.status === 'approved').length
      return { id: p.id, name: p.name, whatsapp: p.whatsapp, token: p.token, sent: mine.length, approved, pending: mine.length - approved, met: mine.length >= min }
    })
    .sort((a, b) => Number(a.met) - Number(b.met) || a.sent - b.sent || a.name.localeCompare(b.name))
  return { min, week, rows }
}
