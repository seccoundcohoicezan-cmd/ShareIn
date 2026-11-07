import type { Metadata } from 'next'
import Link from 'next/link'
import { RulesList } from '@/components/RulesList'
import { Panel, PillLabel } from '@/components/ui'
import { formatNumber } from '@/lib/format'
import { loadPublic } from '@/lib/public-data'

export const revalidate = 60
export const metadata: Metadata = { title: 'Aturan setoran' }

export default async function AturanPage() {
  const { settings } = await loadPublic()
  return (
    <div className="space-y-5">
      <h1 className="px-1 text-3xl font-extrabold tracking-tight">Aturan</h1>

      <Panel aria-labelledby="umum">
        <PillLabel id="umum">Semua program</PillLabel>
        <ol className="mt-4 list-decimal space-y-2 pl-5">
          <li>Gunakan nama asli dan nomor WhatsApp aktif. Hadiah hanya diberikan ke pemilik identitas yang terdaftar.</li>
          <li>Satu orang dikenali dari nomor WhatsApp-nya. Jangan mendaftar dengan nomor orang lain.</li>
          <li>Bukti palsu, curang, atau milik orang lain membuat seluruh kode dan hadiah dibatalkan.</li>
          <li>Keputusan admin atas verifikasi dan hasil undian bersifat final.</li>
        </ol>
      </Panel>

      <Panel aria-labelledby="program-kode">
        <PillLabel id="program-kode">Pelatihan Content & Duta Teladan</PillLabel>
        <ol className="mt-4 list-decimal space-y-2 pl-5">
          <li>Setiap tugas yang dikumpulkan memberi satu kode unik (PC-… untuk Pelatihan, DT-… untuk Duta Teladan).</li>
          <li>Satu tugas hanya bisa dikumpulkan sekali per nomor WhatsApp.</li>
          <li>Kode masuk spin wheel setelah bukti tugas disetujui admin. Makin banyak tugas selesai, makin banyak kesempatan.</li>
          <li>Tugas Duta Teladan bersifat wajib bagi setiap Duta Teladan; kodenya menjadi bonus undian.</li>
          <li>Pemenang dipilih acak oleh sistem, diumumkan di halaman program, dan dihubungi lewat WhatsApp.</li>
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
          <li>Pengecekan dilakukan <b>manual</b>: buka link kontennya langsung, lalu catat jumlah like dan komentar yang tampil saat itu.</li>
          <li>Jangan setor konten yang tidak memenuhi ketentuan. Setoran yang tidak sesuai akan ditolak admin.</li>
          <li>Semua konten yang lolos <b>wajib diunggah lewat Sharein</b>. Tempel link halaman konten Sharein-mu di form setoran.</li>
          <li>Satu konten hanya boleh disetor satu kali di seluruh periode. Link yang sama akan ditolak sebagai duplikat.</li>
          <li>Setiap platform punya target jumlah (QTY) per periode. Setoran ditutup otomatis saat target terpenuhi.</li>
          {settings.require_screenshot && <li>Periode ini <b>wajib</b> melampirkan tangkapan layar konten saat muncul di FYP/Beranda.</li>}
          <li>Admin memeriksa setiap setoran. Status bisa kamu pantau di halaman Riwayat.</li>
        </ol>
      </Panel>

      <Link href="/goldenticket/setor" className="btn-primary w-full">Setor konten Golden Ticket</Link>
    </div>
  )
}
