import type { Channel, Program } from './types'

export function asProgram(v: string): Program | null {
  return v === 'pelatihan' || v === 'duta' ? v : null
}

export function asChannel(v: string | null | undefined): Channel | null {
  return v === 'golden' ? 'golden' : asProgram(String(v ?? ''))
}
