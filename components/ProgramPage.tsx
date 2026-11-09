import { programSummary } from '@/lib/program-service'
import type { Program } from '@/lib/types'
import { TaskForm } from './TaskForm'
import { Toaster } from './Toast'
import { EmptyState, Panel, PillLabel } from './ui'

async function load(program: Program) {
  try {
    return await programSummary(program)
  } catch (e) {
    console.error('program summary unavailable', (e as Error).message)
    return null
  }
}

const STEPS = ['Kerjakan tugas', 'Kumpulkan link bukti', 'Dapat kode tugas', 'Pantau statusnya']

export async function ProgramPage({ program, pill, title, intro }: { program: Program; pill: string; title: string; intro: string }) {
  const data = await load(program)
  return (
    <div className="space-y-5">
      <section className="px-1 pt-2">
        <PillLabel as="span">{pill}</PillLabel>
        <h1 className="mt-3 text-[2.25rem] font-extrabold leading-tight tracking-tight">{title}</h1>
        <p className="muted mt-2 max-w-md">{intro}</p>
        {data && (
          <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${data.open ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>
            {data.open ? 'Pengumpulan dibuka' : 'Pengumpulan ditutup sementara'}
          </p>
        )}
      </section>

      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          ['Peserta', data?.participants ?? 0],
          ['Kode terkumpul', data?.codes ?? 0],
          ['Disetujui', data?.approved ?? 0],
        ].map(([k, v]) => (
          <div key={k} className="panel-solid !p-3">
            <p className="text-2xl font-extrabold tabular-nums text-brand-purple">{v}</p>
            <p className="muted text-xs font-bold">{k}</p>
          </div>
        ))}
      </div>

      <Panel aria-labelledby="cara">
        <PillLabel id="cara">Cara ikut</PillLabel>
        <ol className="mt-4 grid gap-3 sm:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-3 rounded-field bg-white/70 p-3 sm:flex-col sm:items-start">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-purple text-sm font-extrabold text-white">{i + 1}</span>
              <span className="text-sm font-bold">{s}</span>
            </li>
          ))}
        </ol>
      </Panel>

      <section aria-labelledby="tugas" className="panel-solid">
        <PillLabel id="tugas">Daftar tugas</PillLabel>
        {!data ? (
          <p className="muted mt-4 text-sm">Daftar tugas belum bisa dimuat. Coba muat ulang halaman.</p>
        ) : data.tasks.length === 0 ? (
          <div className="mt-4"><EmptyState title="Belum ada tugas.">Tugas akan muncul di sini setelah diumumkan admin.</EmptyState></div>
        ) : (
          <ol className="mt-4 space-y-3">
            {data.tasks.map((t, i) => (
              <li key={t.id} className="rounded-field border border-brand-purple/10 p-4">
                <p className="font-extrabold"><span className="text-brand-purple">{i + 1}.</span> {t.title}</p>
                {t.description && <p className="muted mt-1 whitespace-pre-line text-sm">{t.description}</p>}
                {t.proof_hint && <p className="mt-2 text-xs font-bold text-brand-purple">Bukti: {t.proof_hint}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {data && data.tasks.length > 0 && <TaskForm program={program} tasks={data.tasks} open={data.open} />}

      <section className="panel-solid flex flex-wrap items-center gap-3" aria-labelledby="pantau-judul">
        <div className="min-w-0 flex-1">
          <h2 id="pantau-judul" className="font-extrabold">Pantau kode & status tugasmu</h2>
          <p className="muted text-sm">Semua kode dan status disetujui/ditolak ada di link pantau unikmu.</p>
        </div>
        <a href="/pantau" className="btn-primary btn-sm">Buka halaman pantau</a>
      </section>

      <Toaster />
    </div>
  )
}
