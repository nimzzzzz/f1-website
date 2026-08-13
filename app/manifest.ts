import type { MetadataRoute } from 'next'
import { SITE_NAME } from '@/lib/seo'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — The 2026 Formula 1 Season`,
    short_name: SITE_NAME,
    description:
      'The 2026 Formula 1 season as it happens — championship standings, the calendar, race results and live session timing.',
    start_url: '/',
    display: 'standalone',
    // Matches --bg and --accent so an installed shell opens in the site's
    // own colours rather than flashing white.
    background_color: '#0a0a0a',
    theme_color: '#0a0a0a',
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
  }
}
