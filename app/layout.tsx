import type { Metadata } from 'next'
import { Outfit, Bebas_Neue, Space_Grotesk } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import SessionsPreloader from '@/components/SessionsPreloader'
import LenisProvider from '@/components/motion/LenisProvider'
import TransitionProvider from '@/components/motion/TransitionProvider'
import Shell from '@/components/shell/Shell'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
})

// Brand fonts (LIGHTS OUT). Geist ships via the official `geist` package
// because next/font/google in Next 14 doesn't carry the Geist family yet.
// Outfit remains loaded for legacy route styling during the phased redesign.
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

export const metadata: Metadata = {
  title: 'LIGHTS OUT — F1 2026',
  description:
    'Live 2026 F1 championship standings, race calendar, lap times, and session data powered by OpenF1.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${outfit.variable} ${bebasNeue.variable} ${spaceGrotesk.variable} ${GeistSans.variable} ${GeistMono.variable}`}>
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
