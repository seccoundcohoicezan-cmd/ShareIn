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
      intro="Ikuti pelatihan, selesaikan tugasnya, dan kumpulkan buktinya. Setiap tugas yang terkumpul mendapat kode, dan statusnya bisa kamu pantau."
    />
  )
}
