'use strict'

const { spawn }      = require('child_process')
const path           = require('path')
const os             = require('os')
const fs             = require('fs-extra')
const fsSync         = require('fs')
const { v4: uuidv4 } = require('uuid')
const ffmpegFluent   = require('fluent-ffmpeg')
const axios          = require('axios')

const { generateVoiceover }              = require('./tts')
const { downloadClips, sceneToKeyword }  = require('./pexels')
const { uploadToCloudinary }             = require('./cloudinaryUpload')
const { updateVideoRecord, updateProjectStatus } = require('./supabase')
const { extractKeywords, extractSceneKeyword }   = require('../utils/keywords')
const { acquireAllMedia }                = require('./mediaAcquirer')

// ── FFmpeg binary resolution ──────────────────────────────────────────────────
function resolveBin(envKey, installerPkg, systemPath, bareName) {
  if (process.env[envKey]) {
    console.log(`[resolveBin] ${bareName}: using env ${envKey} = ${process.env[envKey]}`)
    return process.env[envKey]
  }
  try {
    const installerPath = require(installerPkg).path
    if (installerPath && fsSync.existsSync(installerPath)) {
      console.log(`[resolveBin] ${bareName}: using npm installer = ${installerPath}`)
      return installerPath
    }
    console.warn(`[resolveBin] ${bareName}: npm installer path not on disk: ${installerPath}`)
  } catch (e) {
    console.warn(`[resolveBin] ${bareName}: npm installer unavailable: ${e.message}`)
  }
  if (fsSync.existsSync(systemPath)) {
    console.log(`[resolveBin] ${bareName}: using system apt-get binary = ${systemPath}`)
    return systemPath
  }
  console.warn(`[resolveBin] ${bareName}: falling back to bare name`)
  return bareName
}

const FFMPEG_BIN  = resolveBin('FFMPEG_PATH',  '@ffmpeg-installer/ffmpeg',   '/usr/bin/ffmpeg',  'ffmpeg')
const FFPROBE_BIN = resolveBin('FFPROBE_PATH', '@ffprobe-installer/ffprobe', '/usr/bin/ffprobe', 'ffprobe')

console.log('[FFMPEG_BIN]',          FFMPEG_BIN)
console.log('[FFPROBE_BIN]',         FFPROBE_BIN)
console.log('[FFMPEG_BIN]  exists:', fsSync.existsSync(FFMPEG_BIN))
console.log('[FFPROBE_BIN] exists:', fsSync.existsSync(FFPROBE_BIN))

ffmpegFluent.setFfmpegPath(FFMPEG_BIN)
ffmpegFluent.setFfprobePath(FFPROBE_BIN)

const CLIP_MAX_SECS       = 10
const MAX_UNIQUE_DOWNLOADS = 12

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMediaDuration(filePath) {
  return new Promise((resolve, reject) => {
    ffmpegFluent.ffprobe(filePath, (err, meta) => {
      if (err) reject(new Error(`ffprobe "${path.basename(filePath)}": ${err.message}`))
      else     resolve(meta.format.duration)
    })
  })
}

function fileSize(filePath) {
  try { return fsSync.statSync(filePath).size } catch { return 0 }
}

