const WIB = 7 * 3600_000
const DAY = 24 * 3600_000

export interface Week {
  /** ISO instant of Monday 00:00 WIB. */
  start: string
  /** ISO instant of the following Monday 00:00 WIB (exclusive). */
  end: string
}

/** The obligation week runs Monday 00:00 to Sunday 23:59 WIB. */
export function weekOf(now: Date = new Date()): Week {
  const wib = now.getTime() + WIB
  const midnight = wib - (((wib % DAY) + DAY) % DAY)
  const weekday = (new Date(midnight).getUTCDay() + 6) % 7
  const start = midnight - weekday * DAY - WIB
  return { start: new Date(start).toISOString(), end: new Date(start + 7 * DAY).toISOString() }
}

export function inWeek(iso: string, w: Week): boolean {
  const t = Date.parse(iso)
  return t >= Date.parse(w.start) && t < Date.parse(w.end)
}
