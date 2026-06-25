import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const {
    video_url, script,
    font_size, color, border_color, border_width,
    position, box, box_color,
  } = await req.json() as {
    video_url: string; script: string
    font_size?: number; color?: string; border_color?: string; border_width?: number
    position?: string; box?: boolean; box_color?: string
  }

  if (!video_url || !script) {
    return NextResponse.json({ error: 'video_url and script required' }, { status: 400 })
  }

  const workerUrl = (
    process.env.NEXT_PUBLIC_WORKER_URL ||
    'https://reel-forge-production.up.railway.app'
  ).replace(/\/$/, '')

  const res = await fetch(`${workerUrl}/api/burn-captions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_url, script, font_size, color, border_color, border_width, position, box, box_color }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    return NextResponse.json({ error: `Worker error: ${text.slice(0, 200)}` }, { status: 500 })
  }

  return res
}
