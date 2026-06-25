// FILE: app/api/cartoon/write-dialogue/route.ts
// AI Dialogue Movie — Phase 1 write step (15 credits)
// Generates character dialogue for every scene using Groq, then persists it.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Groq from 'groq-sdk'

export const maxDuration = 60

const WRITE_DIALOGUE_COST = 15

// Lightweight voice casting matching worker/src/services/cartoon/voiceCasting.js
const FEMALE_VOICES = ['tara', 'leah', 'jess', 'mia']
const MALE_VOICES   = ['leo', 'dan']

function detectGender(name: string, description = '', personality = ''): 'female' | 'male' | null {
  const txt = `${name} ${description} ${personality}`.toLowerCase()
  if (/\b(she|her|hers|woman|girl|female|queen|princess|witch|lady|mother|sister|daughter|wife)\b/.test(txt))
    return 'female'
  if (/\b(he|him|his|man|boy|male|king|prince|wizard|lord|father|brother|son|husband)\b/.test(txt))
    return 'male'
  return null
}

function buildVoiceMap(characters: { name: string; role: string; description?: string; personality?: string }[]) {
  const map: Record<string, string> = { Narrator: 'dan' }
  let fi = 0, mi = 0, ai = 0

  for (const c of characters) {
    if (!c.name) continue
    if (c.role === 'narrator') { map[c.name] = 'dan'; continue }

    const gender = detectGender(c.name, c.description, c.personality)
    if (gender === 'female') {
      map[c.name] = FEMALE_VOICES[fi % FEMALE_VOICES.length]; fi++
    } else if (gender === 'male') {
      map[c.name] = MALE_VOICES[mi % MALE_VOICES.length]; mi++
    } else {
      if (ai % 2 === 0) { map[c.name] = FEMALE_VOICES[fi % FEMALE_VOICES.length]; fi++ }
      else               { map[c.name] = MALE_VOICES[mi % MALE_VOICES.length];    mi++ }
      ai++
    }
  }

  return map
}

export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { story_id } = await req.json().catch(() => ({}))
  if (!story_id) return NextResponse.json({ error: 'story_id required' }, { status: 400 })

  // Verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: story } = await (supabase.from('cartoon_stories') as any)
    .select('id, title, genre, status')
    .eq('id', story_id)
    .eq('user_id', user.id)
    .single()

  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })

  // Credit check (15 credits)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase.from('users') as any)
    .select('credits')
    .eq('id', user.id)
    .single() as { data: { credits: number } | null }

  const current = profile?.credits ?? 0
  if (current < WRITE_DIALOGUE_COST) {
    return NextResponse.json(
      { error: 'Insufficient credits', credits: current, required: WRITE_DIALOGUE_COST },
      { status: 402 }
    )
  }

  // Fetch characters + scenes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: characters } = await (supabase.from('cartoon_characters') as any)
    .select('id, name, role, description, personality')
    .eq('story_id', story_id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: scenes } = await (supabase.from('cartoon_scenes') as any)
    .select('id, scene_number, title, narration, characters_in_scene')
    .eq('story_id', story_id)
    .order('scene_number', { ascending: true })

  if (!scenes?.length) return NextResponse.json({ error: 'No scenes found' }, { status: 404 })

  const groqApiKey = process.env.GROQ_API_KEY
  if (!groqApiKey) return NextResponse.json({ error: 'Groq API key not configured' }, { status: 500 })

  const groq = new Groq({ apiKey: groqApiKey })

  const charList = (characters || [])
    .map((c: { name: string; role: string; personality?: string }) => `${c.name} (${c.role})${c.personality ? `: ${c.personality}` : ''}`)
    .join('\n')

  const sceneList = scenes
    .map((s: { scene_number: number; title?: string; narration: string; characters_in_scene?: string[] }) =>
      `Scene ${s.scene_number}${s.title ? ` "${s.title}"` : ''}: ${s.narration}${s.characters_in_scene?.length ? ` [Present: ${s.characters_in_scene.join(', ')}]` : ''}`
    )
    .join('\n')

  const systemPrompt = 'Animated cartoon dialogue writer. JSON only, no markdown, no explanation.'

  const userPrompt = `Write character dialogue for every scene of this cartoon.

Story: "${story.title}" (${story.genre})

Characters:
${charList}

Scenes:
${sceneList}

Return JSON:
{"scenes":[{"scene_number":1,"dialogue":[{"speaker":"ExactCharacterName","text":"Their line here."}]}]}

Rules:
- 2–5 dialogue lines per scene (short, punchy lines only)
- speaker must exactly match a character name listed above, or "Narrator"
- Lines must match the tone and action described in each scene narration
- Narrator lines are for scene-setting only when no characters are present`

  try {
    const completion = await groq.chat.completions.create({
      model:    'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt },
      ],
      temperature:     0.75,
      max_tokens:      4096,
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content ?? ''
    const generated = JSON.parse(
      raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '')
    ) as { scenes: { scene_number: number; dialogue: { speaker: string; text: string }[] }[] }

    if (!generated.scenes?.length) throw new Error('Groq returned no scenes')

    // Deduct credits
    const admin = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deductError } = await (admin.from('users') as any)
      .update({ credits: current - WRITE_DIALOGUE_COST })
      .eq('id', user.id)

    if (deductError) {
      console.error('[write-dialogue] Credit deduction failed:', deductError.message)
      return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 })
    }

    // Build voice map and persist
    const voiceMap = buildVoiceMap(characters || [])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('cartoon_stories') as any)
      .update({ voice_map: voiceMap, movie_mode: 'dialogue' })
      .eq('id', story_id)

    // Persist dialogue_json per scene
    const sceneMap = new Map(
      scenes.map((s: { id: string; scene_number: number }) => [s.scene_number, s.id])
    )

    for (const genScene of generated.scenes) {
      const sceneId = sceneMap.get(genScene.scene_number)
      if (!sceneId) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('cartoon_scenes') as any)
        .update({ dialogue_json: genScene.dialogue })
        .eq('id', sceneId)
    }

    console.log(`[write-dialogue] Story ${story_id} — ${generated.scenes.length} scenes — ${WRITE_DIALOGUE_COST} credits`)

    return NextResponse.json({
      success:   true,
      story_id,
      voice_map: voiceMap,
      scenes:    generated.scenes,
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Dialogue generation failed'
    console.error('[write-dialogue] Failed:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
