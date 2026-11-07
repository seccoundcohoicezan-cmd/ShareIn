import type { Metadata } from 'next'
import { SubmissionsAdmin } from '@/components/SubmissionsAdmin'
import { AdminShell, requirePageSession } from '../shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Setoran' }

export default async function SetoranPage() {
  const session = await requirePageSession()
  return (
    <AdminShell session={session}>
      <h1 className="mb-4 text-2xl font-extrabold">Review setoran</h1>
      <SubmissionsAdmin />
    </AdminShell>
  )
}
