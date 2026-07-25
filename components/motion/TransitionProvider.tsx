'use client'

import { createContext, useCallback, useContext, type ReactNode, type MouseEvent } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

// Navigation is INSTANT. There used to be a pure-black panel that wiped up
// over the outgoing page, held ~150ms with the wordmark, then wiped off —
// ~650ms end to end. Once every route began serving from a static snapshot,
// pages arrived faster than the panel could mean anything: it flashed on and
// vanished, reading as a glitch instead of a beat. The panel is gone.
//
// What replaces it is a ~130ms opacity fade on the incoming page content only
// (.route-fade on <main> in Shell) — enough that the swap isn't a hard cut,
// cheap enough that it never delays a paint.
//
// TransitionLink stays the site's navigation primitive so callers keep their
// `onNavigate` hook (the menu closes itself with it), but it is now a thin
// next/link wrapper: no preventDefault, no manual router.push. That hands
// scroll handling and prefetching back to the App Router, which is what keeps
// back/forward arriving clean.

const TransitionContext = createContext<(href: string) => void>(() => {})

export function useTransitionNav() {
  return useContext(TransitionContext)
}

export function TransitionLink({
  href,
  children,
  className,
  style,
  onNavigate,
  ...rest
}: {
  href: string
  children: ReactNode
  className?: string
  style?: React.CSSProperties
  onNavigate?: () => void
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'>) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // modified clicks (new tab etc.) stay native and must not fire onNavigate
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    onNavigate?.()
  }
  return (
    <Link href={href} onClick={onClick} className={className} style={style} {...rest}>
      {children}
    </Link>
  )
}

export default function TransitionProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()

  // Kept for API compatibility with any imperative caller: a plain push.
  const navigate = useCallback(
    (href: string) => {
      if (href === pathname) return
      router.push(href)
    },
    [pathname, router]
  )

  return <TransitionContext.Provider value={navigate}>{children}</TransitionContext.Provider>
}
