import type { Draw, Program, Task, TaskSubmission, TaskSubmissionStatus } from '../types'
import { recordTable } from './records'

const bool = (v: string) => v.trim().toUpperCase() === 'TRUE'
const program = (v: string): Program => (v.trim() === 'duta' ? 'duta' : 'pelatihan')
const SUB_STATUS: TaskSubmissionStatus[] = ['pending', 'approved', 'rejected', 'void']

export const tasksTable = recordTable<Task>(
  'tasks',
  (r) => ({
    id: r.id,
    program: program(r.program ?? ''),
    title: r.title ?? '',
    description: r.description ?? '',
    proof_hint: r.proof_hint ?? '',
    active: r.active === '' || r.active === undefined ? true : bool(r.active),
    order: Number(r.order) || 0,
    created_at: r.created_at ?? '',
  }),
  (t) => ({ ...t }),
)

export const taskSubmissionsTable = recordTable<TaskSubmission>(
  'task_submissions',
  (r) => {
    const status = (r.status || 'pending').trim().toLowerCase() as TaskSubmissionStatus
    return {
      id: r.id,
      created_at: r.created_at ?? '',
      program: program(r.program ?? ''),
      task_id: r.task_id ?? '',
      identity_key: r.identity_key ?? '',
      name: r.name ?? '',
      whatsapp: r.whatsapp ?? '',
      proof_url: r.proof_url ?? '',
      note: r.note ?? '',
      code: (r.code ?? '').toUpperCase(),
      status: SUB_STATUS.includes(status) ? status : 'pending',
      reject_reason: r.reject_reason ?? '',
      reviewed_by: r.reviewed_by ?? '',
      reviewed_at: r.reviewed_at ?? '',
    }
  },
  (s) => ({ ...s }),
)

export const drawsTable = recordTable<Draw>(
  'draws',
  (r) => ({
    id: r.id,
    time: r.time ?? '',
    program: program(r.program ?? ''),
    code: (r.code ?? '').toUpperCase(),
    submission_id: r.submission_id ?? '',
    name: r.name ?? '',
    identity_key: r.identity_key ?? '',
    prize: Number(r.prize) || 0,
    actor: r.actor ?? '',
    status: r.status === 'void' ? 'void' : 'active',
  }),
  (d) => ({ ...d }),
)
