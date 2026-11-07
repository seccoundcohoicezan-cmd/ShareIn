import type { Metadata } from 'next'

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin Sharein' }, robots: { index: false, follow: false } }

// Admin: plain lavender background, no motion.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-brand-lavender">{children}</div>
}
