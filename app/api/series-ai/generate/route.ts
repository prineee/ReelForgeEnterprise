import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

interface CharacterInput {
  name: string
  appearance?: string
  personality?: string
}

interface SceneInput {
  scene_number: number
  title: string
  location: string
  characters_present: string[]
  camera_angle: string
  voiceover: string
  visual_prompt: string
  duration_seconds: number
}

interface EpisodeInput {
  episode_number: number
  title: string
  plot: string
  previously_on: string
  scenes: SceneInput[]
}

interface SeriesPlan {
  title: string
  logline: string
  series_arc: string
  episodes: EpisodeInput[]
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, genre, concept, episode_count, duration_per_episode, style, characters } = await req.json() as {
    title?: string
    genre?: string
    concept?: string
    episode_count?: number
    duration_per_episode?: number
    style?: string
    characters?: CharacterInput[]
  }

  if (!title?.trim() || !concept?.trim())
    return NextResponse.json({ error: 'title and concept required' }, { status: 400 })

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) return NextResponse.json({ error: 'Groq API key not configured' }, { status: 500 })

  const groq          = new Groq({ apiKey: groqApiKey })
  const epCount       = Number(episode_count) || 3
  const durPerEp      = Number(duration_per_episode) || 3
  const scenesPerEp   = Math.round(durPerEp * 4)

  const characterContext = characters?.length
    ? `Recurring Characters: ${characters.map(c =>
        `${c.name} — ${c.appearance ?? ''} — ${c.personality ?? ''}`
      ).join('; ')}`
    : ''

  const prompt = `You are a TV showrunner creating a ${epCount}-episode series.

Title: "${title}"
Genre: ${genre ?? 'Drama'}
Style: ${style ?? 'Cinematic'}
Episodes: ${epCount}
Duration per episode: ${durPerEp} minutes
${characterContext}
Concept: ${concept}

Create a complete series plan with story continuity across all episodes.

Each episode must:
- Continue from previous episode events
- Maintain character consistency
- Have its own mini arc (setup/conflict/resolution) while advancing the main story
- Have exactly ${scenesPerEp} scenes

Respond ONLY with valid JSON:
{
  "title": "series title",
  "logline": "series premise in one sentence",
  "series_arc": "overall story across all episodes",
  "episodes": [
    {
      "episode_number": 1,
      "title": "episode title",
      "plot": "episode summary",
      "previously_on": "",
      "scenes": [
        {
          "scene_number": 1,
          "title": "scene title",
          "location": "Interior - Location - Time",
          "characters_present": ["name"],
          "camera_angle": "Medium Shot",
          "voiceover": "narration or dialogue",
          "visual_prompt": "detailed AI video generation prompt 50+ words",
          "duration_seconds": 8
        }
      ]
    }
  ]
}`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a TV showrunner. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 8000,
      response_format: { type: 'json_object' },
    })

    const raw        = completion.choices[0]?.message?.content ?? ''
    const seriesPlan = JSON.parse(raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')) as SeriesPlan

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: series, error: seriesError } = await (supabase.from('tv_series') as any)
      .insert({ user_id: user.id, title, genre, style, concept, episode_count: epCount })
      .select()
      .single()

    if (seriesError) return NextResponse.json({ error: seriesError.message }, { status: 500 })

    if (seriesPlan.episodes?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('tv_episodes') as any).insert(
        seriesPlan.episodes.map((ep: EpisodeInput) => ({
          series_id:        series.id,
          user_id:          user.id,
          episode_number:   ep.episode_number,
          title:            ep.title,
          plot:             ep.plot,
          screenplay:       ep,
          duration_minutes: durPerEp,
          status:           'draft',
        }))
      )
    }

    return NextResponse.json({ series, plan: seriesPlan })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Series generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
