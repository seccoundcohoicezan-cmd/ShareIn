import { describe, expect, it } from 'vitest'
import { parseSettings } from '@/lib/settings-schema'
import type { Platform } from '@/lib/types'
import { parseSourceUrl } from '@/lib/url'
import { runChecks, type CheckInput } from '@/lib/validate'

const settings = parseSettings(new Map())
const links: Record<Platform, ReturnType<typeof parseSourceUrl>> = {
  tiktok: parseSourceUrl('https://www.tiktok.com/@a/video/7300000000000000000'),
  reels: parseSourceUrl('https://www.instagram.com/reel/C1aBcD2eFgH/'),
}

function input(p: Platform, over: Partial<CheckInput> = {}): CheckInput {
  return {
    platform: p,
    likes: 100000,
    comments: p === 'tiktok' ? 5000 : 3000,
    sharein_url: 'https://sharein.id/c/abc123',
    organic_declared: true,
    checked_declared: true,
    has_screenshot: false,
    ...over,
  }
}

function check(p: Platform, over: Partial<CheckInput> = {}, ctx: Partial<Parameters<typeof runChecks>[1]> = {}) {
  return runChecks(input(p, over), { settings, link: links[p], duplicate: null, ...ctx })
}
const byId = (r: ReturnType<typeof check>, id: string) => r.checks.find((c) => c.id === id)!

describe('runChecks', () => {
  it('returns the documented check ids in order on success', () => {
    const r = check('tiktok')
    expect(r.ok).toBe(true)
    expect(r.checks.map((c) => c.id)).toEqual(['url_valid', 'not_duplicate', 'min_like', 'min_comment', 'sharein_valid', 'organic'])
  })
  it.each(['tiktok', 'reels'] as const)('likes threshold is inclusive (%s): 99.999 rejected, 100.000 accepted', (p) => {
    expect(byId(check(p, { likes: 99999 }), 'min_like').pass).toBe(false)
    expect(byId(check(p, { likes: 100000 }), 'min_like').pass).toBe(true)
  })
  it('comment thresholds: Reels 2.999/3.000, TikTok 4.999/5.000', () => {
    expect(byId(check('reels', { comments: 2999 }), 'min_comment').pass).toBe(false)
    expect(byId(check('reels', { comments: 3000 }), 'min_comment').pass).toBe(true)
    expect(byId(check('tiktok', { comments: 4999 }), 'min_comment').pass).toBe(false)
    expect(byId(check('tiktok', { comments: 5000 }), 'min_comment').pass).toBe(true)
  })
  it('uses the documented messages', () => {
    expect(byId(check('tiktok', { likes: 80000 }), 'min_like').message).toBe('Like 80.000 belum cukup. TikTok minimal 100.000.')
    expect(byId(check('reels', { comments: 2000 }), 'min_comment').message).toBe('Komentar 2.000 belum cukup. Reels minimal 3.000.')
    expect(byId(check('tiktok', { sharein_url: '' }), 'sharein_valid').pass).toBe(true) // optional for first-time participants
    expect(byId(check('tiktok', { sharein_url: 'https://contoh.com/x' }), 'sharein_valid').pass).toBe(false)
    expect(byId(check('tiktok', {}, { duplicate: { created_at: '2026-11-03T05:00:00Z' } }), 'not_duplicate').message).toBe(
      'Link ini sudah pernah disetor pada 3 Nov. Cari konten lain.',
    )
  })
  it('reads thresholds from settings, not code', () => {
    const custom = parseSettings(new Map([['min_like_tiktok', '50000']]))
    const r = runChecks(input('tiktok', { likes: 60000 }), { settings: custom, link: links.tiktok, duplicate: null })
    expect(byId(r, 'min_like').pass).toBe(true)
  })
  it('blocks when the period is closed', () => {
    const closed = parseSettings(new Map([['period_open', 'FALSE']]))
    const r = runChecks(input('tiktok'), { settings: closed, link: links.tiktok, duplicate: null })
    expect(r.ok).toBe(false)
    expect(r.checks[0].id).toBe('period_open')
  })
  it('rejects a link from the other platform and non-TikTok/IG links', () => {
    expect(byId(check('reels', {}, { link: links.tiktok }), 'url_valid').pass).toBe(false)
    expect(byId(check('tiktok', {}, { link: 'unsupported' }), 'url_valid').message).toBe(
      'Link harus dari tiktok.com atau instagram.com/reel/. Tempel link dari tombol Bagikan.',
    )
  })
  it('requires both declarations and, when configured, a screenshot', () => {
    expect(byId(check('tiktok', { organic_declared: false }), 'organic').pass).toBe(false)
    expect(byId(check('tiktok', { checked_declared: false }), 'organic').pass).toBe(false)
    const strict = parseSettings(new Map([['require_screenshot', 'TRUE']]))
    const base = { link: links.tiktok, duplicate: null }
    expect(byId(runChecks(input('tiktok'), { settings: strict, ...base }), 'organic').pass).toBe(false)
    expect(byId(runChecks(input('tiktok', { has_screenshot: true }), { settings: strict, ...base }), 'organic').pass).toBe(true)
  })
  it('numbers and ShareIn link are optional', () => {
    // Participants only paste the link: no numbers = not checked here (admin verifies).
    expect(byId(check('tiktok', { likes: null, comments: null }), 'min_like').pass).toBe(true)
    expect(check('tiktok', { likes: null, comments: null }).ok).toBe(true)
  })
})
