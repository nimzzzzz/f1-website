'use client'

import { useEffect } from 'react'
import { getCachedSessions, getCachedMeetings } from '@/lib/client-cache'

// Pre-warms the shared caches every session-scoped page reads (the session
// list and the meeting list) so navigation is instant instead of hitting
// the API. It no longer warms a driver list: that cache had no consumer
// left once /drivers and /teams went static, so it was a per-visit openf1
// round trip for nothing.
export default function SessionsPreloader() {
  useEffect(() => {
    getCachedSessions()
    getCachedMeetings()
  }, [])
  return null
}
