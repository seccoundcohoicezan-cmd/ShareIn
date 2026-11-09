'use client'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatNumber, parseCount } from '@/lib/format'
import type { Check, CheckId, Platform } from '@/lib/types'
import { PLATFORM_LABEL } from '@/lib/types'
import { checkShareinUrl, detectPlatform, LINK_RULE_MESSAGE, parseSourceUrl } from '@/lib/url'
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

const MAX_ITEMS = 10
// Reported once for the whole form rather than on every content card.
const GLOBAL_CHECKS: CheckId[] = ['period_open', 'identity', 'organic']

type Item = { key: number; url: string; likes: string; comments: string; sharein: string; api: { likes: number; comments: number } | null }
type ItemResult = { ok: boolean; checks: Check[] }

let nextKey = 1
const blankItem = (): Item => ({ key: nextKey++, url: '', likes: '', comments: '', sharein: '', api: null })
// Fixed key: the first card is server-rendered, so its field ids must match on hydration.
const FIRST_ITEM: Item = { key: 0, url: '', likes: '', comments: '', sharein: '', api: null }

function linkState(url: string) {
  if (!url.trim()) return { state: 'empty' as const }
  const parsed = parseSourceUrl(url)
  if (typeof parsed === 'string') return { state: 'bad' as const, message: parsed === 'not_https' ? 'Link harus diawali https://.' : LINK_RULE_MESSAGE }
  return { state: parsed.short ? ('short' as const) : ('ok' as const), parsed }
}

