'use client'

import { useSyncExternalStore } from 'react'
import { isApiBlocked, subscribeApiBlocked } from '@/lib/openf1'

// True while openf1 is 401ing everything (live-session lockout).
export function useApiBlocked(): boolean {
  return useSyncExternalStore(subscribeApiBlocked, isApiBlocked, () => false)
}
