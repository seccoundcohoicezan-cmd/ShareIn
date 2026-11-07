import Link from 'next/link'
import { PlatformTag, ProgressBar, StatusBadge, EmptyState } from '@/components/ui'
import { dashboard } from '@/lib/admin-service'
import { formatDateTime, formatNumber } from '@/lib/format'
import { getProgress } from '@/lib/service'
import { AdminShell, requirePageSession } from './shell'

export const dynamic = 'force-dynamic'

export default async function AdminHome() {
  const session = await requirePageSession()
  const [{ stats, recent, settings }, { progress }] = await Promise.all([dashboard(), getProgress()])
  const cards = [
    { t: 'Menunggu review', v: stats.pending, href: '/admin/setoran?status=pending', tone: 'text-warn' },
    { t: 'Disetujui hari ini', v: stats.approvedToday, href: '/admin/setoran?status=approved', tone: 'text-ok' },
    { t: 'Ditolak (periode)', v: stats.rejected, href: '/admin/setoran?status=rejected', tone: 'text-bad' },
    { t: 'Total periode', v: stats.totalPeriod, href: `/admin/setoran?period=${encodeURIComponent(settings.period_id)}`, tone: 'text-brand-purple' },
  ]
  return (
    <AdminShell session={session}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-extrabold">Dasbor</h1>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${settings.period_open ? 'bg-green-100 text-green-900' : 'bg-red-100 text-red-900'}`}>
          Periode {settings.period_id} · {settings.period_open ? 'Dibuka' : 'Ditutup'}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <Link key={c.t} href={c.href} className="panel-solid !p-4 hover:border-brand-violet">
            <p className="muted text-xs font-bold">{c.t}</p>
            <p className={`mt-1 text-3xl font-extrabold tabular-nums ${c.tone}`}>{formatNumber(c.v)}</p>
          </Link>
        ))}
      </div>
      <section className="panel-solid mt-4 space-y-4">
        <h2 className="font-extrabold">Progres QTY</h2>
        {progress.map((p) => <ProgressBar key={p.platform} label={p.platform === 'tiktok' ? 'TikTok' : 'Reels'} used={p.used} target={p.target} />)}
      </section>
      <section className="panel-solid mt-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-extrabold">5 setoran terbaru</h2>
          <Link href="/admin/setoran" className="text-sm font-bold text-brand-purple underline underline-offset-4">Lihat semua</Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState title="Belum ada setoran." />
        ) : (
          <ul className="divide-y divide-brand-purple/10">
            {recent.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
                <PlatformTag platform={s.platform} />
                <span className="font-bold">{s.submitter_name}</span>
                <span className="muted tabular-nums">{formatNumber(s.likes)} like · {formatNumber(s.comments)} komentar</span>
                <span className="ml-auto flex items-center gap-2">
                  <span className="muted text-xs">{formatDateTime(s.created_at)}</span>
                  <StatusBadge status={s.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AdminShell>
  )
}
