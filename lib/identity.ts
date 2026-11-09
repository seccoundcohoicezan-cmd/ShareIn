/** 08xx / +62 8xx / 62 8xx → 628xx; null when not an Indonesian mobile number. */
export function normalizeWhatsapp(input: string): string | null {
  let d = String(input ?? '').replace(/[\s\-().]/g, '')
  if (d.startsWith('+')) d = d.slice(1)
  if (!/^\d+$/.test(d)) return null
  if (d.startsWith('0')) d = '62' + d.slice(1)
  else if (d.startsWith('8')) d = '62' + d
  return /^628\d{7,12}$/.test(d) ? d : null
}

export function maskWhatsapp(wa: string): string {
  return wa.length > 7 ? `${wa.slice(0, 4)}••••${wa.slice(-3)}` : '••••'
}

/** "Rina Utami Sari" → "Rina U." for public lists. */
export function maskName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'Peserta'
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[1][0].toUpperCase()}.`
}
