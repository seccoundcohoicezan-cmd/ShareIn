/**
 * Browser GET with a few retries on network errors and busy answers (5xx/429). Used for read-only
 * calls only; sends (POST) are never repeated automatically, so nothing is submitted twice.
 */
export async function getJson<T = unknown>(url: string, tries = 3): Promise<T> {
  let last: unknown
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (res.ok) return (await res.json()) as T
      if (res.status !== 429 && res.status < 500) throw Object.assign(new Error(`HTTP ${res.status}`), { final: true })
      last = new Error(`HTTP ${res.status}`)
    } catch (e) {
      if ((e as { final?: boolean }).final) throw e
      last = e
    }
    if (i < tries - 1) await new Promise((r) => setTimeout(r, 800 * 2 ** i + Math.random() * 400))
  }
  throw last
}
