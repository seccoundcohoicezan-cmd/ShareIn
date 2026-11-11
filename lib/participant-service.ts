import { randomInt } from 'node:crypto'
import { maskWhatsapp, normalizeWhatsapp } from './identity'
import { batcher } from './batcher'
import { cached } from './cache'
import { withLock } from './lock'
import { participantsTable } from './repo/programs'
import { strip, type Stored } from './repo/records'
import { getSettings } from './repo/settings'
import { listSubmissionsRecent } from './repo/submissions'
import { AUTO_REVIEWER, CHANNEL_INFO, type Channel, type Participant, type Program } from './types'
import { progressFor } from './progress'

// 12 chars from an unambiguous alphabet (~2^59): long enough to be unguessable with rate limiting,
// short enough to read aloud or type like a complaint ticket number (shown as XXXX-XXXX-XXXX).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function newToken(): string {
  let t = ''
  for (let i = 0; i < 12; i++) t += ALPHABET[randomInt(ALPHABET.length)]
  return t
}

export function normalizeToken(input: string): string | null {
  const t = String(input ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  return /^[A-HJ-NP-Z2-9]{12}$/.test(t) ? t : null
}

export function formatToken(t: string): string {
  return t.replace(/(.{4})(?=.)/g, '$1-')
}

/** 1 WhatsApp number = 1 participant = 1 unique link. Returns the existing one when known. */
export async function ensureParticipant(name: string, whatsapp: string): Promise<Participant | null> {
  const wa = normalizeWhatsapp(whatsapp)
  if (!wa) return null
  // Known number (the usual case): no spreadsheet request at all.
  const known = (await listParticipantsCached()).find((p) => p.whatsapp === wa)
  if (known) return strip(known)
  return registerQueue({ name, wa })
}

/**
 * One wave of first-time participants: read once, append every new number in one request, and settle
 * races (earliest row per number wins). 300 newcomers at once cost a few writes, not 300.
 */
const firstWith = <P extends { whatsapp: string }>(rows: P[], wa: string) => rows.find((p) => p.whatsapp === wa)

/** New participant rows for the numbers not known yet (one per number, unique tokens). */
export function planRegistrations(existing: Participant[], reqs: { name: string; wa: string }[]): Participant[] {
  const taken = new Set(existing.map((p) => p.token))
  const fresh: Participant[] = []
  for (const r of reqs) {
    if (firstWith(existing, r.wa) || firstWith(fresh, r.wa)) continue
    let token = newToken()
    while (taken.has(token)) token = newToken()
    taken.add(token)
    fresh.push({ id: 'usr_' + token.slice(0, 6).toLowerCase() + Date.now().toString(36), token, name: r.name.trim().replace(/\s+/g, ' '), whatsapp: r.wa, created_at: new Date().toISOString(), last_seen_at: '', sso_sub: '' })
  }
  return fresh
}

/** After writing: each number's account is its EARLIEST row (settles races between servers). */
export function pickRegistered(rows: Participant[], reqs: { wa: string }[]): (Participant | null)[] {
  return reqs.map((r) => {
    const p = firstWith(rows, r.wa)
    return p ? strip(p as Stored<Participant>) : null
  })
}

/** Registration-only wave (no links sent), e.g. MyTopstar-free account creation. */
async function registerWave(reqs: { name: string; wa: string }[]): Promise<(Participant | null)[]> {
  const all = await participantsTable.list()
  const fresh = planRegistrations(all, reqs)
  const rows = fresh.length ? await participantsTable.appendAndList(fresh) : all
  return pickRegistered(rows, reqs)
}

const gq = globalThis as unknown as { __shareinRegisterQueue?: (r: { name: string; wa: string }) => Promise<Participant | null> }
const registerQueue = (gq.__shareinRegisterQueue ??= batcher(registerWave))

/** Participants change rarely: served from a 60 s cache (cleared on every write from this server). */
export function listParticipantsCached() {
  return cached('participants', () => participantsTable.list())
}

export async function participantByToken(token: string): Promise<Participant | null> {
  const t = normalizeToken(token)
  if (!t) return null
  let p = (await listParticipantsCached()).find((x) => x.token === t)
  // Registered moments ago on another server instance: look once more in the sheet itself.
  if (!p) p = (await participantsTable.list()).find((x) => x.token === t)
  return p ? strip(p) : null
}

export interface TrackItem {
  id: string
  program: Channel
  programLabel: string
  title: string
  link: string
  sharein?: string
  likes?: number
  comments?: number
  status: 'pending' | 'approved' | 'rejected'
  reason: string
  created_at: string
  reviewed_at: string
  auto: boolean
}

/** Everything one participant submitted, read fresh from the spreadsheet (no cache) for live tracking. */
export async function tracking(token: string) {
  const me = await participantByToken(token)
  if (!me) return null
  // At most 15 s old: 300 people polling every 15 s must not each trigger a spreadsheet read.
  const [all, settings] = await Promise.all([listSubmissionsRecent(), getSettings()])
  const mine = all.filter((s) => s.whatsapp === me.whatsapp && s.status !== 'void')
  const items: TrackItem[] = mine
    .map((s): TrackItem => ({
      id: s.id,
      program: s.program,
      programLabel: CHANNEL_INFO[s.program].label,
      title: s.platform === 'tiktok' ? 'Konten TikTok' : 'Konten Instagram Reels',
      link: s.source_url,
      sharein: s.sharein_url,
      likes: s.likes,
      comments: s.comments,
      status: s.status as TrackItem['status'],
      reason: s.reject_reason,
      created_at: s.created_at,
      reviewed_at: s.reviewed_at,
      auto: s.reviewed_by === AUTO_REVIEWER,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  // Targets are shown for the programs this person takes part in (Duta via MyTopstar counts too).
  const joined = (['pelatihan', 'duta'] as Program[]).filter((p) => mine.some((s) => s.program === p) || (p === 'duta' && me.sso_sub))
  return {
    name: me.name,
    whatsapp: maskWhatsapp(me.whatsapp),
    token: me.token,
    since: me.created_at,
    items,
    progress: joined.map((p) => progressFor(all, settings, p, me.whatsapp)),
    counts: {
      total: items.length,
      pending: items.filter((i) => i.status === 'pending').length,
      approved: items.filter((i) => i.status === 'approved').length,
      rejected: items.filter((i) => i.status === 'rejected').length,
    },
    checkedAt: new Date().toISOString(),
  }
}

/** Admin list: every participant with counts and their link. */
export async function adminParticipants() {
  const [people, all] = await Promise.all([participantsTable.list(), listSubmissionsRecent()])
  return people
    .map(strip)
    .map((p) => {
      const mine = all.filter((s) => s.whatsapp === p.whatsapp && s.status !== 'void')
      return {
        ...p,
        total: mine.length,
        pending: mine.filter((s) => s.status === 'pending').length,
        approved: mine.filter((s) => s.status === 'approved').length,
        rejected: mine.filter((s) => s.status === 'rejected').length,
      }
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
}

export interface SsoProfile {
  sub: string
  name: string
  /** E.164 (+62…) from the MyTopstar `phone_number` claim. */
  phone: string
}

/**
 * Just-in-time account for a MyTopstar sign-in: matched on the MyTopstar id first, then on the
 * WhatsApp number so a Duta who already sent links keeps their history and personal link.
 */
export async function participantFromSso(profile: SsoProfile): Promise<Participant | null> {
  const wa = normalizeWhatsapp(profile.phone)
  return withLock('participants', async () => {
    const all = await participantsTable.list()
    const bySub = all.find((p) => p.sso_sub === profile.sub)
    if (bySub) return strip(bySub)
    if (!wa) return null
    const byWa = all.find((p) => p.whatsapp === wa)
    if (byWa) {
      const linked = { ...byWa, sso_sub: profile.sub }
      await participantsTable.update([linked])
      return strip(linked)
    }
    const taken = new Set(all.map((p) => p.token))
    let token = newToken()
    while (taken.has(token)) token = newToken()
    const name = profile.name.trim().replace(/\s+/g, ' ') || 'Duta'
    const p: Participant = { id: 'usr_' + token.slice(0, 6).toLowerCase() + Date.now().toString(36), token, name, whatsapp: wa, created_at: new Date().toISOString(), last_seen_at: '', sso_sub: profile.sub }
    const after = await participantsTable.appendAndList([p])
    return strip(after.find((x) => x.whatsapp === wa) ?? { ...p, _index: -1 })
  })
}
