import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCredits } from '@/lib/credits'
import Groq from 'groq-sdk'

const GENRE_STYLES: Record<string, string> = {
  Action:      'fast cuts, high energy, explosion visuals, hero moments',
  Horror:      'dark atmosphere, suspense, shadow play, jump scare timing',
  Romance:     'soft lighting, slow motion, golden hour, emotional close-ups',
  Comedy:      'bright colors, reaction shots, comedic timing, expressive faces',
  Documentary: 'handheld camera, real locations, interview style, b-roll heavy',
  Thriller:    'tension building, tight framing, dramatic music, reveal moments',
  Fantasy:     'magical visuals, wide establishing shots, glowing effects',
  'Sci-Fi':    'futuristic sets, neon lighting, space visuals, tech overlays',
}

const CAMERA_ANGLES = [
  'Extreme Close-Up', 'Close-Up', 'Medium Shot', 'Wide Shot',
  'Over-the-Shoulder', 'Low Angle', 'High Angle', 'Drone Shot',
  'Tracking Shot', 'Dolly Zoom', 'Dutch Angle', 'POV Shot',
]

interface CharacterInput {
  name: string
  age?: string
  gender?: string
  appearance?: string
  personality?: string
}

interface SceneInput {
  scene_number: number
  title: string
  voiceover: string
  visual_prompt: string
  camera_angle: string
  characters_present: string[]
  location: string
  duration_seconds: number
}

interface ScreenplayResult {
  title: string
  logline: string
  scenes: SceneInput[]
}

export async function POST(req: Request) {
  const creditCheck = await requireCredits('movie_script')
  if (!creditCheck.ok) return creditCheck.response

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, genre, plot, duration_minutes, style, characters } = await req.json() as {
    title?: string
    genre?: string
    plot?: string
    duration_minutes?: number
    style?: string
    characters?: CharacterInput[]
  }

  if (!title?.trim() || !plot?.trim())
    return NextResponse.json({ error: 'title and plot required' }, { status: 400 })

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) return NextResponse.json({ error: 'Groq API key not configured' }, { status: 500 })

  const groq       = new Groq({ apiKey: groqApiKey })
  const durMins    = Number(duration_minutes) || 3
  const scenesCount = Math.max(5, Math.round(durMins * 4))
  const styleGuide  = GENRE_STYLES[genre ?? ''] ?? 'cinematic, professional'

  const characterContext = characters?.length
    ? `Characters: ${characters.map(c =>
        `${c.name} (${c.age ?? ''} ${c.gender ?? ''}) — ${c.appearance ?? ''} — personality: ${c.personality ?? ''}`
      ).join('; ')}`
    : ''

  const prompt = `You are a Hollywood screenplay writer and AI film director.

Title: "${title}"
Genre: ${genre ?? 'Drama'}
Style: ${style ?? 'Cinematic Realistic'}
Duration: ${durMins} minutes
${characterContext}
Plot: ${plot}

Write a complete cinematic screenplay with exactly ${scenesCount} scenes.

For each scene provide:
- scene_number (1 to ${scenesCount})
- title (short scene title)
- location (specific place, time of day)
- characters_present (array of character names in this scene)
- camera_angle (choose best from: ${CAMERA_ANGLES.join(', ')})
- voiceover (narration or dialogue spoken aloud, 2-4 sentences)
- visual_prompt (detailed AI video generation prompt describing exactly what appears on screen — include lighting, mood, colors, actions, ${styleGuide})
- duration_seconds (5 to 15)

Rules:
- visual_prompt must be detailed enough for an AI video model (50+ words)
- Maintain character appearance consistency across all scenes
- Build narrative arc: setup → conflict → climax → resolution
- Each scene must flow naturally into the next

Respond ONLY with valid JSON:
{
  "title": "movie title",
  "logline": "one sentence summary",
  "scenes": [
    {
      "scene_number": 1,
      "title": "scene title",
      "location": "Interior - Coffee Shop - Day",
      "characters_present": ["name1"],
      "camera_angle": "Medium Shot",
      "voiceover": "spoken words",
      "visual_prompt": "detailed visual description for AI video generation",
      "duration_seconds": 8
    }
  ]
}`

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a Hollywood screenplay writer. Always respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.8,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    })

    const raw        = completion.choices[0]?.message?.content ?? ''
    const screenplay = JSON.parse(raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')) as ScreenplayResult

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: movie, error } = await (supabase.from('movies') as any)
      .insert({ user_id: user.id, title, genre, style, duration_minutes: durMins, plot, screenplay, status: 'draft' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    if (screenplay.scenes?.length) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('movie_scenes') as any).insert(
        screenplay.scenes.map((s: SceneInput) => ({
          movie_id:         movie.id,
          user_id:          user.id,
          scene_number:     s.scene_number,
          title:            s.title,
          voiceover:        s.voiceover,
          visual_prompt:    s.visual_prompt,
          camera_angle:     s.camera_angle,
          characters:       s.characters_present,
          location:         s.location,
          duration_seconds: s.duration_seconds ?? 8,
        }))
      )
    }

    return NextResponse.json({ movie, screenplay })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Script generation failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
