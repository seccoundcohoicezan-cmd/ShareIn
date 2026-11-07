'use client'
import { useEffect, useState } from 'react'
import { CheckIcon, GiftSolid, LinkIcon, UploadIcon } from './icons'

const STEPS = [
  { title: 'Upload konten', help: 'Unggah video, artikel, atau konten lainnya ke Sharein.' },
  { title: 'Bagikan link', help: 'Salin link unik kontenmu lalu bagikan ke WA, IG, atau TikTok.' },
  { title: 'Dapatkan reward', help: 'Makin banyak yang mengakses, makin besar peluang reward.' },
]
const DONE_KEY = 'sharein-tutorial-done'

/** Interactive phone mock: tap through upload → share → reward. Keyboard arrows and swipe supported. */
export function Tutorial() {
  const [step, setStep] = useState(0)
  const [uploaded, setUploaded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [views, setViews] = useState(0)
  const [compact, setCompact] = useState(false)
  const [touchX, setTouchX] = useState<number | null>(null)

  useEffect(() => {
    try {
      if (localStorage.getItem(DONE_KEY)) setCompact(true)
    } catch {}
  }, [])

  const move = (d: number) => setStep((s) => Math.max(0, Math.min(2, s + d)))
  function finish() {
    setCompact(true)
    try {
      localStorage.setItem(DONE_KEY, '1')
    } catch {}
  }
  function reset() {
    setStep(0)
    setUploaded(false)
    setCopied(false)
    setViews(0)
    setCompact(false)
  }

  if (compact) {
    return (
      <div className="panel text-center">
        <p className="font-bold">Tutorial selesai. Pilih program di bawah untuk mulai.</p>
        <button type="button" className="btn-ghost mt-4" onClick={reset}>Lihat lagi tutorial</button>
      </div>
    )
  }

  return (
    <div className="grid items-center gap-6 md:grid-cols-[.9fr_1.1fr]">
      <ol className="hidden space-y-3 md:block">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={() => setStep(i)}
              aria-current={step === i ? 'step' : undefined}
              className={`w-full rounded-field border p-4 text-left ${step === i ? 'border-brand-purple bg-white' : 'border-brand-purple/10 bg-white/60'}`}
            >
              <span className="mr-2 font-extrabold text-brand-purple">{i + 1}</span>
              <b>{s.title}</b>
              <span className="muted mt-1 block text-sm">{s.help}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-col items-center">
        <div
          tabIndex={0}
          role="group"
          aria-roledescription="tutorial"
          aria-label={`Langkah ${step + 1} dari 3: ${STEPS[step].title}. Gunakan panah kiri dan kanan.`}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') { e.preventDefault(); move(1) }
            if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1) }
          }}
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX !== null) {
              const dx = e.changedTouches[0].clientX - touchX
              if (Math.abs(dx) > 45) move(dx < 0 ? 1 : -1)
            }
            setTouchX(null)
          }}
          className="relative h-[440px] w-[250px] overflow-hidden rounded-[38px] border-[8px] border-ink bg-white p-4"
        >
          <div className="mx-auto mb-6 h-4 w-20 rounded-full bg-ink" />
          {step === 0 && (
            <div className="space-y-4">
              <p className="text-lg font-extrabold">Upload konten</p>
              <div className="rounded-field border-2 border-dashed border-brand-violet/50 bg-brand-lavender p-5 text-center">
                <UploadIcon className="mx-auto h-10 w-10 text-brand-purple" />
                <p className="my-3 text-xs">Pilih video untuk mulai</p>
                <button type="button" onClick={() => setUploaded(true)} className="btn-primary btn-sm w-full">
                  {uploaded ? 'Video dipilih' : 'Pilih video'}
                </button>
              </div>
              {uploaded && (
                <div className="rounded-field bg-green-50 p-3 text-xs text-green-900">
                  video-kreatif.mp4
                  <div className="mt-2 h-2 rounded-full bg-green-600" />
                  <span className="mt-1 flex items-center gap-1 font-bold"><CheckIcon className="h-3 w-3" /> Upload selesai</span>
                </div>
              )}
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-lg font-extrabold">Link kontenmu</p>
              <div className="break-all rounded-field bg-brand-lavender p-3 text-xs">sharein.id/s/abc123</div>
              <button type="button" onClick={() => setCopied(true)} className="btn-primary btn-sm w-full">
                <LinkIcon className="h-4 w-4" /> {copied ? 'Tersalin' : 'Salin link'}
              </button>
              {copied && (
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                  {['WhatsApp', 'Instagram', 'TikTok'].map((x) => (
                    <span key={x} className="rounded-field bg-brand-lavender py-2">{x}</span>
                  ))}
                </div>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4 text-center">
              <p className="text-lg font-extrabold">Performa konten</p>
              <button type="button" onClick={() => setViews(1250)} className="w-full rounded-field bg-brand-lavender p-5">
                <span className="block text-4xl font-extrabold text-brand-purple tabular-nums">{views.toLocaleString('id-ID')}</span>
                <span className="muted text-xs">penonton · ketuk untuk simulasi</span>
              </button>
              <div className={`mx-auto w-fit ${views ? 'bounce-once' : 'opacity-40 grayscale'}`}>
                <GiftSolid className="h-16 w-16" />
              </div>
              <p className="text-xs font-bold">{views ? 'Reward terbuka!' : 'Capai target untuk membuka hadiah'}</p>
            </div>
          )}
          <p className="absolute inset-x-4 bottom-3 text-center text-[10px] text-brand-violet">Simulasi tutorial Sharein</p>
        </div>
        <p className="mt-4 text-center font-bold" aria-live="polite">{STEPS[step].help}</p>
        <div className="my-3 flex gap-2">
          {STEPS.map((s, i) => (
            <button key={s.title} type="button" aria-label={`Langkah ${i + 1}`} onClick={() => setStep(i)} className="flex h-11 items-center px-1">
              <span className={`block h-2.5 rounded-full ${i === step ? 'w-8 bg-brand-purple' : 'w-2.5 bg-brand-violet/30'}`} />
            </button>
          ))}
        </div>
        <div className="flex gap-3">
          <button type="button" className="btn-ghost" disabled={step === 0} onClick={() => move(-1)}>Kembali</button>
          <button type="button" className="btn-primary" onClick={() => (step === 2 ? finish() : move(1))}>{step === 2 ? 'Selesai' : 'Lanjut'}</button>
        </div>
        <button type="button" className="muted mt-2 min-h-[44px] text-xs underline" onClick={finish}>Lewati tutorial</button>
      </div>
    </div>
  )
}
