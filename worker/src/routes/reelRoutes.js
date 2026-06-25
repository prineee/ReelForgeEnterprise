'use strict'

const express = require('express')
const router  = express.Router()

const { processVideo, processReel }              = require('../services/videoProcessor')
const { updateVideoRecord, updateProjectStatus } = require('../services/supabase')

// In-memory job store â€” survives the request lifecycle for status polling.
const jobs = new Map()

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isUUID(id) {
  return UUID_RE.test(String(id ?? ''))
}

async function safeUpdateStatus(projectId, status) {
  if (!isUUID(projectId)) return
  try {
    await updateProjectStatus(projectId, status)
  } catch (err) {
    console.warn(`[supabase] updateProjectStatus(${projectId}, ${status}) failed (non-fatal):`, err.message)
  }
}

// â”€â”€ POST /api/generate-video â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/api/generate-video', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (res.flushHeaders) res.flushHeaders()

  function send(data) {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
      if (typeof res.flush === 'function') res.flush()
    } catch { /* connection already closed */ }
  }

  const {
    script, topic, duration, voiceover_url,
    scenes, voice_url, voice_data, project_id, duration_minutes,
  } = req.body

  const audioSource  = voiceover_url || voice_url || voice_data
  const durationMins = Number(duration_minutes || duration || 1)
  const projectId    = isUUID(project_id) ? project_id : `job_${Date.now()}`

  if (!audioSource) {
    send({ type: 'error', error: 'voiceover_url (or voice_url / voice_data) is required' })
    return res.end()
  }

  const scenesArray = scenes?.length ? scenes : buildScenesFromScript(script, topic)

  if (!scenesArray.length) {
    send({ type: 'error', error: 'scenes[] or script+topic is required' })
    return res.end()
  }

  jobs.set(projectId, { status: 'processing', pct: 0, startedAt: new Date().toISOString() })

  try {
    const result = await processVideo({
      scenes:           scenesArray,
      voice_url:        audioSource.startsWith('http') ? audioSource : undefined,
      voice_data:       audioSource.startsWith('data:') ? audioSource : undefined,
      project_id:       projectId,
      duration_minutes: durationMins,
      onProgress: (data) => {
        send(data)
        jobs.set(projectId, { status: 'processing', startedAt: jobs.get(projectId)?.startedAt, ...data })
      },
    })

    // DB save â€” only when a real UUID project_id was provided, always non-fatal
    if (isUUID(projectId)) {
      try {
        await updateVideoRecord(projectId, { video_url: result.videoUrl, status: 'completed' })
      } catch (dbErr) {
        console.warn('[supabase] updateVideoRecord failed (non-fatal):', dbErr.message)
      }
      await safeUpdateStatus(projectId, 'completed')
    } else {
      console.log('[supabase] No valid UUID project_id â€” skipping DB save')
    }

    // Always send done event â€” video_url is returned regardless of DB outcome
    send({ type: 'done', video_url: result.videoUrl, duration: result.duration, status: 'complete' })
    jobs.set(projectId, { status: 'completed', video_url: result.videoUrl, duration: result.duration })
  } catch (err) {
    console.error('[route /api/generate-video]', err.message)
    try { await safeUpdateStatus(projectId, 'failed') } catch(_){}
    jobs.set(projectId, { status: 'failed', error: err.message })
    send({ type: 'error', error: err.message || 'Video generation failed' })
  } finally {
    res.end()
  }
})

