import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from '@/components/icons'
import { SetorForm } from '@/components/SetorForm'
import { Toaster } from '@/components/Toast'

export const metadata: Metadata = { title: 'Setor konten' }

export default function SetorPage() {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Link href="/" aria-label="Kembali ke beranda" className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-brand-purple hover:bg-white">
          <ChevronLeft />
        </Link>
        <h1 className="text-2xl font-extrabold tracking-tight">Setor konten</h1>
      </div>
      <SetorForm />
      <Toaster />
    </div>
  )
}
