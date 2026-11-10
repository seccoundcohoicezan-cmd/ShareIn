import type { Metadata } from 'next'
import Link from 'next/link'
import { RulesList } from '@/components/RulesList'
import { Panel, PillLabel } from '@/components/ui'
import { formatNumber } from '@/lib/format'
import { loadPublic } from '@/lib/public-data'

export const revalidate = 60

const SUBLINKS = [
  { href: '/goldenticket', title: 'Golden Ticket', desc: 'Hadiah berjalan, target, dan ketentuan setor konten viral' },
  { href: '/pelatihancontent', title: 'Pelatihan Content', desc: 'Kerjakan tugas, kumpulkan bukti, dapat kode' },
  { href: '/dutateladan', title: 'Duta Teladan', desc: 'Tugas wajib setiap Duta Teladan' },
  { href: '/pantau', title: 'Pantau setoran', desc: 'Lihat status disetujui/ditolak dengan link unikmu' },
  { href: '/#tutorial', title: 'Tutorial & panduan', desc: 'Cara kerja Sharein dan cara menyalin link' },
]
export const metadata: Metadata = { title: 'Aturan setoran' }

export default async function AturanPage() {
  const { settings } = await loadPublic()
  return (
    <div className="space-y-5">
      <h1 className="px-1 text-3xl font-extrabold tracking-tight">Aturan</h1>

      <Panel aria-labelledby="umum">
        <PillLabel id="umum">Semua program</PillLabel>
        <ol className="mt-4 list-decimal space-y-2 pl-5">
          <li>Gunakan nama asli dan nomor WhatsApp aktif. Identitas ini dipakai untuk memeriksa setoranmu.</li>
          <li>Satu orang dikenali dari nomor WhatsApp-nya. Jangan mendaftar dengan nomor orang lain.</li>
          <li>Bukti palsu, curang, atau milik orang lain membuat setoran dibatalkan.</li>
          <li>Keputusan admin atas verifikasi bersifat final.</li>
        </ol>
      </Panel>

      <Panel aria-labelledby="program-kode">
        <PillLabel id="program-kode">Pelatihan Content & Duta Teladan</PillLabel>
        <ol className="mt-4 list-decimal space-y-2 pl-5">
          <li>Setiap tugas yang dikumpulkan memberi satu kode unik (PC-… untuk Pelatihan, DT-… untuk Duta Teladan).</li>
          <li>Satu tugas hanya bisa dikumpulkan sekali per nomor WhatsApp.</li>
          <li>Status tugas (menunggu, disetujui, ditolak) bisa dipantau lewat link pantau unikmu.</li>
          <li>Tugas Duta Teladan bersifat wajib bagi setiap Duta Teladan.</li>
          <li>Program ini tidak berhadiah. Hadiah hanya ada di program Golden Ticket.</li>
        </ol>
      </Panel>

      <h2 className="px-1 pt-2 text-2xl font-extrabold">Golden Ticket</h2>
      <Panel aria-labelledby="ringkas">
        <PillLabel id="ringkas">Ringkasan</PillLabel>
        <RulesList settings={settings} />
      </Panel>

      <Panel aria-labelledby="angka">
        <PillLabel id="angka">Batas minimal</PillLabel>
        <div className="mt-4 overflow-hidden rounded-field border border-brand-purple/10 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-brand-lavender">
              <tr>
                <th scope="col" className="px-4 py-3">Platform</th>
                <th scope="col" className="px-4 py-3">Min. like</th>
                <th scope="col" className="px-4 py-3">Min. komentar</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr className="border-t border-brand-purple/10">
                <td className="px-4 py-3 font-bold">TikTok</td>
                <td className="px-4 py-3">{formatNumber(settings.min_like_tiktok)}</td>
                <td className="px-4 py-3">{formatNumber(settings.min_comment_tiktok)}</td>
              </tr>
              <tr className="border-t border-brand-purple/10">
                <td className="px-4 py-3 font-bold">Instagram Reels</td>
                <td className="px-4 py-3">{formatNumber(settings.min_like_reels)}</td>
                <td className="px-4 py-3">{formatNumber(settings.min_comment_reels)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="muted mt-3 text-sm">Batas berlaku inklusif: tepat {formatNumber(settings.min_like_tiktok)} like sudah memenuhi.</p>
      </Panel>

      <Panel aria-labelledby="detail">
        <PillLabel id="detail">Ketentuan lengkap</PillLabel>
        <ol className="mt-4 list-decimal space-y-3 pl-5">
          <li>Konten harus berasal dari postingan yang muncul <b>organik</b> di FYP TikTok atau Beranda Reels kamu, bukan hasil pencarian atau iklan.</li>
          <li>Kamu cukup menempel link. Sebelum menyetor, buka link-nya dan pastikan jumlah like dan komentar memenuhi batas minimal. Admin akan memeriksa ulang.</li>
          <li>Jangan setor konten yang tidak memenuhi ketentuan. Setoran yang tidak sesuai akan ditolak admin.</li>
          <li>Konten yang dicari adalah konten yang memicu <b>pro &amp; kontra</b>, misalnya perdebatan bumi bulat atau datar.</li>
          <li>Link Sharein tidak wajib saat menyetor. Bila sudah mengunggah ke Sharein, boleh ditambahkan.</li>
          <li>Link konten wajib dari <b>tiktok.com</b> atau <b>instagram.com/reel/</b>. Link lain ditolak.</li>
          <li>Makin banyak konten yang kamu submit, makin besar peluang rewardmu. Sekali kirim bisa sampai 10 konten.</li>
          <li>Satu konten hanya boleh disetor satu kali di seluruh periode. Link yang sama akan ditolak sebagai duplikat.</li>
          <li>Tidak ada batas jumlah setoran. Link yang disetor tampil di halaman Golden Ticket dengan nama singkat, misalnya Rina U.</li>
          {settings.require_screenshot && <li>Periode ini <b>wajib</b> melampirkan tangkapan layar konten saat muncul di FYP/Beranda.</li>}
          <li>Admin memeriksa setiap setoran. Status disetujui/ditolak bisa kamu pantau di link pantau unikmu (halaman Pantau).</li>
        </ol>
      </Panel>

      <Panel aria-labelledby="halaman">
        <PillLabel id="halaman">Halaman program</PillLabel>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {SUBLINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex min-h-[56px] items-center gap-3 rounded-field border border-brand-purple/15 bg-white px-4 py-3 hover:border-brand-violet">
                <span className="min-w-0 flex-1">
                  <b className="block">{l.title}</b>
                  <span className="muted block text-xs">{l.desc}</span>
                </span>
                <span className="font-mono text-xs font-bold text-brand-purple">{l.href}</span>
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
