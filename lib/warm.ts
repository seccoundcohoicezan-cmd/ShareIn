import { cached, invalidate } from './cache'
import { taskSubmissionsTable } from './repo/programs'
import { appsScriptConfigured, getStore, sheetsConfigured } from './repo'
import { listAdmins } from './repo/admins'
import { getSettings } from './repo/settings'
import { programSummary } from './program-service'
import { getProgress } from './service'

export async function warmCaches(first: boolean) {
  if (!appsScriptConfigured() && !sheetsConfigured()) return
  try {
    if (first) await getStore().ensureSchema()
    for (const k of ['admins', 'settings', 'submissions', 'progress', 'program', 'tasks', 'task_submissions']) invalidate(k)
    // Reads issued together travel in one Apps Script request.
    await Promise.all([
      listAdmins(),
      getSettings(),
      getProgress(),
      programSummary('pelatihan'),
      programSummary('duta'),
      cached('task_submissions', () => taskSubmissionsTable.list()),
    ])
  } catch (e) {
    console.error('cache warm-up failed', (e as Error).message)
  }
}
