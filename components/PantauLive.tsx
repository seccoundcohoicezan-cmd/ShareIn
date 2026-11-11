'use client'
import { useCallback, useEffect, useState } from 'react'
import { formatDateTime, metricsText } from '@/lib/format'
import { CheckIcon, CrossIcon, ExternalIcon } from './icons'
import { PantauCard } from './PantauCard'
import { Toaster } from './Toast'
import { CHANNEL_INFO, type Channel } from '@/lib/types'
import type { Progress } from '@/lib/progress'
import { TargetBars, targetLeft } from './TargetBars'

type Item = {
  id: string
  program: Channel
  programLabel: string
  title: string
  link: string
  sharein?: string
  likes?: number
  comments?: number
  status: 'pending' | 'approved' | 'rejected'
  reason: string
  created_at: string
  reviewed_at: string
  auto: boolean
}
type Data = {
  name: string
  whatsapp: string
  token: string
  items: Item[]
  progress: Pick<Progress, 'program' | 'mode' | 'tiktok' | 'reels' | 'target' | 'met'>[]
  counts: { total: number; pending: number; approved: number; rejected: number }
  checkedAt: string
}

const POLL_MS = 15_000
const LABEL = { pending: 'Menunggu', approved: 'Disetujui', rejected: 'Ditolak' } as const
const BADGE = {
  pending: 'bg-amber-100 text-amber-900 border-amber-300',
  approved: 'bg-green-100 text-green-900 border-green-300',
  rejected: 'bg-red-100 text-red-900 border-red-300',
} as const
const PROGRAM_TAG = { golden: 'bg-gradient-to-r from-brand-amber to-brand-orange text-ink', pelatihan: 'bg-brand-purple text-white', duta: 'bg-ink text-white' } as const
const clock = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' })

