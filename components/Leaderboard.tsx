import { formatNumber } from '@/lib/format'
import type { Leaderboard as Board } from '@/lib/leaderboard'
import { PillLabel } from './ui'

const MEDAL = ['bg-gradient-to-br from-brand-amber to-brand-orange text-ink', 'bg-[#d9dbe3] text-ink', 'bg-[#e6b98a] text-ink']

/** Public Golden Ticket ranking: approved links only, so the list shows who actually got links accepted. */
export function Leaderboard({ board }: { board: Board }) {
  const top = board.rows[0]?.approved ?? 0
  return (
    <section className="panel" aria-labelledby="leaderboard">
      <PillLabel id="leaderboard">Leaderboard</PillLabel>
      <p className="muted mt-2 text-sm">Peringkat dihitung dari jumlah link yang <b>disetujui</b> admin, bukan jumlah link yang dikirim. Link yang masih menunggu atau ditolak tidak dihitung.</p>
      {board.rows.length === 0 ? (
        <p className="muted mt-3 text-sm">Belum ada link yang disetujui. Setor kontenmu dan jadilah yang pertama di papan ini.</p>
      ) : (
        <ol className="mt-3 space-y-2" aria-label="Peringkat peserta Golden Ticket">
          {board.rows.map((r, i) => (
            <li key={i} className="flex items-center gap-3 rounded-field bg-white p-3">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-extrabold tabular-nums ${MEDAL[r.rank - 1] ?? 'bg-brand-purple/10 text-brand-purple'}`}
                aria-label={`Peringkat ${r.rank}`}
              >
                {r.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-extrabold">{r.name}</p>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-brand-purple/10" aria-hidden="true">
                  <div className="h-full rounded-full bg-gradient-to-r from-brand-violet to-brand-orange" style={{ width: `${top ? Math.max(6, (r.approved / top) * 100) : 0}%` }} />
                </div>
                <p className="muted mt-1 text-xs">{formatNumber(r.tiktok)} TikTok · {formatNumber(r.reels)} Reels</p>
              </div>
              <p className="shrink-0 text-right">
                <b className="block text-xl font-extrabold tabular-nums text-brand-purple">{formatNumber(r.approved)}</b>
                <span className="muted text-xs font-bold">disetujui</span>
              </p>
            </li>
          ))}
        </ol>
      )}
      {board.participants > board.rows.length && (
        <p className="muted mt-2 text-xs">Menampilkan {board.rows.length} teratas dari {formatNumber(board.participants)} peserta.</p>
      )}
    </section>
  )
}
