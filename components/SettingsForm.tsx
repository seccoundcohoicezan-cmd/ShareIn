'use client'
import { useState } from 'react'
import { formatNumber, parseCount } from '@/lib/format'
import type { Settings } from '@/lib/types'
import { toast, Toaster } from './Toast'

type NumKey =
  | 'min_like_tiktok' | 'min_comment_tiktok' | 'min_like_reels' | 'min_comment_reels'
  | 'golden_pool_start' | 'golden_pool_end' | 'weekly_min_pelatihan' | 'weekly_min_duta'

// datetime-local works in the browser's zone; the program runs on WIB, so convert explicitly.
function toWibInput(iso: string) {
  const d = new Date(new Date(iso).getTime() + 7 * 3600_000)
  return d.toISOString().slice(0, 16)
}
function fromWibInput(v: string) {
  return new Date(`${v}:00+07:00`).toISOString()
}

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
    const keys: NumKey[] = ['min_like_tiktok', 'min_comment_tiktok', 'min_like_reels', 'min_comment_reels', 'golden_pool_start', 'golden_pool_end', 'weekly_min_pelatihan', 'weekly_min_duta']
    return Object.fromEntries(keys.map((k) => [k, formatNumber(initial[k])])) as Record<NumKey, string>
  })
  const [domains, setDomains] = useState(initial.sharein_domains.join(', '))
  const [goldenStart, setGoldenStart] = useState(toWibInput(initial.golden_start_at))
  const [goldenEnd, setGoldenEnd] = useState(toWibInput(initial.golden_end_at))
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
        body: JSON.stringify({
          ...s,
          ...parsed,
          sharein_domains: domains.split(/[,\s]+/).map((d) => d.trim()).filter(Boolean),
          golden_start_at: fromWibInput(goldenStart),
          golden_end_at: fromWibInput(goldenEnd),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setS(data.settings)
      setDomains(data.settings.sharein_domains.join(', '))
      setGoldenStart(toWibInput(data.settings.golden_start_at))
      setGoldenEnd(toWibInput(data.settings.golden_end_at))
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
        <h2 className="font-extrabold">Periode Golden Ticket</h2>
        <div>
          <label htmlFor="period_id" className="label">Periode aktif</label>
          <input id="period_id" className="field" value={s.period_id} maxLength={40} onChange={(e) => setS({ ...s, period_id: e.target.value })} />
          <p className="muted mt-1 text-sm">Contoh 2026-11-W1. Hanya label untuk mengelompokkan setoran.</p>
        </div>
        <Toggle id="period_open" label="Setoran dibuka" hint="Matikan untuk menutup form setoran." checked={s.period_open} onChange={(v) => setS({ ...s, period_open: v })} />
      </section>

      <section className="panel-solid space-y-4">
        <div>
          <h2 className="font-extrabold">Setujui otomatis</h2>
          <p className="muted text-sm">Bila aktif, setoran baru langsung berstatus Disetujui tanpa menunggu admin. Golden Ticket tetap harus lolos semua cek (like, komentar, duplikat, kuota). Setoran lama tidak berubah, dan admin tetap bisa menolak setelahnya.</p>
        </div>
        <Toggle id="auto_approve_golden" label="Golden Ticket" checked={s.auto_approve_golden} onChange={(v) => setS({ ...s, auto_approve_golden: v })} />
        <Toggle id="auto_approve_pelatihan" label="Pelatihan Content" checked={s.auto_approve_pelatihan} onChange={(v) => setS({ ...s, auto_approve_pelatihan: v })} />
        <Toggle id="auto_approve_duta" label="Duta Teladan" checked={s.auto_approve_duta} onChange={(v) => setS({ ...s, auto_approve_duta: v })} />
      </section>

      <section className="panel-solid">
        <h2 className="mb-1 font-extrabold">Hadiah berjalan Golden Ticket</h2>
        <p className="muted mb-4 text-sm">Angka di halaman Golden Ticket naik sedikit demi sedikit dari nilai awal ke nilai akhir di antara dua tanggal (WIB).</p>
        <div className="grid grid-cols-2 gap-3">
          {num('golden_pool_start', 'Hadiah awal (Rp)')}
          {num('golden_pool_end', 'Hadiah akhir (Rp)')}
          <div>
            <label htmlFor="golden_start_at" className="label">Mulai</label>
            <input id="golden_start_at" type="datetime-local" className="field" value={goldenStart} onChange={(e) => setGoldenStart(e.target.value)} />
          </div>
          <div>
            <label htmlFor="golden_end_at" className="label">Berakhir</label>
            <input id="golden_end_at" type="datetime-local" className="field" value={goldenEnd} onChange={(e) => setGoldenEnd(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="panel-solid space-y-4">
        <h2 className="font-extrabold">Pelatihan Content & Duta Teladan</h2>
        <Toggle id="pelatihan_open" label="Pengumpulan Pelatihan dibuka" checked={s.pelatihan_open} onChange={(v) => setS({ ...s, pelatihan_open: v })} />
        <Toggle id="duta_open" label="Pengumpulan Duta Teladan dibuka" checked={s.duta_open} onChange={(v) => setS({ ...s, duta_open: v })} />
        <div>
          <p className="font-bold">Minimal link per orang setiap minggu</p>
          <p className="muted mb-3 text-sm">Kewajiban mingguan (Senin–Minggu WIB). Isi 0 bila tidak ada target. Peserta melihat progresnya, admin melihat siapa yang belum di Rekap mingguan.</p>
          <div className="grid grid-cols-2 gap-3">
            {num('weekly_min_pelatihan', 'Pelatihan Content')}
            {num('weekly_min_duta', 'Duta Teladan')}
          </div>
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
