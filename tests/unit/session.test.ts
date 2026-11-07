import { describe, expect, it, vi } from 'vitest'
import { signSession, verifySession } from '@/lib/session'

describe('session token', () => {
  it('round-trips and rejects tampering', async () => {
    const t = await signSession({ email: 'a@b.id', role: 'reviewer' })
    expect((await verifySession(t))?.email).toBe('a@b.id')
    const [body, sig] = t.split('.')
    const forged = Buffer.from(JSON.stringify({ email: 'a@b.id', role: 'owner', exp: 9e9 })).toString('base64url')
    expect(await verifySession(`${forged}.${sig}`)).toBeNull()
    expect(await verifySession(`${body}.x${sig.slice(1)}`)).toBeNull()
    expect(await verifySession('garbage')).toBeNull()
  })
  it('expires after 8 hours', async () => {
    const t = await signSession({ email: 'a@b.id', role: 'owner' })
    vi.useFakeTimers()
    vi.setSystemTime(Date.now() + 8 * 3600_000 + 1000)
    expect(await verifySession(t)).toBeNull()
    vi.useRealTimers()
  })
})
