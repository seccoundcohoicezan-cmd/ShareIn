import type { SubmissionStatus } from '@/lib/types'

/**
 * Setujui and Tolak always sit side by side in the last row, same order and size everywhere
 * (cards, table, preview), so reviewers never hunt for them. The current decision stays visible
 * as a disabled button instead of disappearing and shifting the other one.
 */
export function DecisionButtons({ status, onApprove, onReject, size = 'md' }: { status: SubmissionStatus; onApprove: () => void; onReject: () => void; size?: 'sm' | 'md' }) {
  const sm = size === 'sm' ? 'btn-sm' : ''
  return (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" className={`btn ${sm} bg-ok text-white disabled:opacity-50`} disabled={status === 'approved'} onClick={onApprove}>
        {status === 'approved' ? 'Disetujui ✓' : 'Setujui'}
      </button>
      <button type="button" className={`btn ${sm} bg-bad text-white disabled:opacity-50`} disabled={status === 'rejected'} onClick={onReject}>
        {status === 'rejected' ? 'Ditolak' : 'Tolak'}
      </button>
    </div>
  )
}
