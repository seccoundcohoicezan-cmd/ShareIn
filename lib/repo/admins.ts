import type { Admin, AdminRole } from '../types'
import { getStore } from './index'
import { rowToRecord } from './store'

export async function listAdmins(): Promise<Admin[]> {
  const { header, rows } = await getStore().read('admins')
  return rows
    .map((r) => rowToRecord(header, r))
    .filter((r) => r.email)
    .map((r) => ({
      email: r.email.trim().toLowerCase(),
      password_hash: r.password_hash,
      role: (r.role?.trim().toLowerCase() === 'owner' ? 'owner' : 'reviewer') as AdminRole,
      active: r.active === '' ? true : r.active.trim().toUpperCase() === 'TRUE',
    }))
}

export async function addAdmin(a: Admin): Promise<void> {
  await getStore().append('admins', [[a.email.toLowerCase(), a.password_hash, a.role, a.active]])
}
