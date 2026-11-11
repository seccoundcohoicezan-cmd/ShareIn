import Link from 'next/link'
import { loadProgram } from '@/lib/public-data'
import { CHANNEL_INFO, type Program } from '@/lib/types'
import { CollectedFeed } from './CollectedFeed'
import { ArrowUpIcon } from './icons'
import { ProgressMe } from './ProgressMe'
import { RulesList } from './RulesList'
import { Panel, PillLabel } from './ui'

const fmt = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })

function weekLabel(startIso: string) {
  const start = new Date(startIso)
  return `${fmt(start)} – ${fmt(new Date(start.getTime() + 6 * 86_400_000))}`
}

/** Pelatihan (collect → spin-wheel draw) and Duta (weekly duty): the Golden Ticket link system without cash branding. */
export async function ProgramPage({ program, pill, intro }: { program: Program; pill: string; intro: string }) {
  const { settings, feed, summary, winners } = await loadProgram(program)
  const { label, path } = CHANNEL_INFO[program]
  const setorHref = `${path}/setor`
  const draw = summary.mode === 'draw'
  const t = summary.target
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
        <p id="target" className="text-xs font-extrabold tracking-[0.2em] text-brand-purple">{draw ? 'UNDIAN BERHADIAH' : 'TARGET MINGGUAN'}</p>
        <p className="mt-2 text-2xl font-extrabold">
          {draw
            ? `Kumpulkan ${t.tiktok} link TikTok & ${t.reels} link Instagram Reels dan ikuti undian berhadiah`
            : `Kumpulkan ${t.tiktok + t.reels} konten: ${t.tiktok} TikTok & ${t.reels} Instagram Reels`}
        </p>
        <p className="muted text-sm">
          {draw ? 'Link dihitung setelah disetujui admin. Begitu lengkap, kamu otomatis masuk roda undian.' : `Minggu ini: ${weekLabel(summary.week!.start)} (Senin–Minggu WIB, berulang tiap minggu)`}
        </p>
        <div className="mt-4">
          <ProgressMe program={program} setorHref={setorHref} />
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3 text-center">
        {(draw
          ? [['Peserta', summary.active], ['Masuk undian', summary.met], ['Pemenang', winners.length]]
          : [['Aktif minggu ini', summary.active], ['Capai target', summary.met], ['Link minggu ini', summary.links]]
        ).map(([k, v]) => (
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

      {draw && (
        <section className="panel-solid" aria-labelledby="pemenang">
          <PillLabel id="pemenang">Pemenang undian</PillLabel>
          {winners.length === 0 ? (
            <p className="muted mt-3 text-sm">Belum ada undian. Kumpulkan linkmu dan jadilah salah satu pemenangnya.</p>
          ) : (
            <ul className="mt-3 divide-y divide-brand-purple/10" aria-label="Riwayat pemenang">
              {winners.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="font-extrabold">{w.name}</span>
                  <span className="text-right text-sm">
                    {w.prize && <b className="block">{w.prize}</b>}
                    <span className="muted text-xs">{fmt(new Date(w.created_at))}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <CollectedFeed initial={feed} program={program} />

      <Panel aria-labelledby="ketentuan">
        <PillLabel id="ketentuan">Ketentuan</PillLabel>
        <RulesList settings={settings} />
      </Panel>
    </div>
  )
}
