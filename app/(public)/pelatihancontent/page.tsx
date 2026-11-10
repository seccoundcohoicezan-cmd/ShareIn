import type { Metadata } from 'next'
import { ProgramPage } from '@/components/ProgramPage'

export const revalidate = 30
export const metadata: Metadata = { title: 'Pelatihan Content' }

export default function Page() {
  return (
    <ProgramPage
      program="pelatihan"
      pill="Pelatihan"
      intro="Peserta pelatihan wajib mengirim link konten TikTok atau Reels setiap minggu sesuai target di bawah. Cara kirimnya sama seperti Golden Ticket, dan statusnya bisa kamu pantau."
    />
  )
}
