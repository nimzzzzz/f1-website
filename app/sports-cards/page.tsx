export default function SportsCardsPage() {
  return (
    <div className="relative flex min-h-[calc(100dvh-4rem)] flex-col justify-center overflow-x-clip px-6 md:px-14">
      <span
        aria-hidden
        className="outline-numeral pointer-events-none absolute -right-[2vw] top-[8vh] leading-none"
        style={{ fontSize: 'clamp(5rem, 12vw, 13rem)', WebkitTextStroke: '1px rgba(245,245,243,0.06)' }}
      >
        CARDS
      </span>
      <p className="strip-header text-[var(--text-dim)]">THE COLLECTION</p>
      <h1
        className="mt-4 uppercase leading-[0.85] text-[var(--text)]"
        style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem, 8vw, 8rem)' }}
      >
        Sports Cards
      </h1>
      <p className="label-mono mt-6 text-[var(--text-dim)]">COMING SOON</p>
    </div>
  )
}
