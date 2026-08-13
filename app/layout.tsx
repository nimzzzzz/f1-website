import type { Metadata } from 'next'
import { Bebas_Neue, Space_Grotesk, Syne } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import SessionsPreloader from '@/components/SessionsPreloader'
import LenisProvider from '@/components/motion/LenisProvider'
import TransitionProvider from '@/components/motion/TransitionProvider'
import Shell from '@/components/shell/Shell'

// Brand fonts (LIGHTS OUT). Geist ships via the official `geist` package
// because next/font/google in Next 14 doesn't carry the Geist family yet.
// Outfit is gone: it was loaded site-wide (7 weights) purely for the old
// /teams/[slug] page, the last pre-redesign route — replaced by THE MACHINE.
const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
})

// The top-bar ticker's own face — technical like the data mono but with
// drawn letterforms; used nowhere else.
const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500'],
  variable: '--font-ticker',
  display: 'swap',
})

// Section headers site-wide (THE FIGHT, LAST TIME OUT, …) — a distinct
// premium display voice between the mono data labels and Bebas headlines.
const syne = Syne({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-section',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'LIGHTS OUT — F1 2026',
  description:
    'Live 2026 F1 championship standings, race calendar, lap times, and session data powered by OpenF1.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // data-scroll-behavior: globals.css sets html { scroll-behavior: smooth }
    // for in-page anchors. Through Next 15 the router temporarily forced
    // scroll-behavior:auto during a route change so navigation jumped to the
    // top instantly; Next 16 no longer does that unless this attribute opts
    // in. Without it, every route change would SMOOTH-SCROLL to the top —
    // visibly wrong on a site that already runs Lenis for its own scrolling.
    <html lang="en" data-scroll-behavior="smooth" className={`${bebasNeue.variable} ${spaceGrotesk.variable} ${syne.variable} ${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <SessionsPreloader />
        <LenisProvider>
          <TransitionProvider>
            <Shell>{children}</Shell>
          </TransitionProvider>
        </LenisProvider>
      </body>
    </html>
  )
}
