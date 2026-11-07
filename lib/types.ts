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
