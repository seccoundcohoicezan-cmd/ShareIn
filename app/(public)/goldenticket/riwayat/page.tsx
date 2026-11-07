import type { Metadata } from 'next'
import { RiwayatClient } from '@/components/RiwayatClient'

export const metadata: Metadata = { title: 'Riwayat setoran' }

export default function RiwayatPage() {
  return (
    <div>
      <h1 className="mb-4 px-1 text-2xl font-extrabold tracking-tight">Riwayat setoran</h1>
      <RiwayatClient />
    </div>
  )
}
