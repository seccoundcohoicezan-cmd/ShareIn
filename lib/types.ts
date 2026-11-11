export type Platform = 'tiktok' | 'reels'
export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'void'
export type MetricsAdapterMode = 'off' | 'rapidapi' | 'apify'
export type AdminRole = 'owner' | 'reviewer'

export interface Settings {
  period_id: string
  period_open: boolean
  min_like_tiktok: number
  min_comment_tiktok: number
  min_like_reels: number
  min_comment_reels: number
  metrics_adapter: MetricsAdapterMode
  require_screenshot: boolean
  sharein_domains: string[]
  golden_pool_start: number
  golden_pool_end: number
  /** ISO timestamps. */
  golden_start_at: string
  golden_end_at: string
  pelatihan_open: boolean
  duta_open: boolean
  /** New submissions are approved without admin review. */
  auto_approve_golden: boolean
  auto_approve_pelatihan: boolean
  auto_approve_duta: boolean
  /** Pelatihan: approved links needed (per platform) to enter the spin-wheel draw. */
  pelatihan_need_tiktok: number
  pelatihan_need_reels: number
  /** Start of the current draw round (ISO); links before it no longer count. Empty = from the beginning. */
  pelatihan_round_start: string
  /** Duta Teladan: links required every week (Monday–Sunday WIB), per platform. */
  duta_week_tiktok: number
  duta_week_reels: number
}

export interface Participant {
  id: string
  /** Secret code in the personal monitoring link /pantau/<token>; doubles as login. */
  token: string
  name: string
  whatsapp: string
  created_at: string
  last_seen_at: string
  /** MyTopstar account id (OIDC `sub`) once the participant signed in through MyTopstar. */
  sso_sub: string
}

/** One spin-wheel draw. Deleting only hides it (`deleted`), so the history stays auditable. */
export interface Spin {
  id: string
  created_at: string
  program: Program
  /** Draw round the spin belongs to (value of the round start setting at the time). */
  round_start: string
  participant_id: string
  name: string
  whatsapp: string
  prize: string
  /** How many people were on the wheel. */
  entries: number
  drawn_by: string
  deleted: boolean
}

export interface ApiKey {
  id: string
  name: string
  /** First characters, shown so admins can tell keys apart. */
  prefix: string
  /** SHA-256 of the key; the key itself is shown once and never stored. */
  key_hash: string
  active: boolean
  created_at: string
  created_by: string
}

export type Program = 'pelatihan' | 'duta'
/** Every link-collection program: Golden Ticket (with prize) plus the two obligation programs. */
export type Channel = 'golden' | Program

/** Value of reviewed_by on submissions approved by the auto-approve setting. */
export const AUTO_REVIEWER = 'otomatis'

export const CHANNEL_INFO: Record<Channel, { label: string; path: string }> = {
  golden: { label: 'Golden Ticket', path: '/goldenticket' },
  pelatihan: { label: 'Pelatihan Content', path: '/pelatihancontent' },
  duta: { label: 'Duta Teladan', path: '/dutateladan' },
}
export const PROGRAM_INFO: Record<Program, { label: string; path: string }> = { pelatihan: CHANNEL_INFO.pelatihan, duta: CHANNEL_INFO.duta }

export interface Submission {
  id: string
  created_at: string
  period_id: string
  submitter_name: string
  platform: Platform
  source_url: string
  source_key: string
  sharein_url: string
  likes: number
  comments: number
  metrics_source: 'manual' | 'api'
  organic_declared: boolean
  screenshot_url: string
  status: SubmissionStatus
  reject_reason: string
  reviewed_by: string
  reviewed_at: string
  needs_review: boolean
  /** Normalized WhatsApp (628…); empty for submissions made before identities existed. */
  whatsapp: string
  /** Program the link was sent to; empty cells in the sheet mean Golden Ticket. */
  program: Channel
}

export interface Admin {
  email: string
  password_hash: string
  role: AdminRole
  active: boolean
}

export interface AuditEntry {
  time: string
  actor: string
  action: string
  target: string
  before: string
  after: string
}

export type CheckId =
  | 'period_open'
  | 'identity'
  | 'url_valid'
  | 'not_duplicate'
  | 'min_like'
  | 'min_comment'
  | 'sharein_valid'
  | 'organic'

export interface Check {
  id: CheckId
  pass: boolean
  message?: string
  remaining?: number
}

export interface CheckResult {
  ok: boolean
  checks: Check[]
}

export const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: 'TikTok',
  reels: 'Instagram Reels',
}
