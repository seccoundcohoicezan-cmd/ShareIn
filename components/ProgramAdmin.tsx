'use client'
import { useCallback, useEffect, useState } from 'react'
import { formatDateTime } from '@/lib/format'
import type { Program, Task, TaskSubmission } from '@/lib/types'
import { ExternalIcon } from './icons'
import { PreviewPanel } from './PreviewPanel'
import { toast, Toaster } from './Toast'
import { EmptyState } from './ui'

type Item = TaskSubmission
const REASONS = ['Bukti tidak sesuai', 'Link tidak bisa dibuka', 'Tugas belum selesai', 'Duplikat']
const STATUS = { pending: ['Menunggu', 'bg-amber-100 text-amber-900'], approved: ['Disetujui', 'bg-green-100 text-green-900'], rejected: ['Ditolak', 'bg-red-100 text-red-900'], void: ['Batal', 'bg-gray-100'] } as const

function Submissions({ program }: { program: Program }) {
  const [status, setStatus] = useState('pending')
  const [task, setTask] = useState('')
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Item[] | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [rejecting, setRejecting] = useState<Item | null>(null)
  const [previewing, setPreviewing] = useState<Item | null>(null)
  const [reason, setReason] = useState('')

  const load = useCallback(async () => {
    const p = new URLSearchParams({ status, task, q })
    const res = await fetch(`/api/admin/programs/${program}/submissions?${p}`)
    if (res.status === 401) return location.assign('/admin/login')
    const data = await res.json()
    setItems(data.items ?? [])
    setTasks(data.tasks ?? [])
    setPicked(new Set())
  }, [program, status, task, q])

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, q])

  async function act(id: string, action: 'approve' | 'reject' | 'reset', why = '') {
    const res = await fetch(`/api/admin/programs/${program}/submissions/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, reason: why }),
    })
    const data = await res.json()
    if (!res.ok) return toast(data.error ?? 'Gagal.', 'bad')
    toast(action === 'approve' ? 'Disetujui' : action === 'reject' ? 'Ditolak' : 'Dikembalikan')
    setPreviewing((p) => (p && p.id === id ? { ...p, ...data.item } : p))
    load()
  }

  async function bulk() {
    const res = await fetch(`/api/admin/programs/${program}/submissions/bulk`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(picked) }),
    })
    const data = await res.json()
    if (!res.ok) return toast(data.error ?? 'Gagal.', 'bad')
    toast(`${data.count} disetujui`)
    load()
  }

  const titles = new Map(tasks.map((t) => [t.id, t.title]))
  const pendingIds = (items ?? []).filter((s) => s.status === 'pending').map((s) => s.id)

  return (
    <div>
      <div className="panel-solid grid grid-cols-2 gap-3 !p-4 md:grid-cols-3">
        <div>
          <label htmlFor="ps-status" className="label">Status</label>
          <select id="ps-status" className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">Semua</option>
            <option value="pending">Menunggu</option>
            <option value="approved">Disetujui</option>
            <option value="rejected">Ditolak</option>
          </select>
        </div>
        <div>
          <label htmlFor="ps-task" className="label">Tugas</label>
          <select id="ps-task" className="field" value={task} onChange={(e) => setTask(e.target.value)}>
            <option value="">Semua</option>
            {tasks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </div>
        <div className="col-span-2 md:col-span-1">
          <label htmlFor="ps-q" className="label">Cari</label>
          <input id="ps-q" className="field" placeholder="Nama, nomor WA, atau kode" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {pendingIds.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-bold">
            <input type="checkbox" className="h-5 w-5 accent-[#6C2BD9]" checked={pendingIds.every((id) => picked.has(id))} onChange={(e) => setPicked(e.target.checked ? new Set(pendingIds) : new Set())} />
            Pilih semua yang menunggu
          </label>
          <button type="button" className="btn btn-sm bg-ok text-white" disabled={!picked.size} onClick={bulk}>Setujui terpilih ({picked.size})</button>
        </div>
      )}
      {items === null && <div className="mt-3 h-28 animate-pulse rounded-panel bg-white" />}
      {items?.length === 0 && <div className="mt-3"><EmptyState title="Tidak ada setoran untuk filter ini." /></div>}
      <ul className="mt-3 space-y-3">
        {items?.map((s) => (
          <li key={s.id} className="panel-solid !p-4">
            <div className="flex items-start gap-3">
              {s.status === 'pending' && (
                <input type="checkbox" aria-label={`Pilih ${s.name}`} className="mt-1 h-5 w-5 accent-[#6C2BD9]" checked={picked.has(s.id)} onChange={() => setPicked((p) => { const n = new Set(p); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n })} />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-extrabold">{s.code}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS[s.status][1]}`}>{STATUS[s.status][0]}</span>
                  {s.reviewed_by === 'otomatis' && <span className="rounded-full bg-brand-lavender px-2.5 py-0.5 text-xs font-bold text-brand-purple">Otomatis</span>}
                </div>
                <p className="mt-1 font-extrabold">{s.name} <span className="muted text-sm font-medium">· {s.whatsapp}</span></p>
                <p className="text-sm">{titles.get(s.task_id) ?? s.task_id}</p>
                <p className="muted text-xs">{formatDateTime(s.created_at)}</p>
                {s.note && <p className="mt-1 text-sm">Catatan: {s.note}</p>}
                {s.reject_reason && <p className="mt-1 text-sm text-bad">Alasan: {s.reject_reason}</p>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="btn-primary btn-sm" onClick={() => setPreviewing(s)}>Pratinjau & review</button>
              <a href={s.proof_url} target="_blank" rel="noopener noreferrer" className="btn-ghost btn-sm">Buka bukti <ExternalIcon /></a>
              {s.status !== 'approved' && <button type="button" className="btn btn-sm bg-ok text-white" onClick={() => act(s.id, 'approve')}>Setujui</button>}
              {s.status !== 'rejected' && <button type="button" className="btn btn-sm bg-bad text-white" onClick={() => { setRejecting(s); setReason('') }}>Tolak</button>}
              {s.status !== 'pending' && <button type="button" className="btn-ghost btn-sm" onClick={() => act(s.id, 'reset')}>Batalkan</button>}
            </div>
          </li>
        ))}
      </ul>
      {previewing && (
        <PreviewPanel
          title={`${previewing.code} · ${previewing.name}`}
          tabs={[{ label: 'Bukti tugas', url: previewing.proof_url }]}
          onClose={() => setPreviewing(null)}
          details={
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="muted">Status</dt><dd><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS[previewing.status][1]}`}>{STATUS[previewing.status][0]}</span>{previewing.reviewed_by === 'otomatis' && ' · disetujui otomatis'}</dd>
              <dt className="muted">Tugas</dt><dd className="font-bold">{titles.get(previewing.task_id) ?? previewing.task_id}</dd>
              <dt className="muted">Peserta</dt><dd>{previewing.name}</dd>
              <dt className="muted">WhatsApp</dt><dd><a className="font-bold text-brand-purple underline" href={`https://wa.me/${previewing.whatsapp}`} target="_blank" rel="noopener noreferrer">{previewing.whatsapp}</a></dd>
              <dt className="muted">Dikumpulkan</dt><dd>{formatDateTime(previewing.created_at)}</dd>
              {previewing.note && (<><dt className="muted">Catatan</dt><dd>{previewing.note}</dd></>)}
              {previewing.reject_reason && (<><dt className="muted">Alasan</dt><dd className="text-bad">{previewing.reject_reason}</dd></>)}
            </dl>
          }
          actions={
            <>
              {previewing.status !== 'approved' && <button type="button" className="btn bg-ok text-white" onClick={() => act(previewing.id, 'approve')}>Setujui</button>}
              {previewing.status !== 'rejected' && <button type="button" className="btn bg-bad text-white" onClick={() => { setRejecting(previewing); setReason('') }}>Tolak</button>}
              {previewing.status !== 'pending' && <button type="button" className="btn-ghost" onClick={() => act(previewing.id, 'reset')}>Batalkan</button>}
            </>
          }
        />
      )}
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-3 sm:items-center" role="dialog" aria-modal="true" aria-labelledby="tolak-tugas">
          <div className="w-full max-w-md rounded-panel bg-white p-5">
            <h2 id="tolak-tugas" className="text-lg font-extrabold">Tolak kode {rejecting.code}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {REASONS.map((r) => (
                <button key={r} type="button" onClick={() => setReason(r)} className={`min-h-[40px] rounded-full border px-3 text-sm font-bold ${reason === r ? 'border-bad bg-red-50 text-bad' : 'border-brand-purple/20'}`}>{r}</button>
              ))}
            </div>
            <label htmlFor="alasan-tugas" className="label mt-3">Alasan</label>
            <textarea id="alasan-tugas" autoFocus rows={2} maxLength={200} className="field py-3" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost" onClick={() => setRejecting(null)}>Batal</button>
              <button type="button" className="btn bg-bad text-white" disabled={reason.trim().length < 3} onClick={async () => { await act(rejecting.id, 'reject', reason); setRejecting(null) }}>Tolak</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const EMPTY = { title: '', description: '', proof_hint: '', active: true, order: 0 }

