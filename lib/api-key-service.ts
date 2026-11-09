import { createHash, randomBytes } from 'node:crypto'
import { z } from 'zod'
import { cached, invalidate } from './cache'
import { withLock } from './lock'
import { audit } from './repo/audit'
import { apiKeysTable } from './repo/programs'
import { strip } from './repo/records'
import type { ApiKey } from './types'

export const newApiKeySchema = z.object({ name: z.string().trim().min(2, 'Beri nama kunci, misalnya nama sistemnya.').max(60) })

const hash = (key: string) => createHash('sha256').update(key).digest('hex')

/** Keys are 192-bit random, so a plain SHA-256 is enough; the raw key is returned once only. */
export async function createApiKey(name: string, actor: string): Promise<{ key: string; item: Omit<ApiKey, 'key_hash'> }> {
  return withLock('api_keys', async () => {
    const key = 'si_live_' + randomBytes(24).toString('base64url')
    const rec: ApiKey = {
      id: 'key_' + randomBytes(6).toString('hex'),
      name,
      prefix: key.slice(0, 14),
      key_hash: hash(key),
      active: true,
      created_at: new Date().toISOString(),
      created_by: actor,
    }
    await apiKeysTable.append([rec])
    invalidate('api_keys')
    await audit(actor, 'api_key.create', rec.id, '', { name })
    const { key_hash, ...item } = rec
    void key_hash
    return { key, item }
  })
}

export async function listApiKeys(): Promise<Omit<ApiKey, 'key_hash'>[]> {
  return (await apiKeysTable.list()).map(strip).map(({ key_hash, ...k }) => {
    void key_hash
    return k
  })
}

export async function revokeApiKey(id: string, actor: string): Promise<boolean> {
  return withLock('api_keys', async () => {
    const k = (await apiKeysTable.list()).find((x) => x.id === id)
    if (!k || !k.active) return false
    await apiKeysTable.update([{ ...k, active: false }])
    invalidate('api_keys')
    await audit(actor, 'api_key.revoke', id, { active: true }, { active: false })
    return true
  })
}

export async function verifyApiKey(key: string): Promise<ApiKey | null> {
  if (!key.startsWith('si_live_')) return null
  const h = hash(key)
  const all = await cached('api_keys', () => apiKeysTable.list(), 60_000)
  const found = all.find((k) => k.active && k.key_hash === h)
  return found ? strip(found) : null
}
