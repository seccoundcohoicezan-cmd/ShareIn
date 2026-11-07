import type { Program } from './types'

export function asProgram(v: string): Program | null {
  return v === 'pelatihan' || v === 'duta' ? v : null
}
