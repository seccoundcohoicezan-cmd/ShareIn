'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatDateTime, formatNumber } from '@/lib/format'
import type { PublicSubmission } from '@/lib/service'
import { EmptyState, PlatformTag, StatusBadge } from './ui'

export function RiwayatClient() {
  const [name, setName] = useState('')
  const [items, setItems] = useState<PublicSubmission[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load(n: string) {
    if (n.trim().length < 2) {
      setError('Isi nama minimal 2 huruf, sama seperti saat menyetor.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const res = await fetch(`/api/submissions/mine?name=${encodeURIComponent(n.trim())}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setItems(data.items)
      localStorage.setItem('sharein_name', n.trim())
    } catch (e) {
      setError((e as Error).message || 'Riwayat belum termuat. Coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const fromUrl = new URLSearchParams(location.search).get('nama')
    const n = fromUrl || localStorage.getItem('sharein_name') || ''
    if (n) {
      setName(n)
      load(n)
    }
  }, [])

  return (
    <div className="space-y-5">
      <form
        className="panel-solid"
        onSubmit={(e) => {
          e.preventDefault()
          load(name)
        }}
      >
        <label htmlFor="cari-nama" className="label">Nama penyetor</label>
        <div className="flex gap-2">
          <input id="cari-nama" className="field" value={name} maxLength={60} autoComplete="name" onChange={(e) => setName(e.target.value)} placeholder="Nama saat menyetor" />
          <button className="btn-primary shrink-0" disabled={loading}>{loading ? 'Memuat…' : 'Lihat'}</button>
        </div>
        {error && <p role="alert" className="mt-2 text-sm font-bold text-bad">{error}</p>}
      </form>

      {loading && !items && (
        <div className="space-y-3" aria-hidden="true">
          {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-panel bg-white/60" />)}
        </div>
      )}

      {items && items.length === 0 && (
        <EmptyState title="Belum ada setoran atas nama ini.">
          <Link href="/setor" className="font-bold text-brand-purple underline underline-offset-4">Setor konten pertamamu.</Link>
        </EmptyState>
      )}

      {items && items.length > 0 && (
        <ul className="space-y-3" aria-label="Daftar setoran">
          {items.map((s) => (
            <li key={s.id} className="panel-solid !p-4">
              <div className="flex flex-wrap items-center gap-2">
                <PlatformTag platform={s.platform} />
                <StatusBadge status={s.status} />
                <span className="muted ml-auto text-xs">{formatDateTime(s.created_at)}</span>
              </div>
              <p className="mt-2 text-sm tabular-nums">
                <b>{formatNumber(s.likes)}</b> like · <b>{formatNumber(s.comments)}</b> komentar · <span className="muted">periode {s.period_id}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 text-sm font-bold">
                <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-brand-purple underline underline-offset-4">Konten asal</a>
                <a href={s.sharein_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center text-brand-purple underline underline-offset-4">Link Sharein</a>
              </div>
              {s.status === 'rejected' && s.reject_reason && <p className="mt-1 rounded-field bg-red-50 px-3 py-2 text-sm text-bad">Alasan: {s.reject_reason}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
