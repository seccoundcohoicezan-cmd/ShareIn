// 300 participants at once: open the page, check progress, send 3 links, check again, open pantau.
// Usage: node tests/load/load.mjs http://localhost:3300 [users] [rampSeconds]
// Several bases (comma-separated) spread users over server instances, like serverless hosting.
const BASES = (process.argv[2] || 'http://localhost:3300').split(',')
const USERS = Number(process.argv[3] || 300)
const RAMP = Number(process.argv[4] || 10) * 1000
const OFFSET = Number(process.argv[5] || 0)
const steps = {}
const errors = {}
function rec(step, ms, ok, why) {
  ;(steps[step] ??= []).push(ms)
  if (!ok) errors[`${step}: ${why}`] = (errors[`${step}: ${why}`] ?? 0) + 1
}
async function timed(step, fn) {
  const t = performance.now()
  try {
    const r = await fn()
    rec(step, performance.now() - t, r.ok, r.ok ? '' : `${r.status} ${(r.why || '').slice(0, 80)}`)
    return r
  } catch (e) {
    rec(step, performance.now() - t, false, String(e.message).slice(0, 80))
    return { ok: false }
  }
}
async function user(i) {
  const BASE = BASES[i % BASES.length]
  let cookie = ''
  const go = async (path, init = {}) => {
    const res = await fetch(BASE + path, { ...init, headers: { ...(init.headers || {}), cookie, 'x-forwarded-for': '10.0.0.1' }, redirect: 'manual' })
    const set = res.headers.get('set-cookie')
    if (set) cookie = set.split(';')[0]
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch {}
    return { ok: res.ok, status: res.status, json, why: json?.error ?? json?.items?.flatMap?.((x) => x.checks?.filter((c) => !c.pass).map((c) => c.message) ?? [])?.[0] ?? '' }
  }
  await timed('1 halaman /pelatihancontent', () => go('/pelatihancontent'))
  await timed('2 /api/me (progres)', () => go('/api/me?program=pelatihan'))
  const n = String(i).padStart(4, '0')
  const items = [1, 2].map((k) => ({ platform: 'tiktok', source_url: `https://www.tiktok.com/@load${n}/video/74000${n}${k}000000000`.slice(0, 60), sharein_url: '', likes: null, comments: null, metrics_source: 'manual' }))
    .concat([{ platform: 'reels', source_url: `https://www.instagram.com/reel/L${n}x1/`, sharein_url: '', likes: null, comments: null, metrics_source: 'manual' }])
  const fd = new FormData()
  fd.set('data', JSON.stringify({ submitter_name: `Peserta ${n}`, whatsapp: `0812${String(30000000 + i)}`, organic_declared: true, checked_declared: true, has_screenshot: false, program: 'pelatihan', items }))
  const sent = await timed('3 kirim 3 link (akun baru)', () => go('/api/submissions/batch', { method: 'POST', body: fd }))
  await timed('4 /api/me sesudah kirim', () => go('/api/me?program=pelatihan'))
  const token = sent.json?.token
  if (token) await timed('5 halaman pantau (API)', () => go(`/api/pantau/${token}`))
}
const pct = (a, p) => a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))]
const t0 = performance.now()
await Promise.all(Array.from({ length: USERS }, (_, i) => new Promise((r) => setTimeout(r, (i / USERS) * RAMP)).then(() => user(i + OFFSET))))
const total = ((performance.now() - t0) / 1000).toFixed(1)
console.log(`\n${USERS} pengguna, ramp ${RAMP / 1000}s, selesai dalam ${total}s`)
for (const [k, v] of Object.entries(steps).sort()) {
  v.sort((a, b) => a - b)
  console.log(`${k.padEnd(30)} n=${String(v.length).padStart(3)}  p50=${(pct(v, 50) / 1000).toFixed(2)}s  p95=${(pct(v, 95) / 1000).toFixed(2)}s  max=${(v[v.length - 1] / 1000).toFixed(2)}s`)
}
const errs = Object.entries(errors)
console.log(errs.length ? 'ERRORS:' : 'Tanpa error.')
for (const [k, v] of errs.sort((a, b) => b[1] - a[1]).slice(0, 12)) console.log(`  ${v}× ${k}`)
