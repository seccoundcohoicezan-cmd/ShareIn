import { describe, expect, it } from 'vitest'
import { goldenLeaderboard } from '@/lib/leaderboard'
import type { Submission } from '@/lib/types'

let n = 0
function sub(p: Partial<Submission>): Submission {
  n++
  return {
    id: `s${n}`, created_at: `2026-11-16T00:00:${String(n).padStart(2, '0')}Z`, period_id: 'p1', submitter_name: 'Rina Utami', platform: 'tiktok',
    source_url: '', source_key: `k${n}`, sharein_url: '', likes: 0, comments: 0, metrics_source: 'manual', organic_declared: true, screenshot_url: '',
    status: 'approved', reject_reason: '', reviewed_by: '', reviewed_at: '', needs_review: false, whatsapp: '6281111', program: 'golden', ...p,
  }
}

describe('Golden Ticket leaderboard', () => {
  it('ranks by approved links only, not by how many were sent', () => {
    const subs = [
      // Budi sent 5 but only 1 approved.
      ...Array.from({ length: 4 }, () => sub({ submitter_name: 'Budi Santoso', whatsapp: '6282222', status: 'pending' })),
      sub({ submitter_name: 'Budi Santoso', whatsapp: '6282222', status: 'rejected' }),
      sub({ submitter_name: 'Budi Santoso', whatsapp: '6282222' }),
      // Rina: 2 approved (1 TikTok, 1 Reels).
      sub({}), sub({ platform: 'reels' }),
      // Other programs and voided rows never count.
      sub({ submitter_name: 'Budi Santoso', whatsapp: '6282222', program: 'duta' }),
      sub({ submitter_name: 'Budi Santoso', whatsapp: '6282222', status: 'void' }),
    ]
    const b = goldenLeaderboard(subs)
    expect(b.rows).toEqual([
      { rank: 1, name: 'Rina U.', approved: 2, tiktok: 1, reels: 1 },
      { rank: 2, name: 'Budi S.', approved: 1, tiktok: 1, reels: 0 },
    ])
    expect(b.participants).toBe(2)
  })

  it('groups by WhatsApp, shares ranks on ties (earlier finisher first), and caps the list', () => {
    const subs = [
      sub({ submitter_name: 'Ani', whatsapp: '62833' }),
      sub({ submitter_name: 'Dewi', whatsapp: '62844' }),
      sub({ submitter_name: 'Ani Lestari', whatsapp: '62833', platform: 'reels' }),
      sub({ submitter_name: 'Dewi', whatsapp: '62844' }),
      sub({ submitter_name: 'Eko', whatsapp: '62855' }),
    ]
    const b = goldenLeaderboard(subs, 2)
    expect(b.rows.map((r) => [r.rank, r.name, r.approved])).toEqual([[1, 'Ani L.', 2], [1, 'Dewi', 2]])
    expect(b.participants).toBe(3)
  })
})