async function fetchAudio(source, outputPath) {
  if (!source) throw new Error('No audio source provided')
  if (source.startsWith('data:')) {
    const comma = source.indexOf(',')
    if (comma === -1) throw new Error('Malformed data URL')
    const buf = Buffer.from(source.slice(comma + 1), 'base64')
    await fs.writeFile(outputPath, buf)
    console.log(`[audio] Decoded base64 → ${path.basename(outputPath)} (${buf.length} bytes)`)
    return
  }
  console.log(`[audio] Downloading ${source.slice(0, 80)}…`)
  const res = await axios({ method: 'get', url: source, responseType: 'stream', timeout: 120000, maxRedirects: 5 })
  await new Promise((resolve, reject) => {
    const writer = fsSync.createWriteStream(outputPath)
    res.data.pipe(writer)
    writer.on('finish', resolve)
    writer.on('error', reject)
    res.data.on('error', reject)
  })
  const bytes = fileSize(outputPath)
  console.log(`[audio] Saved ${path.basename(outputPath)} (${bytes} bytes)`)
  if (bytes === 0) throw new Error('Audio download produced an empty file')
}

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    console.log(`[ffmpeg] spawn: ${FFMPEG_BIN} ${args.slice(0, 12).join(' ')} …`)
    const proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    proc.stderr.on('data', d => console.log('[ffmpeg]', d.toString().trimEnd().slice(0, 150)))
    proc.on('close', code => {
      if (code === 0) return resolve()
      if (code === null) reject(new Error('FFmpeg killed by OS (OOM)'))
      else               reject(new Error(`FFmpeg exited with code ${code}`))
    })
    proc.on('error', err => reject(new Error(`Failed to spawn ffmpeg: ${err.message}`)))
  })
}

// ── Normalize a video clip to H.264 720x1280 30fps ───────────────────────────
async function normalizeVideoClip(inputPath, outputPath, durationSecs) {
  const trimDuration = Math.min(durationSecs || CLIP_MAX_SECS, CLIP_MAX_SECS)
  await runFFmpeg([
    '-y',
    '-i',      inputPath,
    '-t',      String(trimDuration),
    '-vf',     'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30,format=yuv420p,setsar=1:1',
    '-c:v',    'libx264',
    '-preset', 'ultrafast',
    '-crf',    '28',
    '-pix_fmt','yuv420p',
    '-r',      '30',
    '-video_track_timescale', '90000',
    '-an',
    '-movflags', '+faststart',
    outputPath,
  ])
  const size = fileSize(outputPath)
  console.log(`[normalize] video → ${path.basename(outputPath)} (${size} bytes, ${trimDuration}s)`)
}

// ── Convert image to video with Ken Burns zoom/pan ───────────────────────────
async function convertImageToVideo(inputPath, outputPath, durationSecs) {
  const dur = Math.max(durationSecs || 5, 2)
  const frames = dur * 30

  await runFFmpeg([
    '-y',
    '-loop',  '1',
    '-i',     inputPath,
    '-t',     String(dur),
    '-vf',    [
      'scale=720:1280:force_original_aspect_ratio=increase',
      'crop=720:1280',
      `zoompan=z='min(zoom+0.0008,1.3)':d=${frames}:s=720x1280:fps=30`,
      'format=yuv420p',
      'setsar=1:1',
    ].join(','),
    '-c:v',    'libx264',
    '-preset', 'ultrafast',
    '-crf',    '28',
    '-pix_fmt','yuv420p',
    '-r',      '30',
    '-video_track_timescale', '90000',
    '-an',
    '-movflags', '+faststart',
    outputPath,
  ])
  const size = fileSize(outputPath)
  console.log(`[normalize] image→video ${path.basename(outputPath)} (${size} bytes, ${dur}s)`)
}

// ── Generate solid color video ────────────────────────────────────────────────
async function generateColorVideo(outputPath, durationSecs, color) {
  const dur = Math.max(durationSecs || 5, 2)
  const bgColor = color || '#1a1a2e'

  await runFFmpeg([
    '-y',
    '-f',      'lavfi',
    '-i',      `color=c=${bgColor}:s=720x1280:r=30`,
    '-t',      String(dur),
    '-c:v',    'libx264',
    '-preset', 'ultrafast',
    '-crf',    '28',
    '-pix_fmt','yuv420p',
    '-r',      '30',
    '-an',
    '-movflags', '+faststart',
    outputPath,
  ])
  console.log(`[normalize] color video ${path.basename(outputPath)} (${dur}s color=${bgColor})`)
}

// ── Probe clip duration ───────────────────────────────────────────────────────
async function probeClipDuration(filePath) {
  return new Promise((resolve) => {
    ffmpegFluent.ffprobe(filePath, (err, meta) => {
      if (err) { resolve(5); return }
      resolve(parseFloat(meta.format?.duration) || 5)
    })
  })
}

