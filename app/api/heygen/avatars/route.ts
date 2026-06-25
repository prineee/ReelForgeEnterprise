import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const BUILTIN_AVATARS = [
  {
    avatar_id:         'avatar_casual_male_01',
    name:              'Alex',
    gender:            'male',
    preview_image_url: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?w=400',
    preview_video_url: '',
    type:              'builtin' as const,
    engine:            'wav2lip',
  },
  {
    avatar_id:         'avatar_casual_female_01',
    name:              'Sophia',
    gender:            'female',
    preview_image_url: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?w=400',
    preview_video_url: '',
    type:              'builtin' as const,
    engine:            'wav2lip',
  },
  {
    avatar_id:         'avatar_professional_male_01',
    name:              'Marcus',
    gender:            'male',
    preview_image_url: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?w=400',
    preview_video_url: '',
    type:              'builtin' as const,
    engine:            'wav2lip',
  },
  {
    avatar_id:         'avatar_professional_female_01',
    name:              'Priya',
    gender:            'female',
    preview_image_url: 'https://images.pexels.com/photos/1181690/pexels-photo-1181690.jpeg?w=400',
    preview_video_url: '',
    type:              'builtin' as const,
    engine:            'wav2lip',
  },
]

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: customRows } = await (supabase.from('custom_avatars') as any)
    .select('id, name, preview_url, engine, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false }) as {
      data: Array<{ id: string; name: string; preview_url: string; engine: string }> | null
    }

  const customAvatars = (customRows ?? []).map(row => ({
    avatar_id:         row.id,
    name:              row.name,
    gender:            'unknown',
    preview_image_url: row.preview_url,
    preview_video_url: '',
    type:              'talking_photo' as const,
    engine:            row.engine,
  }))

  return NextResponse.json({ avatars: [...BUILTIN_AVATARS, ...customAvatars] })
}
