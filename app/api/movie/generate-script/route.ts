import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCredits } from '@/lib/credits'
import { MovieDirector } from "@/services/movie/director";
import { ScreenplayBuilder } from "@/services/movie/screenplayBuilder";

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
 const creditCheck = await requireCredits("movie_script");

if (creditCheck.ok === false) {
  return creditCheck.response;
}

  try {
    const supabase = await createClient()
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
    const durMins = Number(duration_minutes) || 3;

    if (!title?.trim() || !plot?.trim())
      return NextResponse.json({ error: 'title and plot required' }, { status: 400 })


    const result =
  await MovieDirector.generate({
    title,
    genre: genre ?? "Drama",
    plot,
    duration: durMins,
    style: style ?? "Cinematic Realistic",
    characters: characters ?? [],
  });

    if (!result.success) {
      return NextResponse.json(
        {
          error: result.error,
        },
        {
          status: 500,
        }
      );
    }

    const screenplay =
  ScreenplayBuilder.build(result.data);
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
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
