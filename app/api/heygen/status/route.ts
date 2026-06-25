import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const videoId = searchParams.get('video_id')
  if (!videoId) return NextResponse.json({ error: 'video_id required' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL
  if (!workerUrl) return NextResponse.json({ error: 'NEXT_PUBLIC_WORKER_URL not configured' }, { status: 500 })

  const res = await fetch(`${workerUrl}/api/lipsync/status/${encodeURIComponent(videoId)}`)
  if (res.status === 404) {
    return NextResponse.json({ code: 100, data: { status: 'processing', pct: 0 } })
  }

  const job = await res.json() as {
    status: string; video_url?: string; error?: string; pct?: number
  }

  console.log('[heygen/status] video_id:', videoId, 'status:', job.status)

  return NextResponse.json({
    code: 100,
    data: {
      status:    job.status,
      video_url: job.video_url ?? null,
      error:     job.error    ?? null,
      pct:       job.pct      ?? 0,
    },
  })
}
