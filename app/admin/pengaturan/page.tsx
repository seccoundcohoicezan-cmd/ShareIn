import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SettingsForm } from '@/components/SettingsForm'
import { getSettingsFresh } from '@/lib/repo/settings'
import { AdminShell, requirePageSession } from '../shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Pengaturan' }

export default async function PengaturanPage() {
  const session = await requirePageSession()
  if (session.role !== 'owner') redirect('/admin')
  const settings = await getSettingsFresh()
  return (
    <AdminShell session={session}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">Pengaturan</h1>
        <span className="flex gap-2">
          <Link href="/admin/akun" className="btn-ghost btn-sm">Daftar admin</Link>
          <Link href="/admin/api" className="btn-ghost btn-sm">Kunci API</Link>
        </span>
      </div>
      <p className="muted mb-4 text-sm">Disimpan ke sheet settings. Halaman publik ikut berubah paling lama 60 detik.</p>
      <SettingsForm initial={settings} />
    </AdminShell>
  )
}
