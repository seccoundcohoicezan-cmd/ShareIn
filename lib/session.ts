// Edge-safe signed session token (HMAC-SHA256 via Web Crypto); used by middleware and route handlers.
import type { AdminRole } from './types'

export const SESSION_COOKIE = 'si_admin'
export const SESSION_TTL_S = 8 * 3600

export interface Session {
  email: string
  role: AdminRole
  exp: number
}

const enc = new TextEncoder()

function secret(): string {
  const s = process.env.SESSION_SECRET
  if (s && s.length >= 32) return s
  // One less env var to set: derive from the Apps Script secret when SESSION_SECRET is absent.
  const a = process.env.APPS_SCRIPT_SECRET
  if (a && a.length >= 32) return `session:${a}`
  if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
    throw new Error('SESSION_SECRET wajib diisi (minimal 32 karakter).')
  }
  return 'dev-only-secret-change-me-dev-only-secret'
}

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let bin = ''
  arr.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

async function key() {
  return crypto.subtle.importKey('raw', enc.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signSession(data: Omit<Session, 'exp'>): Promise<string> {
  const payload: Session = { ...data, exp: Math.floor(Date.now() / 1000) + SESSION_TTL_S }
  const body = b64url(enc.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign('HMAC', await key(), enc.encode(body))
  return `${body}.${b64url(sig)}`
}

export async function verifySession(token: string | undefined | null): Promise<Session | null> {
  if (!token) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  try {
    const ok = await crypto.subtle.verify('HMAC', await key(), fromB64url(sig), enc.encode(body))
    if (!ok) return null
    const s = JSON.parse(new TextDecoder().decode(fromB64url(body))) as Session
    if (typeof s.exp !== 'number' || s.exp < Date.now() / 1000) return null
    if (s.role !== 'owner' && s.role !== 'reviewer') return null
    return s
  } catch {
    return null
  }
}
