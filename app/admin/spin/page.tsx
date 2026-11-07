import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { SpinWheel } from '@/components/SpinWheel'
import { AdminShell, requirePageSession } from '../shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Spin wheel' }

export default async function SpinPage() {
  const session = await requirePageSession()
  if (session.role !== 'owner') redirect('/admin')
  return (
    <AdminShell session={session}>
      <h1 className="mb-1 text-2xl font-extrabold">Spin wheel</h1>
      <p className="muted mb-4 text-sm">Pemenang dipilih acak di server dari kode yang sudah disetujui. Hasil tercatat di sheet draws dan tampil di halaman program.</p>
      <SpinWheel />
    </AdminShell>
  )
}
