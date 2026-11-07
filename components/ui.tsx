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

export function ProgressBar({ label, used, target }: { label: string; used: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((used / target) * 100)) : 0
  const full = target > 0 && used >= target
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="font-bold">{label}</span>
        <span className="text-sm font-bold tabular-nums">
          {used}/{target}
          {full && <span className="ml-2 rounded-full bg-brand-amber/30 px-2 py-0.5 text-xs text-ink">Penuh</span>}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`Progres ${label}`}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(used, target)}
        aria-valuetext={`${used} dari ${target}`}
        className="h-3 overflow-hidden rounded-full bg-brand-purple/15"
      >
        <div className="progress-fill h-full rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
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
