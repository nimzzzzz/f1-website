/// <reference types="react/canary" />
'use client'

import { ViewTransition, type ReactNode } from 'react'

// App Router supplies React's ViewTransition implementation. Names only
// match the selected driver's portrait/number, never the preview tooltips.
export function DriverSharedElement({ acronym, part, children }: {
  acronym: string
  part: 'portrait' | 'number'
  children: ReactNode
}) {
  return (
    <ViewTransition name={`driver-${part}-${acronym.toLowerCase()}`} default="none" share={`driver-${part}-morph`}>
      {children}
    </ViewTransition>
  )
}

export function DriverPageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition default="none"
      enter={{ 'driver-forward': 'driver-forward', 'driver-back': 'driver-back', default: 'none' }}
      exit={{ 'driver-forward': 'driver-forward', 'driver-back': 'driver-back', default: 'none' }}>
      {children}
    </ViewTransition>
  )
}
