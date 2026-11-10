import { randomInt } from 'node:crypto'
import { maskWhatsapp, normalizeWhatsapp } from './identity'
import { withLock } from './lock'
import { participantsTable, taskSubmissionsTable, tasksTable } from './repo/programs'
import { strip } from './repo/records'
import { listSubmissionsFresh } from './repo/submissions'
import { AUTO_REVIEWER, PROGRAM_INFO, type Participant } from './types'

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
  return withLock('participants', async () => {
    const all = await participantsTable.list()
    const found = all.find((p) => p.whatsapp === wa)
    if (found) return strip(found)
    const taken = new Set(all.map((p) => p.token))
    let token = newToken()
    while (taken.has(token)) token = newToken()
    const now = new Date().toISOString()
    const p: Participant = { id: 'usr_' + token.slice(0, 6).toLowerCase() + Date.now().toString(36), token, name: name.trim().replace(/\s+/g, ' '), whatsapp: wa, created_at: now, last_seen_at: '' }
    // Another server may have registered the same number at the same moment: earliest row wins.
    const after = await participantsTable.appendAndList([p])
    return strip(after.find((x) => x.whatsapp === wa) ?? { ...p, _index: -1 })
  })
}

export async function participantByToken(token: string): Promise<Participant | null> {
  const t = normalizeToken(token)
  if (!t) return null
  const all = await participantsTable.list()
  const p = all.find((x) => x.token === t)
  return p ? strip(p) : null
}

export interface TrackItem {
  id: string
  program: 'goldenticket' | 'pelatihan' | 'duta'
  programLabel: string
  title: string
  link: string
  sharein?: string
  code?: string
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
  const [golden, subs, tasks] = await Promise.all([listSubmissionsFresh(), taskSubmissionsTable.list(), tasksTable.list()])
  const titles = new Map(tasks.map((t) => [t.id, t.title]))
  const items: TrackItem[] = [
    ...golden
      .filter((s) => s.whatsapp === me.whatsapp && s.status !== 'void')
      .map((s): TrackItem => ({
        id: s.id,
        program: 'goldenticket',
        programLabel: 'Golden Ticket',
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
      })),
    ...subs
      .filter((s) => s.identity_key === me.whatsapp && s.status !== 'void')
      .map((s): TrackItem => ({
        id: s.id,
        program: s.program,
        programLabel: PROGRAM_INFO[s.program].label,
        title: titles.get(s.task_id) ?? 'Tugas',
        link: s.proof_url,
        code: s.code,
        status: s.status as TrackItem['status'],
        reason: s.reject_reason,
        created_at: s.created_at,
        reviewed_at: s.reviewed_at,
        auto: s.reviewed_by === AUTO_REVIEWER,
      })),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at))
  return {
    name: me.name,
    whatsapp: maskWhatsapp(me.whatsapp),
    token: me.token,
    since: me.created_at,
    items,
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
  const [people, golden, subs] = await Promise.all([participantsTable.list(), listSubmissionsFresh(), taskSubmissionsTable.list()])
  return people
    .map(strip)
    .map((p) => {
      const mine = [
        ...golden.filter((s) => s.whatsapp === p.whatsapp && s.status !== 'void'),
        ...subs.filter((s) => s.identity_key === p.whatsapp && s.status !== 'void'),
      ]
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
