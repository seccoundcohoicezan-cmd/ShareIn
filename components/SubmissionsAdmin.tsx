'use client'
import { useCallback, useEffect, useState } from 'react'
import { countOrDash, formatDateTime, formatNumber, metricsText } from '@/lib/format'
import { CHANNEL_INFO, type Channel, type Submission } from '@/lib/types'
import { DecisionButtons } from './DecisionButtons'
import { ExternalIcon } from './icons'
import { PreviewPanel } from './PreviewPanel'
import { toast, Toaster } from './Toast'
import { EmptyState, PlatformTag, StatusBadge } from './ui'

const QUICK_REASONS = ['Angka tidak sesuai', 'Bukan dari FYP', 'Duplikat', 'Link ShareIn tidak valid']

type Filters = { status: string; platform: string; period: string; name: string }

function query(f: Filters, program?: Channel) {
  const p = new URLSearchParams()
  if (program && program !== 'golden') p.set('program', program)
  Object.entries(f).forEach(([k, v]) => v && v !== 'all' && p.set(k, v))
  return p.toString()
}

function RejectDialog({ target, onClose, onDone }: { target: Submission; onClose: () => void; onDone: (s: Submission) => void }) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="tolak-judul" onKeyDown={(e) => e.key === 'Escape' && onClose()}>
      <div className="w-full max-w-md rounded-panel bg-white p-5">
        <h2 id="tolak-judul" className="text-lg font-extrabold">Tolak setoran {target.submitter_name}</h2>
        <p className="muted mt-1 text-sm">Alasan wajib diisi dan terlihat oleh penyetor.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {QUICK_REASONS.map((r) => (
            <button key={r} type="button" onClick={() => setReason(r)} className={`min-h-[40px] rounded-full border px-3 text-sm font-bold ${reason === r ? 'border-bad bg-red-50 text-bad' : 'border-brand-purple/20 text-ink'}`}>
              {r}
            </button>
          ))}
        </div>
        <label htmlFor="alasan" className="label mt-4">Alasan</label>
        <textarea id="alasan" autoFocus rows={2} maxLength={200} className="field py-3" value={reason} onChange={(e) => setReason(e.target.value)} />
        {error && <p role="alert" className="mt-2 text-sm font-bold text-bad">{error}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Batal</button>
          <button
            type="button"
            className="btn bg-bad text-white"
            disabled={busy || reason.trim().length < 3}
            onClick={async () => {
              setBusy(true)
              const res = await fetch(`/api/admin/submissions/${target.id}`, {
                method: 'PATCH',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action: 'reject', reason }),
              })
              const data = await res.json()
              setBusy(false)
              if (!res.ok) return setError(data.error ?? 'Gagal menolak.')
              onDone(data.item)
            }}
          >
            Tolak setoran
          </button>
        </div>
      </div>
    </div>
  )
}

