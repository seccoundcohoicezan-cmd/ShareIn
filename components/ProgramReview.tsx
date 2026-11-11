'use client'
import { useState } from 'react'
import type { Program } from '@/lib/types'
import { RecapAdmin } from './RecapAdmin'
import { SpinAdmin } from './SpinAdmin'
import { SubmissionsAdmin } from './SubmissionsAdmin'

type Tab = 'review' | 'recap' | 'spin'

export function ProgramReview({ program, canManage }: { program: Program; canManage: boolean }) {
  const [tab, setTab] = useState<Tab>('review')
  const tabs: { k: Tab; t: string }[] = [
    { k: 'review', t: 'Review link' },
    { k: 'recap', t: program === 'pelatihan' ? 'Progres peserta' : 'Rekap mingguan' },
    ...(program === 'pelatihan' ? [{ k: 'spin' as const, t: 'Spin wheel' }] : []),
  ]
  return (
    <div>
      <div role="tablist" aria-label="Bagian program" className={`mb-4 grid gap-1 rounded-field bg-white p-1 sm:w-fit ${tabs.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
        {tabs.map((x) => (
          <button key={x.k} role="tab" type="button" aria-selected={tab === x.k} onClick={() => setTab(x.k)} className={`min-h-[44px] rounded-[12px] px-4 text-sm font-bold ${tab === x.k ? 'bg-brand-purple text-white' : 'text-brand-purple'}`}>
            {x.t}
          </button>
        ))}
      </div>
      {tab === 'review' && <SubmissionsAdmin program={program} />}
      {tab === 'recap' && <RecapAdmin program={program} />}
      {tab === 'spin' && <SpinAdmin canManage={canManage} />}
    </div>
  )
}
