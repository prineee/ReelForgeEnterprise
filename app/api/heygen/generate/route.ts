import { createClient } from '@/lib/supabase/server'

interface GenerateBody {
  avatar_id: string
  avatar_type?: 'builtin' | 'talking_photo'
  voice_url: string
  title?: string
  background_url?: string
  background_type?: 'video' | 'image' | 'color'
  background_color?: string
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const encoder = new TextEncoder()
  const stream  = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        try { controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`)) } catch { /* closed */ }
      }

      if (!user) { send({ type: 'error', error: 'Unauthorized' }); controller.close(); return }

      let body: GenerateBody
      try { body = await request.json() } catch { send({ type: 'error', error: 'Invalid request body' }); controller.close(); return }

      const {
        avatar_id, avatar_type,
        voice_url, title = 'ReelForge Video',
        background_url, background_type = 'color', background_color = '#000000',
      } = body

      if (!avatar_id) { send({ type: 'error', error: 'avatar_id is required' }); controller.close(); return }
      if (!voice_url) { send({ type: 'error', error: 'voice_url is required' }); controller.close(); return }
      if (voice_url.startsWith('data:')) {
        send({ type: 'error', error: 'voice_url must be a public HTTPS URL, not a data URL.' })
        controller.close(); return
      }

      const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL
      if (!workerUrl) { send({ type: 'error', error: 'NEXT_PUBLIC_WORKER_URL not configured' }); controller.close(); return }

      try {
        send({ type: 'progress', status: 'submitting', pct: 2, message: 'Submitting to lipsync engine…' })

        // Resolve avatar image URL for custom (talking_photo) avatars
        let avatar_image_url: string = avatar_id

        if (avatar_type === 'talking_photo') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data } = await (supabase.from('custom_avatars') as any)
            .select('preview_url')
            .eq('id', avatar_id)
            .eq('user_id', user.id)
            .single() as { data: { preview_url: string } | null }
          if (data?.preview_url) avatar_image_url = data.preview_url
        }

        const submitRes = await fetch(`${workerUrl}/api/lipsync/generate`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            avatar_image_url,
            voice_url,
            title,
            background_url,
            background_type,
            background_color,
            user_id: user.id,
          }),
        })

        if (!submitRes.ok) {
          const text = await submitRes.text().catch(() => '')
          throw new Error(`Lipsync submit failed: ${submitRes.status} — ${text.slice(0, 200)}`)
        }

        const { job_id: jobId } = await submitRes.json() as { job_id: string }
        if (!jobId) throw new Error('Worker returned no job_id')

        console.log('[heygen/generate] lipsync job submitted:', jobId)
        send({ type: 'submitted', video_id: jobId, pct: 5, message: 'Video submitted — polling from client…' })
      } catch (err) {
        console.error('[heygen/generate] threw:', err)
        send({ type: 'error', error: err instanceof Error ? err.message : 'Lipsync generation failed' })
      } finally {
        controller.close()
      }
    }
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
