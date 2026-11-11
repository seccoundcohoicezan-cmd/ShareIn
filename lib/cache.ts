interface Entry<T> {
  value: T
  expires: number
}
// On globalThis so every server bundle (routes, instrumentation warm-up) shares one cache.
const g = globalThis as unknown as { __shareinCache?: Map<string, Entry<unknown>> }
const store = (g.__shareinCache ??= new Map<string, Entry<unknown>>())

export const CACHE_TTL_MS = 60_000

export async function cached<T>(key: string, load: () => Promise<T>, ttl = CACHE_TTL_MS): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined
  if (hit && hit.expires > Date.now()) return hit.value
  const value = await load()
  store.set(key, { value, expires: Date.now() + ttl })
  return value
}

/** Stores a value we already know (e.g. right after writing it) so the next read skips the sheet. */
export function prime<T>(key: string, value: T, ttl = CACHE_TTL_MS) {
  store.set(key, { value, expires: Date.now() + ttl })
}

export function invalidate(prefix = '') {
  for (const k of Array.from(store.keys())) if (k.startsWith(prefix)) store.delete(k)
}
