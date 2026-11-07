import { getStore } from './index'

export async function audit(actor: string, action: string, target: string, before: unknown, after: unknown) {
  try {
    await getStore().append('audit_log', [
      [new Date().toISOString(), actor, action, target, JSON.stringify(before ?? ''), JSON.stringify(after ?? '')],
    ])
  } catch (e) {
    console.error('audit_log write failed', (e as Error).message)
  }
}
