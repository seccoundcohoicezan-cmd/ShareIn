'use client'
import { useCallback, useEffect, useState } from 'react'
import { formatDate } from '@/lib/format'
import type { Program } from '@/lib/types'
import { PillLabel } from './ui'

type Code = { code: string; task: string; status: 'pending' | 'approved' | 'rejected'; reject_reason: string; created_at: string; won: boolean }

const BADGE = {
  pending: ['Menunggu verifikasi', 'bg-amber-100 text-amber-900'],
  approved: ['Masuk spin wheel', 'bg-green-100 text-green-900'],
  rejected: ['Ditolak', 'bg-red-100 text-red-900'],
} as const

export function MyCodes({ program }: { program: Program }) {
  const [wa, setWa] = useState('')
  const [codes, setCodes] = useState<Code[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    async (number: string) => {
      if (!number.trim()) return
      setBusy(true)
      setError('')
      try {
        const res = await fetch(`/api/programs/${program}/codes?wa=${encodeURIComponent(number.trim())}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setCodes(data.codes)
      } catch (e) {
        setError((e as Error).message || 'Kode belum termuat. Coba lagi.')
      } finally {
        setBusy(false)
      }
    },
    [program],
  )

  useEffect(() => {
    let saved = ''
    try {
      saved = JSON.parse(localStorage.getItem('sharein_identitas') || '{}').wa || ''
    } catch {}
    if (saved) {
      setWa(saved)
      load(saved)
    }
    const onNew = () => {
      try {
        const n = JSON.parse(localStorage.getItem('sharein_identitas') || '{}').wa
        if (n) {
          setWa(n)
          load(n)
        }
      } catch {}
    }
    window.addEventListener('sharein:kode-baru', onNew)
    return () => window.removeEventListener('sharein:kode-baru', onNew)
  }, [load])

  return (
    <section className="panel-solid" aria-labelledby="kode-saya">
      <PillLabel id="kode-saya">Kode saya</PillLabel>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          load(wa)
        }}
      >
        <label htmlFor="cek-wa" className="sr-only">Nomor WhatsApp untuk cek kode</label>
        <input id="cek-wa" className="field" inputMode="tel" placeholder="Nomor WhatsApp" value={wa} onChange={(e) => setWa(e.target.value)} />
        <button className="btn-primary shrink-0" disabled={busy}>{busy ? 'Memuat…' : 'Cek'}</button>
      </form>
      {error && <p role="alert" className="mt-2 text-sm font-bold text-bad">{error}</p>}
      {codes && codes.length === 0 && <p className="muted mt-3 text-sm">Belum ada kode untuk nomor ini. Kumpulkan tugas pertamamu.</p>}
      {codes && codes.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Daftar kode">
          {codes.map((c) => (
            <li key={c.code} className="flex flex-wrap items-center gap-2 rounded-field bg-brand-lavender/70 p-3">
              <span className="font-mono font-extrabold tracking-wider">{c.code}</span>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${c.won ? 'bg-brand-orange text-white' : BADGE[c.status][1]}`}>
                {c.won ? 'Menang!' : BADGE[c.status][0]}
              </span>
              <span className="muted w-full text-xs">{c.task} · {formatDate(c.created_at)}{c.status === 'rejected' && c.reject_reason ? ` · Alasan: ${c.reject_reason}` : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
