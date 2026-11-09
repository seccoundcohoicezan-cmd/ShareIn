'use client'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatNumber, parseCount } from '@/lib/format'
import type { Check, CheckId, Platform } from '@/lib/types'
import { checkShareinUrl, detectPlatform, parseSourceUrl } from '@/lib/url'
import { CheckIcon, CrossIcon, GiftSolid } from './icons'
import { PantauCard } from './PantauCard'
import { toast } from './Toast'
import { localWa, useMe } from './useMe'
import { PillLabel } from './ui'

interface Rules {
  period_id: string
  period_open: boolean
  require_screenshot: boolean
  metrics_adapter: 'off' | 'rapidapi' | 'apify'
  sharein_domains: string[]
  rules: Record<Platform, { min_like: number; min_comment: number }>
  progress: { platform: Platform; used: number; target: number; remaining: number }[]
}

const CHECK_LABEL: Record<CheckId, string> = {
  period_open: 'Periode setoran dibuka',
  identity: 'Nomor WhatsApp valid',
  url_valid: 'Link konten valid',
  not_duplicate: 'Belum pernah disetor',
  min_like: 'Like memenuhi minimal',
  min_comment: 'Komentar memenuhi minimal',
  sharein_valid: 'Link Sharein valid',
  qty_available: 'Target belum penuh',
  organic: 'Pernyataan organik',
}

const NAME_KEY = 'sharein_name'
const MAX_BYTES = 2 * 1024 * 1024
const TYPES = ['image/jpeg', 'image/png', 'image/webp']

function Status({ ok, children }: { ok: boolean | null; children: React.ReactNode }) {
  if (ok === null) return <p className="muted mt-1.5 text-sm">{children}</p>
  return (
    <p className={`mt-1.5 flex items-start gap-1.5 text-sm font-bold ${ok ? 'text-ok' : 'text-bad'}`}>
      <span className="mt-0.5">{ok ? <CheckIcon /> : <CrossIcon />}</span>
      <span>{children}</span>
    </p>
  )
}

async function pasteInto(set: (v: string) => void) {
  try {
    const text = await navigator.clipboard.readText()
    if (text) set(text.trim())
    else toast('Clipboard kosong. Salin link dulu.', 'bad')
  } catch {
    toast('Izinkan akses clipboard, atau tempel manual (tekan lama di kolom).', 'bad')
  }
}

