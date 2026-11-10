import { formatNumber } from '@/lib/format'
import type { Settings } from '@/lib/types'
import { CheckIcon } from './icons'

function short(n: number) {
  if (n >= 1_000_000 && n % 100_000 === 0) return `${formatNumber(n / 1_000_000)} jt`
  if (n >= 1000 && n % 100 === 0) return `${formatNumber(n / 1000)} rb`
  return formatNumber(n)
}

export function RulesList({ settings }: { settings: Settings }) {
  const items = [
    { k: 'TikTok', v: `≥ ${short(settings.min_like_tiktok)} like · ≥ ${short(settings.min_comment_tiktok)} komentar` },
    { k: 'Reels', v: `≥ ${short(settings.min_like_reels)} like · ≥ ${short(settings.min_comment_reels)} komentar` },
    { k: 'Organik', v: 'Muncul sendiri di FYP TikTok / Beranda Reels kamu' },
    { k: 'Pro & kontra', v: 'Konten yang memancing debat sehat di kolom komentar' },
    { k: 'Cukup tempel link', v: 'Buka link-nya dan pastikan angkanya memenuhi, lalu setor' },
  ]
  return (
    <ul className="mt-4 space-y-2.5">
      {items.map((i) => (
        <li key={i.k} className="flex items-start gap-3">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-purple text-white">
            <CheckIcon className="h-3.5 w-3.5" />
          </span>
          <span>
            <span className="font-bold">{i.k}</span> <span className="muted">{i.v}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
