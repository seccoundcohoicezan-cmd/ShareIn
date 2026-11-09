import type { ApiKey, Participant, Program, Task, TaskSubmission, TaskSubmissionStatus } from '../types'
import { normalizeStatus } from '../status'
import { recordTable } from './records'

const bool = (v: string) => v.trim().toUpperCase() === 'TRUE'
const program = (v: string): Program => (v.trim() === 'duta' ? 'duta' : 'pelatihan')

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
    const status: TaskSubmissionStatus = normalizeStatus(r.status)
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
      status,
      reject_reason: r.reject_reason ?? '',
      reviewed_by: r.reviewed_by ?? '',
      reviewed_at: r.reviewed_at ?? '',
    }
  },
  (s) => ({ ...s }),
)

export const participantsTable = recordTable<Participant>(
  'participants',
  (r) => ({
    id: r.id,
    token: (r.token ?? '').toUpperCase(),
    name: r.name ?? '',
    whatsapp: r.whatsapp ?? '',
    created_at: r.created_at ?? '',
    last_seen_at: r.last_seen_at ?? '',
  }),
  (p) => ({ ...p }),
)

export const apiKeysTable = recordTable<ApiKey>(
  'api_keys',
  (r) => ({
    id: r.id,
    name: r.name ?? '',
    prefix: r.prefix ?? '',
    key_hash: r.key_hash ?? '',
    active: (r.active ?? '').trim().toUpperCase() === 'TRUE',
    created_at: r.created_at ?? '',
    created_by: r.created_by ?? '',
  }),
  (k) => ({ ...k }),
)
