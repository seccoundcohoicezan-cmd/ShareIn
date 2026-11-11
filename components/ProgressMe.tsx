'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { Progress } from '@/lib/progress'
import type { Program } from '@/lib/types'
import { TargetBars, targetLeft } from './TargetBars'

type State = { user: { name: string; token: string } | null; sso: boolean; progress: Progress | null }

const SSO_MESSAGES: Record<string, string> = {
  'belum-aktif': 'Login MyTopstar belum diaktifkan. Masuk dengan link pantau dulu.',
  dibatalkan: 'Login MyTopstar dibatalkan.',
  kedaluwarsa: 'Sesi login kedaluwarsa. Tekan Masuk dengan MyTopstar lagi.',
  'tanpa-hp': 'Akun MyTopstar-mu belum punya nomor HP. Lengkapi profil di MyTopstar, lalu masuk lagi.',
  gagal: 'Login MyTopstar gagal. Coba lagi sebentar lagi.',
}

/** The signed-in participant's progress toward the program target. */
export function ProgressMe({ program, setorHref }: { program: Program; setorHref: string }) {
  const [s, setS] = useState<State | null>(null)
  const [ssoError, setSsoError] = useState('')

  useEffect(() => {
    const code = new URLSearchParams(location.search).get('sso')
    if (code) setSsoError(SSO_MESSAGES[code] ?? SSO_MESSAGES.gagal)
    fetch(`/api/me?program=${program}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(setS)
      .catch(() => setS({ user: null, sso: false, progress: null }))
  }, [program])

  if (!s) return <div className="h-24 animate-pulse rounded-field bg-white/70" aria-hidden="true" />
  const p = s.progress
  const draw = p?.mode === 'draw'

  return (
    <div className="space-y-3">
      {ssoError && <p role="alert" className="rounded-field bg-red-50 p-3 text-sm font-bold text-bad">{ssoError}</p>}
      {s.user && p ? (
        <div className={`rounded-field p-4 ${p.met ? 'bg-green-50 text-green-900' : 'bg-white'}`}>
          <p className="mb-2 text-sm font-bold">Halo, {s.user.name}</p>
          <TargetBars tiktok={p.tiktok} reels={p.reels} target={p.target} />
          <p className="mt-3 text-sm font-bold">
            {p.met ? (draw ? 'Kamu sudah masuk undian spin wheel. Semoga beruntung!' : 'Target minggu ini tercapai.') : targetLeft(p)}
          </p>
          {p.pending > 0 && <p className="muted text-xs">{p.pending} link menunggu review admin{draw ? ' (dihitung setelah disetujui)' : ''}.</p>}
          <div className="mt-1 flex flex-wrap gap-x-4 text-sm font-bold">
            <Link href={setorHref} className="inline-flex min-h-[44px] items-center text-brand-purple underline underline-offset-4">Kirim link</Link>
            <Link href={`/pantau/${s.user.token}`} className="inline-flex min-h-[44px] items-center text-brand-purple underline underline-offset-4">Lihat halaman pantau</Link>
          </div>
        </div>
      ) : (
        <div className="rounded-field bg-white p-4 text-sm">
          <p className="font-bold">Masuk untuk melihat progresmu.</p>
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
