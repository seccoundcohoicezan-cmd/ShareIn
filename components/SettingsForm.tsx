'use client'
import { useState } from 'react'
import { formatNumber, parseCount } from '@/lib/format'
import type { Settings } from '@/lib/types'
import { toast, Toaster } from './Toast'

type NumKey = 'qty_tiktok' | 'qty_reels' | 'min_like_tiktok' | 'min_comment_tiktok' | 'min_like_reels' | 'min_comment_reels'

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <label htmlFor={id} className="font-bold">{label}</label>
        {hint && <p className="muted text-sm">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand-purple' : 'bg-gray-300'}`}
      >
        <span className={`absolute left-0 top-1 h-6 w-6 rounded-full bg-white transition-transform ${checked ? 'translate-x-7' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

export function SettingsForm({ initial }: { initial: Settings }) {
  const [s, setS] = useState(initial)
  const [nums, setNums] = useState<Record<NumKey, string>>(() => {
    const keys: NumKey[] = ['qty_tiktok', 'qty_reels', 'min_like_tiktok', 'min_comment_tiktok', 'min_like_reels', 'min_comment_reels']
    return Object.fromEntries(keys.map((k) => [k, formatNumber(initial[k])])) as Record<NumKey, string>
  })
  const [domains, setDomains] = useState(initial.sharein_domains.join(', '))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const num = (k: NumKey, label: string) => (
    <div>
      <label htmlFor={k} className="label">{label}</label>
      <input
        id={k}
        className="field tabular-nums"
        inputMode="numeric"
        value={nums[k]}
        onChange={(e) => setNums((n) => ({ ...n, [k]: e.target.value }))}
        onBlur={() => {
          const v = parseCount(nums[k])
          if (v !== null) setNums((n) => ({ ...n, [k]: formatNumber(v) }))
        }}
      />
    </div>
  )

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const parsed: Partial<Record<NumKey, number>> = {}
    for (const [k, v] of Object.entries(nums) as [NumKey, string][]) {
      const n = parseCount(v)
      if (n === null) {
        setError('Isi semua angka dengan benar, contoh 100000.')
        document.getElementById(k)?.focus()
        return
      }
      parsed[k] = n
    }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...s, ...parsed, sharein_domains: domains.split(/[,\s]+/).map((d) => d.trim()).filter(Boolean) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setS(data.settings)
      setDomains(data.settings.sharein_domains.join(', '))
      toast('Tersimpan')
    } catch (err) {
      setError((err as Error).message || 'Gagal menyimpan. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-4">
      <section className="panel-solid space-y-4">
        <h2 className="font-extrabold">Periode</h2>
        <div>
          <label htmlFor="period_id" className="label">Periode aktif</label>
          <input id="period_id" className="field" value={s.period_id} maxLength={40} onChange={(e) => setS({ ...s, period_id: e.target.value })} />
          <p className="muted mt-1 text-sm">Contoh 2026-11-W1. QTY dihitung per periode; ganti nama periode untuk mulai hitungan baru.</p>
        </div>
        <Toggle id="period_open" label="Setoran dibuka" hint="Matikan untuk menutup form setoran." checked={s.period_open} onChange={(v) => setS({ ...s, period_open: v })} />
      </section>

      <section className="panel-solid">
        <h2 className="mb-4 font-extrabold">Target QTY</h2>
        <div className="grid grid-cols-2 gap-3">
          {num('qty_tiktok', 'QTY TikTok')}
          {num('qty_reels', 'QTY Reels')}
        </div>
      </section>

      <section className="panel-solid">
        <h2 className="mb-4 font-extrabold">Batas minimal</h2>
        <div className="grid grid-cols-2 gap-3">
          {num('min_like_tiktok', 'Like TikTok')}
          {num('min_comment_tiktok', 'Komentar TikTok')}
          {num('min_like_reels', 'Like Reels')}
          {num('min_comment_reels', 'Komentar Reels')}
        </div>
      </section>

      <section className="panel-solid space-y-4">
        <h2 className="font-extrabold">Validasi</h2>
        <div>
          <label htmlFor="domains" className="label">Domain Sharein yang valid</label>
          <input id="domains" className="field" value={domains} onChange={(e) => setDomains(e.target.value)} placeholder="sharein.id, sharein.app" />
          <p className="muted mt-1 text-sm">Pisahkan dengan koma. Subdomain ikut diterima.</p>
        </div>
        <Toggle id="require_screenshot" label="Wajib tangkapan layar" hint="Penyetor harus melampirkan bukti FYP/Beranda." checked={s.require_screenshot} onChange={(v) => setS({ ...s, require_screenshot: v })} />
        <fieldset>
          <legend className="label">Adapter metrik otomatis</legend>
          <div className="grid grid-cols-3 gap-1 rounded-field bg-brand-lavender p-1">
            {(['off', 'rapidapi', 'apify'] as const).map((m) => (
              <label key={m} className={`flex min-h-[44px] cursor-pointer items-center justify-center rounded-[12px] text-sm font-bold ${s.metrics_adapter === m ? 'bg-brand-purple text-white' : 'text-brand-purple'}`}>
                <input type="radio" name="adapter" className="sr-only" checked={s.metrics_adapter === m} onChange={() => setS({ ...s, metrics_adapter: m })} />
                {m === 'off' ? 'Mati' : m === 'rapidapi' ? 'RapidAPI' : 'Apify'}
              </label>
            ))}
          </div>
          <p className="muted mt-1 text-sm">Kunci API disimpan di environment server, bukan di sheet. Bila adapter gagal, penyetor tetap isi manual.</p>
        </fieldset>
      </section>

      {error && <p role="alert" className="rounded-field bg-red-50 p-3 text-sm font-bold text-bad">{error}</p>}
      <button className="btn-primary w-full sm:w-auto" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan perubahan'}</button>
      <Toaster />
    </form>
  )
}
