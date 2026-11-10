import type { SubmissionStatus } from '@/lib/types'
import { Spinner } from './ui'

export type Decision = 'approve' | 'reject' | 'reset'

/**
 * Setujui and Tolak always sit side by side in the last row, same order and size everywhere
 * (cards, table, preview), so reviewers never hunt for them. The current decision stays visible
 * as a disabled button instead of disappearing and shifting the other one. While saving, the
 * pressed button shows a spinner and both are locked so nothing is sent twice.
 */
export function DecisionButtons({ status, busy = null, onApprove, onReject, size = 'md' }: { status: SubmissionStatus; busy?: Decision | null; onApprove: () => void; onReject: () => void; size?: 'sm' | 'md' }) {
  const sm = size === 'sm' ? 'btn-sm' : ''
  return (
    <div className="grid grid-cols-2 gap-2" aria-busy={busy !== null}>
      <button type="button" className={`btn ${sm} gap-2 bg-ok text-white ${busy === 'approve' ? 'disabled:opacity-90' : 'disabled:opacity-50'}`} disabled={busy !== null || status === 'approved'} onClick={onApprove}>
        {busy === 'approve' ? <><Spinner /> Menyetujui…</> : status === 'approved' ? 'Disetujui ✓' : 'Setujui'}
      </button>
      <button type="button" className={`btn ${sm} gap-2 bg-bad text-white ${busy === 'reject' ? 'disabled:opacity-90' : 'disabled:opacity-50'}`} disabled={busy !== null || status === 'rejected'} onClick={onReject}>
        {busy === 'reject' ? <><Spinner /> Menolak…</> : status === 'rejected' ? 'Ditolak' : 'Tolak'}
      </button>
    </div>
  )
}
