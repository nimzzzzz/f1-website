import { ArrowRight, Clock } from '@phosphor-icons/react/dist/ssr'

const NEWS = [
  {
    id: 1,
    category: 'Race Report',
    headline: 'Norris Masterclass in Melbourne Puts McLaren on Top of Constructors',
    excerpt:
      'A calculated performance from Lando Norris — building a 14.7-second gap before the first safety car — handed McLaren their first win at Albert Park since 2012. The papaya car showed a 0.41s per-lap advantage in high-speed corners.',
    author: 'Tom Clarkson',
    readTime: '4 min',
    date: 'Mar 16, 2025',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ae/Lando_Norris%2CChinese_GP_2024.jpg/1200px-Lando_Norris%2CChinese_GP_2024.jpg',
    featured: true,
  },
  {
    id: 2,
    category: 'Technical Analysis',
    headline: "Ferrari's Revised Floor Closes Red Bull Gap by 0.38s Per Lap at Suzuka",
    excerpt:
      'Technical director Enrico Cardile explains how revised floor endplates and sidepod geometry unlocked aerodynamic gains, repositioning the SF-25 as a genuine challenger on high-downforce circuits.',
    author: 'Giorgio Piola',
    readTime: '7 min',
    date: 'Mar 14, 2025',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/55/2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3912_by_Stepro.jpg/1200px-2024-08-25_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3912_by_Stepro.jpg',
    featured: false,
  },
  {
    id: 3,
    category: 'Driver Profile',
    headline: 'Verstappen at 50: The Architecture of a Four-Time Champion',
    excerpt:
      'In 891 races spread across 10 seasons, Max Verstappen redefined what it means to win in the hybrid era. We trace the psychological and technical evolution that set him apart from an exceptional generation.',
    author: 'Andrew Benson',
    readTime: '11 min',
    date: 'Mar 12, 2025',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2e/Max_Verstappen_2024_Chinese_GP.jpg/1200px-Max_Verstappen_2024_Chinese_GP.jpg',
    featured: false,
  },
]

export default function NewsSection() {
  return (
    <section className="py-24 md:py-32 border-t border-zinc-800/30">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        {/* Header — left-aligned, no center */}
        <div className="flex items-end justify-between mb-14">
          <div>
            <p className="text-[11px] font-bold text-red-500 tracking-[0.3em] uppercase mb-3">
              Latest
            </p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-none text-zinc-100">
              News &amp;
            </h2>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-none text-zinc-600">
              Analysis
            </h2>
          </div>
          <a
            href="#"
            className="hidden md:flex items-center gap-2 text-[13px] text-zinc-500 hover:text-zinc-100 transition-colors group"
          >
            All articles
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform duration-200" />
          </a>
        </div>

        {/* Articles — zig-zag layout, NO 3-column equal grid (taste-skill Rule 3) */}
        <div className="flex flex-col divide-y divide-zinc-800/30">

          {/* Featured — asymmetric 1fr 2fr */}
          <article className="grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-0 group cursor-pointer pb-0">
            <div
              className="aspect-[4/3] md:aspect-auto bg-zinc-900 overflow-hidden"
              style={{
                backgroundImage: `url(${NEWS[0].image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                minHeight: '260px',
              }}
            />
            <div className="p-8 md:p-12 flex flex-col justify-between border-l border-zinc-800/30">
              <div>
                <div className="mb-5">
                  <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-red-500 border border-red-600/30 px-2 py-1">
                    {NEWS[0].category}
                  </span>
                </div>
                <h3 className="text-2xl md:text-[1.75rem] font-black tracking-tight leading-tight text-zinc-100 mb-4 max-w-[55ch] group-hover:text-zinc-200 transition-colors duration-200">
                  {NEWS[0].headline}
                </h3>
                <p className="text-[15px] text-zinc-500 leading-relaxed max-w-[65ch]">
                  {NEWS[0].excerpt}
                </p>
              </div>
              <div className="flex items-center justify-between mt-8 pt-6 border-t border-zinc-800/30">
                <div className="flex items-center gap-4">
                  <span className="text-[13px] font-semibold text-zinc-400">{NEWS[0].author}</span>
                  <div className="flex items-center gap-1.5 text-zinc-600">
                    <Clock size={11} />
                    <span className="text-[11px]">{NEWS[0].readTime} read</span>
                  </div>
                </div>
                <span className="text-[11px] text-zinc-600">{NEWS[0].date}</span>
              </div>
            </div>
          </article>

          {/* Article 2 — 2-col, image right */}
          <article className="grid grid-cols-1 md:grid-cols-2 gap-0 group cursor-pointer">
            <div className="p-8 md:p-10 flex flex-col justify-between border-r border-zinc-800/30">
              <div>
                <div className="mb-4">
                  <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-zinc-500 border border-zinc-800 px-2 py-1">
                    {NEWS[1].category}
                  </span>
                </div>
                <h3 className="text-xl md:text-2xl font-black tracking-tight leading-tight text-zinc-100 mb-3 group-hover:text-zinc-200 transition-colors duration-200">
                  {NEWS[1].headline}
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed max-w-[65ch]">{NEWS[1].excerpt}</p>
              </div>
              <div className="flex items-center justify-between mt-6 pt-5 border-t border-zinc-800/30">
                <span className="text-[13px] font-semibold text-zinc-500">{NEWS[1].author}</span>
                <a
                  href="#"
                  className="group/link flex items-center gap-1.5 text-[12px] text-zinc-600 hover:text-zinc-100 transition-colors"
                >
                  Read
                  <ArrowRight size={11} className="group-hover/link:translate-x-0.5 transition-transform duration-200" />
                </a>
              </div>
            </div>
            <div
              className="aspect-video md:aspect-auto bg-zinc-900 min-h-[220px]"
              style={{
                backgroundImage: `url(${NEWS[1].image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          </article>

          {/* Article 3 — 2-col, image left (zig-zag) */}
          <article className="grid grid-cols-1 md:grid-cols-2 gap-0 group cursor-pointer">
            <div
              className="aspect-video md:aspect-auto bg-zinc-900 min-h-[220px] order-2 md:order-1"
              style={{
                backgroundImage: `url(${NEWS[2].image})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
            <div className="p-8 md:p-10 flex flex-col justify-between border-l border-zinc-800/30 order-1 md:order-2">
              <div>
                <div className="mb-4">
                  <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-zinc-500 border border-zinc-800 px-2 py-1">
                    {NEWS[2].category}
                  </span>
                </div>
                <h3 className="text-xl md:text-2xl font-black tracking-tight leading-tight text-zinc-100 mb-3 group-hover:text-zinc-200 transition-colors duration-200">
                  {NEWS[2].headline}
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed max-w-[65ch]">{NEWS[2].excerpt}</p>
              </div>
              <div className="flex items-center justify-between mt-6 pt-5 border-t border-zinc-800/30">
                <span className="text-[13px] font-semibold text-zinc-500">{NEWS[2].author}</span>
                <a
                  href="#"
                  className="group/link flex items-center gap-1.5 text-[12px] text-zinc-600 hover:text-zinc-100 transition-colors"
                >
                  Read
                  <ArrowRight size={11} className="group-hover/link:translate-x-0.5 transition-transform duration-200" />
                </a>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
