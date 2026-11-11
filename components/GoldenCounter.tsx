'use client'
import { useEffect, useState } from 'react'
import { formatRupiah, goldenAmount, type GoldenPool } from '@/lib/golden'

const endFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' })

/** Running prize pool; the value is time-based so it matches for every visitor. */
export function GoldenCounter({ pool, size = 'lg' }: { pool: GoldenPool; size?: 'lg' | 'sm' }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => {
      if (!document.hidden) setNow(Date.now())
    }, 1000)
    return () => clearInterval(id)
  }, [])
  // Render the start-of-hour value on the server to avoid a hydration mismatch, then tick.
  const value = goldenAmount(pool, now ?? Math.floor(Date.now() / 3_600_000) * 3_600_000)
  return (
    <div>
      <p
        className={`font-extrabold tabular-nums tracking-tight ${size === 'lg' ? 'text-[2.4rem] leading-none sm:text-5xl' : 'text-2xl'}`}
        aria-live="off"
        suppressHydrationWarning
      >
        {formatRupiah(value)}
      </p>
      <p className={`mt-1 font-bold ${size === 'lg' ? 'text-sm' : 'text-xs'} opacity-80`}>
        Terus bertambah sampai {endFmt.format(new Date(pool.golden_end_at))}
      </p>
    </div>
  )
}
