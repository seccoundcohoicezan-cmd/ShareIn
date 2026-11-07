// Creates the 4 tabs with headers and seeds default settings. Usage: npm run sheet:setup
import { getStore, sheetsConfigured } from '../lib/repo'
import { seedSettings } from '../lib/repo/settings'

async function main() {
  if (!sheetsConfigured()) {
    console.log('SHEET_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY belum diisi; memakai store lokal (.data).')
  }
  const store = getStore()
  await store.ensureSchema()
  await seedSettings()
  console.log(`Siap (${store.kind}). Sheet: settings, submissions, admins, audit_log.`)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
