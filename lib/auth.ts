import 'server-only'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { addAdmin, listAdmins } from './repo/admins'
import { invalidate } from './cache'
import { SESSION_COOKIE, verifySession, type Session } from './session'
import type { Admin, AdminRole } from './types'

// Cost 10: bcryptjs is pure JS, and cost 12 took ~1 s per hash/login on the server. Older cost-12
// hashes keep working (the cost is stored in the hash).
export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10)
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
  const check = async (list: Admin[]) => {
    const admin = list.find((a) => a.email === e && a.active)
    // Compare against a dummy hash too, so unknown emails take the same time.
    const hash = admin?.password_hash || '$2a$12$C6UzMDM.H6dfI/f/IKcEeO5F3z1W0q5lF4QX1Q2Yp3bq7xwGkqv5e'
    // Passwords pasted from WhatsApp often carry a trailing space or newline.
    const tries = password.trim() !== password ? [password, password.trim()] : [password]
    for (const p of tries) if (await bcrypt.compare(p, hash).catch(() => false)) return admin ? { email: admin.email, role: admin.role } : null
    return null
  }
  const ok = await check(admins)
  if (ok) return ok
  // The admin list is cached per server instance for 5 min; on Vercel another instance may have added
  // the admin or reset the password moments ago. Re-read the sheet once before saying "wrong password".
  invalidate('admins')
  return check(await listAdmins())
}

export async function currentSession(): Promise<Session | null> {
  return verifySession(cookies().get(SESSION_COOKIE)?.value)
}
