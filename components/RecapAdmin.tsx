'use client'
import { useCallback, useEffect, useState } from 'react'
import type { RecapRow, Target } from '@/lib/progress'
import { CHANNEL_INFO, type Program } from '@/lib/types'
import { EmptyState } from './ui'

type Recap = { mode: 'draw' | 'weekly'; target: Target; week: { start: string; end: string } | null; since: string; rows: RecapRow[] }

const fmt = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })

function reminder(program: Program, r: RecapRow, d: Recap, origin: string) {
  const left = [d.target.tiktok - r.tiktok > 0 ? `${d.target.tiktok - r.tiktok} TikTok` : '', d.target.reels - r.reels > 0 ? `${d.target.reels - r.reels} Reels` : ''].filter(Boolean).join(' & ')
  const what = d.mode === 'draw' ? 'agar ikut undian berhadiah' : 'untuk kewajiban minggu ini'
  return `Halo ${r.name}, progres ${CHANNEL_INFO[program].label} kamu: TikTok ${r.tiktok}/${d.target.tiktok}, Reels ${r.reels}/${d.target.reels}. Kurang ${left} lagi ${what}. Kirim lewat ${origin}${CHANNEL_INFO[program].path}/setor. Pantau: ${origin}/pantau/${r.token}`
}

/** Who has (not yet) reached the target, with a one-tap WhatsApp reminder. */
export function RecapAdmin({ program }: { program: Program }) {
  const [data, setData] = useState<Recap | null>(null)
  const [everyone, setEveryone] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch(`/api/admin/recap?program=${program}${everyone ? '&semua=1' : ''}`, { cache: 'no-store' })
      if (res.status === 401) return location.assign('/admin/login')
      const d = await res.json()
      if (!res.ok) throw new Error(d.error)
      setData(d)
    } catch (e) {
      setError((e as Error).message || 'Rekap belum termuat.')
    }
  }, [program, everyone])

  useEffect(() => {
    load()
  }, [load])

  if (error) return <p role="alert" className="rounded-field bg-red-50 p-3 text-sm font-bold text-bad">{error}</p>
  if (!data) return <div className="h-40 animate-pulse rounded-panel bg-white" />

  const unmet = data.rows.filter((r) => !r.met).length
  const t = data.target
  return (
    <div className="space-y-3">
      <div className="panel-solid !p-4">
        <p className="font-extrabold">
          {data.mode === 'weekly' && data.week
            ? `Minggu ${fmt(data.week.start)} – ${fmt(new Date(Date.parse(data.week.end) - 1).toISOString())} · target ${t.tiktok} TikTok + ${t.reels} Reels`
            : `Syarat undian: ${t.tiktok} TikTok + ${t.reels} Reels disetujui${data.since ? ` sejak ${fmt(data.since)}` : ''}`}
        </p>
        <p className="muted mt-1 text-sm">
          {data.rows.length - unmet} dari {data.rows.length} orang {data.mode === 'draw' ? 'sudah masuk undian' : 'sudah capai target'} · {unmet} belum.{' '}
          {data.mode === 'draw' ? 'Dihitung dari link disetujui.' : 'Dihitung dari link menunggu + disetujui.'} Ubah target di Pengaturan.
        </p>
        <label className="mt-2 flex min-h-[44px] items-center gap-2 text-sm font-bold">
          <input type="checkbox" className="h-5 w-5 accent-[#6C2BD9]" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} />
          Tampilkan semua peserta terdaftar
        </label>
      </div>
      {data.rows.length === 0 ? (
        <EmptyState title="Belum ada peserta di program ini." />
      ) : (
        <ul className="space-y-2">
          {data.rows.map((r) => (
            <li key={r.id} className="panel-solid flex flex-wrap items-center gap-3 !p-4">
              <div className="min-w-0 flex-1">
                <p className="font-extrabold">{r.name}</p>
                <p className="muted text-xs">{r.whatsapp}{r.pending ? ` · ${r.pending} menunggu review` : ''}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-extrabold tabular-nums ${r.tiktok >= t.tiktok ? 'bg-green-100 text-green-900' : 'bg-amber-100 text-amber-900'}`}>TT {r.tiktok}/{t.tiktok}</span>
              <span className={`rounded-full px-3 py-1 text-sm font-extrabold tabular-nums ${r.reels >= t.reels ? 'bg-green-100 text-green-900' : 'bg-amber-100 text-amber-900'}`}>IG {r.reels}/{t.reels}</span>
              {!r.met && (
                <a className="btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${r.whatsapp}?text=${encodeURIComponent(reminder(program, r, data, location.origin))}`}>
                  Ingatkan via WA
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
