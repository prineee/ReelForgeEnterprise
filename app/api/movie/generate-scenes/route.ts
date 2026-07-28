import { MovieRenderPipeline } from "@/services/movie/MovieRenderPipeline";
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireCredits } from '@/lib/credits'

export async function POST(req: Request) {
  const creditCheck = await requireCredits("movie_scenes");

if (creditCheck.ok === false) {
  return creditCheck.response;
}
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Check user plan
    const { data: profile } = await supabase
      .from('users')
      .select('plan, credits')
      .eq('id', user.id)
      .single()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const userPlan = (profile as any)?.plan ?? 'free'
    const isAgency = userPlan === 'agency'

    const body = await req.json()
    const { movie_id, scenes: inlineScenes, model = 'minimax', voice_url, voice_data } = body

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let scenes: any[] = inlineScenes ?? []
    if (movie_id && !inlineScenes?.length) {
      const { data: movieData } = await supabase
        .from('movies')
        .select('*, movie_scenes(*)')
        .eq('id', movie_id)
        .eq('user_id', user.id)
        .single()

      if (!movieData) return NextResponse.json({ error: 'Movie not found' }, { status: 404 })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const movieAny = movieData as any
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      scenes = (movieAny.movie_scenes as any[] ?? [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .sort((a: any, b: any) => a.scene_number - b.scene_number)
    }

    if (!scenes.length) return NextResponse.json({ error: 'No scenes found' }, { status: 400 })

    if (movie_id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from('movies') as any).update({ status: 'generating' }).eq('id', movie_id).eq('user_id', user.id)
    }
    const renderResult =
      await MovieRenderPipeline.render({
        title: movie_id ?? "Movie",
        scenes,
        characters:
          body.characters ?? [],
      });

    if (!renderResult.success) {
      return NextResponse.json(
        {
          error:
            renderResult.error,
        },
        {
          status: 500,
        }
      );
    }

    console.log(
      "Gemini Pipeline Ready:",
      renderResult
    );
    const workerUrl = (
      process.env.NEXT_PUBLIC_WORKER_URL ||
      'https://reel-forge-production.up.railway.app'
    ).replace(/\/$/, '')

    // Agency → AI video pipeline, everyone else → Pexels stock clips
    const endpoint = isAgency
      ? `${workerUrl}/api/generate-movie-scenes`
      : `${workerUrl}/api/generate-pexels-scenes`

    console.log(`[movie-scenes] Plan: ${userPlan} → endpoint: ${endpoint} scenes: ${scenes.length}`)

    return NextResponse.json({
      worker_url: endpoint,
      scenes,
      movie_id,
      model,
      pipeline: isAgency ? 'ai' : 'pexels',
      plan: userPlan,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      duration_minutes: (body as any).duration_minutes ?? 3,
      voice_url: voice_url ?? null,
      voice_data: voice_data ?? null,
    })
  } catch (error) {
    console.error('[movie/generate-scenes] POST failed', error)
    return NextResponse.json({ error: 'Failed to generate movie scenes.' }, { status: 500 })
  }
}
