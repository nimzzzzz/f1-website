import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        // The horizontal, scroll-driven layouts (drivers gallery, home
        // season strip) are pinned and translated by GSAP, and GSAP only
        // activates on `(min-width: 768px) and (hover: hover)`. Their CSS
        // has to be gated on the SAME condition. When it was gated on `md`
        // alone, a touch tablet at >=768px got the horizontal layout with
        // nothing driving it and no native scroll — which is precisely how
        // 21 of 22 drivers and most of the season became unreachable.
        // Naming the condition once means the two cannot drift apart again.
        mdh: { raw: '(min-width: 768px) and (hover: hover)' },
      },
      fontFamily: {
        body: ['var(--font-body)', 'sans-serif'],
        display: ['var(--font-display)', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      colors: {
        ink: 'var(--bg)',
        surface: 'var(--surface)',
        line: 'var(--line)',
        accent: 'var(--accent)',
        dim: 'var(--text-dim)',
      },
    },
  },
  plugins: [],
}
export default config
