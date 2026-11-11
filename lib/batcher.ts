/**
 * Micro-batching for spreadsheet writes. Requests arriving while a write is in flight are collected and
 * sent together in the next one, so 300 people pressing "Kirim" at once cost a handful of Apps Script
 * calls instead of 300 calls queued one after another. Batches run strictly one at a time.
 */
export function batcher<T, R>(run: (items: T[]) => Promise<R[]>, gatherMs = 15) {
  let queue: { item: T; resolve: (r: R) => void; reject: (e: unknown) => void }[] = []
  let running = false
  let timer: ReturnType<typeof setTimeout> | null = null

  async function flush() {
    timer = null
    if (running || queue.length === 0) return
    running = true
    const batch = queue
    queue = []
    try {
      const results = await run(batch.map((b) => b.item))
      batch.forEach((b, i) => b.resolve(results[i]))
    } catch (e) {
      batch.forEach((b) => b.reject(e))
    } finally {
      running = false
      if (queue.length) flush()
    }
  }

  return (item: T): Promise<R> =>
    new Promise<R>((resolve, reject) => {
      queue.push({ item, resolve, reject })
      if (!running && !timer) timer = setTimeout(flush, gatherMs)
    })
}
