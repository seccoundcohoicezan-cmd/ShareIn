import { invalidate } from './cache'
import { isPrimaryHost } from './primary/local'
import { appsScriptConfigured, getStore, sheetsConfigured } from './repo'
import { listAdmins } from './repo/admins'
import { getSettings } from './repo/settings'
import { getProgress } from './service'
import { programSummary } from './progress'

export async function warmCaches(first: boolean) {
  if (!appsScriptConfigured() && !sheetsConfigured()) return
  // The primary database loads on its first real request; warming it at boot would copy the sheet
  // while web servers on the previous deploy may still be writing to it directly.
  if (isPrimaryHost()) return
  try {
    if (first) await getStore().ensureSchema()
    for (const k of ['admins', 'settings', 'submissions', 'progress', 'program:']) invalidate(k)
    // Reads issued together travel in one Apps Script request.
    await Promise.all([listAdmins(), getSettings(), getProgress(), programSummary('pelatihan'), programSummary('duta')])
  } catch (e) {
    console.error('cache warm-up failed', (e as Error).message)
  }
}