function Tasks({ program, canEdit }: { program: Program; canEdit: boolean }) {
  const [tasks, setTasks] = useState<Task[] | null>(null)
  const [editing, setEditing] = useState<string | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/programs/${program}/tasks`)
    const data = await res.json()
    setTasks(data.tasks ?? [])
  }, [program])
  useEffect(() => {
    load()
  }, [load])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const url = editing === 'new' ? `/api/admin/programs/${program}/tasks` : `/api/admin/programs/${program}/tasks/${editing}`
    const res = await fetch(url, {
      method: editing === 'new' ? 'POST' : 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) return setError(data.error ?? 'Gagal menyimpan.')
    toast('Tersimpan')
    setEditing(null)
    load()
  }

  return (
    <div className="space-y-3">
      {canEdit && editing === null && (
        <button type="button" className="btn-primary" onClick={() => { setForm({ ...EMPTY, order: (tasks?.length ?? 0) + 1 }); setEditing('new') }}>Tambah tugas</button>
      )}
      {editing !== null && (
        <form onSubmit={save} className="panel-solid space-y-3">
          <h2 className="font-extrabold">{editing === 'new' ? 'Tugas baru' : 'Ubah tugas'}</h2>
          <div>
            <label htmlFor="t-title" className="label">Judul tugas</label>
            <input id="t-title" className="field" maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div>
            <label htmlFor="t-desc" className="label">Penjelasan</label>
            <textarea id="t-desc" className="field py-3" rows={3} maxLength={1000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <div>
              <label htmlFor="t-hint" className="label">Bukti yang diminta</label>
              <input id="t-hint" className="field" maxLength={200} placeholder="Contoh: link video TikTok kamu" value={form.proof_hint} onChange={(e) => setForm({ ...form, proof_hint: e.target.value })} />
            </div>
            <div>
              <label htmlFor="t-order" className="label">Urutan</label>
              <input id="t-order" className="field" inputMode="numeric" value={form.order} onChange={(e) => setForm({ ...form, order: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
            </div>
          </div>
          <label className="flex min-h-[44px] items-center gap-2 font-bold">
            <input type="checkbox" className="h-5 w-5 accent-[#6C2BD9]" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            Tampilkan di halaman publik
          </label>
          {error && <p role="alert" className="text-sm font-bold text-bad">{error}</p>}
          <div className="flex gap-2">
            <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>Batal</button>
            <button className="btn-primary">Simpan tugas</button>
          </div>
        </form>
      )}
      {tasks?.length === 0 && <EmptyState title="Belum ada tugas.">{canEdit ? 'Tambahkan tugas pertama agar peserta bisa mengumpulkan.' : 'Owner belum menambahkan tugas.'}</EmptyState>}
      <ul className="space-y-2">
        {tasks?.map((t) => (
          <li key={t.id} className="panel-solid flex items-start gap-3 !p-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-purple text-sm font-extrabold text-white">{t.order}</span>
            <div className="min-w-0 flex-1">
              <p className="font-extrabold">{t.title} {!t.active && <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs">Disembunyikan</span>}</p>
              {t.description && <p className="muted line-clamp-2 text-sm">{t.description}</p>}
            </div>
            {canEdit && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => { setForm({ title: t.title, description: t.description, proof_hint: t.proof_hint, active: t.active, order: t.order }); setEditing(t.id) }}>Ubah</button>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ProgramAdmin({ program, canEditTasks }: { program: Program; canEditTasks: boolean }) {
  const [tab, setTab] = useState<'setoran' | 'tugas'>('setoran')
  return (
    <div>
      <div role="tablist" className="mb-4 grid w-full max-w-sm grid-cols-2 gap-1 rounded-field bg-white p-1">
        {(['setoran', 'tugas'] as const).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} type="button" onClick={() => setTab(t)} className={`min-h-[44px] rounded-[12px] text-sm font-bold ${tab === t ? 'bg-brand-purple text-white' : 'text-brand-purple'}`}>
            {t === 'setoran' ? 'Setoran tugas' : 'Daftar tugas'}
          </button>
        ))}
      </div>
      {tab === 'setoran' ? <Submissions program={program} /> : <Tasks program={program} canEdit={canEditTasks} />}
      <Toaster />
    </div>
  )
}
