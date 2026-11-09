import { NextResponse } from 'next/server'
import { getProgress } from '@/lib/service'

export const dynamic = 'force-dynamic'

export async function GET() {
  const { settings, progress } = await getProgress()
  return NextResponse.json(
    {
      period_id: settings.period_id,
      period_open: settings.period_open,
      require_screenshot: settings.require_screenshot,
      metrics_adapter: settings.metrics_adapter,
      sharein_domains: settings.sharein_domains,
      rules: {
        tiktok: { min_like: settings.min_like_tiktok, min_comment: settings.min_comment_tiktok },
        reels: { min_like: settings.min_like_reels, min_comment: settings.min_comment_reels },
      },
      collected: progress,
      golden: {
        start: settings.golden_pool_start,
        end: settings.golden_pool_end,
        start_at: settings.golden_start_at,
        end_at: settings.golden_end_at,
      },
    },
    { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=60' } },
  )
}
