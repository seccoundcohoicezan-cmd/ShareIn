import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, limitOr429, readJson } from '@/lib/http'
import { batchSchema, checkBatch, expandBatch } from '@/lib/service'

export async function POST(req: NextRequest) {
  const limited = limitOr429(req, 'check')
  if (limited) return limited
  const parsed = batchSchema.safeParse(await readJson(req))
  if (!parsed.success) return jsonError(400, parsed.error.issues[0]?.message ?? 'Data tidak lengkap.')
  return NextResponse.json(await checkBatch(expandBatch(parsed.data)))
}
