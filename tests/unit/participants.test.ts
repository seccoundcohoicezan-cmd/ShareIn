import { beforeEach, describe, expect, it } from 'vitest'
import { invalidate } from '@/lib/cache'
import { ensureParticipant, formatToken, normalizeToken, participantByToken, tracking } from '@/lib/participant-service'
import { reviewTaskSubmissions, saveTask, submitTask } from '@/lib/program-service'
import { setStore } from '@/lib/repo'
import { AppsScriptStore } from '@/lib/repo/apps-script-store'
import { LocalStore } from '@/lib/repo/memory-store'
import { taskSubmissionsTable } from '@/lib/repo/programs'
import { listSubmissionsFresh, updateSubmissions } from '@/lib/repo/submissions'
import { getStore } from '@/lib/repo'
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
    const r = await createSubmission({
      submitter_name: 'Rina Utami', whatsapp: '081234567890', platform: 'tiktok',
      source_url: 'https://www.tiktok.com/@a/video/7400000000000000777', sharein_url: 'https://sharein.id/c/x',
      likes: 120000, comments: 6000, organic_declared: true, checked_declared: true, has_screenshot: false, metrics_source: 'manual',
    })
    expect(r.ok).toBe(true)
    const task = await saveTask('pelatihan', { title: 'Video 30 detik', description: '', proof_hint: '', active: true, order: 1 }, 'o')
    const t = await submitTask('pelatihan', { task_id: task.id, name: 'Rina Utami', whatsapp: '0812-3456-7890', proof_url: 'https://www.tiktok.com/@a/video/1', note: '' })
    expect(t.ok).toBe(true)
    // Someone else's submission must not appear.
    await submitTask('pelatihan', { task_id: task.id, name: 'Budi', whatsapp: '081298765432', proof_url: 'https://x.y/z', note: '' })
    const me = await ensureParticipant('Rina Utami', '081234567890')
    let view = await tracking(me!.token)
    expect(view!.items.map((i) => i.program).sort()).toEqual(['goldenticket', 'pelatihan'])
    expect(view!.counts).toMatchObject({ total: 2, pending: 2 })
    expect(view!.whatsapp).toBe('6281••••890')

    // Admin edits the sheet by hand: Indonesian words in the status column.
    const [g] = await listSubmissionsFresh()
    await updateSubmissions([{ ...g, status: 'approved' }])
    const subs = await taskSubmissionsTable.list()
    const mine = subs.find((s) => s.identity_key === '6281234567890')!
    const { header, rows } = await getStore().read('task_submissions')
    const row = [...rows[mine._index]]
    row[header.indexOf('status')] = 'Ditolak'
    row[header.indexOf('reject_reason')] = 'Bukti tidak sesuai'
    await getStore().update('task_submissions', [{ index: mine._index, row }])
    view = await tracking(me!.token)
    expect(view!.counts).toMatchObject({ approved: 1, rejected: 1, pending: 0 })
    expect(view!.items.find((i) => i.program === 'pelatihan')!.reason).toBe('Bukti tidak sesuai')
    await reviewTaskSubmissions('pelatihan', [mine.id], 'approve', '', 'o')
    view = await tracking(me!.token)
    expect(view!.counts.approved).toBe(2)
  })

  it('unknown code → null', async () => {
    expect(await tracking('ABCD-EFGH-JKMN')).toBeNull()
  })
})
