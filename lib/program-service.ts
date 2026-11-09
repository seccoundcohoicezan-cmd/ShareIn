import { randomBytes, randomInt } from 'node:crypto'
import { z } from 'zod'
import { cached, invalidate } from './cache'
import { normalizeName } from './format'
import { withLock } from './lock'
import { audit } from './repo/audit'
import { taskSubmissionsTable, tasksTable } from './repo/programs'
import { strip, type Stored } from './repo/records'
import { getSettings, getSettingsFresh } from './repo/settings'
import { AUTO_REVIEWER, PROGRAM_INFO, type Program, type Settings, type Task, type TaskSubmission } from './types'

export { maskWhatsapp, normalizeWhatsapp } from './identity'
import { normalizeWhatsapp } from './identity'

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function makeCode(program: Program, taken: Set<string>): string {
  for (;;) {
    let s = ''
    for (let i = 0; i < 6; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
    const code = `${PROGRAM_INFO[program].prefix}-${s}`
    if (!taken.has(code)) return code
  }
}

function programOpen(s: Settings, p: Program) {
  return p === 'pelatihan' ? s.pelatihan_open : s.duta_open
}

// ---------- Tasks ----------

export async function listTasks(program: Program, activeOnly = true): Promise<Task[]> {
  const all = await cached('tasks', () => tasksTable.list())
  return all
    .map(strip)
    .filter((t) => t.program === program && (!activeOnly || t.active))
    .sort((a, b) => a.order - b.order || a.created_at.localeCompare(b.created_at))
}

export const taskSchema = z.object({
  title: z.string().trim().min(3, 'Judul tugas minimal 3 karakter.').max(120),
  description: z.string().trim().max(1000).default(''),
  proof_hint: z.string().trim().max(200).default(''),
  active: z.boolean().default(true),
  order: z.number().int().min(0).max(999).default(0),
})

export async function saveTask(program: Program, input: z.infer<typeof taskSchema>, actor: string, id?: string): Promise<Task> {
  return withLock('tasks', async () => {
    const all = await tasksTable.list()
    if (id) {
      const cur = all.find((t) => t.id === id && t.program === program)
      if (!cur) throw new Error('Tugas tidak ditemukan.')
      const next = { ...cur, ...input }
      await tasksTable.update([next])
      invalidate('program')
      await audit(actor, 'task.update', id, strip(cur), input)
      return strip(next)
    }
    const task: Task = {
      id: 'tsk_' + randomBytes(5).toString('hex'),
      program,
      ...input,
      order: input.order || all.filter((t) => t.program === program).length + 1,
      created_at: new Date().toISOString(),
    }
    await tasksTable.append([task])
    invalidate('program')
    await audit(actor, 'task.create', task.id, '', input)
    return task
  })
}

// ---------- Submissions & codes ----------

export const taskSubmitSchema = z.object({
  task_id: z.string().trim().min(1, 'Pilih tugas yang dikerjakan.').max(40),
  name: z.string().trim().min(2, 'Isi nama minimal 2 huruf.').max(60, 'Nama maksimal 60 karakter.'),
  whatsapp: z.string().trim().max(20),
  proof_url: z.string().trim().max(500),
  note: z.string().trim().max(300).optional().default(''),
})
export type TaskSubmitInput = z.infer<typeof taskSubmitSchema>

export type SubmitTaskResult =
  | { ok: true; code: string; task: string; status: TaskSubmission['status'] }
  | { ok: false; field?: keyof TaskSubmitInput; message: string }

function validProof(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === 'https:' && u.hostname.includes('.')
  } catch {
    return false
  }
}

