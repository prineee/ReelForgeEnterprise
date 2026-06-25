// FILE: app/api/cartoon/generate-dialogue-video/route.ts
// AI Dialogue Movie — Phase 1 render step (10 credits)
// Proxies SSE from Railway worker to the browser for dialogue video assembly.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const maxDuration = 300

const RENDER_COST = 10

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { story_id } = await request.json().catch(() => ({}))
  if (!story_id) return NextResponse.json({ error: 'story_id required' }, { status: 400 })

  // Verify ownership
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: story } = await (supabase.from('cartoon_stories') as any)
    .select('id, status, voice_map, genre')
    .eq('id', story_id)
    .eq('user_id', user.id)
    .single()

  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })

  // Credit check (10 credits)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: profile } = await (supabase.from('users') as any)
    .select('credits')
    .eq('id', user.id)
    .single() as { data: { credits: number } | null }

  const current = profile?.credits ?? 0
  if (current < RENDER_COST) {
    return NextResponse.json(
      { error: 'Insufficient credits', credits: current, required: RENDER_COST },
      { status: 402 }
    )
  }

  // Deduct credits upfront (render is expensive)
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: deductError } = await (admin.from('users') as any)
    .update({ credits: current - RENDER_COST })
    .eq('id', user.id)

  if (deductError) {
    return NextResponse.json({ error: 'Failed to deduct credits' }, { status: 500 })
  }

  // Fetch scenes (with dialogue_json) + characters
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: scenes } = await (supabase.from('cartoon_scenes') as any)
    .select('*')
    .eq('story_id', story_id)
    .order('scene_number', { ascending: true })

  if (!scenes?.length) {
    return NextResponse.json({ error: 'No scenes found' }, { status: 404 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: characters } = await (supabase.from('cartoon_characters') as any)
    .select('name, role, description, personality')
    .eq('story_id', story_id)

  const workerUrl = (
    process.env.NEXT_PUBLIC_WORKER_URL || 'https://reel-forge-production.up.railway.app'
  ).replace(/\/$/, '')

  const encoder = new TextEncoder()
  const stream  = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      try {
        const workerRes = await fetch(`${workerUrl}/api/cartoon/generate-dialogue-video`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            story_id,
            scenes,
            voice_map:  story.voice_map || {},
            characters: characters || [],
            genre:      story.genre    || null,
          }),
        })

        if (!workerRes.ok || !workerRes.body) {
          send({ type: 'error', error: `Worker error: ${workerRes.status}` })
          controller.close()
          return
        }

        const reader = workerRes.body.getReader()
        const dec    = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          controller.enqueue(encoder.encode(dec.decode(value)))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        send({ type: 'error', error: msg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
