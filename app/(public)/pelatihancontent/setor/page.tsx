import type { Metadata } from 'next'
import { SetorPage } from '@/components/SetorPage'

export const metadata: Metadata = { title: 'Kirim link · Pelatihan Content' }

export default function Page() {
  return <SetorPage program="pelatihan" />
}
