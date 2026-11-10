import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ProgramReview } from '@/components/ProgramReview'
import { asProgram } from '@/lib/program-param'
import { PROGRAM_INFO } from '@/lib/types'
import { AdminShell, requirePageSession } from '../../shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Program' }

export default async function ProgramAdminPage({ params }: { params: { program: string } }) {
  const session = await requirePageSession()
  const program = asProgram(params.program)
  if (!program) notFound()
  return (
    <AdminShell session={session}>
      <h1 className="mb-4 text-2xl font-extrabold">{PROGRAM_INFO[program].label}</h1>
      <ProgramReview key={program} program={program} />
    </AdminShell>
  )
}
