import type { Settings } from './types'

export type GoldenPool = Pick<Settings, 'golden_pool_start' | 'golden_pool_end' | 'golden_start_at' | 'golden_end_at'>

/**
 * Prize pool that grows steadily from start to end amount between the two dates.
 * Purely time-based, so every visitor sees the same number at the same moment.
 */
export function goldenAmount(p: GoldenPool, now: number = Date.now()): number {
  const t0 = new Date(p.golden_start_at).getTime()
  const t1 = new Date(p.golden_end_at).getTime()
  if (!(t1 > t0) || now <= t0) return p.golden_pool_start
  if (now >= t1) return p.golden_pool_end
  const progress = (now - t0) / (t1 - t0)
  return Math.floor(p.golden_pool_start + (p.golden_pool_end - p.golden_pool_start) * progress)
}

export function formatRupiah(n: number): string {
  return 'Rp' + new Intl.NumberFormat('id-ID').format(Math.max(0, Math.floor(n)))
}
