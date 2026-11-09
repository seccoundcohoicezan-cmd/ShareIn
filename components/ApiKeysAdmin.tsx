'use client'
import { useCallback, useEffect, useState } from 'react'
import { formatDateTime } from '@/lib/format'
import { toast, Toaster } from './Toast'

type Key = { id: string; name: string; prefix: string; active: boolean; created_at: string; created_by: string }

const ENDPOINTS = [
  ['GET', '/api/v1/goldenticket/summary', 'Hadiah berjalan saat ini, periode, link terkumpul, jumlah per status'],
  ['GET', '/api/v1/goldenticket/submissions', 'Daftar setoran. Filter: status, platform, period, updated_since, limit (maks 500), offset'],
  ['GET', '/api/v1/goldenticket/submissions/{id}', 'Satu setoran'],
]

export function ApiKeysAdmin() {
  const [keys, setKeys] = useState<Key[] | null>(null)
  const [name, setName] = useState('')
  const [fresh, setFresh] = useState('')
  const [error, setError] = useState('')
  const [origin, setOrigin] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/api-keys')
    const data = await res.json()
    setKeys(data.keys ?? [])
  }, [])
  useEffect(() => {
    setOrigin(location.origin)
    load()
  }, [load])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/admin/api-keys', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }) })
    const data = await res.json()
    if (!res.ok) return setError(data.error ?? 'Gagal membuat kunci.')
    setFresh(data.key)
    setName('')
    load()
  }

  async function revoke(k: Key) {
    if (!confirm(`Cabut kunci "${k.name}"? Sistem yang memakainya langsung tidak bisa mengakses.`)) return
    const res = await fetch(`/api/admin/api-keys/${k.id}`, { method: 'DELETE' })
    if (!res.ok) return toast('Gagal mencabut kunci.', 'bad')
    toast('Kunci dicabut')
    load()
  }

  return (
    <div className="space-y-4">
      <section className="panel-solid space-y-3">
        <h2 className="font-extrabold">Buat kunci API</h2>
        <form onSubmit={create} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="key-name" className="sr-only">Nama kunci</label>
          <input id="key-name" className="field" maxLength={60} placeholder="Nama sistem, mis. Dashboard Internal" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn-primary shrink-0">Buat kunci</button>
        </form>
        {error && <p role="alert" className="text-sm font-bold text-bad">{error}</p>}
        {fresh && (
          <div className="rounded-field border-2 border-dashed border-brand-orange bg-brand-amber/15 p-3" role="status">
            <p className="text-sm font-extrabold">Salin kunci ini sekarang. Kunci hanya ditampilkan sekali.</p>
            <p id="kunci-baru" className="mt-2 break-all rounded-field bg-white px-3 py-2 font-mono text-sm">{fresh}</p>
            <button type="button" className="btn-ghost btn-sm mt-2" onClick={() => navigator.clipboard?.writeText(fresh).then(() => toast('Kunci tersalin'), () => toast('Salin manual kuncinya', 'bad'))}>Salin kunci</button>
          </div>
        )}
      </section>

      <section className="panel-solid">
        <h2 className="mb-2 font-extrabold">Daftar kunci</h2>
        {keys?.length === 0 && <p className="muted text-sm">Belum ada kunci.</p>}
        <ul className="divide-y divide-brand-purple/10">
          {keys?.map((k) => (
            <li key={k.id} className={`flex flex-wrap items-center gap-2 py-3 text-sm ${k.active ? '' : 'opacity-50'}`}>
              <b>{k.name}</b>
              <span className="font-mono text-xs">{k.prefix}…</span>
              <span className="muted text-xs">{formatDateTime(k.created_at)}</span>
              {k.active ? <button type="button" className="btn-ghost btn-sm ml-auto" onClick={() => revoke(k)}>Cabut</button> : <span className="ml-auto text-xs font-bold">Dicabut</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="panel-solid space-y-3 text-sm">
        <h2 className="font-extrabold">Cara pakai</h2>
        <ul className="space-y-2">
          {ENDPOINTS.map(([m, path, d]) => (
            <li key={path}>
              <code className="break-all font-mono text-xs font-bold text-brand-purple">{m} {origin}{path}</code>
              <span className="muted block">{d}</span>
            </li>
          ))}
        </ul>
        <p className="font-bold">Contoh</p>
        <pre className="overflow-x-auto rounded-field bg-ink p-3 text-xs text-white">{`curl -H "Authorization: Bearer KUNCI_ANDA" \\
  "${origin}/api/v1/goldenticket/submissions?status=approved&limit=100"`}</pre>
        <p className="muted">Data berisi nama dan nomor WhatsApp peserta, jadi panggil API ini dari server sistem Anda, jangan dari kode yang berjalan di browser. Batas 120 permintaan per menit per kunci.</p>
      </section>
      <Toaster />
    </div>
  )
}
