/** Accepts values typed by hand in the spreadsheet (Indonesian or English). */
export function normalizeStatus(v: string | undefined): 'pending' | 'approved' | 'rejected' | 'void' {
  const s = String(v ?? '').trim().toLowerCase()
  if (['approved', 'disetujui', 'setuju', 'diterima', 'lolos', 'ok', 'acc'].includes(s)) return 'approved'
  if (['rejected', 'ditolak', 'tolak', 'gagal'].includes(s)) return 'rejected'
  if (['void', 'batal', 'dibatalkan'].includes(s)) return 'void'
  return 'pending'
}
