import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ApiKeysAdmin } from '@/components/ApiKeysAdmin'
import { AdminShell, requirePageSession } from '../shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'API' }

export default async function ApiPage() {
  const session = await requirePageSession()
  if (session.role !== 'owner') redirect('/admin')
  return (
    <AdminShell session={session}>
      <h1 className="mb-1 text-2xl font-extrabold">API Golden Ticket</h1>
      <p className="muted mb-4 text-sm">Untuk menarik data Golden Ticket ke sistem lain. Hanya baca, dan hanya bisa diakses dengan kunci API.</p>
      <ApiKeysAdmin />
    </AdminShell>
  )
}