// â”€â”€ POST /generate-reel (legacy) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.post('/generate-reel', async (req, res) => {
  const { script, voice_id, project_id } = req.body

  if (!script?.trim())     return res.status(400).json({ error: 'script is required' })
  if (!voice_id?.trim())   return res.status(400).json({ error: 'voice_id is required' })
  if (!project_id?.trim()) return res.status(400).json({ error: 'project_id is required' })

  res.status(202).json({ status: 'processing', project_id, message: 'Reel generation started.' })

  jobs.set(project_id, { status: 'processing', startedAt: new Date().toISOString() })
  await safeUpdateStatus(project_id, 'processing')

  processReel({ script, voice_id, project_id })
    .then(result => {
      jobs.set(project_id, { status: 'completed', video_url: result.videoUrl })
    })
    .catch(async err => {
      console.error(`[route /generate-reel] ${project_id}:`, err.message)
      jobs.set(project_id, { status: 'failed', error: err.message })
      await safeUpdateStatus(project_id, 'failed')
    })
})

// â”€â”€ GET /api/status/:jobId â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
router.get('/api/status/:jobId', (req, res) => {
  const { jobId } = req.params
  const job = jobs.get(jobId)
  if (!job) return res.status(404).json({ error: 'Job not found', jobId })
  res.json(job)
})

// â”€â”€ Helper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildScenesFromScript(script, topic) {
  if (!script?.trim()) return []
  const chunks = script.split(/\n\n+/).map(s => s.trim()).filter(Boolean)
  if (!chunks.length) return []
  return chunks.map((chunk, i) => ({
    number:     i + 1,
    title:      topic ? `${topic} â€” Part ${i + 1}` : `Scene ${i + 1}`,
    voiceover:  chunk,
    visualNote: topic || chunk.slice(0, 60),
    duration:   Math.max(3, Math.ceil(chunk.split(/\s+/).length / 2.5)),
  }))
}


// -- POST /api/generate-movie-scenes -----------------------------------------
router.post('/api/generate-movie-scenes', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (res.flushHeaders) res.flushHeaders()

  function send(data) {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
      if (typeof res.flush === 'function') res.flush()
    } catch { /* closed */ }
  }

  const { scenes, movie_id, model = 'minimax' } = req.body

  if (!scenes?.length) {
    send({ type: 'error', error: 'scenes[] required' })
    return res.end()
  }

  if (process.env.REDIS_URL) {
    // ---- Queue mode (Redis available) ----------------------------------------
    try {
      const { addSceneJob, getJobStatus, getQueueStats } = require('../services/queue')

      const stats = await getQueueStats()
      const position = stats.waiting + stats.active + 1
      const jobId = await addSceneJob({ scenes, movie_id, model })

      send({
        type: 'queued',
        job_id: jobId,
        position,
        message: position === 1
          ? 'Starting generation...'
          : `Queued at position ${position}. Your video will start soon.`,
        estimated_wait_minutes: Math.round(position * 3),
      })

      let done = false
      let lastPct = -1

      while (!done) {
        await new Promise(r => setTimeout(r, 3000))

        const status = await getJobStatus(jobId, 'scene-generation')
        if (!status) continue

        if (status.state === 'active' && status.progress) {
          const p = status.progress
          if (p.pct !== lastPct) {
            lastPct = p.pct
            send({ type: 'progress', pct: p.pct, scene_number: p.scene_number, message: p.message })
          }
        } else if (status.state === 'waiting') {
          const freshStats = await getQueueStats()
          send({ type: 'queued', message: `In queue... ${freshStats.waiting} jobs ahead`, pct: 0 })
        } else if (status.state === 'completed') {
          const result = status.returnvalue
          for (const scene of (result.completedScenes ?? [])) {
            send({ type: 'scene_done', scene_number: scene.scene_number, title: scene.title, video_url: scene.video_url, pct: 90 })
          }
          send({
            type: 'done',
            pct: 100,
            message: `${result.completedScenes?.length ?? 0}/${result.total} scenes generated!`,
            completed_scenes: result.completedScenes ?? [],
          })
          done = true
        } else if (status.state === 'failed') {
          send({ type: 'error', error: status.failedReason ?? 'Job failed' })
          done = true
        }
      }
    } catch (err) {
      console.error('[queue route]', err.message)
      send({ type: 'error', error: err.message })
    } finally {
      res.end()
    }
  } else {
    // ---- Direct mode (no Redis) — uses stock video clips --------------------
    const { downloadOneClip, sceneToKeyword } = require('../services/stockVideo')

    const cloudinary = require('cloudinary').v2
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    })

    const os   = require('os')
    const path = require('path')
    const fs   = require('fs-extra')
    const { v4: uuidv4 } = require('uuid')

    const completedScenes = []

    try {
      send({ type: 'start', total: scenes.length, message: `Fetching ${scenes.length} stock scenes...` })

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i]
        const pct = Math.round((i / scenes.length) * 85)

        send({
          type: 'progress',
          pct,
          scene_number: scene.scene_number,
          message: `Downloading scene ${scene.scene_number}/${scenes.length}: "${scene.title}"...`,
        })

        const jobDir = path.join(os.tmpdir(), `scene_direct_${uuidv4().slice(0, 8)}`)
        await fs.ensureDir(jobDir)

        try {
          const keyword  = sceneToKeyword(scene)
          const rawPath  = path.join(jobDir, 'clip.mp4')
          console.log(`[direct] Scene ${scene.scene_number}: keyword="${keyword}"`)

          await downloadOneClip(keyword, rawPath, true)

          const uploaded = await cloudinary.uploader.upload(rawPath, {
            resource_type: 'video',
            folder: 'reelforge/movie-scenes',
            public_id: `movie_${movie_id ?? 'unknown'}_scene_${scene.scene_number}_${Date.now()}`,
          })

          completedScenes.push({ scene_number: scene.scene_number, video_url: uploaded.secure_url })
          send({
            type: 'scene_done',
            scene_number: scene.scene_number,
            title: scene.title,
            video_url: uploaded.secure_url,
            pct: Math.round(((i + 1) / scenes.length) * 85),
          })
        } catch (sceneErr) {
          console.error(`[scene ${scene.scene_number}] ERROR:`, sceneErr.message)
          send({ type: 'scene_error', scene_number: scene.scene_number, error: sceneErr.message })
        } finally {
          await fs.remove(jobDir).catch(() => {})
        }

        if (i < scenes.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      send({
        type: 'done',
        pct: 100,
        message: `${completedScenes.length}/${scenes.length} scenes generated!`,
        completed_scenes: completedScenes,
      })
    } catch (err) {
      console.error('[generate-movie-scenes]', err.message)
      send({ type: 'error', error: err.message })
    } finally {
      res.end()
    }
  }
})


