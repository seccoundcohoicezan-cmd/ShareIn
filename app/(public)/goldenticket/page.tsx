import type { Metadata } from 'next'
import Link from 'next/link'
import { GoldenCounter } from '@/components/GoldenCounter'
import { ArrowUpIcon } from '@/components/icons'
import { RulesList } from '@/components/RulesList'
import { CollectedFeed } from '@/components/CollectedFeed'
import { Panel, PillLabel } from '@/components/ui'
import { loadPublic } from '@/lib/public-data'

export const revalidate = 60
export const metadata: Metadata = { title: 'Golden Ticket' }

export default async function GoldenTicketPage() {
  const { settings, feed } = await loadPublic()
  return (
    <div className="space-y-5">
      <section className="px-1 pt-2">
        <PillLabel as="span">Program reward</PillLabel>
        <h1 className="mt-3 text-[2.25rem] font-extrabold leading-tight tracking-tight">Golden Ticket</h1>
        <p className="muted mt-2 max-w-md">Temukan konten viral TikTok atau Reels, unggah ulang lewat Sharein, dan setor di sini. Makin banyak konten yang kamu submit, makin besar peluang rewardmu. Sekali kirim bisa sampai 10 konten.</p>
      </section>

      <div className="-rotate-1 rounded-panel bg-gradient-to-br from-brand-amber via-[#f9a63a] to-brand-orange p-6 text-ink">
        <p className="text-xs font-extrabold tracking-[0.2em]">SHAREIN · GOLDEN PASS</p>
        <p className="mt-4 text-sm font-bold">Total hadiah berjalan</p>
        <GoldenCounter pool={settings} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        {settings.period_open ? (
          <Link href="/goldenticket/setor" className="btn-primary w-full sm:w-auto">
            Setor konten <ArrowUpIcon />
          </Link>
        ) : (
          <span className="btn-primary w-full opacity-60 sm:w-auto" aria-disabled="true">
            Setoran sedang ditutup
          </span>
        )}
        <Link href="/pantau" className="btn-ghost w-full sm:w-auto">Pantau setoranku</Link>
      </div>

      <CollectedFeed initial={feed} />

      <Panel aria-labelledby="ketentuan">
        <PillLabel id="ketentuan">Ketentuan</PillLabel>
        <RulesList settings={settings} />
      </Panel>
    </div>
  )
}
