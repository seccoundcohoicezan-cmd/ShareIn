import Link from 'next/link'
import { PlatformTag, StatusBadge, EmptyState } from '@/components/ui'
import { dashboard } from '@/lib/admin-service'
import { formatDateTime, formatNumber, metricsText } from '@/lib/format'
import { programSummary } from '@/lib/progress'
import { getProgress } from '@/lib/service'
import { isDemoStore } from '@/lib/repo'
import { AdminShell, requirePageSession } from './shell'

export const dynamic = 'force-dynamic'

export default async function AdminHome() {
  const session = await requirePageSession()
  const [{ stats, recent, settings, pendingByProgram }, { progress }, pel, dut] = await Promise.all([
    dashboard(),
    getProgress(),
    programSummary('pelatihan'),
    programSummary('duta'),
  ])
  const programs = [
    { key: 'pelatihan' as const, label: 'Pelatihan Content', s: pel },
    { key: 'duta' as const, label: 'Duta Teladan', s: dut },
  ]
  const cards = [
    { t: 'Golden Ticket menunggu', v: stats.pending, href: '/admin/setoran?status=pending', tone: 'text-warn' },
    { t: 'Disetujui hari ini', v: stats.approvedToday, href: '/admin/setoran?status=approved', tone: 'text-ok' },
    { t: 'Ditolak (periode)', v: stats.rejected, href: '/admin/setoran?status=rejected', tone: 'text-bad' },
    { t: 'Total periode', v: stats.totalPeriod, href: `/admin/setoran?period=${encodeURIComponent(settings.period_id)}`, tone: 'text-brand-purple' },
  ]
  return (
    <AdminShell session={session}>
      {isDemoStore() && (
        <p role="alert" className="mb-4 rounded-field border border-warn/40 bg-amber-50 p-3 text-sm font-bold">
          Mode demo: data belum tersimpan ke Google Sheets. Isi env APPS_SCRIPT_SECRET di server agar data permanen.
        </p>
      )}
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
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {programs.map((p) => (
          <Link key={p.key} href={`/admin/program/${p.key}`} className="panel-solid !p-4 hover:border-brand-violet">
            <p className="font-extrabold">{p.label}</p>
            <p className="muted mt-1 text-sm">
              <b className="text-warn">{pendingByProgram[p.key]}</b> menunggu review ·{' '}
              {p.s.mode === 'draw' ? `${p.s.met} orang masuk undian` : `minggu ini ${p.s.met}/${p.s.active} capai target ${p.s.target.tiktok} TikTok + ${p.s.target.reels} Reels`}
            </p>
          </Link>
        ))}
      </div>
      <section className="panel-solid mt-4">
        <h2 className="font-extrabold">Link Golden Ticket terkumpul</h2>
        <p className="mt-1 text-sm">
          {progress.map((p) => (
            <span key={p.platform} className="mr-4"><b className="tabular-nums text-brand-purple">{formatNumber(p.used)}</b> {p.platform === 'tiktok' ? 'TikTok' : 'Reels'}</span>
          ))}
        </p>
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
                <span className="muted tabular-nums">{metricsText(s.likes, s.comments)}</span>
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
