import Link from 'next/link'
import { CHANNEL_INFO, type Channel } from '@/lib/types'
import { ChevronLeft } from './icons'
import { SetorForm } from './SetorForm'
import { Toaster } from './Toast'

export function SetorPage({ program }: { program: Channel }) {
  const { label, path } = CHANNEL_INFO[program]
  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <Link href={path} aria-label={`Kembali ke ${label}`} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/80 text-brand-purple hover:bg-white">
          <ChevronLeft />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">{program === 'golden' ? 'Setor konten' : 'Kirim link konten'}</h1>
          {program !== 'golden' && <p className="muted text-sm font-bold">{label}</p>}
        </div>
      </div>
      <SetorForm program={program} />
      <Toaster />
    </div>
  )
}
