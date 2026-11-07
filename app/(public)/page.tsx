import Link from 'next/link'
import { GoldenCounter } from '@/components/GoldenCounter'
import { ArrowUpIcon, GiftIcon } from '@/components/icons'
import { Tutorial } from '@/components/Tutorial'
import { Panel, PillLabel } from '@/components/ui'
import { loadPublic } from '@/lib/public-data'

export const revalidate = 60

export default async function Home() {
  const { settings } = await loadPublic()
  const programs = [
    {
      href: '/pelatihancontent',
      pill: 'Pelatihan',
      title: 'Pelatihan Content',
      desc: 'Selesaikan tugas pelatihan, dapat kode, dan ikut spin wheel berhadiah uang.',
      cta: 'Kerjakan tugas',
      open: settings.pelatihan_open,
    },
    {
      href: '/dutateladan',
      pill: 'Kewajiban',
      title: 'Duta Teladan',
      desc: 'Tugas wajib Duta Teladan. Setiap tugas selesai jadi kode bonus spin wheel.',
      cta: 'Lihat kewajiban',
      open: settings.duta_open,
    },
  ]
  return (
    <div className="space-y-6">
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
          <a href="#program" className="btn-ghost w-full sm:w-auto">Pilih program</a>
        </div>
      </section>

      <section id="tutorial" aria-labelledby="tutorial-judul" className="scroll-mt-20">
        <PillLabel id="tutorial-judul">Tutorial</PillLabel>
        <h2 className="mb-4 mt-3 text-2xl font-extrabold">Kenali cara kerja Sharein</h2>
        <Tutorial />
      </section>

      <section id="program" aria-labelledby="program-judul" className="scroll-mt-20 space-y-4">
        <div>
          <PillLabel id="program-judul">Program</PillLabel>
          <h2 className="mt-3 text-2xl font-extrabold">Pilih jalurmu</h2>
        </div>

        <Link href="/goldenticket" className="block rounded-panel bg-gradient-to-br from-brand-amber via-[#f9a63a] to-brand-orange p-5 text-ink transition-transform hover:-translate-y-0.5 sm:p-6">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-sm font-bold text-white">
            <GiftIcon className="h-4 w-4 text-brand-amber" /> Golden Ticket
          </span>
          <p className="mt-4 text-sm font-bold">Total hadiah berjalan</p>
          <GoldenCounter pool={settings} />
          <p className="mt-3 text-sm font-bold">Setor konten viral TikTok / Reels lewat Sharein →</p>
        </Link>

        <div className="grid gap-4 sm:grid-cols-2">
          {programs.map((p) => (
            <Link key={p.href} href={p.href} className="panel flex flex-col items-start gap-2 transition-colors hover:border-brand-violet">
              <span className="pill">{p.pill}</span>
              <h3 className="mt-2 text-xl font-extrabold">{p.title}</h3>
              <p className="muted text-sm">{p.desc}</p>
              <span className={`text-xs font-bold ${p.open ? 'text-green-700' : 'text-red-700'}`}>{p.open ? 'Dibuka' : 'Ditutup sementara'}</span>
              <span className="mt-auto inline-flex min-h-[44px] items-center gap-1 font-bold text-brand-purple">
                {p.cta} <ArrowUpIcon className="h-4 w-4 rotate-90" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <Panel aria-labelledby="aturan-ringkas">
        <PillLabel id="aturan-ringkas">Aturan</PillLabel>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm">
          <li>Pakai identitas asli: nama dan nomor WhatsApp aktif untuk menerima hadiah.</li>
          <li>Golden Ticket: hanya konten viral organik yang memenuhi batas like/komentar dan sudah diunggah ke Sharein.</li>
          <li>Pelatihan Content & Duta Teladan: satu tugas selesai = satu kode. Kode yang disetujui admin masuk spin wheel.</li>
          <li>Pemenang spin diumumkan di halaman program dan dihubungi lewat WhatsApp.</li>
        </ul>
        <Link href="/aturan" className="mt-3 inline-flex min-h-[44px] items-center text-sm font-bold text-brand-purple underline underline-offset-4">
          Baca aturan lengkap
        </Link>
      </Panel>
    </div>
  )
}
