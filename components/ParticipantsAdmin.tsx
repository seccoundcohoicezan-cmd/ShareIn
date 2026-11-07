'use client'
import { useEffect, useState } from 'react'
import { formatDateTime } from '@/lib/format'
import { toast, Toaster } from './Toast'
import { EmptyState } from './ui'

type P = { id: string; token: string; name: string; whatsapp: string; created_at: string; total: number; pending: number; approved: number; rejected: number }

export function ParticipantsAdmin() {
  const [list, setList] = useState<P[] | null>(null)
  const [q, setQ] = useState('')
  const [origin, setOrigin] = useState('')
  useEffect(() => {
    setOrigin(location.origin)
    fetch('/api/admin/participants').then((r) => r.json()).then((d) => setList(d.participants ?? []))
  }, [])
  const key = q.trim().toLowerCase()
  const digits = key.replace(/\D/g, '')
  const rows = (list ?? []).filter((p) => !key || p.name.toLowerCase().includes(key) || (digits && p.whatsapp.includes(digits.replace(/^0/, ''))) || p.token.toLowerCase().includes(key.replace(/-/g, '')))
  return (
    <div className="space-y-3">
      <label htmlFor="cari-peserta" className="sr-only">Cari peserta</label>
      <input id="cari-peserta" className="field" placeholder="Cari nama, nomor WA, atau kode" value={q} onChange={(e) => setQ(e.target.value)} />
      {list === null && <div className="h-24 animate-pulse rounded-panel bg-white" />}
      {list?.length === 0 && <EmptyState title="Belum ada peserta." />}
      <ul className="space-y-2">
        {rows.map((p) => {
          const url = `${origin}/pantau/${p.token}`
          const msg = `Halo ${p.name}, ini link pantau Sharein kamu (jangan dibagikan): ${url}`
          return (
            <li key={p.id} className="panel-solid !p-4">
              <div className="flex flex-wrap items-center gap-2">
                <b>{p.name}</b>
                <span className="muted text-sm">{p.whatsapp}</span>
                <span className="ml-auto font-mono text-xs font-bold tracking-wider">{p.token.replace(/(.{4})(?=.)/g, '$1-')}</span>
              </div>
              <p className="muted mt-1 text-xs">
                {p.total} setoran · <span className="text-amber-800">{p.pending} menunggu</span> · <span className="text-green-800">{p.approved} disetujui</span> · <span className="text-red-800">{p.rejected} ditolak</span> · daftar {formatDateTime(p.created_at)}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <a href={`/pantau/${p.token}`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">Lihat seperti peserta</a>
                <button type="button" className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(url).then(() => toast('Link tersalin'))}>Salin link</button>
                <a href={`https://wa.me/${p.whatsapp}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className="btn-primary btn-sm">Kirim link via WhatsApp</a>
              </div>
            </li>
          )
        })}
      </ul>
      <Toaster />
    </div>
  )
}