// -- POST /api/generate-pexels-scenes ----------------------------------------
router.post('/api/generate-pexels-scenes', async (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (res.flushHeaders) res.flushHeaders()

  function send(data) {
    try {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
      if (typeof res.flush === 'function') res.flush()
    } catch { /* closed */ }
  }

  const { scenes, movie_id, voice_url, voice_data, duration_minutes } = req.body

  if (!scenes?.length) {
    send({ type: 'error', error: 'scenes[] required' })
    return res.end()
  }

  const { downloadOneClip, sceneToKeyword } = require('../services/pexels')
  const cloudinary = require('cloudinary').v2
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })

  const os = require('os')
  const path = require('path')
  const fs = require('fs-extra')
  const fsSync = require('fs')
  const { v4: uuidv4 } = require('uuid')
  const { spawn } = require('child_process')

  function resolveBin(envKey, pkg) {
    if (process.env[envKey]) return process.env[envKey]
    try { return require(pkg).path } catch { }
    return envKey === 'FFMPEG_PATH' ? 'ffmpeg' : 'ffprobe'
  }
  const FFMPEG_BIN = resolveBin('FFMPEG_PATH', '@ffmpeg-installer/ffmpeg')

  function runFFmpeg(args) {
    return new Promise((resolve, reject) => {
      const proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] })
      proc.stderr.on('data', d => console.log('[ffmpeg]', d.toString().trimEnd()))
      proc.on('close', code => {
        if (code === 0) resolve()
        else reject(new Error(`FFmpeg exited with code ${code}`))
      })
      proc.on('error', err => reject(err))
    })
  }

  const jobDir = path.join(os.tmpdir(), `movie_pexels_${uuidv4().slice(0, 8)}`)
  await fs.ensureDir(jobDir)

  try {
    const totalSecs = Math.round((duration_minutes || 3) * 60)
    const defaultSecsPerScene = Math.ceil(totalSecs / scenes.length)

    console.log(`[pexels] Total: ${totalSecs}s for ${scenes.length} scenes`)
    console.log(`[pexels] Default per scene: ${defaultSecsPerScene}s`)

    send({
      type: 'start',
      total: scenes.length,
      message: `Fetching ${scenes.length} Pexels clips for ${duration_minutes || 3}-min video...`,
    })

    // ── Step 1: Download one clip per scene ────────────────────────────────────
    const clipPaths = []

    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i]
      const pct = Math.round((i / scenes.length) * 50)

      send({
        type: 'progress',
        pct,
        scene_number: scene.scene_number,
        message: `Downloading clip ${scene.scene_number}/${scenes.length}...`,
      })

      // Smart keyword extraction: priority order visual_prompt > visualNote > title > voiceover
      function extractSmartKeyword(scene) {
        const raw = (
          scene.visual_prompt ||
          scene.visualNote ||
          scene.title ||
          (scene.voiceover || '').slice(0, 100) ||
          ''
        ).toLowerCase()

        const cleaned = raw
          .replace(/\[.*?\]/g, '')
          .replace(/b-roll|close.?up|wide shot|medium shot|drone|tracking/gi, '')
          .replace(/cinematic|dramatic|establishing/gi, '')
          .replace(/[^\w\s]/g, ' ')
          .trim()

        const stopWords = new Set([
          'the','a','an','is','are','was','were','be','been',
          'have','has','had','do','does','did','will','would',
          'could','should','may','might','shall','can','need',
          'this','that','these','those','with','from','into',
          'through','during','before','after','above','below',
          'and','but','or','for','nor','so','yet','both',
          'either','neither','not','only','own','same','than',
          'too','very','just','because','as','until','while',
          'of','at','by','about','against','between','each',
          'few','more','most','other','some','such','no',
        ])

        const words = cleaned.split(/\s+/)
          .filter(w => w.length > 2 && !stopWords.has(w))
          .slice(0, 4)

        const keyword = words.join(' ') || scene.title || 'lifestyle'
        console.log('[keyword] Scene ' + scene.scene_number + ' -> "' + keyword + '"')
        console.log('[keyword] Source: ' + (scene.visual_prompt || scene.visualNote || '').slice(0, 80))
        return keyword
      }

      const primaryKeyword = extractSmartKeyword(scene)
      const destPath = path.join(jobDir, 'scene_' + scene.scene_number + '.mp4')

      const keywordsToTry = [
        primaryKeyword,
        primaryKeyword.split(' ').slice(0, 2).join(' '),
        scene.title || '',
        'lifestyle people',
      ]

      let downloaded = false
      for (const kw of keywordsToTry) {
        if (downloaded || !kw.trim()) continue
        try {
          await downloadOneClip(kw, destPath, true)
          const size = fsSync.statSync(destPath).size
          if (size > 100000) {
            console.log('[pexels] Success with keyword: "' + kw + '" (' + size + ' bytes)')
            clipPaths.push({
              path: destPath,
              scene,
              duration: scene.duration_seconds || defaultSecsPerScene,
              keyword: kw,
            })
            send({
              type: 'scene_done',
              scene_number: scene.scene_number,
              keyword: kw,
              pct: Math.round(((i + 1) / scenes.length) * 50),
            })
            downloaded = true
          }
        } catch (err) {
          console.warn('[pexels] Failed "' + kw + '":', err.message)
        }
      }

      if (!downloaded) {
        console.warn('[pexels] All keywords failed for scene', scene.scene_number)
      }
    }

    if (clipPaths.length === 0) throw new Error('No clips downloaded successfully')

    send({ type: 'progress', pct: 55, message: 'Building video concat list...' })

    // Calculate total needed seconds
    const concatPath = path.join(jobDir, 'concat.txt')
    const concatLines = []
    const totalSecsTarget = totalSecs
    console.log('[duration] Target: ' + totalSecsTarget + 's = ' + (duration_minutes || 3) + ' min')
    console.log('[duration] Downloaded clips: ' + clipPaths.length)

    let builtSecs = 0
    let loopIdx = 0
    const MAX_LOOPS = 500

    while (builtSecs < totalSecsTarget && loopIdx < MAX_LOOPS) {
      const clipIdx = loopIdx % clipPaths.length
      const { path: clipPath, duration } = clipPaths[clipIdx]
      const remaining = totalSecsTarget - builtSecs
      const useDuration = Math.min(duration, remaining)

      concatLines.push("file '" + clipPath + "'")
      concatLines.push('duration ' + useDuration)

      builtSecs += useDuration
      loopIdx++

      if (builtSecs >= totalSecsTarget) break
    }

    if (clipPaths.length > 0) {
      concatLines.push("file '" + clipPaths[0].path + "'")
    }

    fsSync.writeFileSync(concatPath, concatLines.join('\n'), 'utf8')
    console.log('[concat] Built ' + builtSecs.toFixed(1) + 's from ' + loopIdx + ' entries')
    console.log('[concat] Lines: ' + concatLines.length + ', first few: ' + concatLines.slice(0, 4).join(' | '))

    const concatFileSize = fsSync.statSync(concatPath).size
    console.log('[concat] File size: ' + concatFileSize + ' bytes')

    send({ type: 'progress', pct: 60, message: 'Rendering ' + (duration_minutes || 3) + '-min video...' })

    // Step 3: Render with FFmpeg
    const outputPath = path.join(jobDir, 'final.mp4')

    const hasAudio = !!(voice_url && voice_url.startsWith('http'))
    let ffmpegArgs

    if (hasAudio) {
      const audioPath = path.join(jobDir, 'voice.wav')
      const axios = require('axios')
      const audioRes = await axios({ method: 'get', url: voice_url, responseType: 'stream', timeout: 60000 })
      await new Promise((resolve, reject) => {
        const w = fsSync.createWriteStream(audioPath)
        audioRes.data.pipe(w)
        w.on('finish', resolve)
        w.on('error', reject)
      })

      ffmpegArgs = [
        '-y',
        '-f', 'concat', '-safe', '0', '-i', concatPath,
        '-i', audioPath,
        '-map', '0:v:0',
        '-map', '1:a:0',
        '-vf', 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30',
        '-c:a', 'aac', '-b:a', '96k',
        '-t', String(totalSecsTarget),
        '-movflags', '+faststart',
        '-threads', '2',
        outputPath,
      ]
    } else {
      ffmpegArgs = [
        '-y',
        '-f', 'concat', '-safe', '0', '-i', concatPath,
        '-vf', 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280',
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '30',
        '-an',
        '-t', String(totalSecsTarget),
        '-movflags', '+faststart',
        '-threads', '2',
        outputPath,
      ]
    }


    const outSize = fsSync.statSync(outputPath).size
    if (outSize === 0) throw new Error('FFmpeg produced empty file')
    console.log(`[ffmpeg] Output: ${outSize} bytes`)

    // ── Step 4: Upload to Cloudinary ───────────────────────────────────────────
    send({ type: 'progress', pct: 88, message: 'Uploading to Cloudinary...' })

    const uploaded = await cloudinary.uploader.upload(outputPath, {
      resource_type: 'video',
      folder: 'reelforge/movies',
      public_id: `movie_${movie_id ?? 'x'}_final_${Date.now()}`,
    })

    console.log(`[done] video_url: ${uploaded.secure_url}`)

    send({
      type: 'done',
      pct: 100,
      message: `${clipPaths.length} scenes merged into ${duration_minutes || 3}-min video!`,
      video_url: uploaded.secure_url,
      completed_scenes: clipPaths.map(c => ({
        scene_number: c.scene.scene_number,
        video_url: uploaded.secure_url,
      })),
    })

  } catch (err) {
    console.error('[pexels-scenes fatal]', err.message)
    send({ type: 'error', error: err.message })
  } finally {
    await fs.remove(jobDir).catch(() => {})
    res.end()
  }
})


