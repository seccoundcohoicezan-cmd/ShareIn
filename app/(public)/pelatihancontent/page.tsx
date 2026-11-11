import type { Metadata } from 'next'
import { ProgramPage } from '@/components/ProgramPage'

export const revalidate = 30
export const metadata: Metadata = { title: 'Pelatihan Content' }

export default function Page() {
  return (
    <ProgramPage
      program="pelatihan"
      pill="Undian berhadiah"
      intro="Kirim link konten TikTok dan Instagram Reels seperti di Golden Ticket. Lengkapi targetnya, lalu ikuti undian spin wheel berhadiah."
    />
  )
}
