'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import type { AdminRole } from '@/lib/types'
import { Logo } from './Header'

export function AdminNav({ email, role }: { email: string; role: AdminRole }) {
  const path = usePathname()
  const router = useRouter()
  const links = [
    { href: '/admin', t: 'Dasbor' },
    { href: '/admin/setoran', t: 'Golden Ticket' },
    { href: '/admin/program/pelatihan', t: 'Pelatihan' },
    { href: '/admin/program/duta', t: 'Duta Teladan' },
    { href: '/admin/peserta', t: 'Peserta' },
    ...(role === 'owner' ? [{ href: '/admin/spin', t: 'Spin wheel' }, { href: '/admin/pengaturan', t: 'Pengaturan' }] : []),
    { href: '/admin/akun', t: 'Akun' },
  ]
  return (
    <header className="sticky top-0 z-20 border-b border-brand-purple/10 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/admin" aria-label="Dasbor admin"><Logo size={30} /></Link>
        <div className="flex items-center gap-2 text-xs">
          <span className="muted hidden sm:inline">{email} · {role === 'owner' ? 'Owner' : 'Reviewer'}</span>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={async () => {
              await fetch('/api/admin/logout', { method: 'POST' })
              router.replace('/admin/login')
              router.refresh()
            }}
          >
            Keluar
          </button>
        </div>
      </div>
      <nav aria-label="Menu admin" className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
        {links.map((l) => {
          const active = l.href === '/admin' ? path === '/admin' : path.startsWith(l.href)
          return (
            <Link key={l.href} href={l.href} aria-current={active ? 'page' : undefined} className={`inline-flex min-h-[40px] shrink-0 items-center whitespace-nowrap rounded-full px-4 text-sm font-bold ${active ? 'bg-brand-purple text-white' : 'text-brand-purple hover:bg-brand-lavender'}`}>
              {l.t}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
