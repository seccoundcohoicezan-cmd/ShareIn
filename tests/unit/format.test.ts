import { describe, expect, it } from 'vitest'
import { formatNumber, parseCount } from '@/lib/format'
import { currentWeekId, parseSettings } from '@/lib/settings-schema'

describe('parseCount', () => {
  it.each([
    ['120000', 120000],
    ['120.000', 120000],
    ['120,000', 120000],
    ['1.250.000', 1250000],
    ['120rb', 120000],
    ['1,2jt', 1200000],
    ['5k', 5000],
    [' 99 999 ', 99999],
  ])('%s → %d', (s, n) => expect(parseCount(s)).toBe(n))
  it('rejects junk', () => {
    expect(parseCount('abc')).toBeNull()
    expect(parseCount('')).toBeNull()
    expect(parseCount('-5')).toBeNull()
  })
  it('formats with Indonesian separators', () => expect(formatNumber(100000)).toBe('100.000'))
})

describe('settings', () => {
  it('parses sheet values tolerantly', () => {
    const s = parseSettings(new Map([['period_open', 'false'], ['sharein_domains', 'https://ShareIn.id/, sharein.app']]))
    expect(s.period_open).toBe(false)
    expect(s.sharein_domains).toEqual(['sharein.id', 'sharein.app'])
    expect(s.metrics_adapter).toBe('off')
  })
  it('builds week ids in WIB', () => {
    expect(currentWeekId(new Date('2026-11-01T03:00:00Z'))).toBe('2026-11-W1')
    expect(currentWeekId(new Date('2026-11-02T03:00:00Z'))).toBe('2026-11-W2')
  })
})
