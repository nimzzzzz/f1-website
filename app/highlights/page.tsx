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
    <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
      {/* Header */}
      <div className="mb-10">
        <p className="text-[11px] font-bold text-red-500 tracking-[0.3em] uppercase mb-3">2026 Season</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-zinc-100">Highlights</h1>
        <p className="text-zinc-500 text-sm mt-2">Latest videos from the official F1 YouTube channel</p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-video bg-zinc-900 rounded-xl mb-3" />
              <div className="h-3 bg-zinc-800 rounded w-3/4 mb-2" />
              <div className="h-3 bg-zinc-800 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="px-4 py-3 bg-red-950/30 border border-red-800/40 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Videos grid */}
      {!loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {videos.map((video) => (
            <a
              key={video.id}
              href={`https://www.youtube.com/watch?v=${video.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group block"
            >
              <div className="relative aspect-video rounded-xl overflow-hidden bg-zinc-900 mb-3">
                {video.thumbnail && (
                  <Image
                    src={video.thumbnail}
                    alt={video.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    unoptimized
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/40">
                  <div className="w-14 h-14 rounded-full bg-red-600 flex items-center justify-center shadow-2xl">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-red-600 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <p className="text-zinc-200 text-sm font-medium leading-snug line-clamp-2 group-hover:text-white transition-colors mb-1">
                {video.title}
              </p>
              <p className="text-zinc-600 text-[11px]">{timeAgo(video.publishedAt)}</p>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
