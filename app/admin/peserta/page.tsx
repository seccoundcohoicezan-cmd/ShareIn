import type { Metadata } from 'next'
import { ParticipantsAdmin } from '@/components/ParticipantsAdmin'
import { AdminShell, requirePageSession } from '../shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Peserta' }

export default async function PesertaPage() {
  const session = await requirePageSession()
  return (
    <AdminShell session={session}>
      <h1 className="mb-1 text-2xl font-extrabold">Peserta</h1>
      <p className="muted mb-4 text-sm">1 nomor WhatsApp = 1 peserta = 1 link pantau unik. Kirim ulang link ke peserta yang lupa.</p>
      <ParticipantsAdmin />
    </AdminShell>
  )
}
