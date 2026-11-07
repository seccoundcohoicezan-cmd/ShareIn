import Link from 'next/link'

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/logo-72.webp" srcSet="/brand/logo-72.webp 1x, /brand/logo-144.webp 2x" width={size} height={Math.round(size * 0.976)} alt="" />
      <span className="text-xl font-extrabold tracking-tight text-ink">Sharein</span>
    </span>
  )
}

// Landing menu: only Tutorial and Aturan. Programs are reached from landing cards.
export function Header() {
  return (
    <header className="sticky top-0 z-20 border-b border-brand-purple/10 bg-brand-lavender/85 backdrop-blur supports-[backdrop-filter]:bg-brand-lavender/70">
      <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
        <Link href="/" aria-label="Sharein beranda" className="rounded-field">
          <Logo />
        </Link>
        <nav aria-label="Navigasi utama" className="flex items-center gap-1 text-sm font-bold">
          <Link href="/#tutorial" className="inline-flex min-h-[44px] items-center rounded-field px-3 text-[#4c1fa0] hover:bg-white/70">
            Tutorial
          </Link>
          <Link href="/aturan" className="inline-flex min-h-[44px] items-center rounded-field px-3 text-[#4c1fa0] hover:bg-white/70">
            Aturan
          </Link>
        </nav>
      </div>
    </header>
  )
}
