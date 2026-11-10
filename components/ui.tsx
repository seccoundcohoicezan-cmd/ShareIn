import type { ReactNode } from 'react'
import type { SubmissionStatus } from '@/lib/types'
import { ArrowUpIcon } from './icons'

export function PillLabel({ children, as: Tag = 'h2', id }: { children: ReactNode; as?: 'h1' | 'h2' | 'h3' | 'span'; id?: string }) {
  return (
    <Tag id={id} className="pill">
      {children}
    </Tag>
  )
}

export function Panel({ children, className = '', solid = false, ...rest }: { children: ReactNode; className?: string; solid?: boolean } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={`${solid ? 'panel-solid' : 'panel'} ${className}`} {...rest}>
      {children}
    </section>
  )
}

const STATUS: Record<SubmissionStatus, { text: string; cls: string }> = {
  pending: { text: 'Menunggu', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  approved: { text: 'Disetujui', cls: 'bg-green-100 text-green-900 border-green-300' },
  rejected: { text: 'Ditolak', cls: 'bg-red-100 text-red-900 border-red-300' },
  void: { text: 'Batal', cls: 'bg-gray-100 text-gray-700 border-gray-300' },
}

export function StatusBadge({ status }: { status: SubmissionStatus }) {
  const s = STATUS[status]
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold ${s.cls}`}>{s.text}</span>
}

export function PlatformTag({ platform }: { platform: 'tiktok' | 'reels' }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${platform === 'tiktok' ? 'bg-ink text-white' : 'bg-gradient-to-r from-brand-violet to-brand-orange text-white'}`}>
      {platform === 'tiktok' ? 'TikTok' : 'Reels'}
    </span>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-panel border border-dashed border-brand-purple/25 bg-white/60 p-8 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple">
        <ArrowUpIcon className="h-6 w-6" />
      </div>
      <p className="font-bold">{title}</p>
      {children && <div className="muted mt-2 text-sm">{children}</div>}
    </div>
  )
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <span aria-hidden="true" className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />
}

/** Thin indeterminate bar at the top of the screen while the admin waits for the server. */
export function TopProgress({ active, label = 'Menyimpan…' }: { active: boolean; label?: string }) {
  if (!active) return null
  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 top-0 z-[60] h-1 overflow-hidden bg-brand-purple/15">
      <span className="sr-only">{label}</span>
      <div className="top-progress h-full w-1/3 rounded-full bg-brand-purple" />
    </div>
  )
}
