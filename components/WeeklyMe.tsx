'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { Program } from '@/lib/types'

type State = {
  user: { name: string; token: string } | null
  sso: boolean
  weekly: { sent: number; approved: number; min: number; met: boolean } | null
}

const SSO_MESSAGES: Record<string, string> = {
  'belum-aktif': 'Login MyTopstar belum diaktifkan. Masuk dengan link pantau dulu.',
  dibatalkan: 'Login MyTopstar dibatalkan.',
  kedaluwarsa: 'Sesi login kedaluwarsa. Tekan Masuk dengan MyTopstar lagi.',
  'tanpa-hp': 'Akun MyTopstar-mu belum punya nomor HP. Lengkapi profil di MyTopstar, lalu masuk lagi.',
  gagal: 'Login MyTopstar gagal. Coba lagi sebentar lagi.',
}

/** Personal progress toward this week's minimum, for the signed-in participant. */
export function WeeklyMe({ program, setorHref }: { program: Program; setorHref: string }) {
  const [s, setS] = useState<State | null>(null)
  const [ssoError, setSsoError] = useState('')

  useEffect(() => {
    const code = new URLSearchParams(location.search).get('sso')
    if (code) setSsoError(SSO_MESSAGES[code] ?? SSO_MESSAGES.gagal)
    fetch(`/api/me?program=${program}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(setS)
      .catch(() => setS({ user: null, sso: false, weekly: null }))
  }, [program])

  if (!s) return <div className="h-20 animate-pulse rounded-field bg-white/70" aria-hidden="true" />

  return (
    <div className="space-y-3">
      {ssoError && <p role="alert" className="rounded-field bg-red-50 p-3 text-sm font-bold text-bad">{ssoError}</p>}
      {s.user && s.weekly ? (
        <div className={`rounded-field p-4 ${s.weekly.met ? 'bg-green-50 text-green-900' : 'bg-white'}`}>
          <p className="text-sm font-bold">Halo, {s.user.name}</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">
            {s.weekly.sent}
            <span className="text-lg">/{s.weekly.min} link</span>
          </p>
          {s.weekly.min > 0 && (
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-brand-purple/10" role="progressbar" aria-label="Progres minggu ini" aria-valuemin={0} aria-valuemax={s.weekly.min} aria-valuenow={Math.min(s.weekly.sent, s.weekly.min)}>
              <div className={`h-full rounded-full ${s.weekly.met ? 'bg-ok' : 'bg-brand-purple'}`} style={{ width: `${Math.min(100, (s.weekly.sent / s.weekly.min) * 100)}%` }} />
            </div>
          )}
          <p className="mt-2 text-sm">
            {s.weekly.met ? 'Target minggu ini tercapai. Tetap boleh kirim lebih.' : `Kurang ${s.weekly.min - s.weekly.sent} link lagi minggu ini.`}{' '}
            <span className="muted">{s.weekly.approved} sudah disetujui.</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 text-sm font-bold">
            <Link href={setorHref} className="inline-flex min-h-[44px] items-center text-brand-purple underline underline-offset-4">Kirim link</Link>
            <Link href={`/pantau/${s.user.token}`} className="inline-flex min-h-[44px] items-center text-brand-purple underline underline-offset-4">Lihat halaman pantau</Link>
          </div>
        </div>
      ) : (
        <div className="rounded-field bg-white p-4 text-sm">
          <p className="font-bold">Masuk untuk melihat progres mingguanmu.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            {program === 'duta' && s.sso && (
              <a href={`/auth/sso/login?next=${encodeURIComponent(setorHref)}`} className="btn-primary w-full sm:w-auto">Masuk dengan MyTopstar</a>
            )}
            <Link href="/pantau" className="btn-ghost w-full sm:w-auto">Pakai link pantau</Link>
          </div>
        </div>
      )}
    </div>
  )
}
