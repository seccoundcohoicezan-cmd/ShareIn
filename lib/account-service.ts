import 'server-only'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { hashPassword } from './auth'
import { withLock } from './lock'
import { addAdmin, listAdmins, listAdminsStored, updateAdmin } from './repo/admins'
import type { Admin } from './types'
import { auditOp } from './repo/store'

const password = z.string().min(10, 'Sandi minimal 10 karakter.').max(200)

export const changePasswordSchema = z
  .object({ current: z.string().min(1, 'Isi sandi saat ini.'), next: password, confirm: z.string() })
  .refine((v) => v.next === v.confirm, { message: 'Ulangi sandi baru dengan sama persis.', path: ['confirm'] })

export async function changePassword(email: string, current: string, next: string): Promise<string | null> {
  return withLock('admins', async () => {
    const me = (await listAdminsStored()).find((a) => a.email === email && a.active)
    if (!me) return 'Akun tidak ditemukan.'
    if (!(await bcrypt.compare(current, me.password_hash).catch(() => false))) return 'Sandi saat ini salah.'
    await updateAdmin({ ...me, password_hash: await hashPassword(next) }, auditOp(email, 'admin.password', email, '', ''))
    return null
  })
}

export const newAdminSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email tidak valid.').max(120),
  role: z.enum(['owner', 'reviewer']),
  password,
})

export const patchAdminSchema = z.object({
  role: z.enum(['owner', 'reviewer']).optional(),
  active: z.boolean().optional(),
  password: password.optional(),
})

export async function publicAdmins() {
  return (await listAdmins()).map(({ email, role, active }) => ({ email, role, active }))
}

type PublicAdmin = { email: string; role: Admin['role']; active: boolean }
const toPublic = ({ email, role, active }: Admin): PublicAdmin => ({ email, role, active })

/** Adds an admin in one spreadsheet request (row + audit) and returns the new list, so the page needs no reload. */
export async function createAdmin(input: z.infer<typeof newAdminSchema>, actor: string): Promise<{ error: string } | { admins: PublicAdmin[] }> {
  return withLock('admins', async () => {
    const all = await listAdmins()
    if (all.some((a) => a.email === input.email)) return { error: 'Email ini sudah terdaftar sebagai admin.' }
    const created: Admin = { email: input.email, role: input.role, active: true, password_hash: await hashPassword(input.password) }
    await addAdmin(created, auditOp(actor, 'admin.create', input.email, '', { role: input.role }))
    return { admins: [...all, created].map(toPublic) }
  })
}

export async function patchAdmin(email: string, input: z.infer<typeof patchAdminSchema>, actor: string): Promise<{ error: string } | { admins: PublicAdmin[] }> {
  return withLock('admins', async () => {
    const all = await listAdminsStored()
    const target = all.find((a) => a.email === email.toLowerCase())
    if (!target) return { error: 'Admin tidak ditemukan.' }
    const next = {
      ...target,
      role: input.role ?? target.role,
      active: input.active ?? target.active,
      password_hash: input.password ? await hashPassword(input.password) : target.password_hash,
    }
    const after = all.map((a) => (a.email === target.email ? next : a))
    const ownersLeft = after.filter((a) => a.role === 'owner' && a.active)
    if (ownersLeft.length === 0) return { error: 'Harus tersisa minimal satu owner aktif.' }
    await updateAdmin(next, auditOp(actor, 'admin.update', target.email, { role: target.role, active: target.active }, { role: next.role, active: next.active, password: input.password ? 'diganti' : undefined }))
    return { admins: after.map(toPublic) }
  })
}
