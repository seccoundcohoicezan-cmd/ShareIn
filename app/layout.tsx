import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '700', '800'],
  display: 'swap',
  variable: '--font-jakarta',
})

export const metadata: Metadata = {
  title: { default: 'Setor konten viral · Sharein', template: '%s · Sharein' },
  description: 'Setor konten viral TikTok dan Instagram Reels, unggah lewat Sharein, dapatkan reward.',
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#6C2BD9',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={jakarta.variable}>
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  )
}
