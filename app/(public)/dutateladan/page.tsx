import type { Metadata } from 'next'
import { ProgramPage } from '@/components/ProgramPage'

export const revalidate = 30
export const metadata: Metadata = { title: 'Duta Teladan' }

export default function Page() {
  return (
    <ProgramPage
      program="duta"
      pill="Kewajiban"
      intro="Setiap Duta Teladan wajib mengumpulkan konten TikTok dan Instagram Reels setiap minggu (Senin–Minggu). Cara kirimnya sama seperti Golden Ticket, dan statusnya bisa kamu pantau."
    />
  )
}
