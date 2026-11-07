'use client'
import { useEffect, useState } from 'react'

type ToastMsg = { id: number; text: string; tone: 'ok' | 'bad' }
let push: ((t: Omit<ToastMsg, 'id'>) => void) | null = null

export function toast(text: string, tone: 'ok' | 'bad' = 'ok') {
  push?.({ text, tone })
}

export function Toaster() {
  const [items, setItems] = useState<ToastMsg[]>([])
  useEffect(() => {
    push = (t) => {
      const id = Date.now() + Math.random()
      setItems((xs) => [...xs, { ...t, id }])
      setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 3000)
    }
    return () => {
      push = null
    }
  }, [])
  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
      {items.map((t) => (
        <div key={t.id} className={`rounded-full px-5 py-3 text-sm font-bold text-white ${t.tone === 'ok' ? 'bg-ink' : 'bg-bad'}`}>
          {t.text}
        </div>
      ))}
    </div>
  )
}
