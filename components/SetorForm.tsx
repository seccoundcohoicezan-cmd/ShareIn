'use client'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatNumber, parseCount } from '@/lib/format'
import type { Channel, Check, CheckId, Platform, Program } from '@/lib/types'
import { CHANNEL_INFO, PLATFORM_LABEL } from '@/lib/types'
import { detectPlatform, LINK_RULE_MESSAGE, parseSourceUrl } from '@/lib/url'
import { CheckIcon, CrossIcon, GiftSolid } from './icons'
import { getJson } from '@/lib/get-json'
import { PantauCard } from './PantauCard'
import { TargetBars, targetLeft } from './TargetBars'
import type { Progress } from '@/lib/progress'
import { toast } from './Toast'
import { localWa, useMe, type Me } from './useMe'
import { PillLabel } from './ui'

interface Rules {
  period_id: string
  period_open: boolean
  require_screenshot: boolean
  metrics_adapter: 'off' | 'rapidapi' | 'apify'
  sharein_domains: string[]
  rules: Record<Platform, { min_like: number; min_comment: number }>
  programs: Record<Program, { open: boolean; target: { tiktok: number; reels: number } }>
  sso: boolean
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

const maskWa = (wa: string) => (wa.length > 7 ? `${wa.slice(0, 4)}••••${wa.slice(-3)}` : wa)

const PRO_KONTRA = [
  'Bumi itu bulat atau datar?',
  'Bubur ayam diaduk atau tidak diaduk?',
  'Tim kopi atau tim teh?',
  'Nasi + mi instan: wajar atau aneh?',
  'Kuliah penting atau skill lebih penting?',
  'Menikah muda atau mapan dulu?',
  'Kerja kantoran atau freelance / WFH?',
  'Anak kecil boleh pegang HP atau tidak?',
  'Hidup di kota atau di desa?',
  'AI bakal menggantikan pekerjaan manusia?',
  'Kejar passion atau kejar gaji?',
  'Durian: enak atau bau?',
]

/** Guide to the content the campaign looks for: topics that split opinions. */
function ProKontra() {
  return (
    <div className="rounded-field border border-brand-orange/30 bg-brand-amber/10 p-4 text-sm">
      <p className="font-extrabold">Cari konten yang memicu pro &amp; kontra</p>
      <p className="mt-1">Konten yang bikin penonton terbelah dan ramai berdebat di kolom komentar. Contoh topiknya:</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {PRO_KONTRA.map((t) => (
          <li key={t} className="rounded-full bg-white px-3 py-1 font-bold">{t}</li>
        ))}
      </ul>
      <p className="muted mt-2 text-xs">Hindari konten SARA, ujaran kebencian, hoaks yang membahayakan, atau konten dewasa. Konten seperti itu akan ditolak.</p>
    </div>
  )
}
// Reported once for the whole form rather than on every content card.
const GLOBAL_CHECKS: CheckId[] = ['period_open', 'identity', 'organic']

type Item = { key: number; url: string }
type ItemResult = { ok: boolean; checks: Check[] }

let nextKey = 1
const blankItem = (): Item => ({ key: nextKey++, url: '' })
// Fixed key: the first card is server-rendered, so its field ids must match on hydration.
const FIRST_ITEM: Item = { key: 0, url: '' }

function linkState(url: string) {
  if (!url.trim()) return { state: 'empty' as const }
  const parsed = parseSourceUrl(url)
  if (typeof parsed === 'string') return { state: 'bad' as const, message: parsed === 'not_https' ? 'Link harus diawali https://.' : LINK_RULE_MESSAGE }
  return { state: parsed.short ? ('short' as const) : ('ok' as const), parsed }
}

function ContentCard({
  item, index, total, result, onChange, onRemove,
}: {
  item: Item
  index: number
  total: number
  result: ItemResult | null
  onChange: (patch: Partial<Item>) => void
  onRemove: () => void
}) {
  const link = linkState(item.url)
  const id = (n: string) => `${n}-${item.key}`
  const failed = result?.checks.filter((c) => !c.pass && !GLOBAL_CHECKS.includes(c.id)) ?? []
  // A wrong link also fails the duplicate check; one message is enough.
  const shown = failed.some((c) => c.id === 'url_valid') ? failed.filter((c) => c.id !== 'not_duplicate') : failed

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
          {/* The hint is shown once, on the first card, not repeated on every card. */}
          {link.state === 'empty' && index === 0 && (
            <>
              <Status ok={null}>Wajib dari tiktok.com atau instagram.com/reel/.</Status>
              <a href="/#panduan" className="inline-flex min-h-[44px] items-center text-sm font-bold text-brand-purple underline underline-offset-2">Lihat panduan bergambar</a>
            </>
          )}
          {link.state === 'bad' && <Status ok={false}>{link.message}</Status>}
          {link.state === 'short' && <Status ok={null}>Link pendek {PLATFORM_LABEL[link.parsed.platform]} terdeteksi. Server akan membukanya saat kamu menekan Kirim.</Status>}
          {link.state === 'ok' && <Status ok>Link valid · {PLATFORM_LABEL[link.parsed.platform]}</Status>}
        </div>
        {(link.state === 'ok' || link.state === 'short') && (
          <a href={link.parsed.url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-[44px] items-center text-sm font-bold text-brand-purple underline underline-offset-4">
            Buka link untuk cek angka
          </a>
        )}
      </div>

      {result && (
        failed.length === 0 ? (
          <p className="flex items-center gap-2 rounded-field bg-green-50 px-3 py-2 text-sm font-bold text-green-900">
            <CheckIcon /> Lolos semua cek
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

/**
 * Live count while pasting, before anything is sent: what already counts plus the valid links in the
 * form, per platform. Pasted chips are striped until sent.
 */
function LiveTally({ target, base, inForm, mode }: { target: { tiktok: number; reels: number }; base: Progress | null; inForm: { tiktok: number; reels: number }; mode: 'draw' | 'weekly' }) {
  const rows = [
    { k: 'TikTok', done: base?.tiktok ?? 0, add: inForm.tiktok, of: target.tiktok },
    { k: 'Instagram', done: base?.reels ?? 0, add: inForm.reels, of: target.reels },
  ]
  const total = rows.every((r) => r.done + r.add >= r.of)
  return (
    <div className="mb-2 px-1" aria-live="polite">
      <div className="grid grid-cols-2 gap-3">
        {rows.map((r) => {
          const sum = r.done + r.add
          return (
            <div key={r.k}>
              <p className="flex items-baseline justify-between text-xs font-bold">
                <span>{r.k}</span>
                <span className={`tabular-nums ${sum >= r.of ? 'text-ok' : ''}`}>
                  {Math.min(sum, r.of)}/{r.of}
                  {r.add > 0 && <span className="ml-1 text-brand-purple">(+{r.add})</span>}
                </span>
              </p>
              <div className="mt-1 flex gap-0.5" role="progressbar" aria-label={`Hitungan ${r.k} di form`} aria-valuemin={0} aria-valuemax={r.of} aria-valuenow={Math.min(sum, r.of)}>
                {Array.from({ length: r.of }, (_, i) => (
                  <span
                    key={i}
                    className={`h-2 flex-1 rounded-full ${i < r.done ? 'bg-brand-purple' : i < sum ? 'bg-[repeating-linear-gradient(45deg,#a855f7_0_3px,#e9d5ff_3px_6px)]' : 'bg-brand-purple/10'}`}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <p className="mt-1 text-center text-[11px] font-bold">
        {total ? (mode === 'draw' ? 'Lengkap! Kirim untuk masuk undian.' : 'Target minggu ini terpenuhi setelah dikirim.') : 'Bergaris = link di form ini, terhitung setelah dikirim.'}
      </p>
    </div>
  )
}

export function SetorForm({ program = 'golden' }: { program?: Channel }) {
  const golden = program === 'golden'
  const [rules, setRules] = useState<Rules | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [name, setName] = useState('')
  const [wa, setWa] = useState('')
  const [me, setMe] = useState<Me | null | undefined>(undefined)
  const loaded = useMe()
  useEffect(() => setMe(loaded), [loaded])
  const [pantauLink, setPantauLink] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState('')

  async function loginWithLink() {
    setLoginError('')
    setLoggingIn(true)
    try {
      const res = await fetch('/api/me/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ link: pantauLink }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMe(data.user)
      toast(`Halo, ${data.user.name}`)
    } catch (e) {
      setLoginError((e as Error).message || 'Link pantau tidak dikenali.')
    } finally {
      setLoggingIn(false)
    }
  }

  async function logout() {
    await fetch('/api/me/logout', { method: 'POST' })
    setMe(null)
    setName('')
    setWa('')
  }
  const [items, setItems] = useState<Item[]>([FIRST_ITEM])
  const [organic, setOrganic] = useState(false)
  const [checked, setChecked] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [results, setResults] = useState<ItemResult[] | null>(null)
  const [checkedKey, setCheckedKey] = useState('')
  const [busy, setBusy] = useState<'send' | null>(null)
  const [formError, setFormError] = useState('')
  const [done, setDone] = useState<{ saved: number; total: number; token: string; auto: boolean; failed: string[] } | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (me) {
      setName(me.name)
      setWa(localWa(me.whatsapp))
    }
  }, [me])

  // What already counts toward the target, so the live tally below can add the pasted links to it.
  const [base, setBase] = useState<Progress | null>(null)
  const [round, setRound] = useState(0)
  useEffect(() => {
    if (golden || !me) return setBase(null)
    getJson<{ progress: Progress | null }>(`/api/me?program=${program}`)
      .then((d) => setBase(d.progress ?? null))
      .catch(() => setBase(null))
  }, [me, golden, program, round])

  useEffect(() => {
    setName(localStorage.getItem(NAME_KEY) ?? '')
    getJson<Rules>('/api/rules')
      .then(setRules)
      .catch(() => setLoadError(true))
  }, [])

  const formKey = useMemo(
    () => JSON.stringify([name.trim(), wa.trim(), items.map((i) => i.url.trim()), organic, checked, file?.name ?? '', file?.size ?? 0]),
    [name, wa, items, organic, checked, file],
  )
  const fresh = results !== null && checkedKey === formKey
  const anyRedLink = items.some((i) => linkState(i.url).state === 'bad')
  // Valid links in the form right now, per platform (the same link pasted twice counts once).
  const inForm = useMemo(() => {
    const seen = new Map<string, Platform>()
    for (const i of items) {
      const l = linkState(i.url)
      if (l.state === 'ok' || l.state === 'short') seen.set(l.parsed.url, l.parsed.platform)
    }
    const all = Array.from(seen.values())
    return { tiktok: all.filter((p) => p === 'tiktok').length, reels: all.filter((p) => p === 'reels').length }
  }, [items])
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
      program,
      items: items.map((i) => ({
        platform: detectPlatform(i.url) ?? 'tiktok',
        source_url: i.url,
        sharein_url: '',
        likes: null,
        comments: null,
        metrics_source: 'manual',
      })),
    }
  }

  // One step: the server checks everything and saves only when every item passes.
  async function send() {
    setFormError('')
    if (anyRedLink) {
      setFormError('Ada link yang merah. Perbaiki atau hapus dulu sebelum mengirim.')
      return
    }
    if (items.every((i) => !i.url.trim())) {
      setFormError('Tempel minimal satu link konten.')
      document.getElementById(`link-${items[0].key}`)?.focus()
      return
    }
    if (!me && name.trim().length < 2) {
      setFormError('Isi nama penyetor minimal 2 huruf, atau tempel link pantaumu bila sudah pernah setor.')
      document.getElementById('nama')?.focus()
      return
    }
    if (!me && wa.replace(/\D/g, '').length < 9) {
      setFormError('Isi nomor WhatsApp aktif, contoh 081234567890.')
      document.getElementById('wa')?.focus()
      return
    }
    if (!organic || !checked) {
      setFormError('Centang kedua pernyataan di bagian Pernyataan dulu.')
      document.getElementById(organic ? 'sudah-cek' : 'organik')?.focus()
      return
    }
    setBusy('send')
    try {
      const fd = new FormData()
      fd.set('data', JSON.stringify(payload()))
      if (file) fd.set('screenshot', file)
      const res = await fetch('/api/submissions/batch', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok && data.ok) {
        localStorage.setItem(NAME_KEY, name.trim())
        // A first-time sender now has an account (cookie): pick it up so "Setor lagi" needs no typing.
        if (!me) fetch('/api/me', { cache: 'no-store' }).then((r) => r.json()).then((d) => d.user && setMe(d.user)).catch(() => {})
        toast('Terkirim')
        const failed = (data.results as { ok: boolean; checks?: Check[] }[]).flatMap((r, i) => (r.ok ? [] : [`Konten ${i + 1}: ${r.checks?.[0]?.message ?? 'gagal disimpan'}`]))
        setDone({ saved: data.saved, total: items.length, token: data.token ?? '', auto: data.status === 'approved', failed })
        if (!golden) {
          getJson<{ progress: Progress | null }>(`/api/me?program=${program}`)
            .then((d) => setProgress(d.progress ?? null))
            .catch(() => {})
        }
        window.scrollTo({ top: 0 })
        return
      }
      if (data.items) {
        setResults(data.items)
        setCheckedKey(formKey)
      }
      setFormError(data.error ?? 'Setoran belum bisa dikirim. Perbaiki bagian yang merah lalu tekan Kirim lagi.')
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
    setProgress(null)
    setRound((n) => n + 1)
    getJson<Rules>('/api/rules').then(setRules).catch(() => {})
  }

  if (done) {
    return (
      <div className="panel-solid text-center" role="status">
        <div className="bounce-once mx-auto mt-2 w-fit">
          <GiftSolid className="h-24 w-24" />
        </div>
        <h2 className="mt-4 text-2xl font-extrabold">{done.saved === 1 ? 'Setoran terkirim' : `${done.saved} setoran terkirim`}</h2>
        <p className="muted mx-auto mt-2 max-w-sm">{done.auto ? 'Setoranmu sudah disetujui otomatis.' : 'Admin akan memeriksa dalam 1×24 jam. Status disetujui/ditolak langsung terlihat di halaman pantaumu.'}{golden && ' Makin banyak konten yang kamu submit, makin besar peluang rewardmu.'}</p>
        {progress && (
          <div className={`mx-auto mt-4 max-w-sm rounded-field p-4 text-left ${progress.met ? 'bg-green-50 text-green-900' : 'bg-brand-lavender'}`}>
            <p className="mb-2 text-sm font-bold">{progress.mode === 'draw' ? 'Progres undian' : 'Progres minggu ini'}</p>
            <TargetBars tiktok={progress.tiktok} reels={progress.reels} target={progress.target} />
            <p className="mt-2 text-sm font-bold">
              {progress.met ? (progress.mode === 'draw' ? 'Kamu sudah masuk undian spin wheel.' : 'Target minggu ini tercapai.') : targetLeft(progress)}
            </p>
            {progress.mode === 'draw' && progress.pending > 0 && <p className="muted text-xs">Link dihitung setelah disetujui admin ({progress.pending} menunggu).</p>}
          </div>
        )}
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

  const closed = rules && !(golden ? rules.period_open : rules.programs?.[program]?.open)
  const target = !golden && rules ? rules.programs?.[program]?.target ?? null : null

  return (
    <form
      className="space-y-5"
      noValidate
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
    >
      {closed && (
        <div role="alert" className="rounded-panel border border-warn/40 bg-amber-50 p-4 font-bold">
          Setoran {CHANNEL_INFO[program].label} sedang ditutup. Pantau halamannya untuk info berikutnya.
        </div>
      )}

      <section className="panel-solid space-y-5" aria-labelledby="data-diri">
        <PillLabel id="data-diri">Penyetor</PillLabel>
        {me ? (
          <div className="rounded-field bg-green-50 p-3 text-sm text-green-900">
            <p className="font-bold">Masuk sebagai {me.name} · {maskWa(me.whatsapp)}</p>
            <p className="mt-1">Nama dan WhatsApp tidak perlu diisi lagi.</p>
            <div className="mt-2 flex flex-wrap gap-x-4">
              <a href={`/pantau/${me.token}`} className="inline-flex min-h-[44px] items-center font-bold underline">Lihat halaman pantau</a>
              <button type="button" className="inline-flex min-h-[44px] items-center font-bold underline" onClick={logout}>Bukan saya</button>
            </div>
          </div>
        ) : (
          <>
            {program === 'duta' && rules?.sso && (
              <>
                <a href="/auth/sso/login?next=/dutateladan/setor" className="btn-primary w-full">Masuk dengan MyTopstar</a>
                <p className="muted -mt-3 text-center text-xs">Duta yang punya akun MyTopstar langsung masuk tanpa isi data.</p>
              </>
            )}
            <div className="rounded-field border border-brand-purple/20 bg-brand-lavender/60 p-3">
              <label htmlFor="link-pantau" className="label">Sudah pernah setor? Tempel link pantaumu</label>
              <div className="flex gap-2">
                <input id="link-pantau" className="field" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="https://…/pantau/ABCD-EFGH-JKLM" value={pantauLink} onChange={(e) => setPantauLink(e.target.value)} />
                <button type="button" className="btn-primary shrink-0" disabled={loggingIn || !pantauLink.trim()} onClick={loginWithLink}>{loggingIn ? 'Masuk…' : 'Masuk'}</button>
              </div>
              {loginError ? <p role="alert" className="mt-1.5 text-sm font-bold text-bad">{loginError}</p> : <p className="muted mt-1.5 text-xs">Tidak perlu isi nama dan WhatsApp lagi.</p>}
            </div>
            <p className="muted text-center text-xs font-bold">atau, kalau baru pertama kali</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="nama" className="label">Nama penyetor</label>
                <input id="nama" className="field" autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama lengkap" />
              </div>
              <div>
                <label htmlFor="wa" className="label">Nomor WhatsApp</label>
                <input id="wa" className="field" inputMode="tel" autoComplete="tel" maxLength={20} value={wa} onChange={(e) => setWa(e.target.value)} placeholder="081234567890" />
                <p className="muted mt-1.5 text-xs">1 nomor = 1 akun. Kamu akan dapat link pantau unik.</p>
              </div>
            </div>
          </>
        )}
        {golden ? (
          <p className="rounded-field bg-brand-amber/20 px-3 py-2 text-sm font-bold">Makin banyak konten yang kamu submit, makin besar peluang rewardmu.</p>
        ) : target ? (
          <p className="rounded-field bg-brand-lavender px-3 py-2 text-sm font-bold">
            {program === 'pelatihan'
              ? `Kumpulkan ${target.tiktok} link TikTok & ${target.reels} link Instagram Reels dan ikuti undian berhadiah.`
              : `Kewajiban: ${target.tiktok} konten TikTok & ${target.reels} konten Instagram Reels setiap minggu (Senin–Minggu).`}
          </p>
        ) : null}
      </section>

      <section className="panel-solid space-y-3" aria-labelledby="syarat">
        <PillLabel id="syarat">Syarat konten</PillLabel>
        <div className="rounded-field border border-brand-purple/20 bg-brand-lavender/60 p-3 text-sm">
          <p className="font-extrabold">Harus muncul organik di FYP / Beranda Reels</p>
          <p className="mt-0.5">Setor konten yang muncul sendiri saat kamu menggulir FYP TikTok atau Beranda/Reels Instagram. <b>Bukan</b> hasil cari manual (kolom pencarian, hashtag, atau buka profil akun).</p>
        </div>
        <p className="text-sm">Cukup tempel link-nya. Sebelum menyetor, buka kontennya dan pastikan angkanya sudah memenuhi:</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          {(['tiktok', 'reels'] as Platform[]).map((p) => (
            <div key={p} className="rounded-field bg-brand-lavender p-3">
              <p className="font-extrabold">{p === 'tiktok' ? 'TikTok' : 'Instagram Reels'}</p>
              <p className="tabular-nums">Like min. <b>{rules ? formatNumber(rules.rules[p].min_like) : '…'}</b></p>
              <p className="tabular-nums">Komentar min. <b>{rules ? formatNumber(rules.rules[p].min_comment) : '…'}</b></p>
            </div>
          ))}
        </div>
        {golden && <ProKontra />}
      </section>

      {items.map((it, i) => (
        <ContentCard
          key={it.key}
          item={it}
          index={i}
          total={items.length}
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
          { id: 'sudah-cek', v: checked, set: setChecked, t: 'Saya sudah membuka link dan kontennya memenuhi minimal like & komentar.' },
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

      {formError && (
        <p role="alert" className="rounded-field bg-red-50 p-3 text-sm font-bold text-bad">
          {formError}
        </p>
      )}

      <div className="sticky bottom-3 z-10 rounded-panel border border-brand-purple/10 bg-white/90 p-2 backdrop-blur">
        {target && <LiveTally target={target} base={base} inForm={inForm} mode={program === 'pelatihan' ? 'draw' : 'weekly'} />}
        <button type="button" className="btn-primary w-full" onClick={send} disabled={busy !== null || !rules || Boolean(closed) || anyRedLink} aria-describedby="kirim-hint">
          {busy === 'send' ? 'Memeriksa & mengirim…' : items.length > 1 ? `Kirim ${items.length} setoran` : 'Kirim setoran'}
        </button>
      </div>
      <p id="kirim-hint" className={`-mt-2 text-center text-xs ${anyRedLink ? 'font-bold text-bad' : 'muted'}`}>
        {anyRedLink ? 'Ada link yang merah. Perbaiki atau hapus dulu sebelum mengirim.' : 'Link akan dicek otomatis saat dikirim.'}
      </p>
    </form>
  )
}
