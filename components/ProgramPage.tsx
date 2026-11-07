import { formatRupiah } from '@/lib/golden'
import { formatDate } from '@/lib/format'
import { programSummary } from '@/lib/program-service'
import type { Program } from '@/lib/types'
import { MyCodes } from './MyCodes'
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

const STEPS = ['Kerjakan tugas', 'Kumpulkan bukti, dapat kode', 'Kode disetujui masuk spin wheel', 'Yang beruntung dapat uang']

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
          ['Siap diundi', data?.inWheel ?? 0],
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

      <MyCodes program={program} />

      <section aria-labelledby="pemenang" className="panel-solid">
        <PillLabel id="pemenang">Pemenang spin wheel</PillLabel>
        {!data || data.winners.length === 0 ? (
          <p className="muted mt-4 text-sm">Belum ada pengundian. Kumpulkan kodemu sebanyak mungkin.</p>
        ) : (
          <ul className="mt-4 divide-y divide-brand-purple/10">
            {data.winners.map((w) => (
              <li key={w.code + w.time} className="flex items-center gap-3 py-3">
                <span className="rounded-full bg-brand-amber/30 px-2.5 py-1 font-mono text-xs font-bold">{w.code}</span>
                <span className="font-bold">{w.name}</span>
                <span className="ml-auto text-right">
                  <span className="block font-extrabold text-orange-700">{formatRupiah(w.prize)}</span>
                  <span className="muted text-xs">{formatDate(w.time)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Toaster />
    </div>
  )
}
