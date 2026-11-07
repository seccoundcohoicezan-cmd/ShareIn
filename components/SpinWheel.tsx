'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { formatNumber, parseCount } from '@/lib/format'
import { formatRupiah } from '@/lib/golden'
import { formatDateTime } from '@/lib/format'
import type { Draw, Program } from '@/lib/types'
import { GiftSolid } from './icons'
import { toast, Toaster } from './Toast'

const COLORS = ['#6C2BD9', '#F97316', '#A855F7', '#FBBF24']
const LABEL: Record<Program, string> = { pelatihan: 'Pelatihan Content', duta: 'Duta Teladan' }

function Wheel({ segments, rotation, spinning }: { segments: string[]; rotation: number; spinning: boolean }) {
  const n = Math.max(segments.length, 1)
  const seg = 360 / n
  const r = 150
  const arc = (i: number) => {
    const a0 = ((i * seg - 90) * Math.PI) / 180
    const a1 = (((i + 1) * seg - 90) * Math.PI) / 180
    const large = seg > 180 ? 1 : 0
    return `M0 0 L${r * Math.cos(a0)} ${r * Math.sin(a0)} A${r} ${r} 0 ${large} 1 ${r * Math.cos(a1)} ${r * Math.sin(a1)} Z`
  }
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[340px]">
      <div className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-x-[14px] border-t-[26px] border-x-transparent border-t-ink" aria-hidden="true" />
      <svg
        viewBox="-160 -160 320 320"
        className="h-full w-full"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? 'transform 5.5s cubic-bezier(.12,.72,.12,1)' : 'none',
        }}
        role="img"
        aria-label={`Roda berisi ${segments.length} kode`}
      >
        <circle r="158" fill="#2A0F5C" />
        {segments.length === 0 ? (
          <circle r={r} fill="#F3F0FF" />
        ) : (
          segments.map((code, i) => {
            const mid = i * seg + seg / 2
            return (
              <g key={code + i}>
                {n === 1 ? <circle r={r} fill={COLORS[0]} /> : <path d={arc(i)} fill={COLORS[i % (n % 4 === 1 ? 3 : 4)]} />}
                <text
                  transform={`rotate(${mid - 90}) translate(${r - 12} 0)`}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={n > 12 ? 11 : 13}
                  fontWeight={800}
                  fill="#fff"
                  fontFamily="ui-monospace, monospace"
                >
                  {code}
                </text>
              </g>
            )
          })
        )}
        <circle r="22" fill="#fff" stroke="#2A0F5C" strokeWidth="4" />
      </svg>
    </div>
  )
}

