import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, requireAdmin } from '@/lib/http'
import { asProgram } from '@/lib/program-param'
import { defaultPrize, eligibleEntries, listDraws } from '@/lib/program-service'
import { drawsTable, taskSubmissionsTable } from '@/lib/repo/programs'
import { strip } from '@/lib/repo/records'
import { getSettingsFresh } from '@/lib/repo/settings'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { program: string } }) {
  const s = await requireAdmin(req)
  if (s instanceof NextResponse) return s
  const program = asProgram(params.program)
  if (!program) return jsonError(404, 'Program tidak ditemukan.')
  const [settings, subs, draws] = await Promise.all([getSettingsFresh(), taskSubmissionsTable.list(), drawsTable.list()])
  const pool = eligibleEntries(program, subs.map(strip), draws.map(strip), settings.spin_unique_winner)
  return NextResponse.json({
    draws: await listDraws(program),
    pool: pool.map((p) => p.code),
    defaultPrize: defaultPrize(settings, program),
    uniqueWinner: settings.spin_unique_winner,
  })
}
