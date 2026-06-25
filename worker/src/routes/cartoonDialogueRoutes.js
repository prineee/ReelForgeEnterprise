// FILE: worker/src/routes/cartoonDialogueRoutes.js
// AI Dialogue Movie pipeline: dialogue audio → scene clips → FFmpeg → Cloudinary

'use strict'

const express        = require('express')
const router         = express.Router()
const path           = require('path')
const os             = require('os')
const fs             = require('fs-extra')
const fsSync         = require('fs')
const { v4: uuidv4 } = require('uuid')
const { createClient } = require('@supabase/supabase-js')
const WebSocket        = require('ws')

const { convertImageToVideoClip, generateColorClip } = require('../services/cartoon/motionEffect')
const { assignShot }         = require('../services/cartoon/cameraDirector')
const { castVoices }         = require('../services/cartoon/voiceCasting')
const { generateSceneAudio } = require('../services/cartoon/dialogueAudio')
const { probeClip }          = require('../services/ffmpegUtils')
const { resolveMusicTrack, buildMixFilter } = require('../services/cartoon/backgroundMusic')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    realtime: { transport: WebSocket },
    auth: { persistSession: false, autoRefreshToken: false },
  }
)

function resolveBin(envKey, systemPath, bareName) {
  if (process.env[envKey]) return process.env[envKey]
  if (fsSync.existsSync(systemPath)) return systemPath
  return bareName
}

const FFMPEG_BIN = resolveBin('FFMPEG_PATH', '/usr/bin/ffmpeg', 'ffmpeg')

// ── Mux one scene's audio into its own video clip ─────────────────────────────
// The motion video is copied (already encoded by motionEffect). When the scene
// has dialogue, the audio is optionally time-compressed (atempo, only used when
// the movie would otherwise overrun its target runtime), padded with silence
// (apad), and hard-cut to clipDur so the file is exactly clipDur long. When the
// scene has no dialogue, a silent stereo track is generated instead. Either way
// every scene file is self-contained — audio can never drift across scenes.
function muxSceneAudio(videoPath, audioPath, outPath, clipDur, speed = 1) {
  const { spawn } = require('child_process')
  // atempo preserves pitch; only applied when speed > 1 (overflow case).
  const audioFilter = speed > 1.001 ? `atempo=${speed.toFixed(4)},apad` : 'apad'
  const args = audioPath
    ? [
        '-y',
        '-i', videoPath,
        '-i', audioPath,
        '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'copy',
        '-af', audioFilter,
        '-t', clipDur.toFixed(4),
        '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
        '-movflags', '+faststart',
        outPath,
      ]
    : [
        '-y',
        '-i', videoPath,
        '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-map', '0:v:0', '-map', '1:a:0',
        '-c:v', 'copy',
        '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
        '-shortest',
        '-movflags', '+faststart',
        outPath,
      ]
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    proc.stderr.on('data', d => { stderr += d.toString() })
    proc.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`scene mux FFmpeg exit ${code}: ${stderr.slice(-300)}`))
    })
    proc.on('error', reject)
  })
}

