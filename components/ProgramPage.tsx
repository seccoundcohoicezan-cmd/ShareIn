import Link from 'next/link'
import { loadProgram } from '@/lib/public-data'
import { CHANNEL_INFO, type Program } from '@/lib/types'
import { CollectedFeed } from './CollectedFeed'
import { ArrowUpIcon } from './icons'
import { ProgressMe } from './ProgressMe'
import { CountUp } from './ProgressVisuals'
import { RulesList } from './RulesList'
import { Panel, PillLabel } from './ui'

const fmt = (d: Date) => d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })

function weekLabel(startIso: string) {
  const start = new Date(startIso)
  return `${fmt(start)} – ${fmt(new Date(start.getTime() + 6 * 86_400_000))}`
}

const DRAW_STEPS = (t: { tiktok: number; reels: number }, auto: boolean) => [
  ['Kirim link', `Tempel link TikTok & Reels, sampai 10 sekali kirim.`],
  auto ? ['Langsung disetujui', 'Link yang lolos cek otomatis langsung terhitung.'] : ['Disetujui admin', 'Link dicek admin. Status terlihat di halaman pantau.'],
  ['Masuk roda', `Lengkap ${t.tiktok} TikTok + ${t.reels} Reels = otomatis ikut undian.`],
  ['Diundi', 'Pemenang diumumkan di halaman ini.'],
]
const WEEK_STEPS = (t: { tiktok: number; reels: number }) => [
  ['Kirim konten', 'Tempel link TikTok & Reels, sampai 10 sekali kirim.'],
  ['Pantau progres', 'Setiap link langsung terhitung di kartu progresmu.'],
  ['Capai target', `${t.tiktok} TikTok + ${t.reels} Reels sebelum Minggu 23.59 WIB.`],
  ['Ulangi', 'Hitungan mulai lagi dari 0 setiap Senin.'],
]

function Steps({ items }: { items: string[][] }) {
  return (
    <section className="panel-solid" aria-labelledby="cara-ikut">
      <PillLabel id="cara-ikut">Cara ikut</PillLabel>
      <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {items.map(([title, text], i) => (
          <li key={title} tabIndex={0} className="lift group rounded-field border border-brand-purple/10 bg-white p-3 outline-none focus-visible:ring-2 focus-visible:ring-brand-purple">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-purple text-sm font-extrabold text-white transition-transform group-hover:scale-110">{i + 1}</span>
            <p className="mt-2 font-extrabold">{title}</p>
            <p className="muted text-xs">{text}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

/** Decorative wheel slowly turning in the corner of the draw card (CSS only). */
function MiniWheel() {
  const colors = ['#6C2BD9', '#F59E0B', '#8B5CF6', '#F97316', '#4C1D95', '#FBBF24']
  return (
    <svg viewBox="-50 -50 100 100" className="wheel-idle pointer-events-none absolute -right-8 -top-8 h-32 w-32 opacity-25 sm:opacity-40" aria-hidden="true">
      {colors.map((c, i) => {
        const a0 = (i / 6) * 2 * Math.PI
        const a1 = ((i + 1) / 6) * 2 * Math.PI
        return <path key={i} d={`M0 0 L${Math.cos(a0) * 48} ${Math.sin(a0) * 48} A48 48 0 0 1 ${Math.cos(a1) * 48} ${Math.sin(a1) * 48} Z`} fill={c} />
      })}
      <circle r="8" fill="#fff" />
    </svg>
  )
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

      <section className="relative overflow-hidden rounded-panel bg-brand-lavender p-5" aria-labelledby="target">
        {draw && <MiniWheel />}
        <div className="relative">
        <p id="target" className="text-xs font-extrabold tracking-[0.2em] text-brand-purple">{draw ? 'UNDIAN BERHADIAH' : 'TARGET MINGGUAN'}</p>
        <p className="mt-2 text-2xl font-extrabold">
          {draw
            ? `Kumpulkan ${t.tiktok} link TikTok & ${t.reels} link Instagram Reels dan ikuti undian berhadiah`
            : `Kumpulkan ${t.tiktok + t.reels} konten: ${t.tiktok} TikTok & ${t.reels} Instagram Reels`}
        </p>
        <p className="muted text-sm">
          {draw ? (summary.auto ? 'Link langsung terhitung begitu terkirim. Begitu lengkap, kamu otomatis masuk roda undian.' : 'Link dihitung setelah disetujui admin. Begitu lengkap, kamu otomatis masuk roda undian.') : `Minggu ini: ${weekLabel(summary.week!.start)} (Senin–Minggu WIB, berulang tiap minggu)`}
        </p>
        <div className="mt-4">
          <ProgressMe program={program} setorHref={setorHref} />
        </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-3 text-center">
        {(draw
          ? [['Peserta', summary.active], ['Masuk undian', summary.met], ['Pemenang', winners.length]]
          : [['Aktif minggu ini', summary.active], ['Capai target', summary.met], ['Link minggu ini', summary.links]]
        ).map(([k, v]) => (
          <div key={k} className="panel-solid lift !p-3">
            <p className="text-2xl font-extrabold tabular-nums text-brand-purple"><CountUp value={Number(v)} /></p>
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

      <Steps items={draw ? DRAW_STEPS(t, summary.auto) : WEEK_STEPS(t)} />

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
        <RulesList settings={settings} proKontra={false} />
      </Panel>
    </div>
  )
}
