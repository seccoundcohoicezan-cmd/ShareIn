'use client'
import { useEffect, useState } from 'react'
import { toast } from './Toast'

function fmt(t: string) {
  return t.replace(/(.{4})(?=.)/g, '$1-')
}

/** The participant's unique link: monitoring page + login on any device. */
export function PantauCard({ token, compact = false }: { token: string; compact?: boolean }) {
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(location.origin), [])
  const url = `${origin}/pantau/${token}`
  const share = `Link pantau Sharein saya (jangan dibagikan): ${url}`
  return (
    <div className={`rounded-panel border-2 border-dashed border-brand-purple/40 bg-brand-lavender/80 p-4 text-left ${compact ? '' : 'mt-5'}`}>
      <p className="text-sm font-extrabold">Link pantau unikmu</p>
      <p className="muted mt-1 text-xs">Pakai link ini untuk memantau semua setoranmu (disetujui/ditolak) secara langsung dan untuk masuk lagi dari HP lain. Simpan, jangan dibagikan.</p>
      <p className="mt-3 rounded-field bg-white px-3 py-2 font-mono text-lg font-extrabold tracking-widest">{fmt(token)}</p>
      <p className="mt-1 break-all text-xs">{url}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <a href={`/pantau/${token}`} className="btn-primary btn-sm">Buka halaman pantau</a>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => navigator.clipboard?.writeText(url).then(() => toast('Link tersalin'), () => toast('Salin manual link-nya', 'bad'))}
        >
          Salin link
        </button>
        <a href={`https://wa.me/?text=${encodeURIComponent(share)}`} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">
          Simpan ke WhatsApp
        </a>
      </div>
    </div>
  )
}
