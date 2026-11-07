import { redirect } from 'next/navigation'
import { AdminNav } from '@/components/AdminNav'
import { currentSession } from '@/lib/auth'
import type { Session } from '@/lib/session'

export async function requirePageSession(): Promise<Session> {
  const s = await currentSession()
  if (!s) redirect('/admin/login')
  return s
}

export function AdminShell({ session, children }: { session: Session; children: React.ReactNode }) {
  return (
    <>
      <AdminNav email={session.email} role={session.role} />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-5">{children}</main>
    </>
  )
}
