import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, limitOr429 } from '@/lib/http'
import { asProgram } from '@/lib/program-param'
import { myCodes } from '@/lib/program-service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest, { params }: { params: { program: string } }) {
  const program = asProgram(params.program)
  if (!program) return jsonError(404, 'Program tidak ditemukan.')
  const limited = limitOr429(req, 'codes', 20)
  if (limited) return limited
  const r = await myCodes(program, req.nextUrl.searchParams.get('wa') ?? '')
  if (!r) return jsonError(400, 'Nomor WhatsApp tidak valid. Tulis seperti 081234567890.')
  return NextResponse.json(r, { headers: { 'Cache-Control': 'no-store' } })
}
