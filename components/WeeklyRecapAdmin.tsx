'use client'
import { useCallback, useEffect, useState } from 'react'
import { CHANNEL_INFO, type Program } from '@/lib/types'
import type { RecapRow } from '@/lib/weekly'
import { EmptyState } from './ui'

type Recap = { min: number; week: { start: string; end: string }; rows: RecapRow[] }

const fmt = (iso: string) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })

function reminder(program: Program, r: RecapRow, min: number, origin: string) {
  const left = Math.max(0, min - r.sent)
  return `Halo ${r.name}, pengingat kewajiban ${CHANNEL_INFO[program].label} minggu ini: kamu baru mengirim ${r.sent} dari ${min} link, kurang ${left} lagi. Kirim lewat ${origin}${CHANNEL_INFO[program].path}/setor. Pantau statusmu: ${origin}/pantau/${r.token}`
}

/** Who has (not yet) met this week's minimum, with a one-tap WhatsApp reminder. */
export function WeeklyRecapAdmin({ program }: { program: Program }) {
  const [data, setData] = useState<Recap | null>(null)
  const [everyone, setEveryone] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const res = await fetch(`/api/admin/weekly?program=${program}${everyone ? '&semua=1' : ''}`, { cache: 'no-store' })
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
  return (
    <div className="space-y-3">
      <div className="panel-solid !p-4">
        <p className="font-extrabold">
          Minggu {fmt(data.week.start)} – {fmt(new Date(Date.parse(data.week.end) - 1).toISOString())} · target {data.min} link per orang
        </p>
        <p className="muted mt-1 text-sm">
          {data.rows.length - unmet} dari {data.rows.length} orang sudah capai target · {unmet} belum. Dihitung dari link menunggu + disetujui. Ubah target di Pengaturan.
        </p>
        <label className="mt-2 flex min-h-[44px] items-center gap-2 text-sm font-bold">
          <input type="checkbox" className="h-5 w-5 accent-[#6C2BD9]" checked={everyone} onChange={(e) => setEveryone(e.target.checked)} />
          Tampilkan semua peserta terdaftar (termasuk yang belum pernah kirim di program ini)
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
                <p className="muted text-xs">{r.whatsapp} · {r.approved} disetujui · {r.pending} menunggu</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-sm font-extrabold tabular-nums ${r.met ? 'bg-green-100 text-green-900' : 'bg-amber-100 text-amber-900'}`}>
                {r.sent}/{data.min}
              </span>
              {!r.met && (
                <a className="btn-ghost btn-sm" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${r.whatsapp}?text=${encodeURIComponent(reminder(program, r, data.min, location.origin))}`}>
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