// ── POST /api/cartoon/generate-dialogue-video (SSE) ──────────────────────────
router.post('/api/cartoon/generate-dialogue-video', async (req, res) => {
  const { story_id, scenes, voice_map, characters, genre } = req.body

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

  const jobId  = uuidv4().slice(0, 8)
  const jobDir = path.join(os.tmpdir(), `cartoon_dlg_${jobId}`)
  await fs.ensureDir(jobDir)

  send({ type: 'start', story_id, total_scenes: scenes.length })

  try {
    await supabase.from('cartoon_stories')
      .update({ status: 'generating_video' })
      .eq('id', story_id)

    // ── Step 1: Resolve voice map ──────────────────────────────────────────
    send({ type: 'progress', pct: 5, message: 'Preparing character voices...' })

    const finalVoiceMap = (voice_map && Object.keys(voice_map).length > 0)
      ? voice_map
      : castVoices(characters || [])

    // ── Step 2: Runtime-controlled, scene-synchronized assembly ────────────
    // Phase 2.7 builds on 2.6. Every scene still gets its OWN dialogue audio (so
    // audio can never drift across scenes), but the per-scene clip duration is no
    // longer "audio + 0.5s". Instead we measure ALL scene audios first, then
    // distribute the SELECTED tier runtime across scenes so the movie total lands
    // EXACTLY on the target (60 / 180 / 300 / 600s): shortfall becomes silent tail
    // padding; only genuine overflow is lightly time-compressed (atempo).
    send({ type: 'progress', pct: 10, message: `Building ${scenes.length} synchronized scenes...` })

    const audioDir = path.join(jobDir, 'audio')
    const clipDir  = path.join(jobDir, 'clips')
    const sceneDir = path.join(jobDir, 'scenes')
    await fs.ensureDir(audioDir)
    await fs.ensureDir(clipDir)
    await fs.ensureDir(sceneDir)

    const axios = require('axios')

    // Target runtime = sum of the per-scene durations assigned at story creation,
    // which generate-story guarantees sums exactly to durMins*60. Fallback to a
    // 6s/scene nominal if the field is ever missing.
    const targetTotal = scenes.reduce((s, sc) => s + (Number(sc.duration_seconds) || 0), 0)
                        || scenes.length * 6

    const MIN_SCENE = 2     // never show a scene for less than 2s
    const MAX_SPEED = 1.5   // cap dialogue time-compression (atempo upper bound)

    // ── Pass A: generate + measure each scene's dialogue audio ─────────────
    const measured = []     // { num, audioPath|null, audioDur }
    let   anyAudio = false

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]
      const num   = String(i + 1).padStart(3, '0')
      const pct   = 10 + Math.round((i / scenes.length) * 35)

      send({ type: 'progress', pct, message: `Scene ${i + 1}/${scenes.length}: recording dialogue...` })

      // Per-line TTS + concat logic unchanged (Phase 2.6 generateSceneAudio)
      const lines      = Array.isArray(scene.dialogue_json) ? scene.dialogue_json : []
      const sceneTmp   = path.join(audioDir, `scene_${num}`)
      await fs.ensureDir(sceneTmp)
      const sceneAudio = path.join(audioDir, `scene_${num}.mp3`)
      const audioMade  = await generateSceneAudio(lines, finalVoiceMap, sceneAudio, sceneTmp, `scene_${num}`)

      let audioDur = 0
      if (audioMade) {
        try {
          const info = await probeClip(sceneAudio)
          audioDur   = info.duration || 0
        } catch (err) {
          console.warn(`[dlg-video] scene_${num}: ffprobe failed (${err.message}) — treating as silent`)
        }
      }
      if (audioDur > 0) anyAudio = true
      measured.push({ num, audioPath: audioMade ? sceneAudio : null, audioDur })
    }

    if (!anyAudio) {
      throw new Error('No dialogue found. Run Write Dialogue before generating the dialogue movie.')
    }

    // ── Runtime budgeting: fit measured audio into the exact target total ──
    // base_i = the time scene i's audio must occupy (>= MIN_SCENE). If the audio
    // overflows the target, compress uniformly with atempo (capped at MAX_SPEED).
    // Remaining slack is shared out as silent padding so Σ clipDur == targetTotal.
    let speed     = 1
    let baseDur   = measured.map(m => Math.max(m.audioDur, MIN_SCENE))
    let baseTotal = baseDur.reduce((a, b) => a + b, 0)

    if (baseTotal > targetTotal) {
      speed     = Math.min(baseTotal / targetTotal, MAX_SPEED)
      baseDur   = measured.map(m => Math.max(m.audioDur / speed, MIN_SCENE))
      baseTotal = baseDur.reduce((a, b) => a + b, 0)
    }

    const fits     = baseTotal <= targetTotal
    const slack    = Math.max(targetTotal - baseTotal, 0)
    const padEach  = slack / measured.length
    const clipDurs = baseDur.map(b => b + padEach)

    if (fits) {
      // Absorb floating-point remainder into the last scene so the sum is exact.
      const sum = clipDurs.reduce((a, b) => a + b, 0)
      clipDurs[clipDurs.length - 1] += (targetTotal - sum)
    } else {
      // Audio still exceeds target even at MAX_SPEED — accept minor overflow
      // rather than cutting any dialogue.
      console.warn(`[dlg-video] audio ${baseTotal.toFixed(1)}s exceeds target ${targetTotal}s at ${speed.toFixed(2)}x — allowing overflow`)
    }

    console.log(`[dlg-video] target=${targetTotal}s | speed=${speed.toFixed(3)}x | planned=${clipDurs.reduce((a, b) => a + b, 0).toFixed(2)}s`)

    // ── Pass B: render each scene's clip + mux its (padded/sped) audio ─────
    const scenePaths = []

    for (let i = 0; i < scenes.length; i++) {
      const scene   = scenes[i]
      const num     = measured[i].num
      const clipDur = clipDurs[i]
      const pct     = 45 + Math.round((i / scenes.length) * 27)

      send({ type: 'progress', pct, message: `Scene ${i + 1}/${scenes.length}: rendering...` })
      console.log(`[dlg-video] scene_${num}: audio=${measured[i].audioDur.toFixed(2)}s → clip=${clipDur.toFixed(2)}s`)

      // Render the image clip — camera director + motion effects unchanged
      const videoOnly = path.join(clipDir, `clip_${num}.mp4`)
      try {
        if (scene.image_url) {
          const imgPath = path.join(jobDir, `img_${num}.jpg`)
          const imgRes  = await axios.get(scene.image_url, { responseType: 'arraybuffer', timeout: 30000 })
          fsSync.writeFileSync(imgPath, Buffer.from(imgRes.data))

          const shot = assignShot(i, scenes.length)
          console.log(`[dlg-video] scene_${num}: ${shot.label} → ${shot.motionEffect}`)
          await convertImageToVideoClip(imgPath, videoOnly, clipDur, shot.motionEffect)
        } else {
          await generateColorClip(videoOnly, clipDur, '#1a1a2e')
        }
      } catch (err) {
        console.error(`[dlg-video] scene_${num} clip failed: ${err.message} — using color`)
        await generateColorClip(videoOnly, clipDur)
      }

      // Mux THIS scene's audio into THIS scene's video → scene_NNN.mp4
      const scenePath = path.join(sceneDir, `scene_${num}.mp4`)
      try {
        await muxSceneAudio(videoOnly, measured[i].audioPath, scenePath, clipDur, speed)
        const size = fsSync.existsSync(scenePath) ? fsSync.statSync(scenePath).size : 0
        if (size > 0) scenePaths.push({ path: scenePath, duration: clipDur })
      } catch (err) {
        console.error(`[dlg-video] scene_${num} mux failed: ${err.message}`)
      }
    }

    if (scenePaths.length === 0) throw new Error('No scene videos generated')

    // ── Step 3: Concatenate the completed (audio-bearing) scene videos ─────
    // Each scene_NNN.mp4 already carries its own synced audio. The final -t clamp
    // is the planned grand total (== target when audio fits) to guard against
    // sub-second concat rounding — it never truncates dialogue.
    send({ type: 'progress', pct: 72, message: 'Stitching synchronized scenes...' })

    const concatPath  = path.join(jobDir, 'concat.txt')
    const concatLines = scenePaths.map(c => `file '${c.path}'`)
    fsSync.writeFileSync(concatPath, concatLines.join('\n') + '\n', 'utf8')

    const totalSecs = scenePaths.reduce((s, c) => s + c.duration, 0)

    // ── Step 4: Final encode — concat scene clips (each carries its own audio)
    send({ type: 'progress', pct: 75, message: 'Rendering movie with character dialogue...' })

    const outputPath = path.join(jobDir, 'cartoon_dialogue_final.mp4')
    const { spawn }  = require('child_process')

    // ── Background music (Phase 2.8) — optional, genre-selected, mixed under
    // the per-scene dialogue (input 0's audio) with 2s fades. Missing track →
    // render normally with no music.
    const music = resolveMusicTrack(genre)
    if (music) console.log(`[dlg-video] Background music: ${music.mood} (${path.basename(music.path)})`)

    await new Promise((resolve, reject) => {
      const args = music
        ? [
            '-y',
            '-f',       'concat', '-safe', '0', '-i', concatPath,
            '-stream_loop', '-1', '-i', music.path,
            '-filter_complex', buildMixFilter(1, '0:a', totalSecs),
            '-map',     '0:v:0', '-map', '[aout]',
            '-c:v',     'libx264', '-preset', 'veryfast', '-crf', '23',
            '-pix_fmt', 'yuv420p', '-r', '30', '-vsync', 'cfr',
            '-c:a',     'aac', '-b:a', '128k', '-ar', '44100',
            '-t',       totalSecs.toFixed(3),
            '-b:v',     '600k', '-maxrate', '900k', '-bufsize', '1800k',
            '-movflags', '+faststart',
            outputPath,
          ]
        : [
            '-y',
            '-f',       'concat', '-safe', '0', '-i', concatPath,
            '-c:v',     'libx264', '-preset', 'veryfast', '-crf', '23',
            '-pix_fmt', 'yuv420p', '-r', '30', '-vsync', 'cfr',
            '-c:a',     'aac', '-b:a', '128k', '-ar', '44100',
            '-t',       totalSecs.toFixed(3),
            '-b:v',     '600k', '-maxrate', '900k', '-bufsize', '1800k',
            '-movflags', '+faststart',
            outputPath,
          ]
      const proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] })
      let stderr   = ''
      proc.stderr.on('data', d => { stderr += d.toString() })
      proc.on('close', code => {
        if (code === 0) resolve()
        else reject(new Error(`FFmpeg exit ${code}: ${stderr.slice(-300)}`))
      })
      proc.on('error', reject)
    })

    const outSize = fsSync.existsSync(outputPath) ? fsSync.statSync(outputPath).size : 0
    if (outSize === 0) throw new Error('FFmpeg produced empty output')

    // ── Step 7: Upload to Cloudinary ───────────────────────────────────────
    send({ type: 'progress', pct: 88, message: 'Uploading movie...' })

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
          public_id:     `story_${story_id}_dialogue`,
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

    // ── Step 8: Update DB ──────────────────────────────────────────────────
    await supabase.from('cartoon_stories')
      .update({
        status:           'completed',
        video_url:        videoUrl,
        movie_mode:       'dialogue',
        duration_seconds: Math.ceil(totalSecs),
        thumbnail_url:    scenes[0]?.image_url || null,
      })
      .eq('id', story_id)

    send({ type: 'done', video_url: videoUrl, story_id, duration: Math.ceil(totalSecs) })
    console.log(`[dlg-video] Complete: ${videoUrl}`)

  } catch (err) {
    console.error(`[dlg-video] FAILED: ${err.message}`)
    await supabase.from('cartoon_stories').update({ status: 'failed' }).eq('id', story_id)
    send({ type: 'error', error: err.message })
  } finally {
    await fs.remove(jobDir).catch(() => {})
    res.end()
  }
})

module.exports = router
