// Creates the 4 tabs with headers and seeds default settings. Usage: npm run sheet:setup
import { appsScriptConfigured, getStore, sheetsConfigured } from '../lib/repo'
import { seedSettings } from '../lib/repo/settings'

async function main() {
  if (!appsScriptConfigured() && !sheetsConfigured()) {
    console.log('APPS_SCRIPT_SECRET (atau variabel service account) belum diisi; memakai store lokal (.data).')
  }
  const store = getStore()
  await store.ensureSchema()
  await seedSettings()
  console.log(`Siap (${store.kind}). Tab: settings, submissions, admins, audit_log, tasks, task_submissions, participants, api_keys.`)
}
main().catch((e) => {
  console.error(e)
  process.exit(1)
})
