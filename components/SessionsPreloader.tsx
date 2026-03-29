'use client'

import { useEffect } from 'react'
import { getCachedSessions, getCachedMeetings, getCachedLatestDrivers } from '@/lib/client-cache'

// Pre-warms all shared caches as soon as the app loads so every page
// gets instant data on first navigation instead of hitting the API.
export default function SessionsPreloader() {
  useEffect(() => {
    getCachedSessions()
    getCachedMeetings()
    getCachedLatestDrivers()
  }, [])
  return null
}
