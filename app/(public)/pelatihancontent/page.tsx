import type { Metadata } from 'next'
import { ProgramPage } from '@/components/ProgramPage'

export const revalidate = 30
export const metadata: Metadata = { title: 'Pelatihan Content' }

export default function Page() {
  return (
    <ProgramPage
      program="pelatihan"
      pill="Pelatihan"
      title="Pelatihan Content"
      intro="Ikuti pelatihan, selesaikan tugasnya, dan kumpulkan kode. Setiap kode yang disetujui masuk spin wheel. Yang beruntung dapat uang tunai."
    />
  )
}
