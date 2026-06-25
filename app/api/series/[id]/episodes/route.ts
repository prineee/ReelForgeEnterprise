import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { project_id, title, video_url, thumbnail_url, duration } = await req.json()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { count } = await (supabase.from('episodes') as any)
    .select('*', { count: 'exact', head: true })
    .eq('series_id', params.id)

  const episode_number = (count ?? 0) + 1

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from('episodes') as any)
    .insert({
      series_id: params.id,
      user_id: user.id,
      project_id,
      episode_number,
      title,
      video_url,
      thumbnail_url,
      duration,
      status: video_url ? 'ready' : 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ episode: data })
}
