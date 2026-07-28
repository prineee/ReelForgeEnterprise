import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: series } = await (supabase.from('series') as any)
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (!series) return NextResponse.json({ error: 'Series not found' }, { status: 404 })

    const { project_id, title, video_url, thumbnail_url, duration } = await req.json()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (supabase.from('episodes') as any)
      .select('*', { count: 'exact', head: true })
      .eq('series_id', id)

    const episode_number = (count ?? 0) + 1

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('episodes') as any)
      .insert({
        series_id: id,
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
  } catch (error) {
    console.error('[series/[id]/episodes] POST failed', error)
    return NextResponse.json({ error: 'Failed to create episode.' }, { status: 500 })
  }
}