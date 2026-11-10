'use client'
import { useState } from 'react'
import { embedUrl } from '@/lib/embed'
import { formatDate, formatNumber, metricsText } from '@/lib/format'
import type { CollectedFeed as Feed, CollectedItem } from '@/lib/service'
import { ExternalIcon } from './icons'
import { PillLabel, PlatformTag } from './ui'

function Card({ item, playing, onPlay }: { item: CollectedItem; playing: boolean; onPlay: () => void }) {
  const embed = embedUrl(item.source_url)
  return (
    <li className="min-w-0 rounded-field border border-brand-purple/10 bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <PlatformTag platform={item.platform} />
        {item.status === 'approved' && <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-900">Disetujui</span>}
        <span className="muted ml-auto text-xs">{formatDate(item.created_at)}</span>
      </div>
      <p className="mt-2 font-extrabold">{item.name}</p>
      <p className="text-sm tabular-nums">{metricsText(item.likes, item.comments)}</p>
      <p className="muted truncate text-xs">{item.source_url.replace('https://www.', '')}</p>
      {playing && embed && (
        <iframe
          title={`Pratinjau konten ${item.name}`}
          src={embed}
          className="mt-2 h-[560px] w-full rounded-field border border-brand-purple/10"
          loading="lazy"
          allow="encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
        />
      )}
      <div className="mt-1 flex flex-wrap gap-x-4 text-sm font-bold">
        {embed && !playing && (
          <button type="button" onClick={onPlay} className="inline-flex min-h-[44px] items-center text-brand-purple underline underline-offset-4">Putar di sini</button>
        )}
        <a href={item.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-[44px] items-center gap-1 text-brand-purple underline underline-offset-4">Buka link <ExternalIcon /></a>
      </div>
    </li>
  )
}

/** Public preview of collected Golden Ticket links. Players load only when asked, to keep the page light. */
export function CollectedFeed({ initial }: { initial: Feed }) {
  const [feed, setFeed] = useState(initial)
  const [playing, setPlaying] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function more() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/goldenticket/collected?offset=${feed.items.length}`)
      if (!res.ok) throw new Error()
      const next: Feed = await res.json()
      const known = new Set(feed.items.map((i) => i.id))
      setFeed({ ...next, items: [...feed.items, ...next.items.filter((i) => !known.has(i.id))] })
    } catch {
      setError('Belum bisa memuat. Coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="panel" aria-labelledby="terkumpul">
      <PillLabel id="terkumpul">Link terkumpul</PillLabel>
      <p className="mt-3 text-sm"><b className="text-2xl font-extrabold tabular-nums text-brand-purple">{formatNumber(feed.total)}</b> link · {formatNumber(feed.tiktok)} TikTok · {formatNumber(feed.reels)} Reels</p>
      {feed.items.length === 0 ? (
        <p className="muted mt-3 text-sm">Belum ada link terkumpul. Jadilah yang pertama menyetor.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Daftar link terkumpul">
          {feed.items.map((i) => <Card key={i.id} item={i} playing={playing === i.id} onPlay={() => setPlaying(i.id)} />)}
        </ul>
      )}
      {error && <p role="alert" className="mt-2 text-sm font-bold text-bad">{error}</p>}
      {feed.items.length < feed.total && (
        <button type="button" className="btn-ghost mt-3 w-full" onClick={more} disabled={busy}>{busy ? 'Memuat…' : 'Muat lagi'}</button>
      )}
    </section>
  )
}
