import type { Metadata } from 'next'
import { AccountAdmin } from '@/components/AccountAdmin'
import { AdminShell, requirePageSession } from '../shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Akun' }

export default async function AkunPage() {
  const session = await requirePageSession()
  return (
    <AdminShell session={session}>
      <h1 className="mb-4 text-2xl font-extrabold">Akun & admin</h1>
      <AccountAdmin email={session.email} isOwner={session.role === 'owner'} />
    </AdminShell>
  )
}
