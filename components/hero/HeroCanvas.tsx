'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { trackLine } from '@/lib/track-lines-manifest'

// Capability gate for the WebGL circuit hero. The 3D is a desktop
// enhancement: every check below falls through to rendering nothing,
// which leaves the static NOW section (always present underneath)
// as the guaranteed-good floor. Zero CLS either way — this layer is
// absolutely positioned behind the section's content.
//
// three.js loads ONLY after the gate passes (dynamic import, client
// side, post-hydration) so it never touches First Load JS.

const CircuitScene = dynamic(() => import('./CircuitScene'), { ssr: false })

export default function HeroCanvas({
  circuitShortName,
  onLive,
}: {
  circuitShortName: string
  onLive?: (live: boolean) => void
}) {
  const [enabled, setEnabled] = useState(false)
  const lineUrl = trackLine(circuitShortName)

  useEffect(() => {
    if (!lineUrl) return
    const mq = (q: string) => window.matchMedia(q).matches
    // reduced motion → static NOW, no animation of any kind
    if (mq('(prefers-reduced-motion: reduce)')) return
    // touch / small screens → static NOW (the phone-guaranteed path)
    if (!mq('(hover: hover) and (pointer: fine)')) return
    if (window.innerWidth < 1024) return
    // low-power heuristic
    if ((navigator.hardwareConcurrency ?? 4) < 6) return
    // WebGL probe — context creation failure of any kind → static
    try {
      const c = document.createElement('canvas')
      const gl = c.getContext('webgl2') ?? c.getContext('webgl')
      if (!gl) return
    } catch {
      return
    }
    setEnabled(true)
  }, [lineUrl])

  if (!enabled || !lineUrl) return null
  return (
    <CircuitScene
      lineUrl={lineUrl}
      onLive={onLive}
      onFail={() => setEnabled(false)}
    />
  )
}
