// Minimal stand-in for MyTopstar's OIDC provider, for end-to-end tests only.
// Authorization code + PKCE (S256), consent page, token and userinfo endpoints.
import { createHash, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'

const PORT = Number(process.env.MOCK_IDP_PORT || 39117)
const ISSUER = `http://localhost:${PORT}/oidc`
const CLIENT = 'sharein-e2e'
const USER = { sub: 'mt-duta-1', name: 'Dewi Duta', phone_number: '+6281355551234', email: 'dewi@example.test' }
const codes = new Map()
const tokens = new Set()

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  if (url.pathname === '/oidc/.well-known/openid-configuration') {
    return json(res, 200, { issuer: ISSUER, authorization_endpoint: `${ISSUER}/auth`, token_endpoint: `${ISSUER}/token`, userinfo_endpoint: `${ISSUER}/me` })
  }
  if (url.pathname === '/oidc/auth') {
    const q = url.searchParams
    if (q.get('client_id') !== CLIENT || q.get('code_challenge_method') !== 'S256' || !q.get('code_challenge')) return json(res, 400, { error: 'invalid_request' })
    const code = randomBytes(12).toString('hex')
    codes.set(code, { challenge: q.get('code_challenge'), redirect: q.get('redirect_uri') })
    const back = (params) => `${q.get('redirect_uri')}?${new URLSearchParams({ ...params, state: q.get('state'), iss: ISSUER })}`
    res.writeHead(200, { 'content-type': 'text/html' })
    return res.end(`<!doctype html><title>MyTopstar</title><h1>ShareIn wants you to sign in</h1><p>Secured by MyTopstar</p>
      <a href="${back({ code })}">Allow</a> <a href="${back({ error: 'access_denied' })}">Decline</a>`)
  }
  if (url.pathname === '/oidc/token' && req.method === 'POST') {
    let body = ''
    for await (const c of req) body += c
    const p = new URLSearchParams(body)
    const saved = codes.get(p.get('code'))
    codes.delete(p.get('code'))
    const challenge = createHash('sha256').update(p.get('code_verifier') ?? '').digest('base64url')
    if (!saved || saved.challenge !== challenge || saved.redirect !== p.get('redirect_uri') || p.get('client_id') !== CLIENT) return json(res, 400, { error: 'invalid_grant' })
    const t = randomBytes(16).toString('hex')
    tokens.add(t)
    return json(res, 200, { access_token: t, token_type: 'Bearer', expires_in: 3600 })
  }
  if (url.pathname === '/oidc/me') {
    const t = (req.headers.authorization ?? '').replace(/^Bearer /, '')
    return tokens.has(t) ? json(res, 200, USER) : json(res, 401, { error: 'invalid_token' })
  }
  res.writeHead(404)
  res.end()
}).listen(PORT, '127.0.0.1')
