import { LinkGuide } from '@/components/LinkGuide'
import { Tutorial } from '@/components/Tutorial'
import { PillLabel } from '@/components/ui'

// Landing = interactive tutorial only. Program pages (/goldenticket, /pelatihancontent,
// /dutateladan) are shared directly by link.
export default function Home() {
  return (
    <div className="space-y-10">
      <section className="px-1 pb-1 pt-4">
        <h1 className="text-[2.25rem] font-extrabold leading-[1.1] tracking-tight">
          Upload, bagikan,
          <br />
          <span className="bg-gradient-to-r from-brand-purple via-brand-violet to-brand-orange bg-clip-text text-transparent">dapat reward.</span>
        </h1>
        <p className="muted mt-3 max-w-md text-base">
          Sharein adalah platform berbagi konten. Unggah kontenmu, bagikan link-nya, dan raih peluang reward dari setiap akses.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <a href="#tutorial" className="btn-primary w-full sm:w-auto">Coba tutorialnya</a>
          <a href="#panduan" className="btn-ghost w-full sm:w-auto">Cara salin link TikTok/Reels</a>
        </div>
      </section>

      <section id="tutorial" aria-labelledby="tutorial-judul" className="scroll-mt-20">
        <PillLabel id="tutorial-judul">Tutorial</PillLabel>
        <h2 className="mb-4 mt-3 text-2xl font-extrabold">Kenali cara kerja Sharein</h2>
        <Tutorial />
      </section>

      <section id="panduan" aria-labelledby="panduan-judul" className="scroll-mt-20">
        <PillLabel id="panduan-judul">Panduan</PillLabel>
        <h2 className="mt-3 text-2xl font-extrabold">Cara menyalin link konten</h2>
        <p className="muted mb-5 mt-1 text-sm">Ikuti langkahnya di layar contoh. Ketuk titik oranye untuk lanjut.</p>
        <LinkGuide />
      </section>
    </div>
  )
}
