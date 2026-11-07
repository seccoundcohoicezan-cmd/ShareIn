// In-memory sliding window. Best effort per server instance; enough to slow abuse on small traffic.
const hits = new Map<string, number[]>()

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now()
  const list = (hits.get(key) ?? []).filter((t) => t > now - windowMs)
  if (list.length >= limit) {
    hits.set(key, list)
    return { ok: false, retryAfter: Math.ceil((list[0] + windowMs - now) / 1000) }
  }
  list.push(now)
  hits.set(key, list)
  if (hits.size > 5000) {
    for (const [k, v] of Array.from(hits)) if (!v.some((t) => t > now - windowMs)) hits.delete(k)
  }
  return { ok: true, retryAfter: 0 }
}

export function resetRateLimit(key: string) {
  hits.delete(key)
}
