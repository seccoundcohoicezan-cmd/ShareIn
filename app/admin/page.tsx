import Link from 'next/link'
import { PlatformTag, StatusBadge, EmptyState } from '@/components/ui'
import { dashboard, sheetSync } from '@/lib/admin-service'
import { formatDateTime, formatNumber } from '@/lib/format'
import { programSummary } from '@/lib/progress'
import { isDemoStore } from '@/lib/repo'
import { CHANNEL_INFO, type Channel } from '@/lib/types'
import { AdminShell, requirePageSession } from './shell'

export const dynamic = 'force-dynamic'

// Program colours for the 7-day chart (validated: CVD/normal-vision separation passes; amber is
// below 3:1 on white, so every day also shows its number and a table view exists).
const CH: { key: Channel; label: string; color: string; href: string }[] = [
  { key: 'golden', label: 'Golden Ticket', color: '#e8a20c', href: '/admin/setoran' },
  { key: 'pelatihan', label: 'Pelatihan Content', color: '#6c2bd9', href: '/admin/program/pelatihan' },
  { key: 'duta', label: 'Duta Teladan', color: '#0e9f8e', href: '/admin/program/duta' },
]

export default async function AdminHome() {
  const session = await requirePageSession()
  const [{ totals, byChannel, daily, recent, settings }, pel, dut, sync] = await Promise.all([
    dashboard(),
    programSummary('pelatihan'),
    programSummary('duta'),
    sheetSync(),
  ])
  const tiles = [
    { t: 'Total link masuk', v: totals.total, sub: `${formatNumber(totals.tiktok)} TikTok · ${formatNumber(totals.reels)} Reels`, tone: 'text-brand-purple' },
    { t: 'Menunggu review', v: totals.pending, sub: 'semua program', tone: 'text-warn' },
    { t: 'Disetujui', v: totals.approved, sub: totals.total ? `${Math.round((totals.approved / totals.total) * 100)}% dari total` : '-', tone: 'text-ok' },
    { t: 'Ditolak', v: totals.rejected, sub: 'semua program', tone: 'text-bad' },
    { t: 'Masuk hari ini', v: totals.today, sub: 'WIB', tone: 'text-ink' },
    { t: 'Peserta terdaftar', v: totals.participants, sub: 'akun link unik', tone: 'text-ink' },
  ]
  const note: Record<Channel, string> = {
    golden: settings.auto_approve_golden ? 'Setujui otomatis aktif' : 'Direview manual',
    pelatihan: pel.mode === 'draw' ? `${pel.met} orang masuk undian` : `minggu ini ${pel.met}/${pel.active} capai target`,
    duta: dut.mode === 'draw' ? `${dut.met} orang masuk undian` : `minggu ini ${dut.met}/${dut.active} capai target ${dut.target.tiktok} TikTok + ${dut.target.reels} Reels`,
  }
  const maxDay = Math.max(1, ...daily.map((d) => d.golden + d.pelatihan + d.duta))
  const dayLabel = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })
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
      {sync && (
        <p className={`mb-3 rounded-field px-3 py-2 text-xs font-bold ${sync.lastError && sync.pending.length ? 'bg-amber-50 text-amber-900' : 'bg-green-50 text-green-900'}`}>
          {sync.pending.length === 0
            ? `Spreadsheet tersinkron${sync.lastSyncAt ? ` · terakhir ${formatDateTime(sync.lastSyncAt)}` : ''}`
            : sync.lastError
              ? `Spreadsheet tertunda (${sync.pending.length} tab), dicoba ulang otomatis. Data aman di server.`
              : 'Mengirim perubahan ke spreadsheet…'}
        </p>
      )}

      <section aria-label="Ringkasan semua program" className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map((c) => (
          <div key={c.t} className="panel-solid !p-4">
            <p className="muted text-xs font-bold">{c.t}</p>
            <p className={`mt-1 text-3xl font-extrabold tabular-nums ${c.tone}`}>{formatNumber(c.v)}</p>
            <p className="muted mt-0.5 text-xs">{c.sub}</p>
          </div>
        ))}
      </section>

      <section aria-label="Per program" className="mt-4 grid gap-3 md:grid-cols-3">
        {CH.map((c) => {
          const s = byChannel[c.key]
          return (
            <Link key={c.key} href={c.href} className="panel-solid !p-4 hover:border-brand-violet">
              <p className="flex items-center gap-2 font-extrabold">
                <span aria-hidden className="h-3 w-3 rounded-full" style={{ background: c.color }} />
                {c.label}
              </p>
              <p className="mt-2 text-3xl font-extrabold tabular-nums">{formatNumber(s.total)} <span className="muted text-sm font-bold">link</span></p>
              <p className="muted text-sm">{formatNumber(s.tiktok)} TikTok · {formatNumber(s.reels)} Reels · {formatNumber(s.today)} hari ini</p>
              <p className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-900">{formatNumber(s.pending)} menunggu</span>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-900">{formatNumber(s.approved)} disetujui</span>
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-900">{formatNumber(s.rejected)} ditolak</span>
              </p>
              <p className="muted mt-2 text-xs">{note[c.key]}</p>
            </Link>
          )
        })}
      </section>

      <section className="panel-solid mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-extrabold">Link masuk 7 hari terakhir</h2>
          <ul className="flex flex-wrap gap-3 text-xs font-bold" aria-label="Keterangan warna">
            {CH.map((c) => (
              <li key={c.key} className="flex items-center gap-1.5"><span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />{c.label}</li>
            ))}
          </ul>
        </div>
        <div className="mt-4 grid h-44 grid-cols-7 items-end gap-2" aria-hidden>
          {daily.map((d) => {
            const total = d.golden + d.pelatihan + d.duta
            return (
              <div key={d.day} className="flex h-full flex-col items-center justify-end gap-1">
                <span className="text-xs font-bold tabular-nums">{formatNumber(total)}</span>
                <div className="flex w-full max-w-[44px] flex-col-reverse gap-[2px]" style={{ height: `${(total / maxDay) * 100}%`, minHeight: total ? 4 : 0 }}>
                  {CH.map((c) => d[c.key] > 0 && (
                    <div
                      key={c.key}
                      title={`${dayLabel(d.day)} · ${c.label}: ${d[c.key]}`}
                      className="w-full first:rounded-b-[4px] last:rounded-t-[4px]"
                      style={{ background: c.color, flexGrow: d[c.key], minHeight: 3 }}
                    />
                  ))}
                </div>
                <span className="muted text-[11px]">{dayLabel(d.day)}</span>
              </div>
            )
          })}
        </div>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer font-bold text-brand-purple">Lihat sebagai tabel</summary>
          <table className="mt-2 w-full text-left text-xs tabular-nums">
            <thead><tr><th className="py-1">Hari</th>{CH.map((c) => <th key={c.key} className="py-1 text-right">{c.label}</th>)}<th className="py-1 text-right">Total</th></tr></thead>
            <tbody>
              {daily.map((d) => (
                <tr key={d.day} className="border-t border-brand-purple/10">
                  <td className="py-1">{dayLabel(d.day)}</td>
                  {CH.map((c) => <td key={c.key} className="py-1 text-right">{d[c.key]}</td>)}
                  <td className="py-1 text-right font-bold">{d.golden + d.pelatihan + d.duta}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section className="panel-solid mt-4">
        <h2 className="mb-3 font-extrabold">Setoran terbaru (semua program)</h2>
        {recent.length === 0 ? (
          <EmptyState title="Belum ada setoran." />
        ) : (
          <ul className="divide-y divide-brand-purple/10">
            {recent.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-3 text-sm">
                <PlatformTag platform={s.platform} />
                <span className="font-bold">{s.submitter_name}</span>
                <span className="muted text-xs">{CHANNEL_INFO[s.program].label}</span>
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
