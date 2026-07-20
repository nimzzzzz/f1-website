'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'

interface YTVideo {
  id: string
  title: string
  thumbnail: string
  publishedAt: string
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) > 1 ? 's' : ''} ago`
}

export default function HighlightsPage() {
  const [videos, setVideos] = useState<YTVideo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/highlights')
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error)
        else setVideos(data.videos ?? [])
      })
      .catch(() => setError('Failed to load videos'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="relative overflow-x-clip px-6 pb-28 pt-20 md:px-14">
      <span
        aria-hidden
        className="outline-numeral pointer-events-none absolute -right-[2vw] -top-2 leading-none"
        style={{ fontSize: 'clamp(5rem, 12vw, 13rem)', WebkitTextStroke: '1px rgba(245,245,243,0.06)' }}
      >
        VIDEO
      </span>

      <p className="strip-header text-[var(--text-dim)]">HIGHLIGHTS — OFFICIAL F1 CHANNEL</p>
      <h1
        className="mt-4 uppercase leading-[0.85] text-[var(--text)]"
        style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.6rem, 6vw, 5.5rem)' }}
      >
        Latest videos
      </h1>

      {loading && (
        <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i}>
              <div className="aspect-video animate-pulse bg-white/5" />
              <div className="mt-4 h-4 w-3/4 animate-pulse rounded bg-white/5" />
            </div>
          ))}
        </div>
      )}

      {!loading && error && <p className="label-mono mt-14 text-[var(--accent)]">{error}</p>}

      {!loading && !error && (
        <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {videos.map((video) => (
            <a
              key={video.id}
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group block border-t border-[var(--line)] pt-4"
            >
              <div className="relative aspect-video overflow-hidden bg-[var(--surface)]">
                {video.thumbnail && (
                  <Image
                    src={video.thumbnail}
                    alt={video.title}
                    fill
                    className="object-cover brightness-[0.7] saturate-[0.85] transition-[filter,transform] duration-300 group-hover:scale-[1.03] group-hover:brightness-90 motion-reduce:transition-none"
                    unoptimized
                  />
                )}
                {/* dark treatment consistent with the site's grain-over-dark */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background: 'linear-gradient(to top, rgba(10,10,10,0.55), transparent 55%)',
                  }}
                />
                <span className="label-mono absolute bottom-3 left-3 text-[var(--text)] opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none">
                  WATCH →
                </span>
              </div>
              <p
                className="mt-4 line-clamp-2 uppercase leading-tight text-[var(--text)] transition-colors group-hover:text-[var(--accent)]"
                style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem' }}
              >
                {video.title}
              </p>
              <p className="label-mono mt-2 text-[var(--text-dim)]">
                {timeAgo(video.publishedAt).toUpperCase()}
              </p>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
