'use client'
import { useEffect, useState } from 'react'
import { getJson } from '@/lib/get-json'

export type Me = { name: string; whatsapp: string; token: string } | null

/** Logged-in participant (via unique link cookie), or null. undefined while loading. */
export function useMe() {
  const [me, setMe] = useState<Me | undefined>(undefined)
  useEffect(() => {
    getJson<{ user: Me }>('/api/me')
      .then((d) => setMe(d.user ?? null))
      .catch(() => setMe(null))
  }, [])
  return me
}

export function localWa(wa: string) {
  return wa.startsWith('62') ? '0' + wa.slice(2) : wa
}
