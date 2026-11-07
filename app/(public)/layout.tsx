import { Background } from '@/components/Background'
import { Header } from '@/components/Header'

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Background />
      <a href="#isi" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-field focus:bg-white focus:px-4 focus:py-2">
        Lewati ke isi
      </a>
      <Header />
      <main id="isi" className="mx-auto max-w-3xl px-4 pb-16 pt-6">
        {children}
      </main>
      <footer className="muted mx-auto max-w-3xl px-4 pb-10 text-center text-xs">
        Sharein · Upload konten, bagikan link-nya, dan dapatkan sesuatu.
      </footer>
    </>
  )
}
