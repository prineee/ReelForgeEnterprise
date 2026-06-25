import { NextResponse } from 'next/server'
import { requireCredits } from '@/lib/credits'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { env } from '@/lib/env'
import crypto from 'crypto'

export const maxDuration = 300  // 5 minutes — allows up to 10-min scripts

interface Scene {
  number: number
  title: string
  duration: string
  voiceover: string
  visualNote: string
  visualKeywords?: string[]
  narration?: string
}


export async function POST(request: Request) {
  console.log('[reel/generate] Request received')
  console.log('[reel/generate] GROQ_API_KEY present:', !!env.GROQ_API_KEY)
  console.log('[reel/generate] CLOUDINARY present:', !!env.CLOUDINARY_CLOUD_NAME)
  console.log('[reel/generate] PIPER_TTS_URL:', process.env.PIPER_TTS_URL ?? 'NOT SET')

  const check = await requireCredits('reel')
  if (!check.ok) {
    console.log('[reel/generate] Credit check failed')
    return check.response
  }

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    console.log('[reel/generate] Unauthorized')
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { scenes?: Scene[]; voice?: string; title?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { scenes, voice = 'tara', title } = body
  console.log('[reel/generate] voice selected:', voice)

  if (!scenes?.length) {
    return NextResponse.json({ error: 'scenes are required' }, { status: 400 })
  }

  const fullVoiceover = scenes
    .map((s) => s.voiceover.trim())
    .filter(Boolean)
    .join(' ... ')

  console.log('[tts] Text length:', fullVoiceover.length, 'chars')

  // ── TTS: route through Railway worker (Vercel IPs are blocked by Google TTS) ─
  const workerBase = (env.NEXT_PUBLIC_WORKER_URL || '').replace(/\/$/, '')

  if (!workerBase) {
    console.error('[tts] NEXT_PUBLIC_WORKER_URL is not set')
    return NextResponse.json(
      { error: 'Worker URL not configured', browserTTS: true, voiceover: fullVoiceover },
      { status: 202 }
    )
  }

  console.log('[tts] Sending to worker TTS:', workerBase + '/api/tts/synthesize')

  let audioBuffer: Buffer | null = null
  const globalMime = 'audio/mpeg'

  try {
    const ttsRes = await fetch(`${workerBase}/api/tts/synthesize`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text: fullVoiceover, voice }),
      signal:  AbortSignal.timeout(120_000),
    })

    if (ttsRes.ok) {
      const arrayBuf = await ttsRes.arrayBuffer()
      audioBuffer    = Buffer.from(arrayBuf)
      console.log('[tts] Worker TTS success, bytes:', audioBuffer.length)
    } else {
      const errText = await ttsRes.text().catch(() => '')
      console.error('[tts] Worker TTS failed:', ttsRes.status, errText.slice(0, 200))
    }
  } catch (err) {
    console.error('[tts] Worker TTS threw:', err instanceof Error ? err.message : err)
  }

  if (!audioBuffer || audioBuffer.length < 100) {
    console.error('[tts] No audio generated — returning browserTTS fallback')
    return NextResponse.json(
      { error: 'Server TTS unavailable', browserTTS: true, voiceover: fullVoiceover },
      { status: 202 }
    )
  }

  const base64  = audioBuffer.toString('base64')
  const dataUrl = `data:${globalMime};base64,${base64}`
  let voiceUrl  = dataUrl

  console.log('[tts] Total audio bytes:', audioBuffer.length)

  // ── Upload to Cloudinary ──────────────────────────────────────────────────
  const cloudName = env.CLOUDINARY_CLOUD_NAME
  const apiKey    = env.CLOUDINARY_API_KEY
  const apiSecret = env.CLOUDINARY_API_SECRET

  if (cloudName && apiKey && apiSecret) {
    console.log('[reel/generate] Uploading audio to Cloudinary...')
    try {
      const timestamp = Math.floor(Date.now() / 1000).toString()
      const folder    = 'reelforge/audio'
      const signature = crypto
        .createHash('sha1')
        .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
        .digest('hex')

      const form = new FormData()
      form.append('file',      dataUrl)
      form.append('api_key',   apiKey)
      form.append('timestamp', timestamp)
      form.append('signature', signature)
      form.append('folder',    folder)

      const uploadRes = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`,
        { method: 'POST', body: form }
      )

      if (uploadRes.ok) {
        const uploadData = await uploadRes.json() as { secure_url?: string }
        voiceUrl = uploadData.secure_url ?? voiceUrl
        console.log('[reel/generate] Cloudinary upload success:', voiceUrl.slice(0, 80))
      } else {
        console.warn('[reel/generate] Cloudinary upload failed:', uploadRes.status, '— using data URL')
      }
    } catch (err) {
      console.warn('[reel/generate] Cloudinary upload threw:', err instanceof Error ? err.message : err)
    }
  }

  // ── Persist to Supabase ───────────────────────────────────────────────────
  console.log('[reel/generate] Saving project to database...')

  const admin     = createAdminClient()
  const reelTitle = (title?.trim() || 'Untitled Reel').slice(0, 255)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: project, error: projectErr } = await (admin.from('projects') as any)
    .insert({ user_id: user.id, title: reelTitle, type: 'reel', status: 'completed' })
    .select('id')
    .single() as { data: { id: string } | null; error: { message: string } | null }

  if (projectErr || !project) {
    console.error('[reel/generate] project insert failed:', projectErr?.message)
    return NextResponse.json({ error: 'Failed to save project to database' }, { status: 500 })
  }

  const dbVoiceUrl = voiceUrl.startsWith('data:') ? null : voiceUrl

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: video, error: videoErr } = await (admin.from('videos') as any)
    .insert({ project_id: project.id, script: JSON.stringify(scenes), voice_url: dbVoiceUrl })
    .select('id')
    .single() as { data: { id: string } | null; error: { message: string } | null }

  if (videoErr || !video) {
    console.error('[reel/generate] video insert failed:', videoErr?.message)
    return NextResponse.json({ error: 'Failed to save video to database' }, { status: 500 })
  }

  console.log('[reel/generate] Done — projectId:', project.id)

  return NextResponse.json({
    voiceUrl:  voiceUrl  ?? null,
    dataUrl:   dataUrl   ?? null,
    projectId: project.id,
    videoId:   video.id,
  })
}
