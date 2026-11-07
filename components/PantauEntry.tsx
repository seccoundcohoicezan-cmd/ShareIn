'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useMe } from './useMe'

export function PantauEntry() {
  const me = useMe()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    if (me) router.replace(`/pantau/${me.token}`)
  }, [me, router])
  return (
    <form
      className="panel-solid space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        const fromLink = code.match(/pantau\/([A-Za-z0-9-]+)/)?.[1] ?? code
        const t = fromLink.toUpperCase().replace(/[^A-Z0-9]/g, '')
        if (t.length !== 12) return setError('Kode pantau 12 karakter, contoh ABCD-EFGH-JKLM. Bisa juga tempel link lengkapnya.')
        router.push(`/pantau/${t}`)
      }}
    >
      <label htmlFor="kode-pantau" className="label">Kode atau link pantau</label>
      <input id="kode-pantau" className="field font-mono uppercase tracking-widest" autoCapitalize="characters" autoComplete="off" placeholder="ABCD-EFGH-JKLM" value={code} onChange={(e) => setCode(e.target.value)} />
      {error && <p role="alert" className="text-sm font-bold text-bad">{error}</p>}
      <button className="btn-primary w-full" disabled={me === undefined}>Pantau</button>
      <p className="muted text-xs">Belum punya? Kode dibuat otomatis saat kamu menyetor konten Golden Ticket atau mengumpulkan tugas. Lupa kodenya? Hubungi admin Sharein dengan nomor WhatsApp yang kamu daftarkan.</p>
    </form>
  )
}