// ── Build concat.txt from normalized clips with scene durations ───────────────
function buildTimelineConcatFile(sceneClips, concatPath) {
  const lines     = []
  let   builtSecs = 0

  for (const clip of sceneClips) {
    lines.push(`file '${clip.path}'`)
    lines.push(`duration ${clip.duration.toFixed(4)}`)
    builtSecs += clip.duration
  }

  // Required trailing entry for concat demuxer
  if (sceneClips.length > 0) {
    lines.push(`file '${sceneClips[sceneClips.length - 1].path}'`)
  }

  fsSync.writeFileSync(concatPath, lines.join('\n') + '\n', 'utf8')

  console.log(`[timeline] ${sceneClips.length} scenes | total=${builtSecs.toFixed(2)}s`)
  sceneClips.forEach((c, i) => {
    console.log(`[timeline]   Scene ${i+1}: ${path.basename(c.path)} | ${c.duration.toFixed(2)}s | type=${c.mediaType}`)
  })

  return builtSecs
}

// ── processVideo — Phase 2 scene-based pipeline ───────────────────────────────
async function processVideo({ scenes, voice_url, voice_data, project_id, duration_minutes, onProgress }) {
  const jobId  = uuidv4().slice(0, 8)
  const jobDir = path.join(os.tmpdir(), `reelforge_${jobId}`)
  await fs.ensureDir(jobDir)

  const emit = (step, pct, message) => {
    console.log(`[job:${jobId}] [${pct}%] ${message}`)
    onProgress({ type: 'progress', step, pct, message })
  }

  const durationMins = Math.max(Number(duration_minutes) || 1, 0.5)
  const totalSecs    = Math.round(durationMins * 60)

  console.log(`[pipeline] jobId=${jobId} | scenes=${scenes.length} | ${durationMins}min (${totalSecs}s)`)

  try {
    // ── STEP 1: Fetch audio ─────────────────────────────────────────────────
    emit('preparing', 5, 'Preparing voiceover audio…')
    const voicePath   = path.join(jobDir, 'voice.wav')
    const audioSource = voice_url?.startsWith('http') ? voice_url : voice_data
    await fetchAudio(audioSource, voicePath)

    const audioDuration = await getMediaDuration(voicePath)
    console.log(`[job:${jobId}] Audio: ${audioDuration.toFixed(2)}s | target: ${totalSecs}s`)

    if (audioDuration < totalSecs * 0.4) {
      console.warn(`[job:${jobId}] WARNING: Audio only ${audioDuration.toFixed(1)}s vs ${totalSecs}s target`)
    }

    // ── STEP 2: Calculate per-scene duration from narration word count ──────
    // 2.5 words per second = natural speaking pace
    function calcSceneDuration(scene, index) {
      const narration = scene.narration || scene.voiceover || ''
      const words     = narration.trim().split(/\s+/).filter(Boolean).length
      if (words > 0) return Math.max(3, Math.round(words / 2.5))
      // Fallback: divide total duration evenly
      return Math.max(3, Math.round(totalSecs / scenes.length))
    }

    const sceneDurations = scenes.map((s, i) => calcSceneDuration(s, i))
    const declaredTotal  = sceneDurations.reduce((a, b) => a + b, 0)
    console.log(`[timeline] Declared scene durations total: ${declaredTotal}s (audio: ${audioDuration.toFixed(1)}s)`)

    // ── STEP 3: Acquire unique media for every scene ────────────────────────
    emit('fetching_clips', 10, `Acquiring media for ${scenes.length} scenes…`)
    const mediaResults = await acquireAllMedia(scenes, jobDir)

    // Progress update after acquisition
    const videoCount  = mediaResults.filter(r => r.type === 'video').length
    const imageCount  = mediaResults.filter(r => r.type === 'image').length
    const colorCount  = mediaResults.filter(r => r.type === 'color').length
    console.log(`[acquire] Results: ${videoCount} videos, ${imageCount} images, ${colorCount} color`)
    emit('fetching_clips', 40, `Got ${videoCount} videos, ${imageCount} images for ${scenes.length} scenes`)

    // ── STEP 4: Normalize every media asset to uniform format ───────────────
    emit('rendering', 42, `Normalizing ${scenes.length} clips to H.264 720×1280 30fps…`)
    const normalizeDir = path.join(jobDir, 'normalized')
    await fs.ensureDir(normalizeDir)

    const sceneClips = []

    for (let i = 0; i < scenes.length; i++) {
      const media       = mediaResults[i]
      const duration    = sceneDurations[i]
      const normPath    = path.join(normalizeDir, `scene_${String(i+1).padStart(3,'0')}.mp4`)

      emit('rendering', 42 + Math.round((i / scenes.length) * 25),
        `Normalizing scene ${i+1}/${scenes.length}…`)

      try {
        if (media.type === 'video' && media.localPath) {
          // Probe actual duration, use scene duration or actual — whichever is smaller
          const actualDur = await probeClipDuration(media.localPath)
          const useDur    = Math.min(duration, actualDur, CLIP_MAX_SECS)
          await normalizeVideoClip(media.localPath, normPath, useDur)
          const confirmedDur = await probeClipDuration(normPath)
          sceneClips.push({ path: normPath, duration: confirmedDur, mediaType: 'video', sceneNumber: i+1 })

        } else if (media.type === 'image' && media.localPath) {
          await convertImageToVideo(media.localPath, normPath, duration)
          sceneClips.push({ path: normPath, duration, mediaType: 'image', sceneNumber: i+1 })

        } else {
          // Color background
          await generateColorVideo(normPath, duration)
          sceneClips.push({ path: normPath, duration, mediaType: 'color', sceneNumber: i+1 })
        }
      } catch (err) {
        console.error(`[normalize] Scene ${i+1} failed: ${err.message} — using color fallback`)
        try {
          await generateColorVideo(normPath, duration)
          sceneClips.push({ path: normPath, duration, mediaType: 'color', sceneNumber: i+1 })
        } catch (e) {
          console.error(`[normalize] Color fallback also failed for scene ${i+1}: ${e.message}`)
        }
      }
    }

    if (sceneClips.length === 0) throw new Error('No scenes normalized successfully')

    // ── STEP 5: Build scene-based timeline concat.txt ───────────────────────
    emit('rendering', 68, 'Building scene timeline…')
    const concatPath = path.join(jobDir, 'concat.txt')
    const builtSecs  = buildTimelineConcatFile(sceneClips, concatPath)

    console.log(`[timeline] Built ${builtSecs.toFixed(2)}s from ${sceneClips.length} unique scenes`)

    // Use audio duration as final cap (more accurate than word-count estimate)
    const finalDuration = Math.min(totalSecs, Math.ceil(audioDuration) + 2)

    // ── STEP 6: FFmpeg final render with CFR re-encode ──────────────────────
    emit('rendering', 70, `Rendering ${durationMins}-min video (CFR encode)…`)
    const outputPath  = path.join(jobDir, 'final.mp4')
    const renderStart = Date.now()

    const renderPoll = setInterval(() => {
      const elapsed = (Date.now() - renderStart) / 1000
      const pct     = Math.min(86, 70 + Math.round((elapsed / (finalDuration * 0.3)) * 16))
      onProgress({ type: 'progress', step: 'rendering', pct, message: 'Rendering final video…' })
    }, 3000)

    await runFFmpeg([
      '-y',
      '-f',        'concat',
      '-safe',     '0',
      '-i',        concatPath,
      '-i',        voicePath,
      '-map',      '0:v:0',
      '-map',      '1:a:0',
      '-c:v',      'libx264',
      '-preset',   'ultrafast',
      '-crf',      '32',
      '-pix_fmt',  'yuv420p',
      '-r',        '30',
      '-vsync',    'cfr',
      '-c:a',      'aac',
      '-b:a',      '96k',
      '-ar',       '44100',
      '-t',        String(finalDuration),
      '-movflags', '+faststart',
      outputPath,
    ]).finally(() => clearInterval(renderPoll))

    const outSize = fileSize(outputPath)
    if (outSize === 0) throw new Error('FFmpeg produced an empty output file')
    console.log(`[ffmpeg] Final output: ${outSize} bytes (${finalDuration}s)`)

    // ── STEP 7: Upload ──────────────────────────────────────────────────────
    emit('uploading', 88, 'Uploading to Cloudinary…')
    const { videoUrl, voiceUrl: uploadedVoiceUrl } = await uploadToCloudinary(
      outputPath, voicePath, project_id
    )
    console.log(`[done] video_url: ${videoUrl}`)
    return { videoUrl, voiceUrl: uploadedVoiceUrl, duration: finalDuration }

  } catch (err) {
    console.error(`[job:${jobId}] FAILED: ${err.message}`)
    throw err
  } finally {
    await fs.remove(jobDir).catch(() => {})
    console.log(`[job:${jobId}] Cleaned up ${jobDir}`)
  }
}

