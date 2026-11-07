/** Process-wide async mutex keyed by name; serializes writes within one server instance. */
const g = globalThis as unknown as { __shareinLocks?: Map<string, Promise<void>> }
const tails = (g.__shareinLocks ??= new Map<string, Promise<void>>())

export async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve()
  let release!: () => void
  const next = new Promise<void>((r) => (release = r))
  const tail = prev.then(() => next)
  tails.set(key, tail)
  await prev
  try {
    return await fn()
  } finally {
    release()
    if (tails.get(key) === tail) tails.delete(key)
  }
}
