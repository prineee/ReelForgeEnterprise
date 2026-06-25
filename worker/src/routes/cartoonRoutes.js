// FILE: worker/src/routes/cartoonRoutes.js
// Phase 2 — Worker routes for cartoon image generation and video assembly

'use strict'

const express        = require('express')
const router         = express.Router()
const path           = require('path')
const os             = require('os')
const fs             = require('fs-extra')
const fsSync         = require('fs')
const { v4: uuidv4 } = require('uuid')
const { createClient } = require('@supabase/supabase-js')

const { generateSceneImage }      = require('../services/cartoon/imageGenerator')
const { convertImageToVideoClip, generateColorClip } = require('../services/cartoon/motionEffect')
const { assignShot }              = require('../services/cartoon/cameraDirector')
const { resolveMusicTrack, buildMixFilter } = require('../services/cartoon/backgroundMusic')

const WebSocket = require('ws')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    realtime: { transport: WebSocket },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
)

function getSupabase() {
  return supabase
}

function resolveBin(envKey, systemPath, bareName) {
  if (process.env[envKey]) return process.env[envKey]
  if (fsSync.existsSync(systemPath)) return systemPath
  return bareName
}

const FFMPEG_BIN = resolveBin('FFMPEG_PATH', '/usr/bin/ffmpeg', 'ffmpeg')

// ── POST /api/cartoon/generate-images (SSE) ───────────────────────────────────
router.post('/api/cartoon/generate-images', async (req, res) => {
  const { story_id, scenes, characters, visual_style } = req.body

  if (!story_id || !scenes || !scenes.length) {
    return res.status(400).json({ error: 'story_id and scenes are required' })
  }

  // Set up SSE
  res.setHeader('Content-Type',      'text/event-stream')
  res.setHeader('Cache-Control',     'no-cache')
  res.setHeader('Connection',        'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  function send(data) {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`) } catch {}
  }

  const supabase = getSupabase()

  send({ type: 'start', total: scenes.length, story_id })

  let completed = 0
  let failed    = 0

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    const pct   = Math.round(((i) / scenes.length) * 100)

    send({
      type:         'progress',
      scene_number: scene.scene_number,
      pct,
      message:      `Generating image for scene ${i + 1}/${scenes.length}...`,
    })

    // Update DB: scene is generating
    await supabase
      .from('cartoon_scenes')
      .update({ image_status: 'generating', generation_attempts: (scene.generation_attempts || 0) + 1 })
      .eq('id', scene.id)

    try {
      const imageUrl = await generateSceneImage(scene, characters, visual_style || 'anime', i, scenes.length)

      // Update DB: scene completed
      await supabase
        .from('cartoon_scenes')
        .update({ image_url: imageUrl, image_status: 'completed' })
        .eq('id', scene.id)

      completed++
      send({
        type:         'scene_done',
        scene_number: scene.scene_number,
        scene_id:     scene.id,
        image_url:    imageUrl,
        pct:          Math.round(((i + 1) / scenes.length) * 100),
      })

      console.log(`[cartoon] Scene ${scene.scene_number}/${scenes.length} done: ${imageUrl.slice(0, 60)}`)
    } catch (err) {
      console.error(`[cartoon] Scene ${scene.scene_number} failed: ${err.message}`)
      failed++

      await supabase
        .from('cartoon_scenes')
        .update({ image_status: 'failed' })
        .eq('id', scene.id)

      send({
        type:         'scene_failed',
        scene_number: scene.scene_number,
        error:        err.message,
      })
    }

    // Delay between scenes to respect rate limits
    if (i < scenes.length - 1) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  // Update story status
  await supabase
    .from('cartoon_stories')
    .update({ status: failed === scenes.length ? 'failed' : 'images_ready' })
    .eq('id', story_id)

  send({
    type:      'done',
    completed,
    failed,
    total:     scenes.length,
    story_id,
  })

  res.end()
})

// ── POST /api/cartoon/regenerate-scene ───────────────────────────────────────
router.post('/api/cartoon/regenerate-scene', async (req, res) => {
  const { scene_id, story_id, image_prompt, visual_description, visual_style, characters } = req.body

  if (!scene_id) return res.status(400).json({ error: 'scene_id is required' })

  const supabase = getSupabase()

  try {
    // Build a minimal scene object
    const scene = {
      id:                scene_id,
      story_id,
      scene_number:      1,
      image_prompt:      image_prompt || '',
      visual_description: visual_description || image_prompt || '',
      characters_in_scene: [],
      generation_attempts: 1,
    }

    await supabase
      .from('cartoon_scenes')
      .update({ image_status: 'generating' })
      .eq('id', scene_id)

    const imageUrl = await generateSceneImage(scene, characters || [], visual_style || 'anime')

    await supabase
      .from('cartoon_scenes')
      .update({ image_url: imageUrl, image_status: 'completed' })
      .eq('id', scene_id)

    return res.json({ image_url: imageUrl, scene_id })
  } catch (err) {
    console.error('[cartoon/regenerate]', err.message)
    await supabase
      .from('cartoon_scenes')
      .update({ image_status: 'failed' })
      .eq('id', scene_id)
    return res.status(502).json({ error: err.message })
  }
})