export function SubmissionsAdmin({ program = 'golden' }: { program?: Channel }) {
  const [filters, setFilters] = useState<Filters>({ status: 'pending', platform: 'all', period: '', name: '' })
  const [items, setItems] = useState<Submission[] | null>(null)
  const [periods, setPeriods] = useState<string[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rejecting, setRejecting] = useState<Submission | null>(null)
  const [previewing, setPreviewing] = useState<Submission | null>(null)
  const [error, setError] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const p = new URLSearchParams(location.search)
    setFilters((f) => ({ status: p.get('status') ?? f.status, platform: p.get('platform') ?? 'all', period: p.get('period') ?? '', name: p.get('name') ?? '' }))
    setReady(true)
  }, [])

  const load = useCallback(async (f: Filters) => {
    setError('')
    try {
      const res = await fetch(`/api/admin/submissions?${query(f, program)}`)
      if (res.status === 401) return location.assign('/admin/login')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setItems(data.items)
      setPeriods(data.periods)
      setSelected(new Set())
    } catch (e) {
      setError((e as Error).message || 'Data belum termuat.')
    }
  }, [program])

  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => load(filters), filters.name ? 300 : 0)
    history.replaceState(null, '', `?${query(filters)}`)
    return () => clearTimeout(t)
  }, [filters, load, ready])

  function replace(s: Submission) {
    setItems((xs) => {
      if (!xs) return xs
      if (filters.status !== 'all' && s.status !== filters.status) return xs.filter((x) => x.id !== s.id)
      return xs.map((x) => (x.id === s.id ? s : x))
    })
  }

  async function act(s: Submission, action: 'approve' | 'reset') {
    const res = await fetch(`/api/admin/submissions/${s.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await res.json()
    if (!res.ok) return toast(data.error ?? 'Gagal.', 'bad')
    replace(data.item)
    setPreviewing((p) => (p && p.id === data.item.id ? data.item : p))
    toast(action === 'approve' ? 'Disetujui' : 'Dikembalikan ke menunggu')
  }

  async function bulkApprove() {
    const ids = Array.from(selected)
    const res = await fetch('/api/admin/submissions/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids, action: 'approve' }),
    })
    const data = await res.json()
    if (!res.ok) return toast(data.error ?? 'Gagal.', 'bad')
    toast(`${data.count} setoran disetujui`)
    load(filters)
  }

  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilters((f) => ({ ...f, [k]: e.target.value }))
  const pendingIds = (items ?? []).filter((s) => s.status === 'pending').map((s) => s.id)
  const allPicked = pendingIds.length > 0 && pendingIds.every((id) => selected.has(id))
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const undo = (s: Submission) =>
    s.status !== 'pending' && <button type="button" className="btn-ghost btn-sm" title="Kembalikan ke menunggu" onClick={() => act(s, 'reset')}>Batalkan</button>

  // Viewing tools on top, the decision row always last.
  const actions = (s: Submission) => (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary btn-sm" onClick={() => setPreviewing(s)}>Pratinjau & review</button>
        <a href={s.source_url} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">Buka link <ExternalIcon /></a>
        {s.screenshot_url && <a href={s.screenshot_url} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">Bukti</a>}
        {undo(s)}
      </div>
      <DecisionButtons size="sm" status={s.status} onApprove={() => act(s, 'approve')} onReject={() => setRejecting(s)} />
    </div>
  )

  return (
    <div>
      <div className="panel-solid !p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <div>
            <label htmlFor="f-status" className="label">Status</label>
            <select id="f-status" className="field" value={filters.status} onChange={set('status')}>
              <option value="all">Semua</option>
              <option value="pending">Menunggu</option>
              <option value="approved">Disetujui</option>
              <option value="rejected">Ditolak</option>
            </select>
          </div>
          <div>
            <label htmlFor="f-platform" className="label">Platform</label>
            <select id="f-platform" className="field" value={filters.platform} onChange={set('platform')}>
              <option value="all">Semua</option>
              <option value="tiktok">TikTok</option>
              <option value="reels">Reels</option>
            </select>
          </div>
          <div>
            <label htmlFor="f-period" className="label">Periode</label>
            <select id="f-period" className="field" value={filters.period} onChange={set('period')}>
              <option value="">Semua</option>
              {periods.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="f-name" className="label">Nama</label>
            <input id="f-name" className="field" value={filters.name} onChange={set('name')} placeholder="Cari nama" />
          </div>
          <div className="col-span-2 flex items-end gap-2 md:col-span-1">
            <a href={`/api/admin/export.csv?${query(filters, program)}`} className="btn-ghost w-full">Ekspor CSV</a>
          </div>
        </div>
      </div>

      {pendingIds.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-bold">
            <input type="checkbox" className="h-5 w-5 accent-[#6C2BD9]" checked={allPicked} onChange={() => setSelected(allPicked ? new Set() : new Set(pendingIds))} />
            Pilih semua yang menunggu
          </label>
          <button type="button" className="btn btn-sm bg-ok text-white" disabled={selected.size === 0} onClick={bulkApprove}>
            Setujui terpilih ({selected.size})
          </button>
        </div>
      )}

      {error && <p role="alert" className="mt-3 rounded-field bg-red-50 p-3 text-sm font-bold text-bad">{error}</p>}
      {items === null && !error && <div className="mt-3 space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-28 animate-pulse rounded-panel bg-white" />)}</div>}
      {items && items.length === 0 && <div className="mt-3"><EmptyState title="Tidak ada setoran untuk filter ini." /></div>}

      {items && items.length > 0 && (
        <>
          <ul className="mt-3 space-y-3 md:hidden">
            {items.map((s) => (
              <li key={s.id} className="panel-solid !p-4">
                <div className="flex items-start gap-3">
                  {s.status === 'pending' && <input type="checkbox" aria-label={`Pilih setoran ${s.submitter_name}`} className="mt-1 h-5 w-5 accent-[#6C2BD9]" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <PlatformTag platform={s.platform} />
                      <StatusBadge status={s.status} />
                      {s.needs_review && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">Selisih angka API</span>}
                    </div>
                    <p className="mt-2 font-extrabold">{s.submitter_name}</p>
                    <p className="text-sm tabular-nums">{metricsText(s.likes, s.comments)}</p>
                    <p className="muted text-xs">{formatDateTime(s.created_at)} · {s.period_id} · {s.metrics_source === 'api' ? 'angka API' : 'cek manual'}</p>
                    {s.reject_reason && <p className="mt-1 text-sm text-bad">Alasan: {s.reject_reason}</p>}
                  </div>
                </div>
                <div className="mt-3">{actions(s)}</div>
              </li>
            ))}
          </ul>
          <div className="panel-solid mt-3 hidden overflow-x-auto !p-0 md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-brand-lavender text-xs">
                <tr>
                  <th className="w-10 px-3 py-3"><span className="sr-only">Pilih</span></th>
                  <th className="px-3 py-3">Penyetor</th>
                  <th className="px-3 py-3">Platform</th>
                  <th className="px-3 py-3 text-right">Like</th>
                  <th className="px-3 py-3 text-right">Komentar</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="min-w-[17rem] px-3 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {items.map((s) => (
                  <tr key={s.id} className="border-t border-brand-purple/10 align-top">
                    <td className="px-3 py-3">
                      {s.status === 'pending' && <input type="checkbox" aria-label={`Pilih setoran ${s.submitter_name}`} className="h-5 w-5 accent-[#6C2BD9]" checked={selected.has(s.id)} onChange={() => toggle(s.id)} />}
                    </td>
                    <td className="px-3 py-3">
                      <p className="font-bold">{s.submitter_name}</p>
                      <p className="muted text-xs">{formatDateTime(s.created_at)} · {s.period_id}</p>
                    </td>
                    <td className="px-3 py-3"><PlatformTag platform={s.platform} /></td>
                    <td className="px-3 py-3 text-right tabular-nums">{countOrDash(s.likes)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{countOrDash(s.comments)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={s.status} />
                      {s.needs_review && <p className="mt-1 text-xs font-bold text-amber-800">Selisih angka API</p>}
                      {s.reject_reason && <p className="mt-1 max-w-[12rem] text-xs text-bad">{s.reject_reason}</p>}
                    </td>
                    <td className="px-3 py-3">{actions(s)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {previewing && (
        <PreviewPanel
          title={`${previewing.submitter_name} · ${previewing.platform === 'tiktok' ? 'TikTok' : 'Reels'}${program === 'golden' ? '' : ` · ${CHANNEL_INFO[program].label}`}`}
          tabs={[
            { label: previewing.platform === 'tiktok' ? 'Konten TikTok' : 'Konten Reels', url: previewing.source_url },
          ]}
          onClose={() => setPreviewing(null)}
          details={
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="muted">Status</dt><dd><StatusBadge status={previewing.status} />{previewing.reviewed_by === 'otomatis' && ' · disetujui otomatis'}</dd>
              <dt className="muted">WhatsApp</dt><dd>{previewing.whatsapp ? <a className="font-bold text-brand-purple underline" href={`https://wa.me/${previewing.whatsapp}`} target="_blank" rel="noopener noreferrer">{previewing.whatsapp}</a> : '-'}</dd>
              <dt className="muted">Like</dt><dd className="font-bold tabular-nums">{previewing.likes ? formatNumber(previewing.likes) : 'Tidak diisi, cek di pratinjau'}</dd>
              <dt className="muted">Komentar</dt><dd className="font-bold tabular-nums">{previewing.comments ? formatNumber(previewing.comments) : 'Tidak diisi, cek di pratinjau'}</dd>
              <dt className="muted">Sumber angka</dt><dd>{previewing.metrics_source === 'api' ? 'Adapter API' : 'Cek manual penyetor'}{previewing.needs_review ? ' · selisih dengan API' : ''}</dd>
              <dt className="muted">Disetor</dt><dd>{formatDateTime(previewing.created_at)} · {previewing.period_id}</dd>
              <dt className="muted">Organik</dt><dd>{previewing.organic_declared ? 'Dinyatakan muncul di FYP/Beranda' : '-'}</dd>
              {previewing.screenshot_url && (<><dt className="muted">Bukti</dt><dd><a className="font-bold text-brand-purple underline" href={previewing.screenshot_url} target="_blank" rel="noopener noreferrer">Tangkapan layar</a></dd></>)}
              {previewing.reject_reason && (<><dt className="muted">Alasan</dt><dd className="text-bad">{previewing.reject_reason}</dd></>)}
            </dl>
          }
          actions={
            <div className="space-y-2">
              {previewing.status !== 'pending' && <div className="flex justify-end">{undo(previewing)}</div>}
              <DecisionButtons status={previewing.status} onApprove={() => act(previewing, 'approve')} onReject={() => setRejecting(previewing)} />
            </div>
          }
        />
      )}
      {rejecting && (
        <RejectDialog
          target={rejecting}
          onClose={() => setRejecting(null)}
          onDone={(s) => {
            setRejecting(null)
            setPreviewing((p) => (p && p.id === s.id ? s : p))
            replace(s)
            toast('Ditolak')
          }}
        />
      )}
      <Toaster />
    </div>
  )
}
