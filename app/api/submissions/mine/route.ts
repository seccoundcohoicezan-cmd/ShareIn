import { NextResponse, type NextRequest } from 'next/server'
import { limitOr429 } from '@/lib/http'
import { listMine } from '@/lib/service'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const limited = limitOr429(req, 'mine')
  if (limited) return limited
  const name = (req.nextUrl.searchParams.get('name') || '').slice(0, 60)
  return NextResponse.json({ items: await listMine(name) }, { headers: { 'Cache-Control': 'no-store' } })
}