function Timeline({ it }: { it: Item }) {
  const done = it.status !== 'pending'
  const steps = [
    { t: 'Diterima sistem', at: it.created_at, state: 'done' as const },
    { t: it.auto ? 'Diperiksa sistem' : 'Diperiksa admin', at: done ? it.reviewed_at : '', state: done ? ('done' as const) : ('now' as const) },
    {
      t: it.status === 'rejected' ? 'Ditolak' : it.status === 'approved' ? (it.auto ? 'Disetujui otomatis' : 'Disetujui') : 'Keputusan',
      at: done ? it.reviewed_at : '',
      state: it.status === 'approved' ? ('ok' as const) : it.status === 'rejected' ? ('bad' as const) : ('todo' as const),
    },
  ]
  return (
    <ol className="mt-3 space-y-0">
      {steps.map((s, i) => (
        <li key={s.t} className="relative flex gap-3 pb-3 last:pb-0">
          {i < steps.length - 1 && <span className={`absolute left-[11px] top-6 h-[calc(100%-18px)] w-0.5 ${s.state === 'done' ? 'bg-brand-purple' : 'bg-brand-purple/15'}`} aria-hidden="true" />}
          <span
            className={`relative z-[1] flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${
              s.state === 'ok' ? 'bg-ok' : s.state === 'bad' ? 'bg-bad' : s.state === 'done' ? 'bg-brand-purple' : s.state === 'now' ? 'pantau-now bg-warn' : 'bg-brand-purple/20'
            }`}
          >
            {s.state === 'bad' ? <CrossIcon className="h-3 w-3" /> : s.state === 'todo' ? null : s.state === 'now' ? <span className="h-2 w-2 rounded-full bg-white" /> : <CheckIcon className="h-3 w-3" />}
          </span>
          <span className="text-sm">
            <b className={s.state === 'todo' ? 'muted' : ''}>{s.t}</b>
            {s.at && <span className="muted block text-xs">{formatDateTime(s.at)}</span>}
            {s.state === 'now' && <span className="block text-xs font-bold text-amber-800">Sedang menunggu pemeriksaan</span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function PantauLive({ token }: { token: string }) {
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [loading, setLoading] = useState(false)
  const [changed, setChanged] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/pantau/${encodeURIComponent(token)}`, { cache: 'no-store' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setData((prev) => {
        if (prev) {
          const before = new Map(prev.items.map((i) => [i.id, i.status]))
          const diff = new Set(d.items.filter((i: Item) => before.has(i.id) && before.get(i.id) !== i.status).map((i: Item) => i.id) as string[])
          if (diff.size) setChanged(diff)
        }
        return d
      })
      setError('')
    } catch (e) {
      setError((e as Error).message || 'Data belum termuat.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    load()
    const id = setInterval(() => {
      if (!document.hidden) load()
    }, POLL_MS)
    const onVis = () => !document.hidden && load()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [load])

  if (error && !data) {
    return (
      <div className="panel-solid" role="alert">
        <p className="font-bold">{error}</p>
        <a href="/pantau" className="btn-primary mt-4">Masukkan kode lagi</a>
      </div>
    )
  }
  if (!data) return <div className="space-y-3" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-panel bg-white/70" />)}</div>

  const items = data.items.filter((i) => filter === 'all' || i.status === filter)
  const tabs = [
    ['all', 'Semua', data.counts.total],
    ['pending', 'Menunggu', data.counts.pending],
    ['approved', 'Disetujui', data.counts.approved],
    ['rejected', 'Ditolak', data.counts.rejected],
  ] as const

  return (
    <div className="space-y-4">
      <section className="rounded-panel bg-gradient-to-br from-brand-purple to-brand-violet p-5 text-white">
        <p className="text-xs font-bold uppercase tracking-[0.2em] opacity-80">Pantau setoran</p>
        <h1 className="mt-1 text-2xl font-extrabold">{data.name}</h1>
        <p className="text-sm opacity-90">WhatsApp {data.whatsapp} · kode {data.token.replace(/(.{4})(?=.)/g, '$1-')}</p>
        <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold" aria-live="polite">
          <span className={`h-2 w-2 rounded-full ${error ? 'bg-red-300' : 'pantau-live bg-green-300'}`} />
          {error ? 'Koneksi terputus, mencoba lagi…' : `Langsung dari spreadsheet · diperbarui ${clock.format(new Date(data.checkedAt))}`}
        </p>
      </section>

      {(data.progress ?? []).map((w) => (
        <section key={w.program} className={`rounded-panel p-4 ${w.met ? 'bg-green-50 text-green-900' : 'bg-white'}`} aria-label={`Target ${CHANNEL_INFO[w.program].label}`}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-extrabold uppercase tracking-[0.15em]">{CHANNEL_INFO[w.program].label} · {w.mode === 'draw' ? 'undian' : 'minggu ini'}</p>
            <a href={`${CHANNEL_INFO[w.program].path}/setor`} className="btn-primary btn-sm shrink-0">Kirim link</a>
          </div>
          <TargetBars tiktok={w.tiktok} reels={w.reels} target={w.target} />
          <p className="mt-2 text-sm font-bold">{w.met ? (w.mode === 'draw' ? 'Sudah masuk undian spin wheel.' : 'Target minggu ini tercapai.') : targetLeft(w)}</p>
        </section>
      ))}

      <a href={`${CHANNEL_INFO[data.items[0]?.program ?? 'golden'].path}/setor`} className="btn-secondary w-full text-lg">+ Setor konten lagi</a>
      <p className="muted -mt-2 text-center text-xs">Kamu sudah masuk lewat link ini, jadi tidak perlu isi nama dan WhatsApp lagi.</p>

      <div role="tablist" aria-label="Saring status" className="grid grid-cols-4 gap-1 rounded-field bg-white p-1">
        {tabs.map(([k, label, n]) => (
          <button key={k} role="tab" type="button" aria-selected={filter === k} onClick={() => setFilter(k)} className={`min-h-[48px] rounded-[12px] text-xs font-bold leading-tight ${filter === k ? 'bg-brand-purple text-white' : 'text-brand-purple'}`}>
            {label}
            <span className="block text-base">{n}</span>
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="panel-solid text-center">
          <p className="font-bold">{data.counts.total === 0 ? 'Belum ada setoran.' : 'Tidak ada setoran dengan status ini.'}</p>
          {data.counts.total === 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-2 text-sm">
              <a href="/goldenticket/setor" className="btn-primary btn-sm">Setor Golden Ticket</a>
              <a href="/pelatihancontent/setor" className="btn-ghost btn-sm">Kirim Pelatihan</a>
              <a href="/dutateladan/setor" className="btn-ghost btn-sm">Kirim Duta Teladan</a>
            </div>
          )}
        </div>
      ) : (
        <ul className="space-y-3" aria-label="Daftar setoran">
          {items.map((it) => (
            <li key={it.id} className={`panel-solid !p-4 ${changed.has(it.id) ? 'pantau-flash' : ''}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${PROGRAM_TAG[it.program]}`}>{it.programLabel}</span>
                <span className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${BADGE[it.status]}`}>{LABEL[it.status]}</span>
                {changed.has(it.id) && <span className="text-xs font-bold text-brand-purple">Baru diperbarui</span>}
              </div>
              <p className="mt-2 font-extrabold">{it.title}</p>
              {(it.likes ?? 0) + (it.comments ?? 0) > 0 && <p className="text-sm tabular-nums">{metricsText(it.likes ?? 0, it.comments ?? 0)}</p>}
              <div className="mt-1 flex flex-wrap gap-x-4 text-sm font-bold">
                <a href={it.link} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1 text-brand-purple underline underline-offset-4">Konten asal <ExternalIcon /></a>
                {it.sharein && <a href={it.sharein} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1 text-brand-purple underline underline-offset-4">Link Sharein <ExternalIcon /></a>}
              </div>
              {it.status === 'rejected' && it.reason && <p className="mt-1 rounded-field bg-red-50 px-3 py-2 text-sm text-bad">Alasan ditolak: {it.reason}</p>}
              <Timeline it={it} />
            </li>
          ))}
        </ul>
      )}

      <PantauCard token={data.token} compact />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" className="btn-ghost btn-sm" onClick={load} disabled={loading}>{loading ? 'Memuat…' : 'Perbarui sekarang'}</button>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={async () => {
            await fetch('/api/me/logout', { method: 'POST' })
            location.href = '/'
          }}
        >
          Keluar dari perangkat ini
        </button>
      </div>
      <Toaster />
    </div>
  )
}
