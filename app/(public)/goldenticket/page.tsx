import type { Metadata } from 'next'
import Link from 'next/link'
import { GoldenCounter } from '@/components/GoldenCounter'
import { ArrowUpIcon } from '@/components/icons'
import { RulesList } from '@/components/RulesList'
import { Panel, PillLabel, ProgressBar } from '@/components/ui'
import { loadPublic } from '@/lib/public-data'

export const revalidate = 60
export const metadata: Metadata = { title: 'Golden Ticket' }

export default async function GoldenTicketPage() {
  const { settings, progress } = await loadPublic()
  const tiktok = progress.find((p) => p.platform === 'tiktok')!
  const reels = progress.find((p) => p.platform === 'reels')!
  const allFull = progress.every((p) => p.remaining === 0)
  return (
    <div className="space-y-5">
      <section className="px-1 pt-2">
        <PillLabel as="span">Program reward</PillLabel>
        <h1 className="mt-3 text-[2.25rem] font-extrabold leading-tight tracking-tight">Golden Ticket</h1>
        <p className="muted mt-2 max-w-md">Temukan konten viral TikTok atau Reels, unggah ulang lewat Sharein, dan setor di sini. Setoran yang disetujui jadi Golden Ticket-mu.</p>
      </section>

      <div className="-rotate-1 rounded-panel bg-gradient-to-br from-brand-amber via-[#f9a63a] to-brand-orange p-6 text-ink">
        <p className="text-xs font-extrabold tracking-[0.2em]">SHAREIN · GOLDEN PASS</p>
        <p className="mt-4 text-sm font-bold">Total hadiah berjalan</p>
        <GoldenCounter pool={settings} />
        <p className="mt-4 text-xs font-bold">Periode {settings.period_id}</p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {settings.period_open && !allFull ? (
          <Link href="/goldenticket/setor" className="btn-primary w-full sm:w-auto">
            Setor konten <ArrowUpIcon />
          </Link>
        ) : (
          <span className="btn-primary w-full opacity-60 sm:w-auto" aria-disabled="true">
            {settings.period_open ? 'Target periode ini sudah penuh' : 'Setoran sedang ditutup'}
          </span>
        )}
        <Link href="/pantau" className="btn-ghost w-full sm:w-auto">Pantau setoranku</Link>
      </div>

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
      </Panel>
    </div>
  )
}
