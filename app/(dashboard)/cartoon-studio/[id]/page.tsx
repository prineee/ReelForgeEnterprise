import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StoryboardView } from './StoryboardView'

interface Props {
  params: { id: string }
}

export default async function StoryboardPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: story } = await (supabase.from('cartoon_stories') as any)
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!story) redirect('/cartoon-studio')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: characters } = await (supabase.from('cartoon_characters') as any)
    .select('*')
    .eq('story_id', params.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: scenes } = await (supabase.from('cartoon_scenes') as any)
    .select('*')
    .eq('story_id', params.id)
    .order('scene_number', { ascending: true })

  return (
    <StoryboardView
      story={story}
      characters={characters ?? []}
      scenes={scenes ?? []}
    />
  )
}
