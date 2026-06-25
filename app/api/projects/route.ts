import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('projects') as any)
    .select('id, title, status, created_at, videos(video_url, thumbnail_url)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Flatten the nested videos relation into top-level fields
  const projects = (data ?? []).map((p: {
    id: string; title: string; status: string; created_at: string
    videos: Array<{ video_url: string | null; thumbnail_url: string | null }> | null
  }) => ({
    id:            p.id,
    title:         p.title,
    status:        p.status,
    created_at:    p.created_at,
    video_url:     p.videos?.[0]?.video_url ?? null,
    thumbnail_url: p.videos?.[0]?.thumbnail_url ?? null,
  }))

  return NextResponse.json({ projects })
}
