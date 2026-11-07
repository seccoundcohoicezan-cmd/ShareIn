import type { Metadata } from 'next'
import { PantauEntry } from '@/components/PantauEntry'

export const metadata: Metadata = { title: 'Pantau setoran', robots: { index: false } }

export default function PantauPage() {
  return (
    <div>
      <h1 className="mb-2 px-1 text-2xl font-extrabold tracking-tight">Pantau setoran</h1>
      <p className="muted mb-4 px-1 text-sm">Masukkan kode pantau unikmu (ada di layar sukses dan link yang kamu simpan).</p>
      <PantauEntry />
    </div>
  )
}
