import { NextResponse } from 'next/server'

const F1_CHANNEL_ID = 'UCB_qr75-ydFVKSF9Dmo6izg'
const API_KEY = process.env.YOUTUBE_API_KEY

export interface YTVideo {
  id: string
  title: string
  thumbnail: string
  publishedAt: string
}

async function fetchVideos(duration: 'medium' | 'long', pageToken?: string): Promise<{ items: any[]; nextPageToken?: string }> {
  const url = new URL('https://www.googleapis.com/youtube/v3/search')
  url.searchParams.set('part', 'snippet')
  url.searchParams.set('channelId', F1_CHANNEL_ID)
  url.searchParams.set('type', 'video')
  url.searchParams.set('order', 'date')
  url.searchParams.set('maxResults', '50')
  url.searchParams.set('videoDuration', duration)
  url.searchParams.set('key', API_KEY!)
  if (pageToken) url.searchParams.set('pageToken', pageToken)

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
  if (!res.ok) return { items: [] }
  const data = await res.json()
  return { items: data.items ?? [], nextPageToken: data.nextPageToken }
}

function toVideo(item: any): YTVideo {
  return {
    id: item.id.videoId,
    title: item.snippet.title,
    thumbnail:
      item.snippet.thumbnails?.maxres?.url ??
      item.snippet.thumbnails?.high?.url ??
      item.snippet.thumbnails?.medium?.url ?? '',
    publishedAt: item.snippet.publishedAt,
  }
}

export async function GET() {
  if (!API_KEY) {
    return NextResponse.json({ error: 'API key not configured' }, { status: 500 })
  }

  try {
    // Fetch medium (4-20min) and long (20min+) videos in parallel, 2 pages each
    const [med1, long1] = await Promise.all([
      fetchVideos('medium'),
      fetchVideos('long'),
    ])

    const [med2, long2] = await Promise.all([
      med1.nextPageToken ? fetchVideos('medium', med1.nextPageToken) : Promise.resolve({ items: [] }),
      long1.nextPageToken ? fetchVideos('long', long1.nextPageToken) : Promise.resolve({ items: [] }),
    ])

    const allItems = [...med1.items, ...med2.items, ...long1.items, ...long2.items]

    // Deduplicate by video id
    const seen = new Set<string>()
    const videos: YTVideo[] = allItems
      .map(toVideo)
      .filter((v) => {
        if (seen.has(v.id)) return false
        seen.add(v.id)
        return true
      })
      // Sort newest first
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())

    return NextResponse.json({ videos })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 })
  }
}
