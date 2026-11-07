import { describe, expect, it, vi } from 'vitest'
import { isPrivateIp, parseAndResolve, resolveShortLink, type Fetcher } from '@/lib/resolve'
import { parseSourceUrl } from '@/lib/url'

const publicDns = async () => ['203.0.113.10'.replace('203.0.113', '23.45.67')]

function redirector(map: Record<string, string>): Fetcher {
  return vi.fn(async (url: string, init: RequestInit) => {
    expect(init.method).toBe('HEAD')
    expect(init.redirect).toBe('manual')
    const to = map[url]
    return new Response(null, to ? { status: 301, headers: { location: to } } : { status: 200 })
  })
}

describe('short link resolution', () => {
  it('long and short TikTok links produce the same source_key', async () => {
    const fetcher = redirector({
      'https://vm.tiktok.com/ZMabc123/': 'https://www.tiktok.com/@akun/video/7300000000000000000?_r=1&_t=xyz',
    })
    const short = await parseAndResolve('https://vm.tiktok.com/ZMabc123/', { fetcher, resolver: publicDns })
    const long = parseSourceUrl('https://www.tiktok.com/@akun/video/7300000000000000000?is_from_webapp=1')
    expect(typeof short !== 'string' && short.source_key).toBe('tt:7300000000000000000')
    expect(typeof long !== 'string' && long.source_key).toBe('tt:7300000000000000000')
  })
  it('follows multi-hop redirects', async () => {
    const fetcher = redirector({
      'https://vt.tiktok.com/ZS1/': 'https://www.tiktok.com/t/ZS1abc/',
      'https://www.tiktok.com/t/ZS1abc/': '/@a/video/7311111111111111111',
    })
    const r = await parseAndResolve('https://vt.tiktok.com/ZS1', { fetcher, resolver: publicDns })
    expect(typeof r !== 'string' && r.source_key).toBe('tt:7311111111111111111')
  })
  it('refuses redirects to other domains (SSRF guard)', async () => {
    const fetcher = redirector({ 'https://vm.tiktok.com/ZMx/': 'https://169.254.169.254/latest/meta-data' })
    expect(await resolveShortLink('https://vm.tiktok.com/ZMx/', { fetcher, resolver: publicDns })).toBeNull()
  })
  it('refuses hosts that resolve to private IPs', async () => {
    const fetcher = redirector({})
    const r = await resolveShortLink('https://vm.tiktok.com/ZMx/', { fetcher, resolver: async () => ['10.0.0.5'] })
    expect(r).toBeNull()
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('returns unresolved on timeout', async () => {
    const fetcher: Fetcher = (_u, init) =>
      new Promise((_, rej) => init.signal?.addEventListener('abort', () => rej(new Error('aborted'))))
    const r = await parseAndResolve('https://vm.tiktok.com/ZMslow/', { fetcher, resolver: publicDns, timeoutMs: 20 })
    expect(r).toBe('unresolved')
  })
  it('classifies private ranges', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '::1', 'fd00::1', '::ffff:10.0.0.1', '0.0.0.0'])
      expect(isPrivateIp(ip)).toBe(true)
    for (const ip of ['8.8.8.8', '23.45.67.10', '2606:4700::1111']) expect(isPrivateIp(ip)).toBe(false)
  })
})
