import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import './globals.css'
import Sidebar from '@/components/Sidebar'
import SessionsPreloader from '@/components/SessionsPreloader'

const outfit = Outfit({
  subsets: ['latin'],
  variable: '--font-outfit',
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Nimas F1 Tracker',
  description:
    'Live 2026 F1 championship standings, race calendar, lap times, and session data powered by OpenF1.',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={outfit.variable}>
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
