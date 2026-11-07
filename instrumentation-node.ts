// Warms the spreadsheet caches so the first visitor and admin login don't pay the Apps Script
// round trips, and keeps the admin list fresh on long-running servers (Dokploy).
import { warmCaches } from './lib/warm'

if (process.env.NEXT_PHASE !== 'phase-production-build') {
  setTimeout(() => void warmCaches(true), 2000)
  if (!process.env.VERCEL) {
    const timer = setInterval(() => void warmCaches(false), 4 * 60_000)
    timer.unref?.()
  }
}