export async function submitTask(program: Program, input: TaskSubmitInput): Promise<SubmitTaskResult> {
  const settings = await getSettingsFresh()
  if (!programOpen(settings, program)) return { ok: false, message: 'Pengumpulan tugas sedang ditutup. Pantau halaman ini untuk info berikutnya.' }
  const identity = normalizeWhatsapp(input.whatsapp)
  if (!identity) return { ok: false, field: 'whatsapp', message: 'Nomor WhatsApp tidak valid. Tulis seperti 081234567890.' }
  if (!validProof(input.proof_url)) return { ok: false, field: 'proof_url', message: 'Tempel link bukti yang diawali https://, misalnya link konten atau Google Drive.' }
  const tasks = await listTasks(program)
  const task = tasks.find((t) => t.id === input.task_id)
  if (!task) return { ok: false, field: 'task_id', message: 'Tugas ini tidak tersedia. Muat ulang halaman lalu pilih lagi.' }

  return withLock('task_submissions', async () => {
    const all = await taskSubmissionsTable.list()
    const already = all.find(
      (s) => s.program === program && s.task_id === task.id && s.identity_key === identity && s.status !== 'rejected' && s.status !== 'void',
    )
    if (already) return { ok: false, field: 'task_id', message: `Tugas ini sudah kamu kumpulkan. Kodemu: ${already.code}.` }
    const now = new Date().toISOString()
    const auto = program === 'pelatihan' ? settings.auto_approve_pelatihan : settings.auto_approve_duta
    const sub: TaskSubmission = {
      id: 'ts_' + randomBytes(8).toString('base64url'),
      created_at: now,
      program,
      task_id: task.id,
      identity_key: identity,
      name: input.name.replace(/\s+/g, ' '),
      whatsapp: identity,
      proof_url: input.proof_url,
      note: input.note,
      code: makeCode(program, new Set(all.map((s) => s.code))),
      status: auto ? 'approved' : 'pending',
      reject_reason: '',
      reviewed_by: auto ? AUTO_REVIEWER : '',
      reviewed_at: auto ? now : '',
    }
    await taskSubmissionsTable.append([sub])
    // Another server may have appended the same identity+task (or code) concurrently; earliest row wins.
    const after = await taskSubmissionsTable.list()
    const mine = after.find((s) => s.id === sub.id)
    const first = after.find(
      (s) => s.status !== 'void' && s.status !== 'rejected' && ((s.program === program && s.task_id === task.id && s.identity_key === identity) || s.code === sub.code),
    )
    if (mine && first && first.id !== sub.id) {
      await taskSubmissionsTable.update([{ ...mine, status: 'void', reject_reason: 'Ganda bersamaan (otomatis)' }])
      return { ok: false, field: 'task_id', message: `Tugas ini sudah kamu kumpulkan. Kodemu: ${first.code}.` }
    }
    invalidate('program')
    return { ok: true, code: sub.code, task: task.title, status: sub.status }
  })
}

// ---------- Public summary ----------

export async function programSummary(program: Program) {
  return cached(`program:${program}`, async () => {
    const [settings, subs, tasks] = await Promise.all([getSettings(), taskSubmissionsTable.list(), listTasks(program)])
    const valid = subs.filter((s) => s.program === program && (s.status === 'approved' || s.status === 'pending'))
    return {
      open: programOpen(settings, program),
      tasks,
      participants: new Set(valid.map((s) => s.identity_key)).size,
      codes: valid.length,
      approved: valid.filter((s) => s.status === 'approved').length,
    }
  })
}

// ---------- Admin review ----------

export const taskFilterSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).default('all'),
  task: z.string().trim().max(40).default(''),
  q: z.string().trim().max(60).default(''),
})

export async function adminTaskSubmissions(program: Program, f: z.infer<typeof taskFilterSchema>) {
  const [subs, tasks] = await Promise.all([taskSubmissionsTable.list(), listTasks(program, false)])
  const q = normalizeName(f.q)
  const items = subs
    .map(strip)
    .filter((s) => s.program === program && s.status !== 'void')
    .filter((s) => f.status === 'all' || s.status === f.status)
    .filter((s) => !f.task || s.task_id === f.task)
    .filter((s) => !q || normalizeName(s.name).includes(q) || s.identity_key.includes(q.replace(/\D/g, '') || '§') || s.code.toLowerCase().includes(q))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
  return { items, tasks }
}

export async function reviewTaskSubmissions(program: Program, ids: string[], action: 'approve' | 'reject' | 'reset', reason: string, actor: string) {
  return withLock('task_submissions', async () => {
    const subs = await taskSubmissionsTable.list()
    const targets = subs.filter((s) => s.program === program && ids.includes(s.id) && s.status !== 'void')
    const now = new Date().toISOString()
    const updated: Stored<TaskSubmission>[] = targets.map((s) => ({
      ...s,
      status: action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'pending',
      reject_reason: action === 'reject' ? reason : '',
      reviewed_by: action === 'reset' ? '' : actor,
      reviewed_at: action === 'reset' ? '' : now,
    }))
    await taskSubmissionsTable.update(updated)
    for (const s of targets) await audit(actor, `task_submission.${action}`, s.id, { status: s.status }, { status: action, reason: reason || undefined })
    invalidate('program')
    return updated.map(strip)
  })
}
