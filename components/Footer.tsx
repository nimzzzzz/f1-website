import { ArrowRight } from '@phosphor-icons/react/dist/ssr'

const LINKS = {
  Racing:  ['Calendar', 'Results', 'Live Timing', 'Points', 'Circuits'],
  Teams:   ['Red Bull', 'Ferrari', 'McLaren', 'Mercedes', 'Aston Martin'],
  Media:   ['F1 TV Pro', 'Highlights', 'Documentaries', 'Podcasts'],
  Company: ['About', 'Press', 'Careers', 'Privacy', 'Terms'],
}

export default function Footer() {
  return (
    <footer className="border-t border-zinc-800/40 mt-0">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-16 md:py-20">

        {/* Top grid — brand col wider */}
        <div className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-10 md:gap-12 mb-16">

          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-6">
              <svg width="28" height="18" viewBox="0 0 30 20" fill="none" aria-hidden="true">
                <rect x="0" y="0" width="7" height="20" rx="1" fill="#DC2626" />
                <rect x="11.5" y="0" width="7" height="20" rx="1" fill="#DC2626" />
                <rect x="23" y="0" width="7" height="20" rx="1" fill="#DC2626" />
              </svg>
              <span className="text-[11px] font-black tracking-[0.3em] uppercase text-zinc-100">
                Formula 1
              </span>
            </div>
            <p className="text-sm text-zinc-600 leading-relaxed max-w-[30ch] mb-8">
              The pinnacle of motorsport. 24 races, 20 drivers, 10 teams, one world championship.
            </p>
            {/* Social links — SVG icons, no emoji */}
            <div className="flex items-center gap-5">
              <a href="#" className="text-zinc-700 hover:text-zinc-300 transition-colors duration-200" aria-label="X / Twitter">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.259 5.631 5.905-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="#" className="text-zinc-700 hover:text-zinc-300 transition-colors duration-200" aria-label="Instagram">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                </svg>
              </a>
              <a href="#" className="text-zinc-700 hover:text-zinc-300 transition-colors duration-200" aria-label="YouTube">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(LINKS).map(([category, links]) => (
            <div key={category}>
              <p className="text-[10px] font-bold text-zinc-500 tracking-[0.28em] uppercase mb-4">
                {category}
              </p>
              <ul className="flex flex-col gap-2.5">
                {links.map((link) => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-[13px] text-zinc-600 hover:text-zinc-300 transition-colors duration-200"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* F1 TV Pro CTA bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 py-8 border-y border-zinc-800/40 mb-8">
          <div>
            <p className="text-sm font-bold text-zinc-100">Watch every race live, ad-free.</p>
            <p className="text-xs text-zinc-600 mt-0.5">F1 TV Pro — from $9.99/month</p>
          </div>
          <a
            href="#"
            className="group inline-flex items-center gap-2 text-[13px] font-semibold px-5 py-2.5 bg-red-600 text-white hover:bg-red-500 transition-colors duration-200 active:scale-[0.98] active:-translate-y-[1px]"
          >
            Start Watching
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform duration-200" />
          </a>
        </div>

        {/* Bottom row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <p className="text-[11px] text-zinc-700">
            &copy; 2025 Formula One World Championship Limited. All rights reserved.
          </p>
          <div className="flex items-center gap-5">
            {['Privacy Policy', 'Cookie Policy', 'Terms of Service'].map((item) => (
              <a
                key={item}
                href="#"
                className="text-[11px] text-zinc-700 hover:text-zinc-400 transition-colors duration-200"
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
