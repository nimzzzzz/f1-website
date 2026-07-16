import type { Metadata } from 'next'
import { Outfit, Bebas_Neue } from 'next/font/google'
import { GeistSans } from 'geist/font/sans'
import { GeistMono } from 'geist/font/mono'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import SessionsPreloader from '@/components/SessionsPreloader'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
})

// Brand fonts (LIGHTS OUT). Geist ships via the official `geist` package
// because next/font/google in Next 14 doesn't carry the Geist family yet.
// For now only the intro overlay and the sidebar wordmark use these —
// the site-wide restyle comes with the redesign pass.
const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
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
    <html lang="en" className={`${outfit.variable} ${bebasNeue.variable} ${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-zinc-950 text-zinc-100 font-sans">
        <SessionsPreloader />
        <div className="flex min-h-[100dvh]">
          <Sidebar />
          <main className="flex-1 md:ml-60 min-h-[100dvh] overflow-x-hidden">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
