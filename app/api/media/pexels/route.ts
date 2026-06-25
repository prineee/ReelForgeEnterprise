import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const pexelsKey = process.env.PEXELS_API_KEY
  if (!pexelsKey) return NextResponse.json({ error: 'Pexels API key not configured' }, { status: 500 })

  const { searchParams } = new URL(request.url)
  const query    = searchParams.get('query') || 'lifestyle'
  const type     = searchParams.get('type') || 'video'   // 'video' | 'image'
  const page     = Number(searchParams.get('page') || '1')
  const perPage  = Number(searchParams.get('per_page') || '20')

  try {
    if (type === 'video') {
      const res = await fetch(
        `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=portrait&size=medium`,
        { headers: { Authorization: pexelsKey } }
      )

      if (!res.ok) return NextResponse.json({ error: `Pexels error: ${res.status}` }, { status: 502 })

      const data = await res.json() as {
        videos: Array<{
          id: number
          width: number
          height: number
          duration: number
          image: string
          video_files: Array<{ id: number; quality: string; file_type: string; width: number; height: number; link: string }>
        }>
      }

      const media = (data.videos ?? []).map(v => {
        const best = (v.video_files ?? [])
          .filter(f => f.file_type === 'video/mp4' && f.width <= 1280)
          .sort((a, b) => a.width - b.width)[0]
        return {
          id:        v.id,
          url:       best?.link ?? '',
          thumbnail: v.image,
          type:      'video' as const,
          duration:  v.duration,
          width:     v.width,
          height:    v.height,
        }
      }).filter(m => m.url)

      return NextResponse.json({ media, total_results: (data as { total_results?: number }).total_results ?? 0 })
    } else {
      const res = await fetch(
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${perPage}&page=${page}&orientation=portrait`,
        { headers: { Authorization: pexelsKey } }
      )

      if (!res.ok) return NextResponse.json({ error: `Pexels error: ${res.status}` }, { status: 502 })

      const data = await res.json() as {
        photos: Array<{
          id: number
          width: number
          height: number
          src: { large2x: string; large: string; medium: string }
        }>
        total_results: number
      }

      const media = (data.photos ?? []).map(p => ({
        id:        p.id,
        url:       p.src.large2x || p.src.large,
        thumbnail: p.src.medium,
        type:      'image' as const,
        duration:  0,
        width:     p.width,
        height:    p.height,
      }))

      return NextResponse.json({ media, total_results: data.total_results })
    }
  } catch (err) {
    console.error('[media/pexels] Fetch threw:', err)
    return NextResponse.json({ error: 'Failed to fetch media from Pexels' }, { status: 502 })
  }
}
