import { beforeEach, describe, expect, it } from 'vitest'
import { invalidate } from '@/lib/cache'
import { ensureParticipant, formatToken, normalizeToken, participantByToken, tracking } from '@/lib/participant-service'
import { review } from '@/lib/admin-service'
import { setStore } from '@/lib/repo'
import { AppsScriptStore } from '@/lib/repo/apps-script-store'
import { LocalStore } from '@/lib/repo/memory-store'
import { listSubmissionsFresh, updateSubmissions } from '@/lib/repo/submissions'
import type { TableStore } from '@/lib/repo/store'
import { createSubmission } from '@/lib/service'
import { normalizeStatus } from '@/lib/status'
import { createAppsScriptSim } from './apps-script-sim'

const SECRET = 'z'.repeat(40)

describe('tokens & status values', () => {
  it('formats and normalizes unique codes', () => {
    expect(formatToken('ABCDEFGHJKMN')).toBe('ABCD-EFGH-JKMN')
    expect(normalizeToken('abcd-efgh-jkmn')).toBe('ABCDEFGHJKMN')
    expect(normalizeToken('ABCDEFGHJKM0')).toBeNull() // 0 is not in the alphabet
    expect(normalizeToken('short')).toBeNull()
  })
  it('accepts statuses typed by hand in the spreadsheet', () => {
    expect(normalizeStatus('Disetujui')).toBe('approved')
    expect(normalizeStatus(' DITOLAK ')).toBe('rejected')
    expect(normalizeStatus('approved')).toBe('approved')
    expect(normalizeStatus('')).toBe('pending')
    expect(normalizeStatus('menunggu')).toBe('pending')
  })
})

describe.each([
  ['memory', () => new LocalStore(null) as TableStore],
  ['Apps Script (real Code.js)', () => new AppsScriptStore('https://sim', SECRET, createAppsScriptSim(SECRET).poster) as TableStore],
])('participants on %s', (_n, make) => {
  beforeEach(() => {
    setStore(make())
    invalidate()
  })

  it('1 WhatsApp number = 1 participant = 1 unique link', async () => {
    const a = await ensureParticipant('Rina Utami', '081234567890')
    const b = await ensureParticipant('Rina U', '+62 812-3456-7890')
    const c = await ensureParticipant('Budi', '081298765432')
    expect(a!.token).toMatch(/^[A-HJ-NP-Z2-9]{12}$/)
    expect(b!.token).toBe(a!.token)
    expect(c!.token).not.toBe(a!.token)
    expect(await ensureParticipant('X', '123')).toBeNull()
    expect((await participantByToken(formatToken(a!.token).toLowerCase()))?.name).toBe('Rina Utami')
  })

  it('tracking shows all programs live, including edits made directly in the sheet', async () => {
    const base = { submitter_name: 'Rina Utami', whatsapp: '081234567890', platform: 'tiktok' as const, sharein_url: '', likes: null, comments: null, organic_declared: true, checked_declared: true, has_screenshot: false, metrics_source: 'manual' as const }
    const r = await createSubmission({ ...base, source_url: 'https://www.tiktok.com/@a/video/7400000000000000777', program: 'golden' })
    expect(r.ok).toBe(true)
    const t = await createSubmission({ ...base, whatsapp: '0812-3456-7890', source_url: 'https://www.tiktok.com/@a/video/7400000000000000778', program: 'pelatihan' })
    expect(t.ok).toBe(true)
    // Someone else's submission must not appear.
    await createSubmission({ ...base, submitter_name: 'Budi', whatsapp: '081298765432', source_url: 'https://www.tiktok.com/@a/video/7400000000000000779', program: 'pelatihan' })
    const me = await ensureParticipant('Rina Utami', '081234567890')
    let view = await tracking(me!.token)
    expect(view!.items.map((i) => i.program).sort()).toEqual(['golden', 'pelatihan'])
    expect(view!.counts).toMatchObject({ total: 2, pending: 2 })
    expect(view!.whatsapp).toBe('6281••••890')
    expect(view!.weekly).toEqual([expect.objectContaining({ program: 'pelatihan', sent: 1, min: 3, met: false })])

    // Admin edits the sheet by hand: Indonesian words in the status column.
    const all = await listSubmissionsFresh()
    const g = all.find((s) => s.program === 'golden')!
    const p = all.find((s) => s.program === 'pelatihan' && s.whatsapp === '6281234567890')!
    await updateSubmissions([{ ...g, status: 'approved' }, { ...p, status: normalizeStatus('Ditolak'), reject_reason: 'Bukan konten pro-kontra' }])
    view = await tracking(me!.token)
    expect(view!.counts).toMatchObject({ approved: 1, rejected: 1, pending: 0 })
    expect(view!.items.find((i) => i.program === 'pelatihan')!.reason).toBe('Bukan konten pro-kontra')
    // A rejected link does not count toward the weekly minimum.
    expect(view!.weekly[0].sent).toBe(0)
    await review([p.id], 'approve', '', 'o')
    view = await tracking(me!.token)
    expect(view!.counts.approved).toBe(2)
    expect(view!.weekly[0]).toMatchObject({ sent: 1, approved: 1 })
  })

  it('unknown code → null', async () => {
    expect(await tracking('ABCD-EFGH-JKMN')).toBeNull()
  })
})
