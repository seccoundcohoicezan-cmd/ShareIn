type P = { tiktok: number; reels: number; target: { tiktok: number; reels: number } }

/** TikTok and Reels progress side by side, e.g. 3/5 and 5/5. */
export function TargetBars({ tiktok, reels, target }: P) {
  const rows = [
    { k: 'TikTok', n: tiktok, of: target.tiktok },
    { k: 'Instagram Reels', n: reels, of: target.reels },
  ]
  return (
    <div className="grid grid-cols-2 gap-3">
      {rows.map((r) => {
        const done = r.n >= r.of
        return (
          <div key={r.k}>
            <p className="text-xs font-bold">{r.k}</p>
            <p className="text-2xl font-extrabold tabular-nums">
              {Math.min(r.n, r.of)}
              <span className="text-base">/{r.of}</span>
              {done && <span className="ml-1 text-base text-ok">✓</span>}
            </p>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-brand-purple/10" role="progressbar" aria-label={`Progres ${r.k}`} aria-valuemin={0} aria-valuemax={r.of} aria-valuenow={Math.min(r.n, r.of)}>
              <div className={`h-full rounded-full ${done ? 'bg-ok' : 'bg-brand-purple'}`} style={{ width: `${r.of ? Math.min(100, (r.n / r.of) * 100) : 100}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function targetLeft(p: P): string {
  const parts = [
    p.target.tiktok - p.tiktok > 0 ? `${p.target.tiktok - p.tiktok} TikTok` : '',
    p.target.reels - p.reels > 0 ? `${p.target.reels - p.reels} Reels` : '',
  ].filter(Boolean)
  return parts.length ? `Kurang ${parts.join(' & ')} lagi.` : ''
}
