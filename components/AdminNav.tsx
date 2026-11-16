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
    ...(role === 'owner' ? [{ href: '/admin/pengaturan', t: 'Pengaturan', also: ['/admin/api'] }] : []),
  ] as { href: string; t: string; also?: string[] }[]
  return (
    <header className="sticky top-0 z-20 border-b border-brand-purple/10 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/admin" aria-label="Dasbor admin"><Logo size={30} /></Link>
        <div className="flex items-center gap-2 text-xs">
          <Link
            href="/admin/akun"
            aria-current={path.startsWith('/admin/akun') ? 'page' : undefined}
            title="Akun & admin"
            className={`inline-flex min-h-[36px] items-center gap-1 rounded-full border px-3 font-bold ${path.startsWith('/admin/akun') ? 'border-brand-purple bg-brand-lavender text-brand-purple' : 'border-brand-purple/20 text-brand-purple hover:bg-brand-lavender'}`}
          >
            <span className="hidden max-w-[14rem] truncate sm:inline">{email}</span>
            <span className="sm:hidden">Akun</span>
            <span className="muted font-medium">· {role === 'owner' ? 'Owner' : 'Reviewer'}</span>
          </Link>
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
          const active = l.href === '/admin' ? path === '/admin' : [l.href, ...(l.also ?? [])].some((h) => path.startsWith(h))
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
