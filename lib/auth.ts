import 'server-only'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { addAdmin, listAdmins } from './repo/admins'
import { SESSION_COOKIE, verifySession, type Session } from './session'
import type { AdminRole } from './types'

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12)
}

/** Verifies credentials; bootstraps the first owner from ADMIN_EMAIL/ADMIN_PASSWORD when the sheet is empty. */
export async function authenticate(email: string, password: string): Promise<{ email: string; role: AdminRole } | null> {
  const e = email.trim().toLowerCase()
  let admins = await listAdmins()
  if (admins.length === 0 && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
    const bootEmail = process.env.ADMIN_EMAIL.trim().toLowerCase()
    if (e === bootEmail && password === process.env.ADMIN_PASSWORD) {
      await addAdmin({ email: bootEmail, password_hash: await hashPassword(password), role: 'owner', active: true })
      admins = await listAdmins()
    }
  }
  const admin = admins.find((a) => a.email === e && a.active)
  // Compare against a dummy hash too, so unknown emails take the same time.
  const hash = admin?.password_hash || '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5F3z1W0q5lF4QX1Q2Yp3bq7xwGkqv5e'
  const ok = await bcrypt.compare(password, hash).catch(() => false)
  return ok && admin ? { email: admin.email, role: admin.role } : null
}

export async function currentSession(): Promise<Session | null> {
  return verifySession(cookies().get(SESSION_COOKIE)?.value)
}
