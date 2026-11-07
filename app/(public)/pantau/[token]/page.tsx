import type { Metadata } from 'next'
import { PantauLive } from '@/components/PantauLive'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Pantau setoran', robots: { index: false, follow: false } }

export default function PantauTokenPage({ params }: { params: { token: string } }) {
  return <PantauLive token={params.token} />
}
