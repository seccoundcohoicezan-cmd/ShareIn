import { cached, invalidate } from '../cache'
import type { Admin, AdminRole } from '../types'
import { getStore } from './index'
import { rowToRecord, writeAll, type WriteOp } from './store'

type StoredAdmin = Admin & { _index: number }

function toRow(a: Admin) {
  return [a.email.toLowerCase(), a.password_hash, a.role, a.active ? 'TRUE' : 'FALSE']
}

export async function listAdminsStored(): Promise<StoredAdmin[]> {
  const { header, rows } = await getStore().read('admins')
  return rows
    .map((r, i) => ({ rec: rowToRecord(header, r), i }))
    .filter(({ rec }) => rec.email)
    .map(({ rec, i }) => ({
      _index: i,
      email: rec.email.trim().toLowerCase(),
      password_hash: rec.password_hash,
      role: (rec.role?.trim().toLowerCase() === 'owner' ? 'owner' : 'reviewer') as AdminRole,
      active: rec.active === '' || rec.active === undefined ? true : rec.active.trim().toUpperCase() === 'TRUE',
    }))
}

// Login reads this list; caching it skips a ~2 s spreadsheet round trip on warm servers.
export async function listAdmins(): Promise<Admin[]> {
  return (await cached('admins', listAdminsStored, 5 * 60_000)).map(({ _index, ...a }) => {
    void _index
    return a
  })
}

export async function addAdmin(a: Admin, audit?: WriteOp): Promise<void> {
  await writeAll(getStore(), [{ action: 'append', table: 'admins', rows: [toRow(a)] }, ...(audit ? [audit] : [])])
  invalidate('admins')
}

/** Writes the admin row and its audit entry in one request. */
export async function updateAdmin(a: StoredAdmin, audit?: WriteOp): Promise<void> {
  await writeAll(getStore(), [{ action: 'update', table: 'admins', updates: [{ index: a._index, row: toRow(a) }] }, ...(audit ? [audit] : [])])
  invalidate('admins')
}
