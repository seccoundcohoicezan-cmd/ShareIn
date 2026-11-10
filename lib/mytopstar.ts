import { createHash, randomBytes } from 'node:crypto'

/**
 * MyTopstar single sign-on (OpenID Connect, authorization code + PKCE). ShareIn is a relying party:
 * Duta open it from the MyTopstar/Staduta app list and land here already signed in.
 */
/** httpOnly cookie holding state + PKCE verifier between the login redirect and the callback. */
export const SSO_COOKIE = 'si_sso'

export interface SsoConfig {
  issuer: string
  clientId: string
  clientSecret: string
  /** Fixed callback URL; derived from the request host when empty. */
  redirectUri: string
}

export function ssoConfig(): SsoConfig | null {
  const clientId = process.env.MYTOPSTAR_CLIENT_ID?.trim()
  if (!clientId) return null
  return {
    issuer: (process.env.MYTOPSTAR_ISSUER?.trim() || 'https://my.topstar.id/oidc').replace(/\/$/, ''),
    clientId,
    clientSecret: process.env.MYTOPSTAR_CLIENT_SECRET?.trim() ?? '',
    redirectUri: process.env.MYTOPSTAR_REDIRECT_URI?.trim() ?? '',
  }
}

export interface Discovery {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  userinfo_endpoint: string
}

export type Fetch = (url: string, init?: RequestInit) => Promise<Response>

let discovered: { issuer: string; at: number; doc: Promise<Discovery> } | null = null

export function discover(issuer: string, fetcher: Fetch = fetch): Promise<Discovery> {
  if (discovered && discovered.issuer === issuer && Date.now() - discovered.at < 3600_000) return discovered.doc
  const doc = fetcher(`${issuer}/.well-known/openid-configuration`, { cache: 'no-store' }).then(async (r) => {
    if (!r.ok) throw new Error(`discovery ${r.status}`)
    const d = (await r.json()) as Discovery
    if (d.issuer !== issuer) throw new Error('issuer mismatch')
    return d
  })
  discovered = { issuer, at: Date.now(), doc }
  doc.catch(() => (discovered = null))
  return doc
}

const b64url = (b: Buffer) => b.toString('base64url')

export interface LoginState {
  state: string
  verifier: string
  /** Same-origin path to land on after signing in. */
  ret: string
}

export function newLoginState(ret: string): LoginState {
  return { state: b64url(randomBytes(24)), verifier: b64url(randomBytes(32)), ret }
}

export function authorizationUrl(d: Discovery, c: SsoConfig, redirectUri: string, s: LoginState): string {
  const u = new URL(d.authorization_endpoint)
  u.search = new URLSearchParams({
    response_type: 'code',
    client_id: c.clientId,
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    state: s.state,
    code_challenge: b64url(createHash('sha256').update(s.verifier).digest()),
    code_challenge_method: 'S256',
  }).toString()
  return u.toString()
}

/** Only same-origin paths are honoured: anything else would be an open redirect. */
export function safeReturn(target: string | null, origin: string, fallback: string): string {
  if (!target) return fallback
  try {
    const u = new URL(target, origin)
    if (u.origin !== origin) return fallback
    const path = u.pathname + u.search
    return path === '/' ? fallback : path
  } catch {
    return fallback
  }
}

export interface SsoUser {
  sub: string
  name: string
  phone: string
  email: string
}

/** Exchanges the authorization code and reads the profile from the userinfo endpoint. */
export async function completeLogin(d: Discovery, c: SsoConfig, redirectUri: string, code: string, verifier: string, fetcher: Fetch = fetch): Promise<SsoUser> {
  const body = new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier })
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' }
  if (c.clientSecret) headers.authorization = 'Basic ' + Buffer.from(`${encodeURIComponent(c.clientId)}:${encodeURIComponent(c.clientSecret)}`).toString('base64')
  else body.set('client_id', c.clientId)
  const tr = await fetcher(d.token_endpoint, { method: 'POST', headers, body: body.toString(), cache: 'no-store' })
  const tokens = (await tr.json().catch(() => ({}))) as { access_token?: string; error?: string }
  if (!tr.ok || !tokens.access_token) throw new Error(`token ${tr.status} ${tokens.error ?? ''}`.trim())
  const ur = await fetcher(d.userinfo_endpoint, { headers: { authorization: `Bearer ${tokens.access_token}`, accept: 'application/json' }, cache: 'no-store' })
  if (!ur.ok) throw new Error(`userinfo ${ur.status}`)
  const info = (await ur.json()) as Record<string, unknown>
  if (typeof info.sub !== 'string' || !info.sub) throw new Error('userinfo without sub')
  return { sub: info.sub, name: String(info.name ?? ''), phone: String(info.phone_number ?? ''), email: String(info.email ?? '') }
}
