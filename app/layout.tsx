import type { Metadata } from 'next'
import { SITE_NAME, SITE_URL, canonical } from '@/lib/seo'
import JsonLd from '@/components/seo/JsonLd'
import { Bebas_Neue, Space_Grotesk, Syne } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import SessionsPreloader from '@/components/SessionsPreloader'
import LenisProvider from '@/components/motion/LenisProvider'
import TransitionProvider from '@/components/motion/TransitionProvider'
import Shell from '@/components/shell/Shell'

// GEIST, SUBSET AND STATIC — 137.7 KB to 48.1 KB on every route.
//
// The `geist` package serves variable files carrying a 100-900 weight
// axis and the full upstream glyph set. A text-node walk across twelve
// routes found exactly one weight in use, 400, for both families, so the
// axis was dead payload and most of the glyphs with it.
//
// What this costs: the axis is gone, so a future font-weight:600 on Geist
// synthesises rather than renders. That is the deliberate half of the
// trade. The dangerous half is glyph coverage — a subset that drops a
// character does not error, it quietly falls back to another face — and
// that is what tests/font-subset.test.ts exists to catch. Regenerate with
// `npm run subset-fonts` after any change to the grid, the calendar or UI
// copy; the test fails if the files and the repertoire disagree.
//
// The CSS variable names are unchanged, so globals.css does not move.
const geistSans = localFont({
  src: './fonts/Geist-Regular.subset.woff2',
  variable: '--font-geist-sans',
  weight: '400',
  display: 'swap',
})

const geistMono = localFont({
  src: './fonts/GeistMono-Regular.subset.woff2',
  variable: '--font-geist-mono',
  weight: '400',
  display: 'swap',
})

// Brand fonts (LIGHTS OUT).
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

// Section headers (THE FIGHT, LAST TIME OUT, …) — a distinct premium
// display voice between the mono data labels and Bebas headlines.
//
// preload: false is what makes this PER-ROUTE, and it is the whole change.
// A @font-face is only fetched when an element actually renders in that
// family, so Syne would have loaded lazily and only where it is used —
// except the preload link forced the download everywhere regardless. It
// was arriving on /drivers, /teams, /schedule and /sports-cards, which
// render zero Syne elements between them, at 33.8 KB a route.
//
// The cost is on the eleven routes that DO use it, where the file is now
// requested after CSS parse rather than in parallel with it. That is
// already a swap-governed font and it sets 1-3 small labels per route, so
// the exposure is a brief fallback on a 13.5px header, not on body copy.
const syne = Syne({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-section',
  display: 'swap',
  preload: false,
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  // The template gives every route a consistent tail without each one
  // repeating the site name; `default` covers routes that set no title.
  title: {
    default: 'LIGHTS OUT — THE 2026 FORMULA 1 SEASON',
    template: '%s — LIGHTS OUT',
  },
  description:
    'The 2026 Formula 1 season as it happens — championship standings, the calendar, race results and live session timing.',
  applicationName: SITE_NAME,
  alternates: { canonical: canonical('/') },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: 'LIGHTS OUT — THE 2026 FORMULA 1 SEASON',
    description:
      'The 2026 Formula 1 season as it happens — championship standings, the calendar, race results and live session timing.',
    url: canonical('/'),
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LIGHTS OUT — THE 2026 FORMULA 1 SEASON',
    description:
      'The 2026 Formula 1 season as it happens — championship standings, the calendar, race results and live session timing.',
  },
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
    <html lang="en" data-scroll-behavior="smooth" className={`${bebasNeue.variable} ${spaceGrotesk.variable} ${syne.variable} ${geistSans.variable} ${geistMono.variable}`}>
      {/* THE INTRO'S ESCAPE HATCH — two independent routes, because the
          two failure modes are different. <noscript> covers scripts being
          disabled outright. The inline failsafe covers hydration FAILING:
          it runs before React and does not depend on it, so if the app
          never takes over, the overlay is removed anyway. 20s is far past
          the intro's own duration, so it can never cut a working intro
          short — it only ever rescues a broken one. */}
      <noscript>
        <style>{`[data-intro-overlay]{display:none !important}`}</style>
      </noscript>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "setTimeout(function(){var o=document.querySelector('[data-intro-overlay]');" +
            "if(o&&!o.dataset.introHandedOff){o.style.display='none'}},20000)",
        }}
      />
      <body>
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: SITE_NAME,
            alternateName: 'LIGHTS OUT — The 2026 Formula 1 Season',
            url: SITE_URL,
          }}
        />
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
