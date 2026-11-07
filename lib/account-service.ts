import 'server-only'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { hashPassword } from './auth'
import { withLock } from './lock'
import { addAdmin, listAdmins, listAdminsStored, updateAdmin } from './repo/admins'
import { audit } from './repo/audit'

const password = z.string().min(10, 'Sandi minimal 10 karakter.').max(200)

export const changePasswordSchema = z
  .object({ current: z.string().min(1, 'Isi sandi saat ini.'), next: password, confirm: z.string() })
  .refine((v) => v.next === v.confirm, { message: 'Ulangi sandi baru dengan sama persis.', path: ['confirm'] })

export async function changePassword(email: string, current: string, next: string): Promise<string | null> {
  return withLock('admins', async () => {
    const me = (await listAdminsStored()).find((a) => a.email === email && a.active)
    if (!me) return 'Akun tidak ditemukan.'
    if (!(await bcrypt.compare(current, me.password_hash).catch(() => false))) return 'Sandi saat ini salah.'
    await updateAdmin({ ...me, password_hash: await hashPassword(next) })
    await audit(email, 'admin.password', email, '', '')
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

export async function createAdmin(input: z.infer<typeof newAdminSchema>, actor: string): Promise<string | null> {
  return withLock('admins', async () => {
    if ((await listAdmins()).some((a) => a.email === input.email)) return 'Email ini sudah terdaftar sebagai admin.'
    await addAdmin({ email: input.email, role: input.role, active: true, password_hash: await hashPassword(input.password) })
    await audit(actor, 'admin.create', input.email, '', { role: input.role })
    return null
  })
}

export async function patchAdmin(email: string, input: z.infer<typeof patchAdminSchema>, actor: string): Promise<string | null> {
  return withLock('admins', async () => {
    const all = await listAdminsStored()
    const target = all.find((a) => a.email === email.toLowerCase())
    if (!target) return 'Admin tidak ditemukan.'
    const next = {
      ...target,
      role: input.role ?? target.role,
      active: input.active ?? target.active,
      password_hash: input.password ? await hashPassword(input.password) : target.password_hash,
    }
    const after = all.map((a) => (a.email === target.email ? next : a))
    const ownersLeft = after.filter((a) => a.role === 'owner' && a.active)
    if (ownersLeft.length === 0) return 'Harus tersisa minimal satu owner aktif.'
    await updateAdmin(next)
    await audit(actor, 'admin.update', target.email, { role: target.role, active: target.active }, { role: next.role, active: next.active, password: input.password ? 'diganti' : undefined })
    return null
  })
}
