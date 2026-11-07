import 'server-only'
import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import { dataDir } from './repo'

export const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024
export const SCREENSHOT_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

/** Validates by magic bytes, not by the client-declared type. */
export function sniffImage(buf: Buffer): keyof typeof SCREENSHOT_TYPES | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp'
  return null
}

export function uploadsDir() {
  return path.join(dataDir(), 'uploads')
}

/** Stores the image and returns the URL kept in the sheet (Drive link, or /api/admin/screenshot/<file>). */
export async function saveScreenshot(buf: Buffer, mime: keyof typeof SCREENSHOT_TYPES): Promise<string> {
  const name = `ss_${Date.now()}_${randomBytes(6).toString('hex')}.${SCREENSHOT_TYPES[mime]}`
  const folder = process.env.DRIVE_FOLDER_ID
  if (folder && process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_PRIVATE_KEY) {
    const { drive, auth } = await import('@googleapis/drive')
    const jwt = new auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    })
    const res = await drive({ version: 'v3', auth: jwt }).files.create({
      requestBody: { name, parents: [folder] },
      media: { mimeType: mime, body: Readable.from(buf) },
      fields: 'id,webViewLink',
      supportsAllDrives: true,
    })
    return res.data.webViewLink || `https://drive.google.com/file/d/${res.data.id}/view`
  }
  await fs.mkdir(uploadsDir(), { recursive: true })
  await fs.writeFile(path.join(uploadsDir(), name), buf)
  return `/api/admin/screenshot/${name}`
}
