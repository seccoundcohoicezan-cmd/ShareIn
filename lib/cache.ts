interface Entry<T> {
  value: T
  expires: number
}
const store = new Map<string, Entry<unknown>>()

export const CACHE_TTL_MS = 60_000

export async function cached<T>(key: string, load: () => Promise<T>, ttl = CACHE_TTL_MS): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined
  if (hit && hit.expires > Date.now()) return hit.value
  const value = await load()
  store.set(key, { value, expires: Date.now() + ttl })
  return value
}

export function invalidate(prefix = '') {
  for (const k of Array.from(store.keys())) if (k.startsWith(prefix)) store.delete(k)
}
