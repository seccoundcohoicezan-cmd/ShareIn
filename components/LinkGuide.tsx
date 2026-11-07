'use client'
import { useEffect, useState } from 'react'
import { CheckIcon } from './icons'
import { useAutoplay } from './useAutoplay'

const STEP_MS = 3200

type Step = {
  title: string
  help: string
  /** Screenshot in /public/guide; null = illustrated step. */
  img: string | null
  /** Tap target as % of the screenshot. */
  spot?: { x: number; y: number }
}

const GUIDES: Record<'tiktok' | 'reels', { label: string; steps: Step[] }> = {
  tiktok: {
    label: 'TikTok',
    steps: [
      { title: 'Buka video di FYP', help: 'Putar video yang muncul sendiri di FYP kamu, lalu ketuk ikon panah Bagikan di kanan.', img: '/guide/tt-1.webp', spot: { x: 92.5, y: 79.5 } },
      { title: 'Ketuk "Salin Tautan"', help: 'Di menu "Kirim ke", ketuk tombol biru Salin Tautan.', img: '/guide/tt-2.webp', spot: { x: 25.8, y: 77.6 } },
      { title: 'Tempel di form setoran', help: 'Link sudah tersalin. Buka form setoran lalu tekan tombol Tempel di kolom Link TikTok.', img: null },
    ],
  },
  reels: {
    label: 'Instagram Reels',
    steps: [
      { title: 'Buka Instagram', help: 'Buka aplikasi Instagram, lalu masuk ke tab Reels atau Beranda.', img: '/guide/ig-1.webp', spot: { x: 76.4, y: 33.2 } },
      { title: 'Ketuk ikon Kirim', help: 'Saat Reels yang muncul di Beranda/Reels-mu diputar, ketuk ikon pesawat kertas di sisi kanan.', img: null },
      { title: 'Ketuk "Salin tautan"', help: 'Geser deretan tombol di bawah, lalu ketuk Salin tautan.', img: '/guide/ig-2.webp', spot: { x: 47.2, y: 87 } },
      { title: 'Muncul "Disalin"', help: 'Tanda Disalin berarti link siap. Tempel di kolom Link Instagram Reels pada form setoran.', img: '/guide/ig-3.webp', spot: { x: 49.7, y: 84.2 } },
    ],
  },
}

function PaperPlane() {
  return (
    <svg viewBox="0 0 64 64" className="h-20 w-20" aria-hidden="true">
      <path d="M8 30 56 8 44 56 30 38Z" fill="#A855F7" />
      <path d="M30 38 56 8 22 33Z" fill="#6C2BD9" />
      <path d="M30 38 28 50 36 43Z" fill="#2A0F5C" />
    </svg>
  )
}

export function LinkGuide({ initial = 'tiktok' }: { initial?: 'tiktok' | 'reels' }) {
  const [platform, setPlatform] = useState<'tiktok' | 'reels'>(initial)
  const [step, setStep] = useState(0)
  const { ref, playing, stop } = useAutoplay<HTMLDivElement>()
  const guide = GUIDES[platform]
  const s = guide.steps[step]
  const last = step === guide.steps.length - 1
  const next = () => setStep((i) => Math.min(guide.steps.length - 1, i + 1))

  // Autoplay: walk through the steps, then switch to the other app and loop.
  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => {
      if (step < guide.steps.length - 1) setStep(step + 1)
      else {
        setPlatform((p) => (p === 'tiktok' ? 'reels' : 'tiktok'))
        setStep(0)
      }
    }, STEP_MS)
    return () => clearTimeout(t)
  }, [playing, step, guide.steps.length])

  // Warm the cache for the other screenshots (~20–35 KB each) so step changes are instant.
  useEffect(() => {
    const t = setTimeout(() => {
      Object.values(GUIDES).forEach((g) => g.steps.forEach((st) => { if (st.img) new Image().src = st.img }))
    }, 1500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div ref={ref}>
      <div role="tablist" aria-label="Pilih aplikasi" className="mx-auto mb-4 grid max-w-xs grid-cols-2 gap-1 rounded-field bg-white p-1">
        {(Object.keys(GUIDES) as ('tiktok' | 'reels')[]).map((p) => (
          <button
            key={p}
            role="tab"
            type="button"
            aria-selected={platform === p}
            onClick={() => { stop(); setPlatform(p); setStep(0) }}
            className={`min-h-[44px] rounded-[12px] text-sm font-bold ${platform === p ? 'bg-brand-purple text-white' : 'text-brand-purple'}`}
          >
            {GUIDES[p].label}
          </button>
        ))}
      </div>

      <div className="grid items-center gap-5 md:grid-cols-[1fr_1fr]">
        <div className="relative mx-auto w-[236px] overflow-hidden rounded-[34px] border-[7px] border-ink bg-ink">
          <div className="absolute inset-x-3 top-2 z-10 flex gap-1" aria-hidden="true">
            {guide.steps.map((st, i) => (
              <span key={st.title} className="h-1 flex-1 overflow-hidden rounded-full bg-white/35">
                <span
                  key={`${platform}-${i}-${step}-${playing}`}
                  className={`block h-full origin-left rounded-full bg-white ${i < step ? 'w-full' : i === step ? `tut-bar w-full ${playing ? '' : 'is-static'}` : 'w-0'}`}
                  style={i === step ? { animationDuration: `${STEP_MS}ms` } : undefined}
                />
              </span>
            ))}
          </div>
          <div className="relative aspect-[9/20] w-full">
            {s.img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.img} alt={`Tangkapan layar: ${s.title}`} width={540} height={1200} decoding="async" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-brand-lavender p-5 text-center">
                {last ? (
                  <span className="flex h-20 w-20 items-center justify-center rounded-full bg-ok text-white"><CheckIcon className="h-10 w-10" /></span>
                ) : (
                  <PaperPlane />
                )}
                <p className="text-sm font-bold text-ink">{s.title}</p>
              </div>
            )}
            {s.spot && (
              <button
                type="button"
                onClick={() => { stop(); next() }}
                aria-label={`Ketuk di sini: ${s.title}`}
                className="guide-spot absolute h-12 w-12 -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ left: `${s.spot.x}%`, top: `${s.spot.y}%` }}
              />
            )}
          </div>
        </div>

        <div>
          <ol className="space-y-2">
            {guide.steps.map((st, i) => (
              <li key={st.title}>
                <button
                  type="button"
                  onClick={() => { stop(); setStep(i) }}
                  aria-current={i === step ? 'step' : undefined}
                  className={`flex w-full items-start gap-3 rounded-field border p-3 text-left ${i === step ? 'border-brand-purple bg-white' : 'border-transparent bg-white/50'}`}
                >
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${i < step ? 'bg-ok text-white' : i === step ? 'bg-brand-purple text-white' : 'bg-brand-purple/15 text-brand-purple'}`}>
                    {i < step ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span>
                    <b className="block">{st.title}</b>
                    {i === step && <span className="muted mt-0.5 block text-sm">{st.help}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-ghost btn-sm" disabled={step === 0} onClick={() => { stop(); setStep((i) => Math.max(0, i - 1)) }}>Kembali</button>
            {last ? (
              <a href="/goldenticket/setor" className="btn-primary btn-sm">Buka form setoran</a>
            ) : (
              <button type="button" className="btn-primary btn-sm" onClick={() => { stop(); next() }}>Lanjut</button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
