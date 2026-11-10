'use client'
import { useState } from 'react'
import type { Program } from '@/lib/types'
import { SubmissionsAdmin } from './SubmissionsAdmin'
import { WeeklyRecapAdmin } from './WeeklyRecapAdmin'

export function ProgramReview({ program }: { program: Program }) {
  const [tab, setTab] = useState<'review' | 'recap'>('review')
  return (
    <div>
      <div role="tablist" aria-label="Bagian program" className="mb-4 grid grid-cols-2 gap-1 rounded-field bg-white p-1 sm:w-fit">
        {[
          { k: 'review' as const, t: 'Review link' },
          { k: 'recap' as const, t: 'Rekap mingguan' },
        ].map((x) => (
          <button key={x.k} role="tab" type="button" aria-selected={tab === x.k} onClick={() => setTab(x.k)} className={`min-h-[44px] rounded-[12px] px-4 text-sm font-bold ${tab === x.k ? 'bg-brand-purple text-white' : 'text-brand-purple'}`}>
            {x.t}
          </button>
        ))}
      </div>
      {tab === 'review' ? <SubmissionsAdmin program={program} /> : <WeeklyRecapAdmin program={program} />}
    </div>
  )
}
