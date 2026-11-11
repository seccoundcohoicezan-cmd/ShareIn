import { randomBytes, randomInt } from 'node:crypto'
import { cached, invalidate } from './cache'
import { maskName } from './identity'
import { withLock } from './lock'
import { recap } from './progress'
import { getStore } from './repo'
import { spinsTable } from './repo/programs'
import { strip } from './repo/records'
import { getSettings, getSettingsFresh, saveSettings } from './repo/settings'
import { auditOp, writeAll } from './repo/store'
import type { Program, Spin } from './types'

export interface WheelEntry {
  id: string
  name: string
  whatsapp: string
  tiktok: number
  reels: number
}

export interface Candidate extends WheelEntry {
  /** Reached the target this round. */
  met: boolean
  /** Already won in this round (stays off the wheel until the win is deleted or the round reset). */
  won: boolean
  /** Admin choice: true = on, false = off, null = follow the target rule. */
  override: boolean | null
  onWheel: boolean
}

function listSpins(): Promise<Spin[]> {
  return cached('spins', async () => (await spinsTable.list()).map(strip))
}

const sameRound = (s: Spin, round: string) => s.round_start === round

/**
 * Who is on the wheel: by default everyone who reached the target this round, but the admin can
 * take people off or put others on. Winners of this round stay off until their win is deleted.
 */
export async function wheel(program: Program) {
  const [settings, r, spins] = await Promise.all([getSettings(), recap(program), listSpins()])
  const round = settings.pelatihan_round_start
  const won = new Set(spins.filter((s) => s.program === program && !s.deleted && sameRound(s, round)).map((s) => s.whatsapp))
  const candidates: Candidate[] = r.rows.map((x) => {
    const override = x.whatsapp in settings.spin_overrides ? settings.spin_overrides[x.whatsapp] : null
    const isWon = won.has(x.whatsapp)
    return { id: x.id, name: x.name, whatsapp: x.whatsapp, tiktok: x.tiktok, reels: x.reels, met: x.met, won: isWon, override, onWheel: !isWon && (override ?? x.met) }
  })
  const entries: WheelEntry[] = candidates.filter((c) => c.onWheel).map(({ id, name, whatsapp, tiktok, reels }) => ({ id, name, whatsapp, tiktok, reels }))
  const history = spins.filter((s) => s.program === program && !s.deleted).sort((a, b) => b.created_at.localeCompare(a.created_at))
  return { round, target: r.target, entries, candidates, history, progress: r.rows.length }
}

/** Saves the admin's wheel choices (one settings write); `null` returns a person to the target rule. */
export async function setWheelChoices(changes: Record<string, boolean | null>, actor: string) {
  const settings = await getSettingsFresh()
  const next = { ...settings.spin_overrides }
  for (const [wa, v] of Object.entries(changes)) {
    if (v === null) delete next[wa]
    else next[wa] = v
  }
  await saveSettings({ ...settings, spin_overrides: next }, { actor })
}

/** Picks a winner with a cryptographic random draw and records it together with its audit entry. */
export async function draw(program: Program, prize: string, actor: string) {
  return withLock('spins', async () => {
    invalidate('spins')
    const state = await wheel(program)
    if (state.entries.length === 0) return { error: 'Belum ada peserta di roda. Centang peserta yang mau diundi.' as const }
    const index = randomInt(state.entries.length)
    const w = state.entries[index]
    const spin: Spin = {
      id: 'spn_' + randomBytes(6).toString('base64url'),
      created_at: new Date().toISOString(),
      program,
      round_start: state.round,
      participant_id: w.id,
      name: w.name,
      whatsapp: w.whatsapp,
      prize: prize.trim(),
      entries: state.entries.length,
      drawn_by: actor,
      deleted: false,
    }
    await writeAll(getStore(), [await spinsTable.appendOp([spin]), auditOp(actor, 'spin.draw', spin.id, '', { winner: w.name, prize: spin.prize, entries: spin.entries })])
    invalidate('spins')
    return { spin, index, entries: state.entries }
  })
}

/** Removes draws from the history (kept in the sheet as deleted); those people go back on the wheel. */
export async function deleteSpins(ids: string[], actor: string): Promise<number> {
  return withLock('spins', async () => {
    const targets = (await spinsTable.list()).filter((s) => ids.includes(s.id) && !s.deleted)
    if (!targets.length) return 0
    await writeAll(getStore(), [
      await spinsTable.updateOp(targets.map((t) => ({ ...t, deleted: true }))),
      auditOp(actor, 'spin.delete', targets.map((t) => t.id).join(','), { winners: targets.map((t) => t.name) }, { deleted: true }),
    ])
    invalidate('spins')
    return targets.length
  })
}

/** Starts a new round: links and wins before now no longer count, so everyone collects again. */
export async function resetRound(actor: string): Promise<string> {
  const settings = await getSettingsFresh()
  const now = new Date().toISOString()
  await saveSettings({ ...settings, pelatihan_round_start: now }, { actor })
  invalidate('program:')
  return now
}

export interface PublicWinner {
  id: string
  created_at: string
  name: string
  prize: string
}

/** Winners for the public page: shortened names only. */
export async function publicWinners(program: Program, limit = 20): Promise<PublicWinner[]> {
  return (await listSpins())
    .filter((s) => s.program === program && !s.deleted)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit)
    .map((s) => ({ id: s.id, created_at: s.created_at, name: maskName(s.name), prize: s.prize }))
}
