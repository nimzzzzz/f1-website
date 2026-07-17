'use client'

// The honest empty state for openf1's live-session lockout: shown wherever
// data is absent because the API is 401ing, never for genuine off-season.
// full   — replaces the home hero slot
// inline — stands in for a data section
// banner — strip at the top of non-home routes
export default function LiveSessionNotice({
  variant = 'inline',
}: {
  variant?: 'full' | 'inline' | 'banner'
}) {
  const dot = (
    <span
      aria-hidden
      className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--accent)] motion-reduce:animate-none"
    />
  )
  const subline = (
    <p className="label-mono text-[var(--text-dim)]">
      DATA RESUMES AFTER THE SESSION · SOURCE: OPENF1
    </p>
  )

  if (variant === 'banner') {
    return (
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[var(--line)] px-6 py-4 md:px-14">
        <span className="flex items-center gap-2.5">
          {dot}
          <span
            className="uppercase leading-none text-[var(--text)]"
            style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', letterSpacing: '0.06em' }}
          >
            Live session in progress
          </span>
        </span>
        {subline}
      </div>
    )
  }

  if (variant === 'full') {
    return (
      <section className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-6 md:px-14">
        <p className="label-mono mb-6 flex items-center gap-2.5 text-[var(--accent)]">
          {dot}
          LIVE
        </p>
        <h1
          className="uppercase text-[var(--text)]"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(3.2rem, 9vw, 9.5rem)',
            lineHeight: 0.88,
          }}
        >
          Live session in progress
        </h1>
        <div className="mt-8">{subline}</div>
      </section>
    )
  }

  return (
    <section className="border-t border-[var(--line)] px-6 py-24 md:px-14">
      <p
        className="flex items-center gap-4 uppercase leading-none text-[var(--text)]"
        style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4vw, 3.6rem)' }}
      >
        {dot}
        Live session in progress
      </p>
      <div className="mt-4">{subline}</div>
    </section>
  )
}