function ContentCard({
  item, index, total, rules, result, onChange, onRemove,
}: {
  item: Item
  index: number
  total: number
  rules: Rules | null
  result: ItemResult | null
  onChange: (patch: Partial<Item>) => void
  onRemove: () => void
}) {
  const [fetching, setFetching] = useState(false)
  const link = linkState(item.url)
  const platform: Platform = detectPlatform(item.url) ?? 'tiktok'
  const rule = rules?.rules[platform]
  const likesN = parseCount(item.likes)
  const commentsN = parseCount(item.comments)
  const share = item.sharein.trim() && rules ? checkShareinUrl(item.sharein, rules.sharein_domains) : null
  const id = (n: string) => `${n}-${item.key}`
  const failed = result?.checks.filter((c) => !c.pass && !GLOBAL_CHECKS.includes(c.id)) ?? []
  // A wrong link also fails the duplicate check; one message is enough.
  const shown = failed.some((c) => c.id === 'url_valid') ? failed.filter((c) => c.id !== 'not_duplicate') : failed
  const qty = result?.checks.find((c) => c.id === 'qty_available')

  async function fetchMetrics() {
    setFetching(true)
    try {
      const res = await fetch('/api/metrics/fetch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: item.url }) })
      const data = await res.json()
      if (data.ok) {
        onChange({ api: { likes: data.likes, comments: data.comments }, likes: formatNumber(data.likes), comments: formatNumber(data.comments) })
        toast('Angka terisi otomatis')
      } else toast('Angka otomatis belum tersedia. Isi manual hasil cekmu.', 'bad')
    } catch {
      toast('Angka otomatis belum tersedia. Isi manual hasil cekmu.', 'bad')
    } finally {
      setFetching(false)
    }
  }

  return (
    <section className="panel-solid space-y-4" aria-label={`Konten ${index + 1}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="pill">Konten {index + 1}</span>
        {total > 1 && (
          <button type="button" className="min-h-[44px] rounded-field px-3 text-sm font-bold text-bad hover:bg-red-50" onClick={onRemove} aria-label={`Hapus konten ${index + 1}`}>
            Hapus
          </button>
        )}
      </div>

      <div>
        <label htmlFor={id('link')} className="label">Link konten</label>
        <div className="relative">
          <input
            id={id('link')}
            className={`field pr-24 ${link.state === 'bad' ? '!border-bad !bg-red-50 !text-bad' : ''}`}
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={item.url}
            aria-invalid={link.state === 'bad'}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://www.tiktok.com/… atau https://www.instagram.com/reel/…"
            aria-describedby={id('link-status')}
          />
          <button type="button" className="absolute right-1.5 top-1/2 min-h-[38px] -translate-y-1/2 rounded-[12px] bg-brand-purple/10 px-3 text-sm font-bold text-brand-purple hover:bg-brand-purple/20" onClick={() => pasteInto((v) => onChange({ url: v }))}>
            Tempel
          </button>
        </div>
        <div id={id('link-status')} aria-live="polite">
          {link.state === 'empty' && (
            <>
              <Status ok={null}>Wajib dari tiktok.com atau instagram.com/reel/.</Status>
              <a href="/#panduan" className="inline-flex min-h-[44px] items-center text-sm font-bold text-brand-purple underline underline-offset-2">Lihat panduan bergambar</a>
            </>
          )}
          {link.state === 'bad' && <Status ok={false}>{link.message}</Status>}
          {link.state === 'short' && <Status ok={null}>Link pendek {PLATFORM_LABEL[link.parsed.platform]} terdeteksi. Server akan membukanya saat kamu menekan Cek setoran.</Status>}
          {link.state === 'ok' && <Status ok>Link valid · {PLATFORM_LABEL[link.parsed.platform]}</Status>}
        </div>
        {(link.state === 'ok' || link.state === 'short') && (
          <a href={link.parsed.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-[44px] items-center text-sm font-bold text-brand-purple underline underline-offset-4">
            Buka link untuk cek angka
          </a>
        )}
      </div>

      {rules && rules.metrics_adapter !== 'off' && (
        <button type="button" className="btn-ghost btn-sm" disabled={fetching || link.state === 'empty' || link.state === 'bad'} onClick={fetchMetrics}>
          {fetching ? 'Mengambil angka…' : 'Ambil angka otomatis'}
        </button>
      )}
      <div className="grid grid-cols-2 gap-3">
        {([
          { k: 'like', label: 'Like', field: 'likes', value: item.likes, n: likesN, min: rule?.min_like },
          { k: 'komentar', label: 'Komentar', field: 'comments', value: item.comments, n: commentsN, min: rule?.min_comment },
        ] as const).map((f) => (
          <div key={f.k}>
            <label htmlFor={id(f.k)} className="label">{f.label}</label>
            <input
              id={id(f.k)}
              className="field tabular-nums"
              inputMode="numeric"
              autoComplete="off"
              value={f.value}
              placeholder={f.min ? formatNumber(f.min) : ''}
              onChange={(e) => onChange({ [f.field]: e.target.value.replace(/[^\d.,rbkjtRBKJT ]/g, '') })}
              onBlur={() => {
                const n = parseCount(f.value)
                if (n !== null) onChange({ [f.field]: formatNumber(n) })
              }}
              aria-describedby={id(`${f.k}-status`)}
            />
            <div id={id(`${f.k}-status`)} aria-live="polite">
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

      <div>
        <label htmlFor={id('sharein')} className="label">Link Sharein</label>
        <div className="relative">
          <input
            id={id('sharein')}
            className={`field pr-24 ${share && !share.ok ? '!border-bad !bg-red-50 !text-bad' : ''}`}
            inputMode="url"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            value={item.sharein}
            aria-invalid={Boolean(share && !share.ok)}
            onChange={(e) => onChange({ sharein: e.target.value })}
            placeholder={`https://${rules?.sharein_domains[0] ?? 'sharein.id'}/…`}
            aria-describedby={id('sharein-status')}
          />
          <button type="button" className="absolute right-1.5 top-1/2 min-h-[38px] -translate-y-1/2 rounded-[12px] bg-brand-purple/10 px-3 text-sm font-bold text-brand-purple hover:bg-brand-purple/20" onClick={() => pasteInto((v) => onChange({ sharein: v }))}>
            Tempel
          </button>
        </div>
        <div id={id('sharein-status')} aria-live="polite">
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

      {result && (
        failed.length === 0 ? (
          <p className="flex items-center gap-2 rounded-field bg-green-50 px-3 py-2 text-sm font-bold text-green-900">
            <CheckIcon /> Lolos semua cek{typeof qty?.remaining === 'number' ? ` · sisa kuota ${qty.remaining}` : ''}
          </p>
        ) : (
          <ul className="space-y-1 rounded-field bg-red-50 px-3 py-2 text-sm text-bad">
            {shown.map((c) => (
              <li key={c.id} className="flex items-start gap-2">
                <span className="mt-0.5"><CrossIcon /></span>
                <span>{c.message}</span>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  )
}

export function SetorForm() {
  const [rules, setRules] = useState<Rules | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [name, setName] = useState('')
  const [wa, setWa] = useState('')
  const me = useMe()
  const [items, setItems] = useState<Item[]>([FIRST_ITEM])
  const [organic, setOrganic] = useState(false)
  const [checked, setChecked] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [results, setResults] = useState<ItemResult[] | null>(null)
  const [checkedKey, setCheckedKey] = useState('')
  const [busy, setBusy] = useState<'check' | 'send' | null>(null)
  const [formError, setFormError] = useState('')
  const [done, setDone] = useState<{ saved: number; total: number; token: string; auto: boolean; failed: string[] } | null>(null)
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

  const formKey = useMemo(
    () => JSON.stringify([name.trim(), wa.trim(), items.map((i) => [i.url.trim(), parseCount(i.likes), parseCount(i.comments), i.sharein.trim()]), organic, checked, file?.name ?? '', file?.size ?? 0]),
    [name, wa, items, organic, checked, file],
  )
  const fresh = results !== null && checkedKey === formKey
  const anyRedLink = items.some((i) => linkState(i.url).state === 'bad')
  const canSend = fresh && !anyRedLink && results.every((r) => r.ok)
  const globalFails = results ? Array.from(new Map(results.flatMap((r) => r.checks).filter((c) => !c.pass && GLOBAL_CHECKS.includes(c.id)).map((c) => [c.id, c])).values()) : []

  const update = (key: number, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)))

  function addItem() {
    const it = blankItem()
    setItems((xs) => (xs.length >= MAX_ITEMS ? xs : [...xs, it]))
    requestAnimationFrame(() => document.getElementById(`link-${it.key}`)?.focus())
  }

  function payload() {
    return {
      submitter_name: name,
      whatsapp: wa,
      organic_declared: organic,
      checked_declared: checked,
      has_screenshot: Boolean(file),
      items: items.map((i) => {
        const likes = parseCount(i.likes)
        const comments = parseCount(i.comments)
        return {
          platform: detectPlatform(i.url) ?? 'tiktok',
          source_url: i.url,
          sharein_url: i.sharein,
          likes,
          comments,
          metrics_source: i.api && i.api.likes === likes && i.api.comments === comments ? 'api' : 'manual',
          api_likes: i.api?.likes ?? null,
          api_comments: i.api?.comments ?? null,
        }
      }),
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
      const res = await fetch('/api/submissions/batch/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload()) })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error ?? 'Cek gagal. Coba lagi.')
        setResults(null)
        return
      }
      setResults(data.items)
      setCheckedKey(formKey)
      if (!data.ok) setFormError('Ada yang belum lolos. Perbaiki bagian yang merah lalu cek lagi.')
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
      const res = await fetch('/api/submissions/batch', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.ok) {
        localStorage.setItem(NAME_KEY, name.trim())
        toast('Terkirim')
        const failed = (data.results as { ok: boolean; checks?: Check[] }[]).flatMap((r, i) => (r.ok ? [] : [`Konten ${i + 1}: ${r.checks?.[0]?.message ?? 'gagal disimpan'}`]))
        setDone({ saved: data.saved, total: items.length, token: data.token ?? '', auto: data.status === 'approved', failed })
        window.scrollTo({ top: 0 })
        return
      }
      if (data.items) {
        setResults(data.items)
        setCheckedKey(formKey)
      }
      setFormError(data.error ?? 'Setoran belum bisa dikirim. Perbaiki poin yang merah lalu cek lagi.')
    } catch {
      setFormError('Tidak terhubung ke server. Periksa internet lalu coba lagi.')
    } finally {
      setBusy(null)
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
    setItems([blankItem()])
    setOrganic(false)
    setChecked(false)
    setFile(null)
    setResults(null)
    setCheckedKey('')
    setDone(null)
    fetch('/api/rules').then((r) => r.json()).then(setRules).catch(() => {})
  }

  if (done) {
    return (
      <div className="panel-solid text-center" role="status">
        <div className="bounce-once mx-auto mt-2 w-fit">
          <GiftSolid className="h-24 w-24" />
        </div>
        <h2 className="mt-4 text-2xl font-extrabold">{done.saved === 1 ? 'Setoran terkirim' : `${done.saved} setoran terkirim`}</h2>
        <p className="muted mx-auto mt-2 max-w-sm">{done.auto ? 'Setoranmu sudah disetujui otomatis.' : 'Admin akan memeriksa dalam 1×24 jam. Status disetujui/ditolak langsung terlihat di halaman pantaumu.'} Makin banyak konten yang kamu submit, makin besar peluang rewardmu.</p>
        {done.failed.length > 0 && (
          <ul className="mx-auto mt-3 max-w-sm rounded-field bg-red-50 p-3 text-left text-sm text-bad">
            {done.failed.map((f) => <li key={f}>{f}</li>)}
          </ul>
        )}
        {done.token && <PantauCard token={done.token} />}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button type="button" className="btn-primary" onClick={reset}>Setor lagi</button>
          {!done.token && <Link href="/pantau" className="btn-ghost">Pantau setoranku</Link>}
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
  const quota = (p: Platform) => rules?.progress.find((x) => x.platform === p)

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
        <p className="muted min-h-[1.25rem] text-sm">
          {rules ? `Sisa kuota: TikTok ${quota('tiktok')?.remaining ?? 0} · Reels ${quota('reels')?.remaining ?? 0}` : 'Memuat kuota…'}
        </p>
        <p className="rounded-field bg-brand-amber/20 px-3 py-2 text-sm font-bold">Makin banyak konten yang kamu submit, makin besar peluang rewardmu.</p>
      </section>

      {items.map((it, i) => (
        <ContentCard
          key={it.key}
          item={it}
          index={i}
          total={items.length}
          rules={rules}
          result={fresh ? results![i] : null}
          onChange={(p) => update(it.key, p)}
          onRemove={() => setItems((xs) => xs.filter((x) => x.key !== it.key))}
        />
      ))}

      <button type="button" className="btn-ghost w-full" onClick={addItem} disabled={items.length >= MAX_ITEMS}>
        {items.length >= MAX_ITEMS ? `Sudah maksimal ${MAX_ITEMS} konten` : `+ Tambah konten (${items.length}/${MAX_ITEMS})`}
      </button>

      <section className="panel-solid space-y-3" aria-labelledby="pernyataan">
        <PillLabel id="pernyataan">Pernyataan</PillLabel>
        {[
          { id: 'organik', v: organic, set: setOrganic, t: 'Konten ini muncul organik di FYP TikTok / Beranda Reels saya.' },
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
            {fileError ? <Status ok={false}>{fileError}</Status> : file ? <Status ok>{file.name}</Status> : <Status ok={null}>Satu gambar untuk semua konten di setoran ini. JPG/PNG/WebP, maksimal 2 MB.</Status>}
          </div>
        </div>
      </section>

      {fresh && globalFails.length > 0 && (
        <ul className="space-y-1 rounded-field bg-red-50 p-3 text-sm text-bad" role="alert">
          {globalFails.map((c) => <li key={c.id}>{c.message}</li>)}
        </ul>
      )}
      {results && !fresh && <p className="text-center text-sm font-bold text-amber-800">Ada perubahan setelah dicek. Tekan Cek setoran lagi.</p>}

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
          {busy === 'send' ? 'Mengirim…' : items.length > 1 ? `Kirim ${items.length} setoran` : 'Kirim setoran'}
        </button>
      </div>
      {!canSend && (
        <p id="kirim-hint" className="muted -mt-2 text-center text-xs">
          {anyRedLink ? 'Ada link yang merah. Perbaiki atau hapus dulu sebelum mengirim.' : 'Tombol Kirim setoran aktif setelah semua cek lolos.'}
        </p>
      )}
    </form>
  )
}
