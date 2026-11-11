'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Spin } from '@/lib/types'
import type { WheelEntry } from '@/lib/spin'
import { toast } from './Toast'
import { EmptyState, Spinner, TopProgress } from './ui'

type State = { round: string; target: { tiktok: number; reels: number }; entries: WheelEntry[]; history: Spin[] }

const COLORS = ['#6C2BD9', '#F59E0B', '#8B5CF6', '#F97316', '#4C1D95', '#FBBF24']
const SPIN_MS = 4500
const fmt = (iso: string) => new Date(iso).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })

function slice(i: number, n: number) {
  const a0 = (i / n) * 2 * Math.PI - Math.PI / 2
  const a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2
  const large = a1 - a0 > Math.PI ? 1 : 0
  return `M0 0 L${Math.cos(a0) * 100} ${Math.sin(a0) * 100} A100 100 0 ${large} 1 ${Math.cos(a1) * 100} ${Math.sin(a1) * 100} Z`
}

/** Plain SVG + one CSS transform: light enough for phones, no canvas or animation library. */
function Wheel({ names, rotation, spinning }: { names: string[]; rotation: number; spinning: boolean }) {
  const n = Math.max(names.length, 1)
  const labels = n <= 30
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[340px]">
      <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-1 text-3xl text-ink drop-shadow" aria-hidden="true">▼</div>
      <svg
        viewBox="-104 -104 208 208"
        className="h-full w-full"
        style={{ transform: `rotate(${rotation}deg)`, transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.17, 0.67, 0.12, 1)` : 'none' }}
        role="img"
        aria-label={`Roda undian berisi ${names.length} peserta`}
      >
        <circle r="103" fill="#fff" />
        {names.length === 0 ? (
          <circle r="100" fill="#EDE9FE" />
        ) : (
          names.map((name, i) => {
            const mid = ((i + 0.5) / n) * 360
            return (
              <g key={i}>
                {n === 1 ? <circle r="100" fill={COLORS[0]} /> : <path d={slice(i, n)} fill={COLORS[i % (n % COLORS.length === 1 ? COLORS.length - 1 : COLORS.length)]} />}
                {labels && (
                  <text transform={`rotate(${mid - 90}) translate(58 0)`} fill="#fff" fontSize={n > 16 ? 6 : 8} fontWeight="700" textAnchor="middle" dominantBaseline="middle">
                    {name.length > 14 ? name.slice(0, 13) + '…' : name}
                  </text>
                )}
              </g>
            )
          })
        )}
        <circle r="12" fill="#fff" stroke="#6C2BD9" strokeWidth="3" />
      </svg>
    </div>
  )
}

export function SpinAdmin({ canManage }: { canManage: boolean }) {
  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState('')
  const [prize, setPrize] = useState('')
  const [names, setNames] = useState<string[]>([])
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [winner, setWinner] = useState<Spin | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch('/api/admin/spin', { cache: 'no-store' })
      if (res.status === 401) return location.assign('/admin/login')
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setState(d)
      setNames(d.entries.map((e: WheelEntry) => e.name))
    } catch (e) {
      setError((e as Error).message || 'Data undian belum termuat.')
    }
  }, [])

  useEffect(() => {
    load()
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [load])

  async function spin() {
    setWinner(null)
    setBusy('draw')
    let d: { ok?: boolean; error?: string; spin: Spin; index: number; entries: WheelEntry[] }
    try {
      const res = await fetch('/api/admin/spin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ prize }) })
      d = await res.json()
      if (!res.ok) throw new Error(d.error)
    } catch (e) {
      setBusy(null)
      return toast((e as Error).message || 'Gagal mengundi. Coba lagi.', 'bad')
    }
    setBusy(null)
    // The server already picked the winner; the wheel only shows it.
    const n = d.entries.length
    setNames(d.entries.map((e) => e.name))
    const center = ((d.index + 0.5) / n) * 360
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const target = rotation - (rotation % 360) + (reduce ? 0 : 360 * 6) + (360 - center)
    const finish = () => {
      setSpinning(false)
      setWinner(d.spin)
      setState((s) => (s ? { ...s, entries: s.entries.filter((e) => e.whatsapp !== d.spin.whatsapp), history: [d.spin, ...s.history] } : s))
    }
    if (reduce) {
      setRotation(target)
      return finish()
    }
    requestAnimationFrame(() => {
      setSpinning(true)
      setRotation(target)
    })
    timer.current = setTimeout(finish, SPIN_MS + 100)
  }

  async function remove(ids: string[], label: string) {
    if (!confirm(label)) return
    setBusy('delete')
    const res = await fetch('/api/admin/spin', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids }) }).catch(() => null)
    setBusy(null)
    if (!res?.ok) return toast('Gagal menghapus. Coba lagi.', 'bad')
    toast('Riwayat dihapus')
    await load()
  }

  async function reset() {
    if (!confirm('Mulai putaran undian baru? Hitungan link semua peserta mulai dari 0 lagi. Riwayat pemenang tetap tersimpan.')) return
    setBusy('reset')
    const res = await fetch('/api/admin/spin/reset', { method: 'POST' }).catch(() => null)
    setBusy(null)
    if (!res?.ok) return toast('Gagal mereset. Coba lagi.', 'bad')
    toast('Putaran baru dimulai')
    setWinner(null)
    await load()
  }

  if (error) return <p role="alert" className="rounded-field bg-red-50 p-3 text-sm font-bold text-bad">{error}</p>
  if (!state) return <div className="h-80 animate-pulse rounded-panel bg-white" />

  return (
    <div className="space-y-4">
      <TopProgress active={busy !== null} label={busy === 'draw' ? 'Mengundi…' : 'Menyimpan…'} />
      <section className="panel-solid space-y-4">
        <div>
          <h2 className="font-extrabold">Spin wheel undian</h2>
          <p className="muted text-sm">
            Peserta masuk roda setelah punya {state.target.tiktok} link TikTok & {state.target.reels} link Reels yang disetujui
            {state.round ? ` sejak ${fmt(state.round)}` : ''}. Pemenang di putaran ini tidak ikut lagi sampai riwayatnya dihapus atau putaran direset.
          </p>
        </div>
        <Wheel names={names} rotation={rotation} spinning={spinning} />
        <p className="text-center text-sm font-bold">{state.entries.length} peserta di roda</p>
        {winner && !spinning && (
          <div role="status" className="bounce-once rounded-field bg-gradient-to-br from-brand-amber to-brand-orange p-4 text-center text-ink">
            <p className="text-xs font-extrabold tracking-[0.2em]">PEMENANG</p>
            <p className="text-2xl font-extrabold">{winner.name}</p>
            <p className="text-sm font-bold">{winner.whatsapp}{winner.prize ? ` · ${winner.prize}` : ''}</p>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label htmlFor="hadiah" className="label">Hadiah (opsional)</label>
            <input id="hadiah" className="field" maxLength={80} value={prize} onChange={(e) => setPrize(e.target.value)} placeholder="Contoh: Voucher Rp100.000" />
          </div>
          <button type="button" className="btn-primary gap-2" disabled={spinning || busy !== null || state.entries.length === 0} onClick={spin}>
            {busy === 'draw' ? <><Spinner /> Mengundi…</> : spinning ? 'Memutar…' : 'Putar roda'}
          </button>
        </div>
        {state.entries.length === 0 && <p className="muted text-sm">Belum ada peserta yang memenuhi syarat. Lihat tab Progres peserta.</p>}
        {state.entries.length > 0 && (
          <details className="rounded-field bg-brand-lavender/60 p-3 text-sm">
            <summary className="cursor-pointer font-bold">Daftar peserta di roda ({state.entries.length})</summary>
            <ul className="mt-2 space-y-1">
              {state.entries.map((e) => <li key={e.id}>{e.name} <span className="muted">· {e.whatsapp} · TT {e.tiktok} · IG {e.reels}</span></li>)}
            </ul>
          </details>
        )}
      </section>

      <section className="panel-solid space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-extrabold">Riwayat pemenang</h2>
          {canManage && (
            <div className="flex flex-wrap gap-2">
              {state.history.length > 0 && (
                <button type="button" className="btn-ghost btn-sm" disabled={busy !== null} onClick={() => remove(state.history.map((h) => h.id), `Hapus semua ${state.history.length} riwayat pemenang?`)}>
                  Hapus semua riwayat
                </button>
              )}
              <button type="button" className="btn btn-sm gap-2 bg-bad text-white" disabled={busy !== null || spinning} onClick={reset}>
                {busy === 'reset' ? <><Spinner /> Mereset…</> : 'Reset undian'}
              </button>
            </div>
          )}
        </div>
        {state.history.length === 0 ? (
          <EmptyState title="Belum ada pemenang." />
        ) : (
          <ul className="divide-y divide-brand-purple/10" aria-label="Riwayat pemenang">
            {state.history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold">{h.name}{h.prize && <span className="font-bold text-brand-purple"> · {h.prize}</span>}</p>
                  <p className="muted text-xs">{fmt(h.created_at)} · {h.whatsapp} · dari {h.entries} peserta · oleh {h.drawn_by}{h.round_start !== state.round ? ' · putaran lalu' : ''}</p>
                </div>
                {canManage && (
                  <button type="button" className="btn-ghost btn-sm" disabled={busy !== null} onClick={() => remove([h.id], `Hapus riwayat pemenang ${h.name}? Ia bisa ikut diundi lagi.`)}>
                    Hapus
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
