'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { embedUrl } from '@/lib/embed'
import { ExternalIcon } from './icons'

type Tab = { label: string; url: string }

/**
 * Review modal: live preview of the submitted links (official TikTok/Instagram embed,
 * other links in a frame with an "open in new tab" fallback) next to the approve/reject actions.
 */
export function PreviewPanel({ title, tabs, details, actions, onClose }: { title: string; tabs: Tab[]; details: ReactNode; actions: ReactNode; onClose: () => void }) {
  const [active, setActive] = useState(0)
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  const tab = tabs[active]
  const embed = tab ? embedUrl(tab.url) : null
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/50 p-2 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="preview-title">
      <div className="flex max-h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-panel bg-white">
        <div className="flex items-center gap-3 border-b border-brand-purple/10 p-4">
          <h2 id="preview-title" className="min-w-0 flex-1 truncate text-lg font-extrabold">{title}</h2>
          <button ref={closeRef} type="button" className="btn-ghost btn-sm" onClick={onClose}>Tutup</button>
        </div>
        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 md:grid-cols-[minmax(0,340px)_1fr]">
          <div>
            {tabs.length > 1 && (
              <div role="tablist" className="mb-3 grid grid-cols-2 gap-1 rounded-field bg-brand-lavender p-1">
                {tabs.map((t, i) => (
                  <button key={t.label} role="tab" type="button" aria-selected={i === active} onClick={() => setActive(i)} className={`min-h-[40px] rounded-[12px] text-sm font-bold ${i === active ? 'bg-brand-purple text-white' : 'text-brand-purple'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
            {tab && (
              <>
                <div className="overflow-hidden rounded-field border border-brand-purple/10 bg-brand-lavender">
                  <iframe
                    key={tab.url}
                    title={`Pratinjau ${tab.label}`}
                    src={embed ?? tab.url}
                    className="h-[560px] w-full"
                    loading="lazy"
                    allow="encrypted-media; picture-in-picture; fullscreen"
                    referrerPolicy="strict-origin-when-cross-origin"
                    sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
                  />
                </div>
                <a href={tab.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-sm font-bold text-brand-purple underline underline-offset-4">
                  Buka di tab baru <ExternalIcon />
                </a>
                {!embed && <p className="muted text-xs">Jika pratinjau kosong, situs tersebut menolak ditampilkan di dalam bingkai. Buka di tab baru.</p>}
              </>
            )}
          </div>
          <div className="space-y-4">
            <div className="text-sm">{details}</div>
            <div className="flex flex-wrap gap-2">{actions}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
