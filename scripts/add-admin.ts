// Adds an admin row with a bcrypt hash. Usage: npm run admin:add -- email@domain owner|reviewer
// The password is read from the ADMIN_NEW_PASSWORD env var so it never lands in shell history.
import bcrypt from 'bcryptjs'
import { addAdmin, listAdmins } from '../lib/repo/admins'

async function main() {
  const [email, role = 'reviewer'] = process.argv.slice(2)
  const password = process.env.ADMIN_NEW_PASSWORD
  if (!email || !password || !['owner', 'reviewer'].includes(role)) {
    console.error('Pakai: ADMIN_NEW_PASSWORD=... npm run admin:add -- email@domain owner|reviewer')
    process.exit(1)
  }
  if (password.length < 10) throw new Error('Sandi minimal 10 karakter.')
  if ((await listAdmins()).some((a) => a.email === email.toLowerCase())) throw new Error('Email sudah terdaftar.')
  await addAdmin({ email, password_hash: await bcrypt.hash(password, 12), role: role as 'owner' | 'reviewer', active: true })
  console.log(`Admin ${email} (${role}) ditambahkan.`)
}
main().catch((e) => {
  console.error((e as Error).message)
  process.exit(1)
})
