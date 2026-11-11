import type { ApiKey, Participant, Spin } from '../types'
import { recordTable } from './records'

const bool = (v: string) => v.trim().toUpperCase() === 'TRUE'

export const participantsTable = recordTable<Participant>(
  'participants',
  (r) => ({
    id: r.id,
    token: (r.token ?? '').toUpperCase(),
    name: r.name ?? '',
    whatsapp: r.whatsapp ?? '',
    created_at: r.created_at ?? '',
    last_seen_at: r.last_seen_at ?? '',
    sso_sub: r.sso_sub ?? '',
  }),
  (p) => ({ ...p }),
)

export const spinsTable = recordTable<Spin>(
  'spins',
  (r) => ({
    id: r.id,
    created_at: r.created_at ?? '',
    program: r.program === 'duta' ? 'duta' : 'pelatihan',
    round_start: r.round_start ?? '',
    participant_id: r.participant_id ?? '',
    name: r.name ?? '',
    whatsapp: r.whatsapp ?? '',
    prize: r.prize ?? '',
    entries: Number(r.entries) || 0,
    drawn_by: r.drawn_by ?? '',
    deleted: bool(r.deleted ?? ''),
  }),
  (s) => ({ ...s }),
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
