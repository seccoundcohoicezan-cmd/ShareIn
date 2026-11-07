import type { MetricsAdapterMode, Platform, Settings } from './types'

export const SETTING_KEYS = [
  'period_id',
  'period_open',
  'qty_tiktok',
  'qty_reels',
  'min_like_tiktok',
  'min_comment_tiktok',
  'min_like_reels',
  'min_comment_reels',
  'metrics_adapter',
  'require_screenshot',
  'sharein_domains',
] as const

export type SettingKey = (typeof SETTING_KEYS)[number]

// Seed values written to an empty "settings" sheet. The app always reads the sheet afterwards.
export const SEED_SETTINGS: Record<SettingKey, string> = {
  period_id: currentWeekId(new Date()),
  period_open: 'TRUE',
  qty_tiktok: '20',
  qty_reels: '15',
  min_like_tiktok: '100000',
  min_comment_tiktok: '5000',
  min_like_reels: '100000',
  min_comment_reels: '3000',
  metrics_adapter: 'off',
  require_screenshot: 'FALSE',
  sharein_domains: 'sharein.id,sharein.app',
}

const ADAPTERS: MetricsAdapterMode[] = ['off', 'rapidapi', 'apify']

function toBool(v: string | undefined): boolean {
  return ['true', '1', 'ya', 'yes', 'on'].includes(String(v ?? '').trim().toLowerCase())
}

function toInt(v: string | undefined, fallback: number): number {
  const n = Number(String(v ?? '').replace(/[.\s_]/g, '').replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback
}

export function parseSettings(raw: Map<string, string>): Settings {
  const get = (k: SettingKey) => raw.get(k) ?? SEED_SETTINGS[k]
  const adapter = get('metrics_adapter').trim().toLowerCase() as MetricsAdapterMode
  return {
    period_id: get('period_id').trim() || SEED_SETTINGS.period_id,
    period_open: toBool(get('period_open')),
    qty_tiktok: toInt(get('qty_tiktok'), 0),
    qty_reels: toInt(get('qty_reels'), 0),
    min_like_tiktok: toInt(get('min_like_tiktok'), 100000),
    min_comment_tiktok: toInt(get('min_comment_tiktok'), 5000),
    min_like_reels: toInt(get('min_like_reels'), 100000),
    min_comment_reels: toInt(get('min_comment_reels'), 3000),
    metrics_adapter: ADAPTERS.includes(adapter) ? adapter : 'off',
    require_screenshot: toBool(get('require_screenshot')),
    sharein_domains: get('sharein_domains')
      .split(/[,\s]+/)
      .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''))
      .filter(Boolean),
  }
}

export function serializeSettings(s: Settings): Record<SettingKey, string> {
  return {
    period_id: s.period_id,
    period_open: s.period_open ? 'TRUE' : 'FALSE',
    qty_tiktok: String(s.qty_tiktok),
    qty_reels: String(s.qty_reels),
    min_like_tiktok: String(s.min_like_tiktok),
    min_comment_tiktok: String(s.min_comment_tiktok),
    min_like_reels: String(s.min_like_reels),
    min_comment_reels: String(s.min_comment_reels),
    metrics_adapter: s.metrics_adapter,
    require_screenshot: s.require_screenshot ? 'TRUE' : 'FALSE',
    sharein_domains: s.sharein_domains.join(','),
  }
}

export function minLike(s: Settings, p: Platform) {
  return p === 'tiktok' ? s.min_like_tiktok : s.min_like_reels
}
export function minComment(s: Settings, p: Platform) {
  return p === 'tiktok' ? s.min_comment_tiktok : s.min_comment_reels
}
export function qtyTarget(s: Settings, p: Platform) {
  return p === 'tiktok' ? s.qty_tiktok : s.qty_reels
}

/** ISO week id such as 2026-11-W1 (week of month, Monday based). */
export function currentWeekId(d: Date): string {
  const wib = new Date(d.getTime() + 7 * 3600_000)
  const y = wib.getUTCFullYear()
  const m = wib.getUTCMonth()
  const first = new Date(Date.UTC(y, m, 1))
  const offset = (first.getUTCDay() + 6) % 7
  const week = Math.floor((wib.getUTCDate() + offset - 1) / 7) + 1
  return `${y}-${String(m + 1).padStart(2, '0')}-W${week}`
}
