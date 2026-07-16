'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
  type MouseEvent,
} from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import gsap from 'gsap'

// Route transitions: a pure-black panel wipes up over the outgoing page,
// holds ~150ms with the wordmark, and wipes off the incoming page.
// Total ≈ 650ms. Reduced motion: plain navigation, no panel.

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
  const navigate = useTransitionNav()
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // let modified clicks (new tab etc.) behave natively
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    onNavigate?.()
    navigate(href)
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
  const panelRef = useRef<HTMLDivElement>(null)
  const phaseRef = useRef<'idle' | 'covering' | 'waiting'>('idle')

  const navigate = useCallback(
    (href: string) => {
      if (href === pathname) return
      const panel = panelRef.current
      if (
        !panel ||
        phaseRef.current !== 'idle' ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        router.push(href)
        return
      }
      phaseRef.current = 'covering'
      gsap.timeline()
        .set(panel, { display: 'flex' })
        .fromTo(
          panel,
          { yPercent: 100 },
          {
            yPercent: 0,
            duration: 0.25,
            ease: 'power3.inOut',
            onComplete: () => {
              phaseRef.current = 'waiting'
              router.push(href)
            },
          }
        )
    },
    [pathname, router]
  )

  // New route committed: hold briefly under the panel, then wipe it off.
  useEffect(() => {
    if (phaseRef.current !== 'waiting') return
    const panel = panelRef.current
    if (!panel) return
    window.scrollTo(0, 0)
    const t = setTimeout(() => {
      gsap.to(panel, {
        yPercent: -100,
        duration: 0.25,
        ease: 'power3.inOut',
        onComplete: () => {
          gsap.set(panel, { display: 'none' })
          phaseRef.current = 'idle'
        },
      })
    }, 150)
    return () => clearTimeout(t)
  }, [pathname])

  return (
    <TransitionContext.Provider value={navigate}>
      {children}
      {/* pure black by design — the one place it's allowed outside the intro */}
      <div
        ref={panelRef}
        aria-hidden
        className="fixed inset-0 z-[180] hidden items-center justify-center bg-black"
        style={{ transform: 'translateY(100%)' }}
      >
        <span
          className="text-2xl text-[var(--text)]"
          style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}
        >
          LIGHTS OUT
        </span>
      </div>
    </TransitionContext.Provider>
  )
}
