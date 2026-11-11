'use client'
import { useEffect, useState } from 'react'
import { useCountUp } from './useCountUp'

export function ProgressRing({ done, total, size = 112, caption }: { done: number; total: number; size?: number; caption?: string }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(total ? Math.min(1, done / total) : 0))
    return () => cancelAnimationFrame(id)
  }, [done, total])
  const pct = useCountUp(total ? Math.round(Math.min(1, done / total) * 100) : 0)
  const r = 44
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(108 43 217 / .12)" strokeWidth="10" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={shown >= 1 ? '#16a34a' : 'url(#ring-grad)'} strokeWidth="10" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - shown)} className="ring-arc" />
        <defs>
          <linearGradient id="ring-grad" x1="0" x2="1">
            <stop offset="0" stopColor="#6C2BD9" />
            <stop offset="1" stopColor="#F97316" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-extrabold tabular-nums leading-none">{pct}%</span>
        <span className="mt-0.5 text-[11px] font-bold opacity-70 tabular-nums">{caption ?? `${Math.min(done, total)}/${total} link`}</span>
      </div>
    </div>
  )
}

const ICON: Record<'tiktok' | 'reels', string> = { tiktok: '♪', reels: '▶' }

/** One chip per required link: filled = counted, dashed amber = waiting for review. */
export function SlotRow({ kind, label, done, pending, of }: { kind: 'tiktok' | 'reels'; label: string; done: number; pending: number; of: number }) {
  const shownDone = useCountUp(Math.min(done, of))
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-bold">{label}</span>
        <span className="font-extrabold tabular-nums">
          {shownDone}/{of}
          {done >= of && <span className="ml-1 text-ok">✓</span>}
        </span>
      </div>
      <div className="mt-1.5 grid gap-1" style={{ gridTemplateColumns: `repeat(${Math.min(of, 10)}, minmax(0, 1fr))` }} role="progressbar" aria-label={`Progres ${label}`} aria-valuemin={0} aria-valuemax={of} aria-valuenow={Math.min(done, of)}>
        {Array.from({ length: of }, (_, i) => {
          const on = i < done
          const wait = !on && i < done + pending
          return (
            <span
              key={i}
              className={`flex aspect-square max-h-9 items-center justify-center rounded-lg text-xs font-extrabold ${on ? 'slot-on text-white' : wait ? 'border-2 border-dashed border-amber-400 text-amber-500' : 'bg-brand-purple/10 text-brand-purple/30'}`}
              style={on ? { animationDelay: `${i * 60}ms`, background: kind === 'tiktok' ? '#1f1147' : 'linear-gradient(135deg,#a855f7,#f97316)' } : undefined}
              title={on ? 'Terhitung' : wait ? 'Menunggu review' : 'Belum'}
            >
              {ICON[kind]}
            </span>
          )
        })}
      </div>
    </div>
  )
}

const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']

/** Monday–Sunday strip with today highlighted and the days left. */
export function WeekStrip({ start }: { start: string }) {
  const [today, setToday] = useState<number | null>(null)
  useEffect(() => setToday(Math.floor((Date.now() - Date.parse(start)) / 86_400_000)), [start])
  const left = today === null ? null : 7 - today
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold">
        {DAYS.map((d, i) => (
          <span key={d} className={`rounded-md py-1 ${today === i ? 'bg-brand-purple text-white' : today !== null && i < today ? 'bg-brand-purple/15 text-brand-purple' : 'bg-white/70 text-ink/50'}`}>
            {d}
          </span>
        ))}
      </div>
      {left !== null && <p className="mt-1 text-xs font-bold">{left <= 1 ? 'Hari terakhir minggu ini — ayo kejar!' : `Sisa ${left} hari minggu ini`}</p>}
    </div>
  )
}

/** A small burst, played once when the target is reached. */
export function Confetti() {
  const colors = ['#F59E0B', '#6C2BD9', '#F97316', '#16a34a', '#EC4899']
  return (
    <span className="pointer-events-none absolute left-1/2 top-6" aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <span key={i} className="tut-confetti" style={{ ['--a' as string]: `${i * 26 - 180}deg`, background: colors[i % colors.length], animationDelay: `${(i % 3) * 60}ms` }} />
      ))}
    </span>
  )
}

export function CountUp({ value }: { value: number }) {
  return <>{useCountUp(value)}</>
}
