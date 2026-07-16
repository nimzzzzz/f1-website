'use client'

export default function HomeFooter({ seasonYear }: { seasonYear: number | null }) {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-6 border-t border-[var(--line)] px-6 py-10 md:px-14">
      <span
        className="text-lg leading-none text-[var(--text)]"
        style={{ fontFamily: 'var(--font-display)', letterSpacing: '0.08em' }}
      >
        LIGHTS OUT
      </span>
      <div className="label-mono flex flex-wrap items-center gap-6 text-[var(--text-dim)] md:gap-10">
        <a
          href="https://openf1.org"
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-[var(--accent)]"
        >
          DATA: OPENF1
        </a>
        <a
          href="https://github.com/nimzzzzz/f1-website"
          target="_blank"
          rel="noreferrer"
          className="transition-colors hover:text-[var(--accent)]"
        >
          GITHUB ↗
        </a>
        {/* derived from loaded season data, not the system clock */}
        {seasonYear !== null && <span>SEASON {seasonYear}</span>}
      </div>
    </footer>
  )
}
