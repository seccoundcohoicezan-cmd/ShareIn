import { defaultPoster, type Poster } from '../repo/apps-script-store'
import { PRIMARY_MARKER } from './engine'

/**
 * Talks to the primary database (lib/primary/engine.ts on the self-hosted server) with the Apps Script
 * protocol. While the primary is restarting (redeploy) the reply looks "busy", so AppsScriptStore
 * retries with backoff instead of failing.
 *
 * Before the primary has ever taken over (no marker in the sheet), an unreachable primary means it is
 * simply not deployed yet: requests then go straight to the Google Sheet as before. After the takeover
 * the sheet is never written directly again, because the primary would overwrite it.
 */
export function primaryPoster(sheet: { url: string; post?: Poster }, post: Poster = defaultPoster): Poster {
  const sheetPost = sheet.post ?? defaultPoster
  let takenOver: boolean | null = null
  let checkedAt = 0

  async function primaryActive(secret: string): Promise<boolean> {
    if (takenOver || Date.now() - checkedAt < 30_000) return Boolean(takenOver)
    checkedAt = Date.now()
    try {
      const r = await sheetPost(sheet.url, JSON.stringify({ secret, ops: [{ action: 'read', table: 'settings' }] }))
      const data = JSON.parse(r.text) as { ok: boolean; results?: { header: string[]; rows: string[][] }[] }
      const rows = data.results?.[0]?.rows ?? []
      takenOver = data.ok && rows.some((row) => row[0] === PRIMARY_MARKER && row[1])
    } catch {
      takenOver = null
    }
    return Boolean(takenOver)
  }

  return async (url, body) => {
    let res: { status: number; text: string } | null = null
    let networkError: unknown = null
    try {
      res = await post(url, body)
    } catch (e) {
      networkError = e
    }
    const up = res && res.status === 200 && res.text.startsWith('{')
    if (up) return res!
    const secret = (JSON.parse(body) as { secret?: string }).secret ?? ''
    if (!(await primaryActive(secret))) return sheetPost(sheet.url, body)
    // 404/502/503 from the proxy or a refused connection: the request never reached the app, so
    // retrying is safe (AppsScriptStore backs off on "try again"). A reset or timeout mid-request
    // may have been applied, so that error is passed on instead of repeating a write blindly.
    const neverArrived = res || ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(String((networkError as { code?: string })?.code))
    if (neverArrived) return { status: 200, text: JSON.stringify({ ok: false, error: 'Server data sedang restart, try again' }) }
    throw networkError
  }
}
