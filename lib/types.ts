export type Platform = 'tiktok' | 'reels'
export type SubmissionStatus = 'pending' | 'approved' | 'rejected' | 'void'
export type MetricsAdapterMode = 'off' | 'rapidapi' | 'apify'
export type AdminRole = 'owner' | 'reviewer'

export interface Settings {
  period_id: string
  period_open: boolean
  qty_tiktok: number
  qty_reels: number
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
  spin_prize_pelatihan: number
  spin_prize_duta: number
  spin_unique_winner: boolean
}

export interface Participant {
  id: string
  /** Secret code in the personal monitoring link /pantau/<token>; doubles as login. */
  token: string
  name: string
  whatsapp: string
  created_at: string
  last_seen_at: string
}

export type Program = 'pelatihan' | 'duta'
export type TaskSubmissionStatus = 'pending' | 'approved' | 'rejected' | 'void'

export interface Task {
  id: string
  program: Program
  title: string
  description: string
  proof_hint: string
  active: boolean
  order: number
  created_at: string
}

export interface TaskSubmission {
  id: string
  created_at: string
  program: Program
  task_id: string
  /** Normalized WhatsApp number (62…): one identity. */
  identity_key: string
  name: string
  whatsapp: string
  proof_url: string
  note: string
  code: string
  status: TaskSubmissionStatus
  reject_reason: string
  reviewed_by: string
  reviewed_at: string
}

export interface Draw {
  id: string
  time: string
  program: Program
  code: string
  submission_id: string
  name: string
  identity_key: string
  prize: number
  actor: string
  status: 'active' | 'void'
}

export const PROGRAM_INFO: Record<Program, { label: string; path: string; prefix: string }> = {
  pelatihan: { label: 'Pelatihan Content', path: '/pelatihancontent', prefix: 'PC' },
  duta: { label: 'Duta Teladan', path: '/dutateladan', prefix: 'DT' },
}

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
  | 'qty_available'
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
