import type { Metadata } from 'next'
import { SetorPage } from '@/components/SetorPage'

export const metadata: Metadata = { title: 'Setor konten' }

export default function Page() {
  return <SetorPage program="golden" />
}
