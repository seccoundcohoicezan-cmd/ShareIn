import { NextResponse } from 'next/server'
import { jsonError } from '@/lib/http'
import { asProgram } from '@/lib/program-param'
import { programSummary } from '@/lib/weekly'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: { program: string } }) {
  const program = asProgram(params.program)
  if (!program) return jsonError(404, 'Program tidak ditemukan.')
  return NextResponse.json(await programSummary(program), {
    headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60' },
  })
}