export function SetorForm() {
  const [rules, setRules] = useState<Rules | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [name, setName] = useState('')
  const [wa, setWa] = useState('')
  const [token, setToken] = useState('')
  const [autoApproved, setAutoApproved] = useState(false)
  const me = useMe()
  const [platform, setPlatform] = useState<Platform>('tiktok')
  const [sourceUrl, setSourceUrl] = useState('')
  const [likes, setLikes] = useState('')
  const [comments, setComments] = useState('')
  const [apiMetrics, setApiMetrics] = useState<{ likes: number; comments: number } | null>(null)
  const [fetchingMetrics, setFetchingMetrics] = useState(false)
  const [shareinUrl, setShareinUrl] = useState('')
  const [organic, setOrganic] = useState(false)
  const [checked, setChecked] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [checks, setChecks] = useState<Check[] | null>(null)
  const [checkedKey, setCheckedKey] = useState('')
  const [busy, setBusy] = useState<'check' | 'send' | null>(null)
  const [formError, setFormError] = useState('')
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (me) {
      setName(me.name)
      setWa(localWa(me.whatsapp))
    }
  }, [me])

  useEffect(() => {
    setName(localStorage.getItem(NAME_KEY) ?? '')
    fetch('/api/rules')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setRules)
      .catch(() => setLoadError(true))
  }, [])

  const rule = rules?.rules[platform]
  const likesN = parseCount(likes)
  const commentsN = parseCount(comments)
  const parsed = sourceUrl.trim() ? parseSourceUrl(sourceUrl) : null
  const detected = sourceUrl.trim() ? detectPlatform(sourceUrl) : null
  const share = shareinUrl.trim() && rules ? checkShareinUrl(shareinUrl, rules.sharein_domains) : null
  const prog = rules?.progress.find((p) => p.platform === platform)

  useEffect(() => {
    if (detected && detected !== platform) setPlatform(detected)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detected])

  const formKey = useMemo(
    () => JSON.stringify([name.trim(), wa.trim(), platform, sourceUrl.trim(), likesN, commentsN, shareinUrl.trim(), organic, checked, file?.name ?? '', file?.size ?? 0]),
    [name, wa, platform, sourceUrl, likesN, commentsN, shareinUrl, organic, checked, file],
  )
  const canSend = checks !== null && checks.every((c) => c.pass) && checkedKey === formKey

  function payload() {
    return {
      submitter_name: name,
      whatsapp: wa,
      platform,
      source_url: sourceUrl,
      sharein_url: shareinUrl,
      likes: likesN,
      comments: commentsN,
      organic_declared: organic,
      checked_declared: checked,
      has_screenshot: Boolean(file),
      metrics_source: apiMetrics && apiMetrics.likes === likesN && apiMetrics.comments === commentsN ? 'api' : 'manual',
      api_likes: apiMetrics?.likes ?? null,
      api_comments: apiMetrics?.comments ?? null,
    }
  }

  async function runCheck() {
    setFormError('')
    if (name.trim().length < 2) {
      setFormError('Isi nama penyetor minimal 2 huruf.')
      document.getElementById('nama')?.focus()
      return
    }
    if (wa.replace(/\D/g, '').length < 9) {
      setFormError('Isi nomor WhatsApp aktif, contoh 081234567890.')
      document.getElementById('wa')?.focus()
      return
    }
    setBusy('check')
    try {
      const res = await fetch('/api/submissions/check', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload()),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error ?? 'Cek gagal. Coba lagi.')
        setChecks(null)
        return
      }
      setChecks(data.checks)
      setCheckedKey(formKey)
      requestAnimationFrame(() => document.getElementById('hasil-cek')?.focus())
    } catch {
      setFormError('Tidak terhubung ke server. Periksa internet lalu coba lagi.')
    } finally {
      setBusy(null)
    }
  }

  async function send() {
    if (!canSend) return
    setBusy('send')
    setFormError('')
    try {
      const fd = new FormData()
      fd.set('data', JSON.stringify(payload()))
      if (file) fd.set('screenshot', file)
      const res = await fetch('/api/submissions', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.ok) {
        localStorage.setItem(NAME_KEY, name.trim())
        if (data.token) setToken(data.token)
        setAutoApproved(data.status === 'approved')
        toast('Terkirim')
        setDone(true)
        window.scrollTo({ top: 0 })
        return
      }
      if (data.checks) {
        setChecks(data.checks)
        setCheckedKey('')
      }
      setFormError(data.error ?? 'Setoran belum bisa dikirim. Perbaiki poin yang merah lalu cek lagi.')
    } catch {
      setFormError('Tidak terhubung ke server. Periksa internet lalu coba lagi.')
    } finally {
      setBusy(null)
    }
  }

  async function fetchMetrics() {
    setFetchingMetrics(true)
    try {
      const res = await fetch('/api/metrics/fetch', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: sourceUrl }),
      })
      const data = await res.json()
      if (data.ok) {
        setApiMetrics({ likes: data.likes, comments: data.comments })
        setLikes(formatNumber(data.likes))
        setComments(formatNumber(data.comments))
        toast('Angka terisi otomatis')
      } else {
        toast('Angka otomatis belum tersedia. Isi manual hasil cekmu.', 'bad')
      }
    } catch {
      toast('Angka otomatis belum tersedia. Isi manual hasil cekmu.', 'bad')
    } finally {
      setFetchingMetrics(false)
    }
  }

  function onFile(f: File | null) {
    setFileError('')
    if (!f) return setFile(null)
    if (!TYPES.includes(f.type)) {
      setFileError('Pilih gambar JPG, PNG, atau WebP.')
      if (fileRef.current) fileRef.current.value = ''
      return setFile(null)
    }
    if (f.size > MAX_BYTES) {
      setFileError(`Ukuran ${(f.size / 1024 / 1024).toFixed(1)} MB. Maksimal 2 MB, potong atau kecilkan gambarnya.`)
      if (fileRef.current) fileRef.current.value = ''
      return setFile(null)
    }
    setFile(f)
  }

  function reset() {
    setSourceUrl('')
    setLikes('')
    setComments('')
    setShareinUrl('')
    setOrganic(false)
    setChecked(false)
    setFile(null)
    setApiMetrics(null)
    setChecks(null)
    setCheckedKey('')
    setDone(false)
    setToken('')
    fetch('/api/rules').then((r) => r.json()).then(setRules).catch(() => {})
  }

  if (done) {
    return (
      <div className="panel-solid text-center" role="status">
        <div className="bounce-once mx-auto mt-2 w-fit">
          <GiftSolid className="h-24 w-24" />
        </div>
        <h2 className="mt-4 text-2xl font-extrabold">Setoran terkirim</h2>
        <p className="muted mx-auto mt-2 max-w-sm">{autoApproved ? 'Setoranmu sudah disetujui otomatis.' : 'Admin akan memeriksa dalam 1×24 jam. Status disetujui/ditolak langsung terlihat di halaman pantaumu.'}</p>
        {token && <PantauCard token={token} />}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" className="btn-primary" onClick={reset}>Setor lagi</button>
          {!token && <Link href="/pantau" className="btn-ghost">Pantau setoranku</Link>}
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="panel-solid" role="alert">
        <p className="font-bold">Aturan setoran belum termuat.</p>
        <p className="muted mt-1 text-sm">Periksa koneksi internet, lalu muat ulang halaman.</p>
        <button type="button" className="btn-primary mt-4" onClick={() => location.reload()}>Muat ulang</button>
      </div>
    )
  }

  const closed = rules && !rules.period_open
  const full = prog && prog.remaining === 0

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (canSend) send()
        else runCheck()
      }}
    >
      {closed && (
        <div role="alert" className="rounded-panel border border-warn/40 bg-amber-50 p-4 font-bold">
          Setoran sedang ditutup. Pantau beranda untuk periode berikutnya.
        </div>
      )}

      <section className="panel-solid space-y-5" aria-labelledby="data-diri">
        <PillLabel id="data-diri">Penyetor</PillLabel>
        {me && (
          <p className="rounded-field bg-green-50 p-3 text-sm font-bold text-green-900">
            Masuk sebagai {me.name}. <a href={`/pantau/${me.token}`} className="underline">Lihat halaman pantau</a>
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="nama" className="label">Nama penyetor</label>
            <input id="nama" className="field" autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" />
          </div>
          <div>
            <label htmlFor="wa" className="label">Nomor WhatsApp</label>
            <input id="wa" className="field" inputMode="tel" autoComplete="tel" maxLength={20} value={wa} onChange={(e) => setWa(e.target.value)} placeholder="081234567890" readOnly={Boolean(me)} />
            <p className="muted mt-1.5 text-xs">1 nomor = 1 akun. Kamu akan dapat link pantau unik.</p>
          </div>
        </div>
        <fieldset>
          <legend className="label">Platform asal</legend>
          <div className="grid grid-cols-2 gap-1 rounded-field bg-brand-lavender p-1" role="radiogroup">
            {(['tiktok', 'reels'] as Platform[]).map((p) => (
              <label key={p} className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-[12px] text-sm font-bold transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-brand-violet ${platform === p ? 'bg-brand-purple text-white' : 'text-brand-purple hover:bg-white'}`}>
                <input type="radio" name="platform" value={p} checked={platform === p} onChange={() => setPlatform(p)} className="sr-only" />
                {p === 'tiktok' ? 'TikTok' : 'Instagram Reels'}
              </label>
            ))}
          </div>
          <p className={`mt-1.5 min-h-[1.25rem] text-sm ${full ? 'font-bold text-bad' : 'muted'}`}>
            {prog ? (full ? `Target ${platform === 'tiktok' ? 'TikTok' : 'Reels'} periode ini sudah terpenuhi (${prog.used}/${prog.target}).` : `Sisa kuota ${prog.remaining} dari ${prog.target}.`) : 'Memuat kuota…'}
          </p>
        </fieldset>
      </section>

      <section className="panel-solid space-y-5" aria-labelledby="konten">
        <PillLabel id="konten">1 · Link konten asal</PillLabel>
        <div>
          <label htmlFor="link-asal" className="label">{platform === 'tiktok' ? 'Link TikTok' : 'Link Instagram Reels'}</label>
          <div className="relative">
            <input
              id="link-asal"
              className="field pr-24"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
              placeholder={platform === 'tiktok' ? 'https://www.tiktok.com/@akun/video/…' : 'https://www.instagram.com/reel/…'}
              aria-describedby="link-asal-status"
            />
            <button type="button" className="absolute right-1.5 top-1/2 min-h-[38px] -translate-y-1/2 rounded-[12px] bg-brand-purple/10 px-3 text-sm font-bold text-brand-purple hover:bg-brand-purple/20" onClick={() => pasteInto(setSourceUrl)}>
              Tempel
            </button>
          </div>
          <div id="link-asal-status" aria-live="polite">
            {!sourceUrl.trim() ? (
              <Status ok={null}>
                Salin dari tombol Bagikan → Salin tautan.{' '}
                <a href="/#panduan" className="font-bold text-brand-purple underline underline-offset-2">Lihat panduan bergambar</a>
              </Status>
            ) : typeof parsed === 'string' || !parsed ? (
              <Status ok={false}>
                {parsed === 'not_https' ? 'Link harus diawali https://.' : 'Link ini bukan dari TikTok atau Instagram Reels. Tempel link dari tombol Bagikan.'}
              </Status>
            ) : parsed.short ? (
              <Status ok={null}>Link pendek {parsed.platform === 'tiktok' ? 'TikTok' : 'Instagram'} terdeteksi. Server akan membukanya saat kamu menekan Cek setoran.</Status>
            ) : (
              <Status ok>Link valid · {parsed.platform === 'tiktok' ? 'TikTok' : 'Instagram Reels'}</Status>
            )}
          </div>
          {sourceUrl.trim() && typeof parsed !== 'string' && parsed && (
            <a href={parsed.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-[44px] items-center text-sm font-bold text-brand-purple underline underline-offset-4">
              Buka link untuk cek angka
            </a>
          )}
        </div>
      </section>

      <section className="panel-solid space-y-4" aria-labelledby="angka">
        <PillLabel id="angka">2 · Angka hasil cek manual</PillLabel>
        {rules?.metrics_adapter !== 'off' && rules && (
          <button type="button" className="btn-ghost btn-sm" disabled={fetchingMetrics || !sourceUrl.trim()} onClick={fetchMetrics}>
            {fetchingMetrics ? 'Mengambil angka…' : 'Ambil angka otomatis'}
          </button>
        )}
        <div className="grid grid-cols-2 gap-3">
          {[
            { id: 'like', label: 'Like', value: likes, set: setLikes, n: likesN, min: rule?.min_like },
            { id: 'komentar', label: 'Komentar', value: comments, set: setComments, n: commentsN, min: rule?.min_comment },
          ].map((f) => (
            <div key={f.id}>
              <label htmlFor={f.id} className="label">{f.label}</label>
              <input
                id={f.id}
                className="field tabular-nums"
                inputMode="numeric"
                autoComplete="off"
                value={f.value}
                placeholder={f.min ? formatNumber(f.min) : ''}
                onChange={(e) => f.set(e.target.value.replace(/[^\d.,rbkjtRBKJT ]/g, ''))}
                onBlur={() => {
                  const n = parseCount(f.value)
                  if (n !== null) f.set(formatNumber(n))
                }}
                aria-describedby={`${f.id}-status`}
              />
              <div id={`${f.id}-status`} aria-live="polite">
                {f.min === undefined ? (
                  <Status ok={null}>Memuat batas…</Status>
                ) : !f.value.trim() ? (
                  <Status ok={null}>Minimal {formatNumber(f.min)}</Status>
                ) : f.n === null ? (
                  <Status ok={false}>Tulis angka saja, contoh 120000.</Status>
                ) : f.n >= f.min ? (
                  <Status ok>Memenuhi (≥ {formatNumber(f.min)})</Status>
                ) : (
                  <Status ok={false}>Kurang {formatNumber(f.min - f.n)} dari {formatNumber(f.min)}</Status>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel-solid space-y-4" aria-labelledby="sharein">
        <PillLabel id="sharein">3 · Link hasil unggah Sharein</PillLabel>
        <div>
          <label htmlFor="link-sharein" className="label">Link Sharein</label>
          <div className="relative">
            <input
              id="link-sharein"
              className="field pr-24"
              inputMode="url"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={shareinUrl}
              onChange={(e) => setShareinUrl(e.target.value)}
              placeholder={`https://${rules?.sharein_domains[0] ?? 'sharein.id'}/…`}
              aria-describedby="sharein-status"
            />
            <button type="button" className="absolute right-1.5 top-1/2 min-h-[38px] -translate-y-1/2 rounded-[12px] bg-brand-purple/10 px-3 text-sm font-bold text-brand-purple hover:bg-brand-purple/20" onClick={() => pasteInto(setShareinUrl)}>
              Tempel
            </button>
          </div>
          <div id="sharein-status" aria-live="polite">
            {!share ? (
              <Status ok={null}>Unggah kontennya ke Sharein dulu, lalu tempel link-nya di sini.</Status>
            ) : share.ok ? (
              <Status ok>Link Sharein valid</Status>
            ) : (
              <Status ok={false}>
                {share.reason === 'domain'
                  ? `Link harus dari ${rules?.sharein_domains.join(' atau ')}.`
                  : share.reason === 'no_path'
                    ? 'Tempel link halaman konten, bukan beranda Sharein.'
                    : share.reason === 'not_https'
                      ? 'Link Sharein harus diawali https://.'
                      : 'Link Sharein tidak terbaca. Salin ulang dari Sharein.'}
              </Status>
            )}
          </div>
        </div>
      </section>

      <section className="panel-solid space-y-3" aria-labelledby="pernyataan">
        <PillLabel id="pernyataan">Pernyataan</PillLabel>
        {[
          { id: 'organik', v: organic, set: setOrganic, t: `Konten ini muncul organik di ${platform === 'tiktok' ? 'FYP TikTok' : 'Beranda Reels'} saya.` },
          { id: 'sudah-cek', v: checked, set: setChecked, t: 'Saya sudah membuka link dan memeriksa angkanya.' },
        ].map((c) => (
          <label key={c.id} htmlFor={c.id} className="flex min-h-[44px] cursor-pointer items-start gap-3 rounded-field bg-brand-lavender/70 p-3">
            <input id={c.id} type="checkbox" checked={c.v} onChange={(e) => c.set(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#6C2BD9]" />
            <span className="font-bold">{c.t}</span>
          </label>
        ))}
        <div className="pt-2">
          <label htmlFor="ss" className="label">
            Tangkapan layar {rules?.require_screenshot ? <span className="text-bad">(wajib)</span> : <span className="muted font-medium">(opsional)</span>}
          </label>
          <input
            ref={fileRef}
            id="ss"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:min-h-[44px] file:rounded-field file:border-0 file:bg-brand-purple/10 file:px-4 file:font-bold file:text-brand-purple"
            aria-describedby="ss-status"
          />
          <div id="ss-status">
            {fileError ? <Status ok={false}>{fileError}</Status> : file ? <Status ok>{file.name}</Status> : <Status ok={null}>JPG/PNG/WebP, maksimal 2 MB.</Status>}
          </div>
        </div>
      </section>

      {checks && (
        <section id="hasil-cek" tabIndex={-1} className="panel-solid outline-none" aria-labelledby="hasil">
          <PillLabel id="hasil">Hasil cek</PillLabel>
          <ul className="mt-4 space-y-2.5">
            {checks.map((c) => (
              <li key={c.id} className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-white ${c.pass ? 'bg-ok' : 'bg-bad'}`}>
                  {c.pass ? <CheckIcon className="h-3.5 w-3.5" /> : <CrossIcon className="h-3.5 w-3.5" />}
                </span>
                <span>
                  <span className="font-bold">{CHECK_LABEL[c.id]}</span>
                  {c.pass && c.id === 'qty_available' && typeof c.remaining === 'number' && <span className="muted"> · sisa {c.remaining}</span>}
                  {!c.pass && c.message && <span className="block text-sm text-bad">{c.message}</span>}
                </span>
              </li>
            ))}
          </ul>
          {checks.every((c) => c.pass) && checkedKey !== formKey && <p className="mt-3 text-sm font-bold text-warn">Ada perubahan setelah dicek. Tekan Cek setoran lagi.</p>}
        </section>
      )}

      {formError && (
        <p role="alert" className="rounded-field bg-red-50 p-3 text-sm font-bold text-bad">
          {formError}
        </p>
      )}

      <div className="sticky bottom-3 z-10 grid grid-cols-2 gap-3 rounded-panel border border-brand-purple/10 bg-white/90 p-2 backdrop-blur">
        <button type="button" className="btn-ghost" onClick={runCheck} disabled={busy !== null || !rules || Boolean(closed)}>
          {busy === 'check' ? 'Mengecek…' : 'Cek setoran'}
        </button>
        <button type="button" className="btn-primary" onClick={send} disabled={!canSend || busy !== null || Boolean(closed)} aria-describedby={canSend ? undefined : 'kirim-hint'}>
          {busy === 'send' ? 'Mengirim…' : 'Kirim setoran'}
        </button>
      </div>
      {!canSend && (
        <p id="kirim-hint" className="muted -mt-2 text-center text-xs">
          Tombol Kirim setoran aktif setelah semua cek lolos.
        </p>
      )}
    </form>
  )
}
