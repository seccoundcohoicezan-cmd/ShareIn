type P = { className?: string }
const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

export function ArrowUpIcon({ className = 'h-5 w-5' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
    </svg>
  )
}
export function GiftIcon({ className = 'h-5 w-5' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <rect x="3.5" y="8.5" width="17" height="4" rx="1" />
      <path d="M5 12.5v7.5h14v-7.5M12 8.5V20M12 8.5S10.8 4 8.2 4C6.7 4 6 5 6 6.1 6 7.6 7.6 8.5 9.4 8.5H12Zm0 0s1.2-4.5 3.8-4.5C17.3 4 18 5 18 6.1c0 1.5-1.6 2.4-3.4 2.4H12Z" />
    </svg>
  )
}
export function GiftSolid({ className = 'h-20 w-20' }: P) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect x="8" y="26" width="48" height="32" rx="5" fill="#FBBF24" />
      <rect x="5" y="18" width="54" height="12" rx="4" fill="#F97316" />
      <rect x="28" y="18" width="8" height="40" fill="#6C2BD9" />
      <path d="M32 18c-3-7-8-11-13-10-4 1-5 6-1 8 4 2 10 2 14 2Zm0 0c3-7 8-11 13-10 4 1 5 6 1 8-4 2-10 2-14 2Z" fill="#A855F7" />
    </svg>
  )
}
export function LinkIcon({ className = 'h-5 w-5' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
      <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
    </svg>
  )
}
export function UploadIcon({ className = 'h-5 w-5' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <rect x="3" y="4" width="18" height="14" rx="3" />
      <path d="m10 8.5 4.5 2.5-4.5 2.5z" />
      <path d="M8 21h8" />
    </svg>
  )
}
export function CheckIcon({ className = 'h-4 w-4' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base} strokeWidth={3}>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  )
}
export function CrossIcon({ className = 'h-4 w-4' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base} strokeWidth={3}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}
export function ChevronLeft({ className = 'h-5 w-5' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="m14.5 5-7 7 7 7" />
    </svg>
  )
}
export function ExternalIcon({ className = 'h-4 w-4' }: P) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...base}>
      <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  )
}