// ── POST /api/cartoon/generate-video (SSE) ────────────────────────────────────
router.post('/api/cartoon/generate-video', async (req, res) => {
  const { story_id, scenes, voice_id, caption_style, genre } = req.body

  if (!story_id || !scenes || !scenes.length) {
    return res.status(400).json({ error: 'story_id and scenes are required' })
  }

  res.setHeader('Content-Type',      'text/event-stream')
  res.setHeader('Cache-Control',     'no-cache')
  res.setHeader('Connection',        'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  function send(data) {
    try { res.write(`data: ${JSON.stringify(data)}\n\n`) } catch {}
  }

  const supabase  = getSupabase()
  const jobId     = uuidv4().slice(0, 8)
  const jobDir    = path.join(os.tmpdir(), `cartoon_${jobId}`)
  await fs.ensureDir(jobDir)

  send({ type: 'start', story_id, total_scenes: scenes.length })

  try {
    // Update story status
    await supabase
      .from('cartoon_stories')
      .update({ status: 'generating_video' })
      .eq('id', story_id)

    // ── Step 1: Generate voiceover ──────────────────────────────────────────
    send({ type: 'progress', pct: 5, message: 'Generating voiceover...' })

    const fullNarration = scenes.map(s => s.narration || '').filter(Boolean).join(' ... ')
    const voicePath     = path.join(jobDir, 'voice.wav')

    const { generateVoiceover } = require('../services/tts')
    await generateVoiceover(fullNarration, voice_id || 'tara', voicePath)

    send({ type: 'progress', pct: 15, message: 'Voiceover ready' })

    // ── Step 2: Convert each scene image to video clip ──────────────────────
    send({ type: 'progress', pct: 20, message: `Processing ${scenes.length} scene clips...` })

    const clipDir   = path.join(jobDir, 'clips')
    await fs.ensureDir(clipDir)
    const clipPaths = []

    for (let i = 0; i < scenes.length; i++) {
      const scene      = scenes[i]
      const clipPath   = path.join(clipDir, `clip_${String(i).padStart(3, '0')}.mp4`)
      const pct        = 20 + Math.round((i / scenes.length) * 50)

      // Single validated duration, used consistently for rendering, concat.txt,
      // totalSecs, and the persisted DB duration — prevents the render clamp
      // (motionEffect.js floors at 2s) from drifting out of sync with a raw
      // scene.duration_seconds value that concat.txt would otherwise declare.
      const rawDuration       = Number(scene.duration_seconds)
      const validatedDuration = Math.max(rawDuration || 5, 2)

      if (!rawDuration || rawDuration < 2) {
        console.warn(
          `[video] Scene ${scene.scene_number}: invalid duration_seconds=${scene.duration_seconds} — auto-corrected to ${validatedDuration}s`
        )
      }
      console.log(`[video] Scene ${scene.scene_number}: duration=${validatedDuration}s`)

      send({
        type:    'progress',
        pct,
        message: `Processing scene ${i + 1}/${scenes.length}...`,
      })

      try {
        if (scene.image_url) {
          // Download scene image
          const axios   = require('axios')
          const imgPath = path.join(jobDir, `img_${i}.jpg`)
          const imgRes  = await axios.get(scene.image_url, {
            responseType: 'arraybuffer', timeout: 30000,
          })
          fsSync.writeFileSync(imgPath, Buffer.from(imgRes.data))

          // Apply cinematic motion effect from camera director
          const shot = assignShot(i, scenes.length)
          console.log(`[cartoon/video] Scene ${i + 1}: ${shot.label} → ${shot.motionEffect}`)
          await convertImageToVideoClip(
            imgPath,
            clipPath,
            validatedDuration,
            shot.motionEffect
          )
        } else {
          // No image — generate color placeholder
          await generateColorClip(clipPath, validatedDuration, '#1a1a2e')
        }

        const size = fsSync.existsSync(clipPath) ? fsSync.statSync(clipPath).size : 0
        if (size > 0) {
          clipPaths.push({ path: clipPath, duration: validatedDuration })
          console.log(`[cartoon/video] Clip ${i + 1}: ${size} bytes`)
        }
      } catch (err) {
        console.error(`[cartoon/video] Clip ${i + 1} failed: ${err.message} — using color`)
        await generateColorClip(clipPath, validatedDuration)
        clipPaths.push({ path: clipPath, duration: validatedDuration })
      }
    }

    if (clipPaths.length === 0) throw new Error('No clips generated')

    // ── Step 3: Build concat.txt ────────────────────────────────────────────
    send({ type: 'progress', pct: 72, message: 'Building timeline...' })

    const concatPath = path.join(jobDir, 'concat.txt')
    const lines      = []

    for (const clip of clipPaths) {
      lines.push(`file '${clip.path}'`)
      lines.push(`duration ${clip.duration.toFixed(4)}`)
    }
    lines.push(`file '${clipPaths[clipPaths.length - 1].path}'`)
    fsSync.writeFileSync(concatPath, lines.join('\n') + '\n', 'utf8')

    const totalSecs = clipPaths.reduce((s, c) => s + c.duration, 0)

    // ── Step 4: FFmpeg render ───────────────────────────────────────────────
    send({ type: 'progress', pct: 75, message: 'Rendering final video...' })

    const outputPath = path.join(jobDir, 'cartoon_final.mp4')
    const { spawn }  = require('child_process')

    // ── Background music (Phase 2.8) — optional, genre-selected, mixed under
    // narration with 2s fades. Missing track → render normally with no music.
    const renderSecs = Math.ceil(totalSecs)
    const music      = resolveMusicTrack(genre)
    if (music) console.log(`[cartoon/video] Background music: ${music.mood} (${path.basename(music.path)})`)

    await new Promise((resolve, reject) => {
      const args = music
        ? [
            '-y',
            '-f',       'concat', '-safe', '0', '-i', concatPath,
            '-i',       voicePath,
            '-stream_loop', '-1', '-i', music.path,
            '-filter_complex', buildMixFilter(2, '1:a', renderSecs),
            '-map',     '0:v:0', '-map', '[aout]',
            '-c:v',     'libx264', '-preset', 'veryfast', '-crf', '23',
            '-pix_fmt', 'yuv420p', '-r', '30', '-vsync', 'cfr',
            '-c:a',     'aac', '-b:a', '128k', '-ar', '44100',
            '-t',       String(renderSecs),
            '-b:v',     '600k', '-maxrate', '900k', '-bufsize', '1800k',
            '-movflags', '+faststart',
            outputPath,
          ]
        : [
            '-y',
            '-f',       'concat', '-safe', '0', '-i', concatPath,
            '-i',       voicePath,
            '-map',     '0:v:0', '-map', '1:a:0',
            '-c:v',     'libx264', '-preset', 'veryfast', '-crf', '23',
            '-pix_fmt', 'yuv420p', '-r', '30', '-vsync', 'cfr',
            '-c:a',     'aac', '-b:a', '128k', '-ar', '44100',
            '-t',       String(renderSecs),
            '-b:v',     '600k', '-maxrate', '900k', '-bufsize', '1800k',
            '-movflags', '+faststart',
            outputPath,
          ]
      const proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] })
      let stderr = ''
      proc.stderr.on('data', d => { stderr += d.toString() })
      proc.on('close', code => {
        if (code === 0) resolve()
        else reject(new Error(`FFmpeg exit ${code}: ${stderr.slice(-300)}`))
      })
      proc.on('error', reject)
    })

    const outSize = fsSync.existsSync(outputPath) ? fsSync.statSync(outputPath).size : 0
    if (outSize === 0) throw new Error('FFmpeg produced empty output')

    // ── Step 5: Upload to Cloudinary ────────────────────────────────────────
    send({ type: 'progress', pct: 88, message: 'Uploading video...' })

    const cloudinary = require('cloudinary').v2
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    })

    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_large(
        outputPath,
        {
          resource_type: 'video',
          folder:        'reelforge/cartoon/videos',
          public_id:     `story_${story_id}`,
          overwrite:     true,
          chunk_size:    6 * 1024 * 1024,
          timeout:       300000,
        },
        (err, result) => {
          if (err) reject(new Error(`Cloudinary: ${err.message}`))
          else     resolve(result)
        }
      )
    })

    const videoUrl = uploadResult.secure_url

    // ── Step 6: Update DB ───────────────────────────────────────────────────
    await supabase
      .from('cartoon_stories')
      .update({
        status:           'completed',
        video_url:        videoUrl,
        duration_seconds: Math.ceil(totalSecs),
        thumbnail_url:    scenes[0]?.image_url || null,
      })
      .eq('id', story_id)

    send({ type: 'done', video_url: videoUrl, story_id, duration: Math.ceil(totalSecs) })
    console.log(`[cartoon/video] Complete: ${videoUrl}`)

  } catch (err) {
    console.error(`[cartoon/video] FAILED: ${err.message}`)
    await supabase.from('cartoon_stories').update({ status: 'failed' }).eq('id', story_id)
    send({ type: 'error', error: err.message })
  } finally {
    await fs.remove(jobDir).catch(() => {})
    res.end()
  }
})

module.exports = router