export function SpinWheel() {
  const [program, setProgram] = useState<Program>('pelatihan')
  const [pool, setPool] = useState<string[]>([])
  const [draws, setDraws] = useState<Draw[]>([])
  const [prize, setPrize] = useState('')
  const [segments, setSegments] = useState<string[]>([])
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [winner, setWinner] = useState<{ draw: Draw; whatsapp: string } | null>(null)
  const [error, setError] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout>>()

  const load = useCallback(async (p: Program, resetPrize: boolean, keepWheel = false) => {
    const res = await fetch(`/api/admin/programs/${p}/draws`)
    const data = await res.json()
    if (!res.ok) return setError(data.error ?? 'Data belum termuat.')
    setPool(data.pool)
    setDraws(data.draws)
    if (!keepWheel) setSegments(data.pool.slice(0, 16))
    if (resetPrize) setPrize(data.defaultPrize ? formatNumber(data.defaultPrize) : '')
  }, [])

  useEffect(() => {
    setWinner(null)
    setRotation(0)
    load(program, true)
  }, [program, load])
  useEffect(() => () => clearTimeout(timer.current), [])

  async function spin() {
    setError('')
    const amount = parseCount(prize)
    if (!amount) return setError('Isi nominal hadiah dulu, contoh 100000.')
    setWinner(null)
    const res = await fetch(`/api/admin/programs/${program}/spin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ prize: amount }),
    })
    const data = await res.json()
    if (!res.ok) return setError(data.error ?? 'Gagal memutar.')
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    setSpinning(false)
    setSegments(data.segments)
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const seg = 360 / data.segments.length
        const center = (data.winnerIndex + 0.5) * seg
        const jitter = (Math.random() - 0.5) * seg * 0.6
        setSpinning(!reduce)
        setRotation((r) => r + (reduce ? 0 : 360 * 6) + ((360 - center + jitter - (r % 360)) % 360 + 360) % 360)
        timer.current = setTimeout(() => {
          setSpinning(false)
          setWinner({ draw: data.draw, whatsapp: data.whatsapp })
          load(program, false, true)
        }, reduce ? 50 : 5600)
      }),
    )
  }

  async function voidDraw(d: Draw) {
    if (!confirm(`Batalkan kemenangan ${d.code} (${d.name})? Kode bisa ikut diundi lagi.`)) return
    const res = await fetch(`/api/admin/programs/${program}/draws/${d.id}`, { method: 'DELETE' })
    if (!res.ok) return toast('Gagal membatalkan.', 'bad')
    toast('Dibatalkan')
    load(program, false, Boolean(winner))
  }

  return (
    <div className="space-y-4">
      <div role="tablist" className="grid max-w-sm grid-cols-2 gap-1 rounded-field bg-white p-1">
        {(['pelatihan', 'duta'] as Program[]).map((p) => (
          <button key={p} role="tab" type="button" aria-selected={program === p} disabled={spinning} onClick={() => setProgram(p)} className={`min-h-[44px] rounded-[12px] text-sm font-bold ${program === p ? 'bg-brand-purple text-white' : 'text-brand-purple'}`}>
            {LABEL[p]}
          </button>
        ))}
      </div>

      <section className="panel-solid">
        <Wheel segments={segments} rotation={rotation} spinning={spinning} />
        <p className="muted mt-3 text-center text-sm">{pool.length} kode siap diundi{pool.length > 16 ? ' · roda menampilkan 16 kode, pemenang diambil dari semua kode' : ''}</p>
        <div className="mx-auto mt-4 grid max-w-md grid-cols-[1fr_auto] items-end gap-2">
          <div>
            <label htmlFor="hadiah" className="label">Nominal hadiah</label>
            <input id="hadiah" className="field tabular-nums" inputMode="numeric" placeholder="100.000" value={prize} onChange={(e) => setPrize(e.target.value)} onBlur={() => { const n = parseCount(prize); if (n) setPrize(formatNumber(n)) }} />
          </div>
          <button type="button" className="btn-secondary" disabled={spinning || pool.length === 0} onClick={spin}>{spinning ? 'Memutar…' : 'Putar'}</button>
        </div>
        {error && <p role="alert" className="mt-2 text-center text-sm font-bold text-bad">{error}</p>}
      </section>

      {winner && (
        <section className="panel-solid text-center" role="status" aria-live="polite">
          <div className="bounce-once mx-auto w-fit"><GiftSolid className="h-16 w-16" /></div>
          <p className="mt-2 text-sm font-bold">Pemenang</p>
          <p className="font-mono text-3xl font-extrabold tracking-widest">{winner.draw.code}</p>
          <p className="mt-1 text-lg font-extrabold">{winner.draw.name}</p>
          <p className="text-2xl font-extrabold text-orange-700">{formatRupiah(winner.draw.prize)}</p>
          <a href={`https://wa.me/${winner.whatsapp}`} target="_blank" rel="noopener noreferrer" className="btn-primary mt-3">Hubungi via WhatsApp</a>
        </section>
      )}

      <section className="panel-solid">
        <h2 className="mb-3 font-extrabold">Riwayat undian {LABEL[program]}</h2>
        {draws.length === 0 ? (
          <p className="muted text-sm">Belum ada undian.</p>
        ) : (
          <ul className="divide-y divide-brand-purple/10">
            {draws.map((d) => (
              <li key={d.id} className={`flex flex-wrap items-center gap-2 py-3 text-sm ${d.status === 'void' ? 'opacity-50' : ''}`}>
                <span className="font-mono font-extrabold">{d.code}</span>
                <span className="font-bold">{d.name}</span>
                <span className="font-bold text-orange-700">{formatRupiah(d.prize)}</span>
                <span className="muted text-xs">{formatDateTime(d.time)}</span>
                {d.status === 'void' ? (
                  <span className="ml-auto text-xs font-bold">Dibatalkan</span>
                ) : (
                  <button type="button" className="btn-ghost btn-sm ml-auto" onClick={() => voidDraw(d)}>Batalkan</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <Toaster />
    </div>
  )
}
