'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Mounted only inside a WARMING UP state: re-runs the server render every
// few seconds (and on tab focus) so the page heals itself the moment the
// season snapshot exists — the user never has to refresh manually.
export default function WarmingRetry() {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), 6000)
    const onVis = () => {
      if (!document.hidden) router.refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [router])
  return null
}