// -- GET /api/queue/status ----------------------------------------------------
router.get('/api/queue/status', async (req, res) => {
  try {
    const { getQueueStats } = require('../services/queue')
    const stats = await getQueueStats()
    res.json(stats)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// -- GET /api/queue/job/:jobId ------------------------------------------------
router.get('/api/queue/job/:jobId', async (req, res) => {
  try {
    const { getJobStatus } = require('../services/queue')
    const status = await getJobStatus(req.params.jobId, 'scene-generation')
    if (!status) return res.status(404).json({ error: 'Job not found' })
    res.json(status)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})


router.post('/api/burn-captions', async (req, res) => {
  const {
    video_url, script,
    font_size = 48,
    color = 'white',
    border_color = 'black',
    border_width = 4,
    position = 'bottom',
    box = false,
    box_color = '0x00000000',
  } = req.body

  if (!video_url || !script) {
    return res.status(400).json({ error: 'video_url and script required' })
  }

  const os = require('os')
  const path = require('path')
  const fs = require('fs-extra')
  const fsSync = require('fs')
  const { v4: uuidv4 } = require('uuid')
  const { spawn } = require('child_process')
  const axios = require('axios')

  function resolveBin(envKey, pkg) {
    if (process.env[envKey]) return process.env[envKey]
    try { return require(pkg).path } catch {}
    return envKey === 'FFMPEG_PATH' ? 'ffmpeg' : 'ffprobe'
  }
  const FFMPEG_BIN = resolveBin('FFMPEG_PATH', '@ffmpeg-installer/ffmpeg')

  function runFFmpeg(args) {
    return new Promise((resolve, reject) => {
      console.log('[ffmpeg]', args.slice(0, 8).join(' '))
      const proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] })
      let stderr = ''
      proc.stderr.on('data', d => {
        stderr += d.toString()
        console.log('[ffmpeg]', d.toString().slice(0, 100).trimEnd())
      })
      proc.on('close', code => {
        if (code === 0) resolve()
        else reject(new Error('FFmpeg failed: ' + stderr.slice(-300)))
      })
      proc.on('error', reject)
    })
  }

  const jobDir = path.join(os.tmpdir(), 'cap_' + uuidv4().slice(0, 8))
  await fs.ensureDir(jobDir)

  try {
    // Step 1: Download video
    const inputPath = path.join(jobDir, 'input.mp4')
    const videoRes = await axios({
      method: 'get', url: video_url,
      responseType: 'stream', timeout: 120000,
    })
    await new Promise((resolve, reject) => {
      const w = fsSync.createWriteStream(inputPath)
      videoRes.data.pipe(w)
      w.on('finish', resolve)
      w.on('error', reject)
    })
    console.log('[captions] Downloaded:', fsSync.statSync(inputPath).size, 'bytes')

    // Step 2: Re-encode to standard format first
    const stdPath = path.join(jobDir, 'standard.mp4')
    await runFFmpeg([
      '-y', '-i', inputPath,
      '-c:v', 'libx264', '-preset', 'ultrafast',
      '-crf', '28', '-pix_fmt', 'yuv420p',
      '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '44100',
      '-movflags', '+faststart',
      stdPath,
    ])
    console.log('[captions] Re-encoded:', fsSync.statSync(stdPath).size, 'bytes')

    // Step 3: Build ASS subtitle file (more reliable than drawtext)
    const words = script.trim().split(/\s+/)
    const wordsPerSec = 2.5
    const chunkSize = 4
    const chunks = []
    for (let i = 0; i < words.length; i += chunkSize) {
      chunks.push(words.slice(i, i + chunkSize).join(' '))
    }

    function toASS(secs) {
      const h = Math.floor(secs / 3600)
      const m = Math.floor((secs % 3600) / 60)
      const s = Math.floor(secs % 60)
      const cs = Math.floor((secs % 1) * 100)
      return h + ':' +
        String(m).padStart(2, '0') + ':' +
        String(s).padStart(2, '0') + '.' +
        String(cs).padStart(2, '0')
    }

    function toASSColor(c) {
      const colors = {
        white:  '&H00FFFFFF',
        yellow: '&H0000FFFF',
        red:    '&H000000FF',
        green:  '&H0000FF00',
        blue:   '&H00FF0000',
      }
      if (c && c.startsWith('#')) {
        const r = c.slice(1, 3)
        const g = c.slice(3, 5)
        const b = c.slice(5, 7)
        return '&H00' + b + g + r
      }
      return colors[c] ?? '&H00FFFFFF'
    }

    const fontSize = Math.min(font_size || 40, 44)
    const primaryColor = toASSColor(color || 'white')
    const borderColor  = toASSColor(border_color || 'black')
    const marginV      = position === 'top' ? 0 : position === 'center' ? 50 : 10
    const alignment    = position === 'top' ? 8 : position === 'center' ? 5 : 2

    const assHeader = `[Script Info]
ScriptType: v4.00+
PlayResX: 720
PlayResY: 1280
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,DejaVu Sans,${fontSize},${primaryColor},&H000000FF,${borderColor},&H00000000,0,0,0,0,100,100,0,0,1,2,1,${alignment},20,20,${marginV},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`

    let timeOffset = 0
    const assEvents = chunks.map((chunk) => {
      const wordCount = chunk.split(/\s+/).length
      const duration = wordCount / wordsPerSec
      const start = timeOffset
      const end = timeOffset + duration + 0.1
      timeOffset += duration

      const cleanText = chunk
        .replace(/\{/g, '(')
        .replace(/\}/g, ')')
        .replace(/\n/g, ' ')
        .replace(/\r/g, '')
        .trim()

      return 'Dialogue: 0,' + toASS(start) + ',' + toASS(end) + ',Default,,0,0,0,,' + cleanText
    }).join('\n')

    const assContent = assHeader + assEvents + '\n'
    const assPath = path.join(jobDir, 'captions.ass')
    fsSync.writeFileSync(assPath, assContent, 'utf8')
    console.log('[captions] ASS file written, chunks:', chunks.length)
    console.log('[captions] Sample:', assContent.split('\n').slice(-3).join(' | '))

    // Step 4: Burn ASS subtitles into video
    const outputPath = path.join(jobDir, 'output.mp4')
    await runFFmpeg([
      '-y',
      '-i', stdPath,
      '-vf', 'ass=' + assPath,
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      '-crf', '28',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'copy',
      '-movflags', '+faststart',
      outputPath,
    ])

    const outSize = fsSync.statSync(outputPath).size
    console.log('[captions] Output:', outSize, 'bytes')
    if (outSize < 50000) throw new Error('Output too small - captions failed silently')

    // Step 6: Upload to Cloudinary
    const cloudinary = require('cloudinary').v2
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    })

    const uploaded = await cloudinary.uploader.upload(outputPath, {
      resource_type: 'video',
      folder: 'reelforge/captioned',
      public_id: 'captioned_' + Date.now(),
    })

    console.log('[captions] Done:', uploaded.secure_url)
    res.json({ video_url: uploaded.secure_url })

  } catch (err) {
    console.error('[burn-captions]', err.message)
    res.status(500).json({ error: err.message })
  } finally {
    await fs.remove(jobDir).catch(() => {})
  }
})

module.exports = router
