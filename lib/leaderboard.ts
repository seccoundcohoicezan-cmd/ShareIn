import type { Submission } from './types'
import { maskName } from './identity'

export const LEADERBOARD_SIZE = 10

export interface LeaderRow {
  rank: number
  name: string
  approved: number
  tiktok: number
  reels: number
}

export interface Leaderboard {
  rows: LeaderRow[]
  /** Participants with at least one approved link (the list itself is capped). */
  participants: number
}

/** One person = one WhatsApp number; very old rows without a number fall back to the name. */
const personKey = (s: Submission) => s.whatsapp || `name:${s.submitter_name.trim().toLowerCase()}`

/**
 * Golden Ticket ranking: only links an admin (or auto-approve) accepted count, so sending many links
 * that get rejected or are still waiting does not move anyone up. Ties go to whoever reached the
 * count first (earlier latest approved link), so the order does not shuffle between page loads.
 * Covers the whole program like the 'Link terkumpul' counts: the default period id changes weekly.
 */
export function goldenLeaderboard(subs: Submission[], limit = LEADERBOARD_SIZE): Leaderboard {
  const people = new Map<string, { name: string; tiktok: number; reels: number; last: string }>()
  for (const s of subs) {
    if (s.program !== 'golden' || s.status !== 'approved') continue
    const key = personKey(s)
    const p = people.get(key) ?? { name: s.submitter_name, tiktok: 0, reels: 0, last: '' }
    if (s.platform === 'tiktok') p.tiktok++
    else p.reels++
    if (s.created_at >= p.last) {
      p.last = s.created_at
      p.name = s.submitter_name || p.name
    }
    people.set(key, p)
  }
  const sorted = Array.from(people.values())
    .map((p) => ({ ...p, approved: p.tiktok + p.reels }))
    .sort((a, b) => b.approved - a.approved || a.last.localeCompare(b.last) || a.name.localeCompare(b.name))
  const rows: LeaderRow[] = []
  sorted.slice(0, limit).forEach((p, i) => {
    // Equal counts share a rank ("1, 2, 2, 4"), so nobody looks behind someone with the same score.
    const prev = rows[i - 1]
    rows.push({ rank: prev && prev.approved === p.approved ? prev.rank : i + 1, name: maskName(p.name), approved: p.approved, tiktok: p.tiktok, reels: p.reels })
  })
  return { rows, participants: people.size }
}
