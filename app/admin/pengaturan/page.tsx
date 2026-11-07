import type { Metadata } from 'next'
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
      <h1 className="mb-1 text-2xl font-extrabold">Pengaturan</h1>
      <p className="muted mb-4 text-sm">Disimpan ke sheet settings. Halaman publik ikut berubah paling lama 60 detik.</p>
      <SettingsForm initial={settings} />
    </AdminShell>
  )
}
