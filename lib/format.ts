const nf = new Intl.NumberFormat('id-ID')

export function formatNumber(n: number): string {
  return nf.format(n)
}

/** Parses "120.000", "120,000", "120000", "120rb", "1,2jt" into an integer; null when invalid. */
export function parseCount(input: string | number | null | undefined): number | null {
  if (typeof input === 'number') return Number.isFinite(input) && input >= 0 ? Math.floor(input) : null
  const raw = String(input ?? '').trim().toLowerCase().replace(/\s+/g, '')
  if (!raw) return null
  const m = raw.match(/^(\d+(?:[.,]\d+)*)(rb|ribu|k|jt|juta|m)?$/)
  if (!m) return null
  const [, num, unit] = m
  let value: number
  if (unit) {
    value = Number(num.replace(',', '.'))
    if (!Number.isFinite(value)) return null
    value *= unit === 'rb' || unit === 'ribu' || unit === 'k' ? 1_000 : 1_000_000
  } else {
    value = Number(num.replace(/[.,]/g, ''))
  }
  return Number.isFinite(value) ? Math.round(value) : null
}

const df = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })
const dtf = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Jakarta',
})

export function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : df.format(d)
}
export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '-' : dtf.format(d)
}

export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase()
}
