import { describe, expect, it } from 'vitest'
import { checkShareinUrl, detectPlatform, parseSourceUrl } from '@/lib/url'

describe('parseSourceUrl', () => {
  it('normalizes TikTok video links and strips tracking params', () => {
    const r = parseSourceUrl('https://www.tiktok.com/@akun/video/7300000000000000000?is_from_webapp=1&sender_device=pc&utm_source=x')
    expect(r).toEqual({ platform: 'tiktok', url: 'https://www.tiktok.com/@akun/video/7300000000000000000', source_key: 'tt:7300000000000000000', short: false })
  })
  it('gives the same key for mobile and desktop TikTok variants', () => {
    const a = parseSourceUrl('https://m.tiktok.com/v/7300000000000000000.html')
    const b = parseSourceUrl('https://tiktok.com/@akun/video/7300000000000000000/')
    expect(typeof a !== 'string' && a.source_key).toBe('tt:7300000000000000000')
    expect(typeof b !== 'string' && b.source_key).toBe('tt:7300000000000000000')
  })
  it('flags vm./vt./t/ short links for resolution', () => {
    for (const u of ['https://vm.tiktok.com/ZMabc123/', 'https://vt.tiktok.com/ZSxyz789', 'https://www.tiktok.com/t/ZT8abcd/']) {
      const r = parseSourceUrl(u)
      expect(typeof r !== 'string' && r.short && r.source_key === null).toBe(true)
    }
  })
  it('parses Instagram reel, reels and p links', () => {
    for (const u of [
      'https://www.instagram.com/reel/C1aBcD2eFgH/?igsh=MTIzNDU2&utm_source=ig_web_copy_link',
      'https://instagram.com/reels/C1aBcD2eFgH/',
      'https://www.instagram.com/akun.id/reel/C1aBcD2eFgH',
    ]) {
      const r = parseSourceUrl(u)
      expect(r).toEqual({ platform: 'reels', url: 'https://www.instagram.com/reel/C1aBcD2eFgH/', source_key: 'ig:C1aBcD2eFgH', short: false })
    }
    const p = parseSourceUrl('https://www.instagram.com/p/C1aBcD2eFgH/')
    expect(typeof p !== 'string' && p.source_key).toBe('ig:C1aBcD2eFgH')
  })
  it('rejects http, other domains, look-alike hosts and profile pages', () => {
    expect(parseSourceUrl('http://www.tiktok.com/@a/video/7300000000000000000')).toBe('not_https')
    expect(parseSourceUrl('https://youtube.com/shorts/abc')).toBe('unsupported')
    expect(parseSourceUrl('https://tiktok.com.evil.id/@a/video/7300000000000000000')).toBe('unsupported')
    expect(parseSourceUrl('https://faketiktok.com/@a/video/7300000000000000000')).toBe('unsupported')
    expect(parseSourceUrl('https://www.instagram.com/akun/')).toBe('unsupported')
    expect(parseSourceUrl('javascript:alert(1)')).toBe('invalid')
    expect(parseSourceUrl('')).toBe('invalid')
  })
  it('accepts links pasted without scheme', () => {
    const r = parseSourceUrl('www.tiktok.com/@a/video/7300000000000000001')
    expect(typeof r !== 'string' && r.source_key).toBe('tt:7300000000000000001')
  })
  it('detects platform', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMabc/')).toBe('tiktok')
    expect(detectPlatform('https://www.instagram.com/reel/C1aBcD2eFgH/')).toBe('reels')
    expect(detectPlatform('https://example.com')).toBeNull()
  })
})

describe('checkShareinUrl', () => {
  const d = ['sharein.id', 'sharein.app']
  it('accepts configured domains and subdomains', () => {
    expect(checkShareinUrl('https://sharein.id/c/abc123', d).ok).toBe(true)
    expect(checkShareinUrl('https://www.sharein.app/v/xyz', d).ok).toBe(true)
  })
  it('explains each failure', () => {
    expect(checkShareinUrl('', d).reason).toBe('empty')
    expect(checkShareinUrl('http://sharein.id/c/abc', d).reason).toBe('not_https')
    expect(checkShareinUrl('https://sharein.id.evil.com/c/abc', d).reason).toBe('domain')
    expect(checkShareinUrl('https://sharein.id/', d).reason).toBe('no_path')
  })
})
