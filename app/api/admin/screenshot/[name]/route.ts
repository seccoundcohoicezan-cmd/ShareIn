import { promises as fs } from 'node:fs'
import path from 'node:path'
import { NextResponse, type NextRequest } from 'next/server'
import { jsonError, requireAdmin } from '@/lib/http'
import { uploadsDir } from '@/lib/storage'

const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }

export async function GET(req: NextRequest, { params }: { params: { name: string } }) {
  const s = await requireAdmin(req)
  if (s instanceof NextResponse) return s
  const m = params.name.match(/^ss_\d+_[a-f0-9]{12}\.(jpg|png|webp)$/)
  if (!m) return jsonError(404, 'Tidak ditemukan.')
  try {
    const buf = await fs.readFile(path.join(uploadsDir(), params.name))
    return new NextResponse(new Uint8Array(buf), {
      headers: { 'Content-Type': TYPES[m[1]], 'Cache-Control': 'private, max-age=3600' },
    })
  } catch {
    return jsonError(404, 'Tidak ditemukan.')
  }
}