// ── processReel — legacy pipeline (unchanged) ─────────────────────────────────
async function processReel({ script, voice_id, project_id }) {
  const jobId  = uuidv4().slice(0, 8)
  const jobDir = path.join(os.tmpdir(), `reelforge_${jobId}`)
  await fs.ensureDir(jobDir)
  console.log(`\n[job:${jobId}] ▶ project=${project_id} (legacy processReel)`)
  try {
    const voicePath     = path.join(jobDir, 'voice.mp3')
    await generateVoiceover(script, voice_id, voicePath)
    const audioDuration = await getMediaDuration(voicePath)
    const totalSecs     = Math.round(audioDuration)
    const keywords      = extractKeywords(script, MAX_UNIQUE_DOWNLOADS)
    const rawClips      = await downloadClips(keywords, jobDir)
    const validClips    = rawClips.filter(c => fileSize(c) >= 100000)
    if (validClips.length === 0) throw new Error('No valid clips downloaded')

    // Simple concat for legacy path
    const concatPath = path.join(jobDir, 'concat.txt')
    const lines      = []
    const slots      = Math.ceil(totalSecs / CLIP_MAX_SECS) + 2
    for (let i = 0; i < slots; i++) {
      lines.push(`file '${validClips[i % validClips.length]}'`)
      lines.push(`duration ${CLIP_MAX_SECS}`)
    }
    lines.push(`file '${validClips[0]}'`)
    fsSync.writeFileSync(concatPath, lines.join('\n') + '\n', 'utf8')

    const outputPath = path.join(jobDir, 'final.mp4')
    await runFFmpeg([
      '-y', '-f', 'concat', '-safe', '0', '-i', concatPath, '-i', voicePath,
      '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
      '-vf', 'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280',
      '-pix_fmt', 'yuv420p', '-r', '30','-b:v',      '500k',
'-maxrate',  '800k',
'-bufsize',  '1600k',
      '-c:a', 'aac', '-b:a', '96k', '-ar', '44100',
      '-t', String(totalSecs), '-movflags', '+faststart', outputPath,
    ])

    if (fileSize(outputPath) === 0) throw new Error('FFmpeg produced empty file')
    const { videoUrl, voiceUrl } = await uploadToCloudinary(outputPath, voicePath, project_id)
    await updateVideoRecord(project_id, videoUrl, voiceUrl, totalSecs)
    await updateProjectStatus(project_id, 'completed')
    return { videoUrl, voiceUrl }
  } catch (err) {
    console.error(`[job:${jobId}] FAILED: ${err.message}`)
    throw err
  } finally {
    await fs.remove(jobDir).catch(() => {})
  }
}

module.exports = { processReel, processVideo }