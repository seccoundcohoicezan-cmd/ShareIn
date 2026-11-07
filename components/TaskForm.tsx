'use client'
import { useEffect, useState } from 'react'
import type { Program, Task } from '@/lib/types'
import { GiftSolid } from './icons'
import { PantauCard } from './PantauCard'
import { toast } from './Toast'
import { localWa, useMe } from './useMe'
import { PillLabel } from './ui'

const ID_KEY = 'sharein_identitas'

export function TaskForm({ program, tasks, open }: { program: Program; tasks: Task[]; open: boolean }) {
  const [name, setName] = useState('')
  const [wa, setWa] = useState('')
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? '')
  const [proof, setProof] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<{ field?: string; message: string } | null>(null)
  const [result, setResult] = useState<{ code: string; task: string; token?: string } | null>(null)
  const me = useMe()

  useEffect(() => {
    if (me) {
      setName(me.name)
      setWa(localWa(me.whatsapp))
    }
  }, [me])

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(ID_KEY) || '{}')
      if (saved.name) setName(saved.name)
      if (saved.wa) setWa(saved.wa)
    } catch {}
  }, [])

  const task = tasks.find((t) => t.id === taskId)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/programs/${program}/submit`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ task_id: taskId, name, whatsapp: wa, proof_url: proof, note }),
      })
      const data = await res.json()
      if (!data.ok) {
        setError({ field: data.field, message: data.message ?? data.error ?? 'Belum bisa dikirim. Coba lagi.' })
        if (data.field) document.getElementById(`tf-${data.field}`)?.focus()
        return
      }
      localStorage.setItem(ID_KEY, JSON.stringify({ name: name.trim(), wa: wa.trim() }))
      window.dispatchEvent(new CustomEvent('sharein:kode-baru'))
      setResult({ code: data.code, task: data.task, token: data.token })
      toast('Terkirim')
    } catch {
      setError({ message: 'Tidak terhubung ke server. Periksa internet lalu coba lagi.' })
    } finally {
      setBusy(false)
    }
  }

  if (result) {
    return (
      <section className="panel-solid text-center" role="status" aria-labelledby="kode-judul">
        <div className="bounce-once mx-auto w-fit"><GiftSolid className="h-20 w-20" /></div>
        <h2 id="kode-judul" className="mt-3 text-xl font-extrabold">Tugas terkumpul. Ini kodemu:</h2>
        <p id="kode-hasil" className="mx-auto mt-3 w-fit rounded-field border-2 border-dashed border-brand-orange bg-brand-amber/15 px-6 py-3 font-mono text-3xl font-extrabold tracking-widest">{result.code}</p>
        <p className="muted mx-auto mt-3 max-w-sm text-sm">Tugas “{result.task}”. Kode masuk spin wheel setelah bukti disetujui admin. Pantau statusnya di link unikmu.</p>
        {result.token && <PantauCard token={result.token} />}
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => navigator.clipboard?.writeText(result.code).then(() => toast('Kode tersalin'), () => toast('Salin manual kodenya', 'bad'))}
          >
            Salin kode
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setResult(null)
              setProof('')
              setNote('')
              const next = tasks.find((t) => t.id !== taskId)
              if (next) setTaskId(next.id)
            }}
          >
            Kumpulkan tugas lain
          </button>
        </div>
      </section>
    )
  }

  const err = (f: string) => (error?.field === f ? <p className="mt-1.5 text-sm font-bold text-bad">{error.message}</p> : null)

  return (
    <form onSubmit={submit} className="panel-solid space-y-4" aria-labelledby="kumpul-judul" noValidate>
      <PillLabel id="kumpul-judul">Kumpulkan tugas</PillLabel>
      {!open && <p role="alert" className="rounded-field bg-amber-50 p-3 text-sm font-bold">Pengumpulan sedang ditutup.</p>}
      {me && (
        <p className="rounded-field bg-green-50 p-3 text-sm font-bold text-green-900">
          Masuk sebagai {me.name}. <a href={`/pantau/${me.token}`} className="underline">Lihat halaman pantau</a>
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tf-name" className="label">Nama lengkap</label>
          <input id="tf-name" className="field" autoComplete="name" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          {err('name')}
        </div>
        <div>
          <label htmlFor="tf-whatsapp" className="label">Nomor WhatsApp</label>
          <input id="tf-whatsapp" className="field" inputMode="tel" autoComplete="tel" placeholder="081234567890" maxLength={20} value={wa} onChange={(e) => setWa(e.target.value)} readOnly={Boolean(me)} />
          {err('whatsapp') ?? <p className="muted mt-1.5 text-xs">1 nomor = 1 akun. Kamu dapat link pantau unik; pemenang dihubungi lewat nomor ini.</p>}
        </div>
      </div>
      <div>
        <label htmlFor="tf-task_id" className="label">Tugas</label>
        <select id="tf-task_id" className="field" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
          {tasks.map((t, i) => <option key={t.id} value={t.id}>{i + 1}. {t.title}</option>)}
        </select>
        {err('task_id')}
      </div>
      <div>
        <label htmlFor="tf-proof_url" className="label">Link bukti</label>
        <input id="tf-proof_url" className="field" inputMode="url" autoCapitalize="none" spellCheck={false} placeholder="https://…" maxLength={500} value={proof} onChange={(e) => setProof(e.target.value)} />
        {err('proof_url') ?? <p className="muted mt-1.5 text-xs">{task?.proof_hint || 'Link konten, Google Drive, atau postingan yang membuktikan tugas selesai.'}</p>}
      </div>
      <div>
        <label htmlFor="tf-note" className="label">Catatan <span className="muted font-medium">(opsional)</span></label>
        <textarea id="tf-note" className="field py-3" rows={2} maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      {error && !error.field && <p role="alert" className="rounded-field bg-red-50 p-3 text-sm font-bold text-bad">{error.message}</p>}
      <button className="btn-primary w-full" disabled={busy || !open}>{busy ? 'Mengirim…' : 'Kumpulkan & dapat kode'}</button>
    </form>
  )
}
