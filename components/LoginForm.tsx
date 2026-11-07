'use client'
import { useState } from 'react'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <form
      className="mt-5 space-y-4"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setError('')
        try {
          const res = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email, password }),
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error)
          const next = new URLSearchParams(location.search).get('next')
          location.href = next && next.startsWith('/admin') && !next.startsWith('//') ? next : '/admin'
        } catch (err) {
          setError((err as Error).message || 'Gagal masuk. Coba lagi.')
          setBusy(false)
        }
      }}
    >
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" type="email" className="field" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label htmlFor="sandi" className="label">Sandi</label>
        <input id="sandi" type="password" className="field" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm font-bold text-bad">{error}</p>}
      <button className="btn-primary w-full" disabled={busy}>{busy ? 'Memeriksa…' : 'Masuk'}</button>
    </form>
  )
}
