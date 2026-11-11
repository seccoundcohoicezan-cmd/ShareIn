import type { Metadata } from 'next'
import { ProgramPage } from '@/components/ProgramPage'

export const revalidate = 30
export const metadata: Metadata = { title: 'Pelatihan Content' }

export default function Page() {
  return (
    <ProgramPage
      program="pelatihan"
      pill="Undian berhadiah"
    />
  )
}
