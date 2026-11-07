import type { Metadata } from 'next'
import { ProgramPage } from '@/components/ProgramPage'

export const revalidate = 30
export const metadata: Metadata = { title: 'Duta Teladan' }

export default function Page() {
  return (
    <ProgramPage
      program="duta"
      pill="Kewajiban"
      title="Duta Teladan"
      intro="Tugas di halaman ini wajib diselesaikan setiap Duta Teladan. Setiap tugas yang selesai memberi kode bonus untuk spin wheel berhadiah uang."
    />
  )
}
