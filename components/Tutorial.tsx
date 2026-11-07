'use client'
import { useEffect, useState } from 'react'
import { CheckIcon, GiftSolid, LinkIcon, UploadIcon } from './icons'
import { useAutoplay } from './useAutoplay'

const STEPS = [
  { title: 'Upload konten', help: 'Unggah video, artikel, atau konten lainnya ke Sharein.' },
  { title: 'Bagikan link', help: 'Salin link unik kontenmu lalu bagikan ke WA, IG, atau TikTok.' },
  { title: 'Dapatkan reward', help: 'Makin banyak yang mengakses, makin besar peluang reward.' },
]
// Each step plays as a tiny storyboard: frame durations in ms.
const FRAMES = [
  [900, 700, 1400, 1300],
  [800, 900, 1100, 1300],
  [700, 1800, 1500],
]
const STEP_MS = FRAMES.map((f) => f.reduce((a, b) => a + b, 0))
const LAST = FRAMES.map((f) => f.length - 1)
const TARGETS = ['WhatsApp', 'Instagram', 'TikTok']

function useCountUp(target: number, run: boolean, ms = 1500) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!run) return setV(0)
    let raf = 0
    const t0 = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      setV(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, run, ms])
  return v
}

/** Interactive phone story: plays by itself, stops when a step bar is clicked. */
export function Tutorial() {
  const { ref, playing, stop } = useAutoplay<HTMLDivElement>()
  const [step, setStep] = useState(0)
  const [frame, setFrame] = useState(0)

  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => {
      if (frame < LAST[step]) setFrame(frame + 1)
      else {
        setStep((step + 1) % STEPS.length)
        setFrame(0)
      }
    }, FRAMES[step][frame])
    return () => clearTimeout(t)
  }, [playing, step, frame])

  function jump(i: number) {
    stop()
    setStep(i)
    setFrame(LAST[i])
  }
  // Manual taps inside the phone advance the story one frame.
  const tap = () => {
    stop()
    if (frame < LAST[step]) setFrame(frame + 1)
  }

  const views = useCountUp(1250, step === 2 && frame >= 1)
  const f = frame

  return (
    <div ref={ref} className="grid items-center gap-6 md:grid-cols-[.9fr_1.1fr]">
      <ol className="order-2 space-y-3 md:order-1" aria-label="Langkah tutorial">
        {STEPS.map((s, i) => (
          <li key={s.title}>
            <button
              type="button"
              onClick={() => jump(i)}
              aria-current={step === i ? 'step' : undefined}
              className={`relative w-full overflow-hidden rounded-field border p-4 text-left transition-colors ${step === i ? 'border-brand-purple bg-white' : 'border-brand-purple/10 bg-white/60'}`}
            >
              <span className="mr-2 font-extrabold text-brand-purple">{i + 1}</span>
              <b>{s.title}</b>
              <span className="muted mt-1 block text-sm">{s.help}</span>
              {step === i && (
                <span
                  key={`${i}-${playing}`}
                  className={`tut-bar absolute inset-x-0 bottom-0 h-1 origin-left bg-gradient-to-r from-brand-purple to-brand-orange ${playing ? '' : 'is-static'}`}
                  style={{ animationDuration: `${STEP_MS[i]}ms` }}
                  aria-hidden="true"
                />
              )}
            </button>
          </li>
        ))}
      </ol>

      <div className="order-1 flex flex-col items-center md:order-2">
        <div className="relative h-[460px] w-[250px] overflow-hidden rounded-[38px] border-[8px] border-ink bg-white p-4 shadow-[0_30px_60px_-30px_rgba(42,15,92,.6)]">
          {/* Story-style step bar on top of the phone. */}
          <div className="mb-3 grid grid-cols-3 gap-1" aria-hidden="true">
            {STEPS.map((s, i) => (
              <span key={s.title} className="h-1 overflow-hidden rounded-full bg-brand-purple/15">
                <span
                  key={`${i}-${step}-${playing}`}
                  className={`block h-full origin-left rounded-full bg-brand-purple ${i < step ? 'w-full' : i === step ? `tut-bar w-full ${playing ? '' : 'is-static'}` : 'w-0'}`}
                  style={i === step ? { animationDuration: `${STEP_MS[i]}ms` } : undefined}
                />
              </span>
            ))}
          </div>
          <div className="mx-auto mb-4 h-4 w-20 rounded-full bg-ink" />

          <div role="group" aria-roledescription="animasi tutorial" aria-label={`Langkah ${step + 1}: ${STEPS[step].title}`} onClick={tap} className="h-[330px] cursor-pointer">
            {step === 0 && (
              <div className="space-y-4">
                <p className="text-lg font-extrabold">Upload konten</p>
                <div className={`rounded-field border-2 border-dashed p-5 text-center transition-colors ${f >= 1 ? 'border-brand-purple bg-brand-purple/5' : 'border-brand-violet/50 bg-brand-lavender'}`}>
                  <UploadIcon className={`mx-auto h-10 w-10 text-brand-purple ${f === 0 ? 'tut-float' : ''}`} />
                  <p className="my-3 text-xs">{f >= 1 ? 'video-kreatif.mp4' : 'Pilih video untuk mulai'}</p>
                  <span className={`btn-primary btn-sm w-full ${f === 1 ? 'tut-press' : ''}`}>{f >= 1 ? 'Video dipilih' : 'Pilih video'}</span>
                </div>
                {f >= 2 && (
                  <div className="tut-pop rounded-field bg-green-50 p-3 text-xs text-green-900">
                    <div className="flex items-center gap-2">
                      <span className="h-9 w-14 rounded-md bg-gradient-to-br from-brand-violet to-brand-orange" />
                      <span className="font-bold">video-kreatif.mp4</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-green-200">
                      <div className={`h-full rounded-full bg-green-600 ${f === 2 ? 'tut-fill' : 'w-full'}`} />
                    </div>
                    {f >= 3 && <span className="tut-pop mt-1 flex items-center gap-1 font-bold"><CheckIcon className="h-3 w-3" /> Upload selesai</span>}
                  </div>
                )}
              </div>
            )}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-lg font-extrabold">Link kontenmu</p>
                <div className="tut-pop flex items-center gap-2 break-all rounded-field bg-brand-lavender p-3 text-xs">
                  <LinkIcon className="h-4 w-4 shrink-0 text-brand-purple" /> sharein.id/s/abc123
                </div>
                <span className={`btn-primary btn-sm w-full ${f === 1 ? 'tut-press' : ''}`}>
                  <LinkIcon className="h-4 w-4" /> {f >= 1 ? 'Tersalin' : 'Salin link'}
                </span>
                {f >= 1 && <p className="tut-pop mx-auto w-fit rounded-full bg-ink px-3 py-1 text-[11px] font-bold text-white">Link disalin ✓</p>}
                {f >= 2 && (
                  <div className="grid grid-cols-3 gap-2 text-center text-xs font-bold">
                    {TARGETS.map((x, i) => (
                      <span key={x} className={`tut-pop rounded-field py-2 ${f >= 3 && i === 0 ? 'bg-green-500 text-white' : 'bg-brand-lavender'}`} style={{ animationDelay: `${i * 120}ms` }}>
                        {x}
                      </span>
                    ))}
                  </div>
                )}
                {f >= 3 && <p className="tut-pop text-center text-xs font-bold text-green-700">Terkirim ke grup WhatsApp!</p>}
              </div>
            )}
            {step === 2 && (
              <div className="relative space-y-4 text-center">
                <p className="text-lg font-extrabold">Performa konten</p>
                <div className="rounded-field bg-brand-lavender p-5">
                  <span className="block text-4xl font-extrabold tabular-nums text-brand-purple">{(f === 0 ? 0 : f >= 2 ? 1250 : views).toLocaleString('id-ID')}</span>
                  <span className="muted text-xs">penonton</span>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-brand-purple/15">
                    <div className="progress-fill h-full rounded-full transition-[width] duration-[1500ms] ease-out" style={{ width: f === 0 ? '0%' : '100%' }} />
                  </div>
                </div>
                <div className={`mx-auto w-fit ${f >= 2 ? 'bounce-once' : 'opacity-40 grayscale'}`}>
                  <GiftSolid className="h-16 w-16" />
                </div>
                {f >= 2 && (
                  <div className="pointer-events-none absolute left-1/2 top-[62%]" aria-hidden="true">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <i key={i} className="tut-confetti" style={{ ['--a' as string]: `${i * 36}deg`, background: ['#6C2BD9', '#F97316', '#FBBF24', '#A855F7'][i % 4] }} />
                    ))}
                  </div>
                )}
                <p className="text-xs font-bold">{f >= 2 ? 'Reward terbuka!' : 'Capai target untuk membuka hadiah'}</p>
              </div>
            )}
          </div>
          <p className="absolute inset-x-4 bottom-3 text-center text-[10px] text-brand-purple">Simulasi tutorial Sharein</p>
        </div>
        <p className="mt-4 text-center font-bold" aria-live="polite">{STEPS[step].help}</p>
      </div>
    </div>
  )
}
