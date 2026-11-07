import Link from 'next/link'
import { ArrowUpIcon, GiftIcon, LinkIcon, UploadIcon } from '@/components/icons'
import { RulesList } from '@/components/RulesList'
import { Panel, PillLabel, ProgressBar } from '@/components/ui'
import { loadPublic } from '@/lib/public-data'

export const revalidate = 60

const STEPS = [
  { n: 1, t: 'Upload konten', d: 'Temukan konten viral, cek angkanya, lalu unggah ke Sharein.', Icon: UploadIcon },
  { n: 2, t: 'Bagikan link', d: 'Setor link asli dan link Sharein lewat form setoran.', Icon: LinkIcon },
  { n: 3, t: 'Dapatkan reward', d: 'Setoran yang disetujui admin berpeluang dapat reward.', Icon: GiftIcon },
]

export default async function Home() {
  const { settings, progress } = await loadPublic()
  const tiktok = progress.find((p) => p.platform === 'tiktok')!
  const reels = progress.find((p) => p.platform === 'reels')!
  const allFull = progress.every((p) => p.remaining === 0)

  return (
    <div className="space-y-5">
      <section className="px-1 pb-2 pt-4">
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-bold text-brand-purple">
          <ArrowUpIcon className="h-3.5 w-3.5" /> Periode {settings.period_id}
        </p>
        <h1 className="text-[2.25rem] font-extrabold leading-[1.1] tracking-tight">
          Setor konten viral,
          <br />
          <span className="bg-gradient-to-r from-brand-purple via-brand-violet to-brand-orange bg-clip-text text-transparent">dapatkan reward.</span>
        </h1>
        <p className="muted mt-3 max-w-md text-base">
          Temukan konten TikTok atau Reels yang lagi ramai, cek angkanya, lalu unggah ke Sharein.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          {settings.period_open && !allFull ? (
            <Link href="/setor" className="btn-primary w-full sm:w-auto">
              Setor konten <ArrowUpIcon />
            </Link>
          ) : (
            <span className="btn-primary w-full opacity-60 sm:w-auto" aria-disabled="true">
              {settings.period_open ? 'Target periode ini sudah penuh' : 'Setoran sedang ditutup'}
            </span>
          )}
          <Link href="/riwayat" className="btn-ghost w-full sm:w-auto">
            Lihat riwayat
          </Link>
        </div>
      </section>

      <Panel aria-labelledby="target">
        <PillLabel id="target">Target periode ini</PillLabel>
        <div className="mt-4 space-y-4">
          <ProgressBar label="TikTok" used={tiktok.used} target={tiktok.target} />
          <ProgressBar label="Reels" used={reels.used} target={reels.target} />
        </div>
      </Panel>

      <Panel aria-labelledby="ketentuan">
        <PillLabel id="ketentuan">Ketentuan</PillLabel>
        <RulesList settings={settings} />
        <Link href="/aturan" className="mt-4 inline-flex min-h-[44px] items-center text-sm font-bold text-brand-purple underline-offset-4 hover:underline">
          Baca ketentuan lengkap
        </Link>
      </Panel>

      <Panel aria-labelledby="cara">
        <PillLabel id="cara">Cara kerja</PillLabel>
        <ol className="mt-4 grid gap-3 sm:grid-cols-3">
          {STEPS.map(({ n, t, d, Icon }) => (
            <li key={n} className="rounded-field bg-brand-lavender/80 p-4">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-purple text-sm font-extrabold text-white">{n}</span>
                <Icon className={`h-6 w-6 ${n === 3 ? 'text-brand-orange' : 'text-brand-purple'}`} />
              </div>
              <p className="mt-2 font-extrabold">{t}</p>
              <p className="muted mt-1 text-sm">{d}</p>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="flex items-center gap-3 rounded-panel bg-brand-purple p-5 text-white">
        <GiftIcon className="h-9 w-9 shrink-0 text-brand-amber" />
        <p className="font-bold">Upload konten, bagikan link-nya, dan dapatkan sesuatu!</p>
      </div>
    </div>
  )
}
