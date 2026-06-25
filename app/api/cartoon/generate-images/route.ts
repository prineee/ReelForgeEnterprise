// FILE: app/api/cartoon/generate-images/route.ts
// Triggers worker to generate images for all scenes via SSE

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { story_id } = await request.json()
  if (!story_id) return NextResponse.json({ error: 'story_id required' }, { status: 400 })

  // Verify ownership
  const { data: story } = await (supabase.from('cartoon_stories') as any)
    .select('id, visual_style, status')
    .eq('id', story_id)
    .eq('user_id', user.id)
    .single()

  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 })

  // Get scenes
  const { data: scenes } = await (supabase.from('cartoon_scenes') as any)
    .select('*')
    .eq('story_id', story_id)
    .order('scene_number', { ascending: true })

  if (!scenes || scenes.length === 0) {
    return NextResponse.json({ error: 'No scenes found' }, { status: 404 })
  }

  // Get characters
  const { data: characters } = await (supabase.from('cartoon_characters') as any)
    .select('*')
    .eq('story_id', story_id)

  // Update story status
  await (supabase.from('cartoon_stories') as any)
    .update({ status: 'generating_images' })
    .eq('id', story_id)

  const workerUrl = (process.env.NEXT_PUBLIC_WORKER_URL || 'https://reel-forge-production.up.railway.app').replace(/\/$/, '')
  console.log('[cartoon/generate-images] workerUrl:', workerUrl)

  // Stream SSE from worker to client
  const encoder = new TextEncoder()
  const stream  = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      try {
        console.log('[cartoon/generate-images] fetch start →', `${workerUrl}/api/cartoon/generate-images`)
        const workerRes = await fetch(`${workerUrl}/api/cartoon/generate-images`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            story_id,
            scenes,
            characters: characters || [],
            visual_style: story.visual_style,
          }),
        })

        console.log('[cartoon/generate-images] worker responded:', workerRes.status, workerRes.headers.get('content-type'))
        if (!workerRes.ok || !workerRes.body) {
          send({ type: 'error', error: `Worker error: ${workerRes.status}` })
          controller.close()
          return
        }

        console.log('[cartoon/generate-images] streaming SSE from worker...')
        const reader = workerRes.body.getReader()
        const dec    = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = dec.decode(value)
          controller.enqueue(encoder.encode(chunk))
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error'
        console.error('[cartoon/generate-images] fetch/stream error:', msg)
        send({ type: 'error', error: msg })
      } finally {
        console.log('[cartoon/generate-images] stream closed')
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