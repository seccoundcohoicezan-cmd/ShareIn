import Link from 'next/link'
import { loadProgram } from '@/lib/public-data'
import { CHANNEL_INFO, type Program } from '@/lib/types'
import { CollectedFeed } from './CollectedFeed'
import { ArrowUpIcon } from './icons'
import { RulesList } from './RulesList'
import { Panel, PillLabel } from './ui'
import { WeeklyMe } from './WeeklyMe'

function weekLabel(startIso: string) {
  const fmt = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })
  const start = new Date(startIso)
  return `${fmt(start)} – ${fmt(new Date(start.getTime() + 6 * 86_400_000))}`
}

/** Pelatihan / Duta: the Golden Ticket link system as a weekly obligation, without prizes. */
export async function ProgramPage({ program, pill, intro }: { program: Program; pill: string; intro: string }) {
  const { settings, feed, summary } = await loadProgram(program)
  const { label, path } = CHANNEL_INFO[program]
  const setorHref = `${path}/setor`
  return (
    <div className="space-y-5">
      <section className="px-1 pt-2">
        <PillLabel as="span">{pill}</PillLabel>
        <h1 className="mt-3 text-[2.25rem] font-extrabold leading-tight tracking-tight">{label}</h1>
        <p className="muted mt-2 max-w-md">{intro}</p>
        <p className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold ${summary.open ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>
          {summary.open ? 'Pengumpulan dibuka' : 'Pengumpulan ditutup sementara'}
        </p>
      </section>

      <section className="rounded-panel bg-brand-lavender p-5" aria-labelledby="target">
        <p id="target" className="text-xs font-extrabold tracking-[0.2em] text-brand-purple">TARGET MINGGUAN</p>
        <p className="mt-2 text-2xl font-extrabold">
          {summary.min > 0 ? `Minimal ${summary.min} link per orang` : 'Belum ada target minimal'}
        </p>
        <p className="muted text-sm">Minggu ini: {weekLabel(summary.week.start)} (Senin–Minggu WIB)</p>
        <div className="mt-4">
          <WeeklyMe program={program} setorHref={setorHref} />
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3 text-center">
        {[
          ['Aktif minggu ini', summary.active],
          ['Capai target', summary.met],
          ['Link minggu ini', summary.linksThisWeek],
        ].map(([k, v]) => (
          <div key={k} className="panel-solid !p-3">
            <p className="text-2xl font-extrabold tabular-nums text-brand-purple">{v}</p>
            <p className="muted text-xs font-bold">{k}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {summary.open ? (
          <Link href={setorHref} className="btn-primary w-full sm:w-auto">
            Kirim link konten <ArrowUpIcon />
          </Link>
        ) : (
          <span className="btn-primary w-full opacity-60 sm:w-auto" aria-disabled="true">
            Pengumpulan sedang ditutup
          </span>
        )}
        <Link href="/pantau" className="btn-ghost w-full sm:w-auto">Pantau setoranku</Link>
      </div>

      <CollectedFeed initial={feed} program={program} />

      <Panel aria-labelledby="ketentuan">
        <PillLabel id="ketentuan">Ketentuan</PillLabel>
        <RulesList settings={settings} />
      </Panel>
    </div>
  )
}
