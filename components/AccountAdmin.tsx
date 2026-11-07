'use client'
import { useCallback, useEffect, useState } from 'react'
import { toast, Toaster } from './Toast'

type AdminRow = { email: string; role: 'owner' | 'reviewer'; active: boolean }

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  return res.ok ? null : (data.error as string) ?? 'Gagal menyimpan.'
}

function ChangePassword() {
  const [f, setF] = useState({ current: '', next: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <form
      className="panel-solid space-y-3"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        const err = await send('/api/admin/account/password', 'POST', f)
        setBusy(false)
        setError(err ?? '')
        if (!err) {
          setF({ current: '', next: '', confirm: '' })
          toast('Sandi diganti')
        }
      }}
    >
      <h2 className="font-extrabold">Ganti sandi saya</h2>
      {(
        [
          ['current', 'Sandi saat ini', 'current-password'],
          ['next', 'Sandi baru (min. 10 karakter)', 'new-password'],
          ['confirm', 'Ulangi sandi baru', 'new-password'],
        ] as const
      ).map(([k, label, ac]) => (
        <div key={k}>
          <label htmlFor={`pw-${k}`} className="label">{label}</label>
          <input id={`pw-${k}`} type="password" className="field" autoComplete={ac} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        </div>
      ))}
      {error && <p role="alert" className="text-sm font-bold text-bad">{error}</p>}
      <button className="btn-primary" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan sandi baru'}</button>
    </form>
  )
}

function Admins({ me }: { me: string }) {
  const [admins, setAdmins] = useState<AdminRow[] | null>(null)
  const [f, setF] = useState({ email: '', role: 'reviewer' as AdminRow['role'], password: '' })
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/admins')
    const data = await res.json()
    setAdmins(data.admins ?? [])
  }, [])
  useEffect(() => {
    load()
  }, [load])

  async function patch(email: string, body: Partial<AdminRow> & { password?: string }) {
    const err = await send(`/api/admin/admins/${encodeURIComponent(email)}`, 'PATCH', body)
    if (err) return toast(err, 'bad')
    toast('Tersimpan')
    load()
  }

  return (
    <section className="panel-solid space-y-4">
      <h2 className="font-extrabold">Daftar admin</h2>
      <ul className="divide-y divide-brand-purple/10">
        {admins?.map((a) => (
          <li key={a.email} className={`flex flex-wrap items-center gap-2 py-3 ${a.active ? '' : 'opacity-60'}`}>
            <span className="w-full break-all font-bold sm:w-auto sm:flex-1">{a.email}{a.email === me && <span className="muted font-medium"> (saya)</span>}</span>
            <label className="sr-only" htmlFor={`role-${a.email}`}>Peran {a.email}</label>
            <select id={`role-${a.email}`} className="field !min-h-[40px] w-auto" value={a.role} onChange={(e) => patch(a.email, { role: e.target.value as AdminRow['role'] })}>
              <option value="owner">Owner</option>
              <option value="reviewer">Reviewer</option>
            </select>
            <button type="button" className="btn-ghost btn-sm" onClick={() => patch(a.email, { active: !a.active })}>{a.active ? 'Nonaktifkan' : 'Aktifkan'}</button>
            {a.email !== me && (
              <button
                type="button"
                className="btn-ghost btn-sm"
                onClick={() => {
                  const pw = prompt(`Sandi baru untuk ${a.email} (min. 10 karakter):`)
                  if (pw) patch(a.email, { password: pw })
                }}
              >
                Atur ulang sandi
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="grid gap-3 rounded-field bg-brand-lavender/70 p-4 sm:grid-cols-[1fr_auto]"
        onSubmit={async (e) => {
          e.preventDefault()
          const err = await send('/api/admin/admins', 'POST', f)
          setError(err ?? '')
          if (!err) {
            toast('Admin ditambahkan')
            setF({ email: '', role: 'reviewer', password: '' })
            load()
          }
        }}
      >
        <p className="font-bold sm:col-span-2">Tambah admin</p>
        <div>
          <label htmlFor="new-email" className="label">Email</label>
          <input id="new-email" type="email" className="field" autoComplete="off" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        </div>
        <div>
          <label htmlFor="new-role" className="label">Peran</label>
          <select id="new-role" className="field" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as AdminRow['role'] })}>
            <option value="reviewer">Reviewer</option>
            <option value="owner">Owner</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="new-password" className="label">Sandi awal (min. 10 karakter)</label>
          <input id="new-password" type="password" className="field" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        </div>
        {error && <p role="alert" className="text-sm font-bold text-bad sm:col-span-2">{error}</p>}
        <button className="btn-primary sm:col-span-2 sm:w-fit">Tambah admin</button>
      </form>
    </section>
  )
}

export function AccountAdmin({ email, isOwner }: { email: string; isOwner: boolean }) {
  return (
    <div className="space-y-4">
      <p className="muted text-sm">Masuk sebagai <b>{email}</b>.</p>
      <ChangePassword />
      {isOwner && <Admins me={email} />}
      <Toaster />
    </div>
  )
}
