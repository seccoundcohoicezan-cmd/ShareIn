import { describe, expect, it } from 'vitest'
import { embedUrl } from '@/lib/embed'

describe('embedUrl', () => {
  it('maps TikTok and Instagram links to their official embed players', () => {
    expect(embedUrl('https://www.tiktok.com/@a/video/7400000000000000123?is_from_webapp=1')).toBe('https://www.tiktok.com/embed/v2/7400000000000000123')
    expect(embedUrl('https://www.instagram.com/reel/C1aBcD2eFgH/?igsh=x')).toBe('https://www.instagram.com/reel/C1aBcD2eFgH/embed/')
    expect(embedUrl('https://www.instagram.com/p/C1aBcD2eFgH/')).toBe('https://www.instagram.com/p/C1aBcD2eFgH/embed/')
  })
  it('returns null for other links (shown in a plain frame instead)', () => {
    expect(embedUrl('https://sharein.id/c/abc')).toBeNull()
    expect(embedUrl('https://vm.tiktok.com/ZMabc/')).toBeNull()
  })
})
