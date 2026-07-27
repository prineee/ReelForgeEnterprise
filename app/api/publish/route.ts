import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const { video_url, title, description, hashtags, platforms, project_id, movie_id } = await req.json() as {
      video_url?: string; title?: string; description?: string
      hashtags?: string[]; platforms?: string[]; project_id?: string; movie_id?: string
    }

    if (!video_url || !platforms?.length || !title)
      return NextResponse.json({ error: 'video_url, title, platforms required' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: job, error } = await (supabase.from('publish_jobs') as any)
      .insert({ user_id: user.id, video_url, title, description, hashtags, platforms, project_id, movie_id, status: 'pending' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Check which platforms are already connected
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: connections } = await (supabase.from('platform_connections') as any)
      .select('platform, channel_name')
      .eq('user_id', user.id)
      .in('platform', platforms) as { data: { platform: string; channel_name: string }[] | null }

    const connectedPlatforms = (connections ?? []).map(c => c.platform)
    const notConnected       = platforms.filter(p => !connectedPlatforms.includes(p))

    return NextResponse.json({
      job,
      connectedPlatforms,
      notConnected,
      message: notConnected.length > 0
        ? `Connect ${notConnected.join(', ')} to publish automatically`
        : 'Publish job created',
    })
  } catch (error) {
    console.error('[publish] POST failed', error)
    return NextResponse.json({ error: 'Failed to create publish job.' }, { status: 500 })
  }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from('publish_jobs') as any)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ jobs: data })
  } catch (error) {
    console.error('[publish] GET failed', error)
    return NextResponse.json({ error: 'Failed to load publish jobs.' }, { status: 500 })
  }
}
