'use client'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import type { Progress } from '@/lib/progress'
import type { Program } from '@/lib/types'
import { Confetti, ProgressRing, SlotRow, WeekStrip } from './ProgressVisuals'
import { targetLeft } from './TargetBars'
import { Spinner } from './ui'

type State = { user: { name: string; whatsapp: string; token: string } | null; sso: boolean; progress: Progress | null }

const SSO_MESSAGES: Record<string, string> = {
  'belum-aktif': 'Login MyTopstar belum diaktifkan. Masuk dengan link pantau dulu.',
  dibatalkan: 'Login MyTopstar dibatalkan.',
  kedaluwarsa: 'Sesi login kedaluwarsa. Tekan Masuk dengan MyTopstar lagi.',
  'tanpa-hp': 'Akun MyTopstar-mu belum punya nomor HP. Lengkapi profil di MyTopstar, lalu masuk lagi.',
  gagal: 'Login MyTopstar gagal. Coba lagi sebentar lagi.',
}

const maskWa = (wa: string) => (wa.length > 7 ? `${wa.slice(0, 4)}••••${wa.slice(-3)}` : wa)

/** Who is signed in on this device, and their progress toward the program target. */
export function ProgressMe({ program, setorHref }: { program: Program; setorHref: string }) {
  const [s, setS] = useState<State | null>(null)
  const [ssoError, setSsoError] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState(false)
  const [loginError, setLoginError] = useState('')

  const load = useCallback(() => {
    return fetch(`/api/me?program=${program}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(setS)
      .catch(() => setS({ user: null, sso: false, progress: null }))
  }, [program])

  useEffect(() => {
    const code = new URLSearchParams(location.search).get('sso')
    if (code) setSsoError(SSO_MESSAGES[code] ?? SSO_MESSAGES.gagal)
    load()
  }, [load])

  async function login(e: React.FormEvent) {
    e.preventDefault()
    setLoginError('')
    setBusy(true)
    const res = await fetch('/api/me/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ link }) }).catch(() => null)
    const d = await res?.json().catch(() => ({}))
    if (!res?.ok) setLoginError(d?.error ?? 'Tidak terhubung ke server.')
    else await load()
    setBusy(false)
  }

  async function logout() {
    setBusy(true)
    await fetch('/api/me/logout', { method: 'POST' }).catch(() => null)
    setLink('')
    await load()
    setBusy(false)
  }

  if (!s) return <div className="h-40 animate-pulse rounded-field bg-white/70" aria-hidden="true" />
  const p = s.progress
  const draw = p?.mode === 'draw'

  return (
    <div className="space-y-3">
      {ssoError && <p role="alert" className="rounded-field bg-red-50 p-3 text-sm font-bold text-bad">{ssoError}</p>}
      {s.user && p ? (
        <div className={`relative overflow-hidden rounded-field p-4 transition-colors ${p.met ? 'bg-gradient-to-br from-green-50 to-emerald-100 text-green-950' : 'bg-white'}`}>
          {p.met && <Confetti />}
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-purple to-brand-orange text-lg font-extrabold text-white" aria-hidden="true">
              {s.user.name.trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-extrabold">Halo, {s.user.name}</p>
              <p className="text-xs opacity-70">
                {maskWa(s.user.whatsapp)} ·{' '}
                <button type="button" className="font-bold underline" onClick={logout} disabled={busy}>Bukan kamu? Keluar</button>
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <ProgressRing done={Math.min(p.tiktok, p.target.tiktok) + Math.min(p.reels, p.target.reels)} total={p.target.tiktok + p.target.reels} />
            <div className="w-full flex-1 space-y-3">
              <SlotRow kind="tiktok" label="TikTok" done={p.tiktok} pending={p.waiting.tiktok} of={p.target.tiktok} />
              <SlotRow kind="reels" label="Instagram Reels" done={p.reels} pending={p.waiting.reels} of={p.target.reels} />
            </div>
          </div>

          {!draw && p.week && (
            <div className="mt-4">
              <WeekStrip start={p.week.start} />
            </div>
          )}

          <p className="mt-3 text-sm font-bold">
            {p.met ? (draw ? 'Kamu sudah masuk undian spin wheel. Semoga beruntung!' : 'Target minggu ini tercapai. Mantap!') : targetLeft(p)}
          </p>
          {p.pending > 0 && <p className="text-xs opacity-70">{p.pending} link menunggu review admin{draw ? ', dihitung setelah disetujui' : ''}.</p>}
        </div>
      ) : (
        <div className="rounded-field bg-white p-4 text-sm">
          <div className="flex items-center gap-4">
            <div className="opacity-40">
              <ProgressRing done={0} total={1} size={84} caption="–" />
            </div>
            <div>
              <p className="font-extrabold">Belum masuk</p>
              <p className="muted">Masuk dulu supaya progresmu tampil di sini.</p>
            </div>
          </div>
          {program === 'duta' && s.sso && (
            <a href={`/auth/sso/login?next=${encodeURIComponent(setorHref)}`} className="btn-primary lift mt-4 w-full">Masuk dengan MyTopstar</a>
          )}
          <form onSubmit={login} className="mt-3">
            <label htmlFor={`masuk-${program}`} className="label">Sudah pernah kirim? Tempel link atau kode pantaumu</label>
            <div className="flex gap-2">
              <input id={`masuk-${program}`} className="field" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="ABCD-EFGH-JKLM" value={link} onChange={(e) => setLink(e.target.value)} />
              <button className="btn-primary shrink-0 gap-2" disabled={busy || !link.trim()}>{busy ? <><Spinner /> Masuk…</> : 'Masuk'}</button>
            </div>
            {loginError && <p role="alert" className="mt-1.5 text-sm font-bold text-bad">{loginError}</p>}
          </form>
          <p className="muted mt-3 text-xs">
            Belum pernah? <Link href={setorHref} className="font-bold text-brand-purple underline">Kirim link pertamamu</Link>, akunmu dibuat otomatis dari nomor WhatsApp.
          </p>
        </div>
      )}
    </div>
  )
}
