import { invalidate } from './cache'
import { appsScriptConfigured, getStore, sheetsConfigured } from './repo'
import { listAdmins } from './repo/admins'
import { getSettings } from './repo/settings'
import { getProgress } from './service'
import { programSummary } from './progress'

export async function warmCaches(first: boolean) {
  if (!appsScriptConfigured() && !sheetsConfigured()) return
  try {
    if (first) await getStore().ensureSchema()
    for (const k of ['admins', 'settings', 'submissions', 'progress', 'program:']) invalidate(k)
    // Reads issued together travel in one Apps Script request.
    await Promise.all([listAdmins(), getSettings(), getProgress(), programSummary('pelatihan'), programSummary('duta')])
  } catch (e) {
    console.error('cache warm-up failed', (e as Error).message)
  }
}
