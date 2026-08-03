'use strict'

const { spawn }      = require('child_process')
const path            = require('path')
const os              = require('os')
const fs              = require('fs-extra')
const fsSync          = require('fs')
const axios           = require('axios')
const { v4: uuidv4 }  = require('uuid')
const { FFMPEG_BIN, FFPROBE_BIN } = require('./ffmpegUtils')
const { downloadOneClip } = require('./pexels')
const { calculateSceneTiming } = require('./sceneTiming')
const { analyzeClip } = require('./clipAnalyzer')
const { buildTransitionGraph, renderTransitionChain } = require('./transitionEngine')

const TARGET_WIDTH  = 720
const TARGET_HEIGHT = 1280
const TARGET_FPS    = 25

function fileSize(p) {
  try { return fsSync.statSync(p).size } catch { return 0 }
}

// ── Generic retry helper: exponential backoff, 3 attempts, never used for FFmpeg rendering ──
async function withRetry(fn, { attempts = 3, backoffsMs = [1000, 2000, 4000], label = 'operation' } = {}) {
  let lastErr
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt)
    } catch (err) {
      lastErr = err
      console.warn(`[V2] Retry: ${label} attempt ${attempt}/${attempts} failed: ${err.message}`)
      if (attempt < attempts) {
        const wait = backoffsMs[attempt - 1] ?? backoffsMs[backoffsMs.length - 1]
        await new Promise(r => setTimeout(r, wait))
      }
    }
  }
  throw new Error(`[V2] ${label} failed after ${attempts} attempts: ${lastErr.message}`, { cause: lastErr })
}

// ── Keyword extraction — moved verbatim from reelRoutes.js /api/generate-pexels-scenes ──
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
  return keyword
}

// ── STEP 1: download one stock clip per scene — same retry/keyword behaviour as before, now with automatic retry ──
async function downloadSceneClips(scenes, jobDir, onProgress) {
  const progress = (data) => { if (typeof onProgress === 'function') onProgress(data) }
  const downloadsDir = path.join(jobDir, 'downloads')
  await fs.ensureDir(downloadsDir)

  progress({ type: 'start', total: scenes.length, message: `Fetching ${scenes.length} Pexels clips...` })

  const clipEntries = []

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]
    const pct = Math.round((i / scenes.length) * 5)

    progress({
      type: 'progress',
      pct,
      scene_number: scene.scene_number,
      message: `Downloading clip ${scene.scene_number}/${scenes.length}...`,
    })

    const primaryKeyword = extractSmartKeyword(scene)
    const destPath = path.join(downloadsDir, `scene_${scene.scene_number}.mp4`)

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
        await withRetry(() => downloadOneClip(kw, destPath, true), { label: `download clip (keyword: "${kw}")` })
        const size = fileSize(destPath)
        if (size > 100000) {
          console.log(`[V2] Downloaded scene ${scene.scene_number} with keyword "${kw}" (${size} bytes)`)
          clipEntries.push({ path: destPath, scene, keyword: kw })
          progress({
            type: 'scene_done',
            scene_number: scene.scene_number,
            keyword: kw,
            pct: Math.round(((i + 1) / scenes.length) * 5),
          })
          downloaded = true
        }
      } catch (err) {
        console.warn(`[V2] Download failed for keyword "${kw}": ${err.message}`)
      }
    }

    if (!downloaded) {
      console.warn(`[V2] All keywords failed for scene ${scene.scene_number}`)
    }
  }

  if (clipEntries.length === 0) {
    throw new Error('[V2] downloadSceneClips: no clips downloaded successfully')
  }

  return clipEntries
}

// ── Download the voice track, if one was provided as an http(s) URL ──
async function downloadVoiceTrack(voiceUrl, jobDir) {
  if (!voiceUrl || !voiceUrl.startsWith('http')) return null

  const voicePath = path.join(jobDir, 'voice.wav')

  await withRetry(async () => {
    const res = await axios({ method: 'get', url: voiceUrl, responseType: 'stream', timeout: 60000 })
    await new Promise((resolve, reject) => {
      const w = fsSync.createWriteStream(voicePath)
      res.data.pipe(w)
      w.on('finish', resolve)
      w.on('error', reject)
    })
  }, { label: 'download voice track' })

  return voicePath
}

// ── Reusable FFmpeg runner: logs command, captures stderr, rejects with full diagnostics. Never retried. ──
// A hard wall-clock timeout (default 5 min) guards against a hung/stuck ffmpeg process blocking a render forever.
const FFMPEG_TIMEOUT_MS = Number(process.env.V2_FFMPEG_TIMEOUT_MS) || 5 * 60 * 1000

function runFFmpeg(args, label, clipPath, timeoutMs = FFMPEG_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    console.log(`[V2] [ffmpeg:${label}] ${FFMPEG_BIN} ${args.join(' ')}`)

    let proc
    try {
      proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    } catch (err) {
      return reject(new Error(
        `[V2] FFmpeg failed to spawn for stage "${label}"` +
        (clipPath ? ` (clip: ${clipPath})` : '') +
        `: ${err.message}`
      ))
    }

    let stderr    = ''
    let timedOut  = false
    let settled   = false

    const timer = setTimeout(() => {
      timedOut = true
      console.error(`[V2] FFmpeg stage "${label}" exceeded ${timeoutMs}ms — killing process`)
      proc.kill('SIGKILL')
    }, timeoutMs)

    proc.stdout && proc.stdout.on('data', () => {})
    proc.stderr.on('data', d => { stderr += d.toString() })

    proc.on('error', err => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(
        `[V2] FFmpeg process error for stage "${label}"` +
        (clipPath ? ` (clip: ${clipPath})` : '') +
        `: ${err.message}`
      ))
    })

    proc.on('close', (code, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timer)

      if (timedOut) {
        return reject(new Error(
          `[V2] FFmpeg stage "${label}" timed out after ${timeoutMs}ms and was killed` +
          (clipPath ? ` (clip: ${clipPath})` : '') +
          `\n--- command ---\n${FFMPEG_BIN} ${args.join(' ')}\n` +
          `--- stderr tail ---\n${stderr.slice(-4000)}`
        ))
      }

      if (code === 0) {
        resolve({ code, stderr })
      } else {
        reject(new Error(
          `[V2] FFmpeg stage "${label}" failed` +
          (clipPath ? ` (clip: ${clipPath})` : '') +
          ` — exit code: ${code}, signal: ${signal || 'none'}\n` +
          `--- command ---\n${FFMPEG_BIN} ${args.join(' ')}\n` +
          `--- stderr tail ---\n${stderr.slice(-4000)}`
        ))
      }
    })
  })
}

// ── Shared quality baseline for every encode path in this file: H264 baseline / yuv420p / ──
// constant fps / faststart / no audio. Kept as one source of truth so every strategy
// (trim, slow, loop+crossfade, download-more) always outputs identically-shaped clips.
function buildEncodeArgs() {
  return [
    '-vf', [
      `scale=${TARGET_WIDTH}:${TARGET_HEIGHT}:force_original_aspect_ratio=increase`,
      `crop=${TARGET_WIDTH}:${TARGET_HEIGHT}`,
      `fps=${TARGET_FPS}`,
      'format=yuv420p',
      'setsar=1:1',
    ].join(','),
    '-c:v', 'libx264',
    '-profile:v', 'baseline',
    '-level:v', '3.0',
    '-preset', 'ultrafast',
    '-crf', '28',
    '-pix_fmt', 'yuv420p',
    '-r', String(TARGET_FPS),
    '-an',
    '-movflags', '+faststart',
  ]
}

// ── STEP 2: normalize a single clip to 720x1280 / 25fps / H264 baseline / yuv420p / no audio ──
async function normalizeClip(inputPath, outputPath) {
  if (!fsSync.existsSync(inputPath)) {
    throw new Error(`[V2] normalizeClip: input clip does not exist: ${inputPath}`)
  }

  const args = ['-y', '-i', inputPath, ...buildEncodeArgs(), outputPath]

  try {
    await runFFmpeg(args, 'normalize', inputPath)
  } catch (err) {
    throw new Error(`[V2] normalizeClip failed for ${inputPath} -> ${outputPath}: ${err.message}`)
  }

  if (!fsSync.existsSync(outputPath) || fileSize(outputPath) === 0) {
    throw new Error(`[V2] normalizeClip produced no output for ${inputPath} -> ${outputPath}`)
  }

  return outputPath
}

// ── STEP 3: probe a clip's real duration via ffprobe ──
async function getClipDuration(clipPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      clipPath,
    ]

    let proc
    try {
      proc = spawn(FFPROBE_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (err) {
      return reject(new Error(`[V2] getClipDuration: ffprobe failed to spawn for ${clipPath}: ${err.message}`))
    }

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', d => { stdout += d.toString() })
    proc.stderr.on('data', d => { stderr += d.toString() })

    proc.on('error', err => {
      reject(new Error(`[V2] getClipDuration: ffprobe process error for ${clipPath}: ${err.message}`))
    })

    proc.on('close', code => {
      if (code !== 0) {
        return reject(new Error(
          `[V2] getClipDuration: ffprobe exited ${code} for ${clipPath}\n--- stderr ---\n${stderr.slice(-1000)}`
        ))
      }
      const duration = parseFloat(stdout.trim())
      if (!isFinite(duration) || duration <= 0) {
        return reject(new Error(
          `[V2] getClipDuration: could not parse a valid duration for ${clipPath} (ffprobe returned "${stdout.trim()}")`
        ))
      }
      resolve(duration)
    })
  })
}

// ── Full probe: resolution / fps / codec / pix_fmt / duration in one ffprobe call ──
async function probeMovie(moviePath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=width,height,r_frame_rate,codec_name,pix_fmt:format=duration',
      '-of', 'json',
      moviePath,
    ]

    let proc
    try {
      proc = spawn(FFPROBE_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (err) {
      return reject(new Error(`[V2] probeMovie: ffprobe failed to spawn for ${moviePath}: ${err.message}`))
    }

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', d => { stdout += d.toString() })
    proc.stderr.on('data', d => { stderr += d.toString() })

    proc.on('error', err => {
      reject(new Error(`[V2] probeMovie: ffprobe process error for ${moviePath}: ${err.message}`))
    })

    proc.on('close', code => {
      if (code !== 0) {
        return reject(new Error(`[V2] probeMovie: ffprobe exited ${code} for ${moviePath}\n--- stderr ---\n${stderr.slice(-1000)}`))
      }
      try {
        const parsed = JSON.parse(stdout)
        const stream = (parsed.streams || [])[0]
        if (!stream) throw new Error('no video stream found in ffprobe output')

        const [num, den] = String(stream.r_frame_rate || '0/1').split('/').map(Number)
        const fps = den > 0 ? num / den : 0

        resolve({
          width:    stream.width,
          height:   stream.height,
          fps,
          codec:    stream.codec_name,
          pixFmt:   stream.pix_fmt,
          duration: parseFloat(parsed.format?.duration) || 0,
        })
      } catch (err) {
        reject(new Error(`[V2] probeMovie: failed to parse ffprobe output for ${moviePath}: ${err.message}\nraw: ${stdout.slice(0, 500)}`))
      }
    })
  })
}

// ── Smart Clip Duration Engine ────────────────────────────────────────────────
// Strategy selection thresholds, expressed as clipDuration / targetDuration:
//   ratio >= 1.0        -> TRIM                 (clean cut, never touched otherwise)
//   0.7  <= ratio < 1.0  -> SLOW                 (playback slowed by up to 10%)
//   0.4  <= ratio < 0.7  -> LOOP_WITH_CROSSFADE  (seamless xfade loop, never a frozen frame)
//   ratio < 0.4          -> DOWNLOAD_MORE        (fetch one more stock clip, merge, re-evaluate;
//                                                 falls back to LOOP_WITH_CROSSFADE if unavailable)
const STRATEGIES = {
  TRIM: 'TRIM',
  SLOW: 'SLOW',
  LOOP_WITH_CROSSFADE: 'LOOP_WITH_CROSSFADE',
  DOWNLOAD_MORE: 'DOWNLOAD_MORE',
}

const MIN_SPEED = 0.9  // never slow playback by more than 10%
const MAX_SPEED = 1.1  // reserved ceiling — no current strategy speeds a clip up
const SLOW_RATIO_MIN = 0.7
const LOOP_RATIO_MIN = 0.4

// ── Pure strategy selector — no I/O, safe to unit test directly ──
function classifyStrategy(clipDuration, targetDuration) {
  if (!(clipDuration > 0) || !(targetDuration > 0)) return STRATEGIES.TRIM
  const ratio = clipDuration / targetDuration
  if (ratio >= 1) return STRATEGIES.TRIM
  if (ratio >= SLOW_RATIO_MIN) return STRATEGIES.SLOW
  if (ratio >= LOOP_RATIO_MIN) return STRATEGIES.LOOP_WITH_CROSSFADE
  return STRATEGIES.DOWNLOAD_MORE
}

// ── Pure loop-plan calculator — how many repetitions + how long a crossfade to reach ──
// (at least) targetDuration, with a one-crossfade-length safety buffer to absorb the
// small per-repetition boundary jitter applied for visual variety. No I/O.
function computeLoopPlan(clipDuration, targetDuration) {
  const safeClipDuration = Math.max(clipDuration, 0.1)
  const crossfadeDuration = Math.max(0.05, Math.min(0.6, safeClipDuration * 0.2, safeClipDuration * 0.4))
  const perRepGain = Math.max(0.05, safeClipDuration - crossfadeDuration)
  const bufferedTarget = targetDuration + crossfadeDuration
  const reps = Math.max(2, Math.ceil(1 + (bufferedTarget - safeClipDuration) / perRepGain))
  return { crossfadeDuration, reps }
}

// ── Build an N-repetition xfade chain of the SAME clip, trimmed to exactly targetDuration. ──
// Loop boundaries are jittered slightly on interior repetitions so repeats don't look
// identical, and the transition alternates fade/dissolve for visual variety.
async function runLoopedCrossfade(inputPath, outputPath, clipDuration, targetDuration) {
  const { crossfadeDuration, reps } = computeLoopPlan(clipDuration, targetDuration)

  if (!(await ffmpegSupportsXfade())) {
    console.warn('[V2] LOOP_WITH_CROSSFADE: xfade unsupported by this FFmpeg build — falling back to plain loop+trim')
    const loopCount = Math.max(0, Math.ceil(targetDuration / clipDuration) - 1)
    await runFFmpeg([
      '-y', '-stream_loop', String(loopCount), '-i', inputPath,
      '-t', String(targetDuration), ...buildEncodeArgs(), outputPath,
    ], 'loop-fallback', inputPath)
    return { crossfades: 0, reps: loopCount + 1 }
  }

  const inputArgs = []
  for (let i = 0; i < reps; i++) inputArgs.push('-i', inputPath)

  const transitions = ['fade', 'dissolve']
  const labels = []
  let filter = ''

  for (let i = 0; i < reps; i++) {
    const isInterior = i > 0 && i < reps - 1
    const jitter = isInterior ? Math.random() * Math.min(0.15, crossfadeDuration * 0.5) : 0
    const label = `s${i}`
    filter += jitter > 0.01
      ? `[${i}:v]trim=start=${jitter.toFixed(3)},setpts=PTS-STARTPTS[${label}];`
      : `[${i}:v]setpts=PTS-STARTPTS[${label}];`
    labels.push(label)
  }

  let cumulative = clipDuration
  let lastLabel = labels[0]
  let crossfadeCount = 0

  for (let i = 1; i < reps; i++) {
    const offset = Math.max(0, cumulative - crossfadeDuration)
    const outLabel = i === reps - 1 ? 'vraw' : `x${i}`
    const transition = transitions[i % transitions.length]
    filter += `[${lastLabel}][${labels[i]}]xfade=transition=${transition}:duration=${crossfadeDuration.toFixed(3)}:offset=${offset.toFixed(3)}[${outLabel}];`
    cumulative = cumulative + clipDuration - crossfadeDuration
    lastLabel = outLabel
    crossfadeCount++
  }

  filter += `[${lastLabel}]` + [
    `scale=${TARGET_WIDTH}:${TARGET_HEIGHT}:force_original_aspect_ratio=increase`,
    `crop=${TARGET_WIDTH}:${TARGET_HEIGHT}`,
    `fps=${TARGET_FPS}`,
    'format=yuv420p',
    'setsar=1:1',
  ].join(',') + '[vfinal]'

  await runFFmpeg([
    '-y',
    ...inputArgs,
    '-filter_complex', filter,
    '-map', '[vfinal]',
    '-t', String(targetDuration),
    '-c:v', 'libx264',
    '-profile:v', 'baseline',
    '-level:v', '3.0',
    '-preset', 'ultrafast',
    '-crf', '28',
    '-pix_fmt', 'yuv420p',
    '-r', String(TARGET_FPS),
    '-an',
    '-movflags', '+faststart',
    outputPath,
  ], 'loop-crossfade', inputPath)

  return { crossfades: crossfadeCount, reps }
}

// ── SLOW strategy: slow playback by at most 10% (Step 4 speed limits). If that alone can't ──
// close the gap to targetDuration, close the remainder with a single seamless crossfaded
// loop of the (already slowed) clip — never a frozen last frame.
async function encodeSlowed(inputPath, outputPath, clipDuration, targetDuration) {
  const desiredSpeed = clipDuration / targetDuration
  const appliedSpeed = Math.min(1.0, Math.max(MIN_SPEED, desiredSpeed))
  const slowedDuration = clipDuration / appliedSpeed
  const ptsMultiplier = 1 / appliedSpeed

  const vf = [
    `setpts=${ptsMultiplier.toFixed(6)}*PTS`,
    `scale=${TARGET_WIDTH}:${TARGET_HEIGHT}:force_original_aspect_ratio=increase`,
    `crop=${TARGET_WIDTH}:${TARGET_HEIGHT}`,
    `fps=${TARGET_FPS}`,
    'format=yuv420p',
    'setsar=1:1',
  ].join(',')

  const encodeTail = [
    '-c:v', 'libx264', '-profile:v', 'baseline', '-level:v', '3.0',
    '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p',
    '-r', String(TARGET_FPS), '-an', '-movflags', '+faststart',
  ]

  if (slowedDuration >= targetDuration - 0.02) {
    await runFFmpeg([
      '-y', '-i', inputPath, '-vf', vf, '-t', String(targetDuration), ...encodeTail, outputPath,
    ], 'slow-trim', inputPath)
    return { appliedSpeed, extended: false }
  }

  const slowedTemp = `${outputPath}.slowed.mp4`
  await runFFmpeg(['-y', '-i', inputPath, '-vf', vf, ...encodeTail, slowedTemp], 'slow', inputPath)

  try {
    const { crossfades, reps } = await runLoopedCrossfade(slowedTemp, outputPath, slowedDuration, targetDuration)
    return { appliedSpeed, extended: true, crossfades, reps }
  } finally {
    await fs.remove(slowedTemp).catch(() => {})
  }
}

// ── DOWNLOAD_MORE strategy: fetch one additional stock clip for the same keyword, ──
// normalize both to identical params, and concat them into a single combined source.
// Returns null (caller falls back to LOOP_WITH_CROSSFADE) if no keyword/jobDir was
// provided or the download fails — this strategy is opportunistic, never required.
async function tryStrategyD(inputPath, keyword, jobDir) {
  const extraDir = path.join(jobDir, 'strategy_d')
  await fs.ensureDir(extraDir)

  const rawExtraPath = path.join(extraDir, `extra_${uuidv4().slice(0, 8)}.mp4`)
  try {
    await withRetry(() => downloadOneClip(keyword, rawExtraPath, true),
      { attempts: 2, label: `Strategy D extra clip (keyword: "${keyword}")` })
  } catch (err) {
    console.warn(`[V2] Strategy D: could not fetch an additional clip for "${keyword}": ${err.message}`)
    return null
  }

  if (fileSize(rawExtraPath) < 100000) {
    console.warn('[V2] Strategy D: downloaded extra clip looked invalid (too small) — discarding')
    return null
  }

  const baseA = path.join(extraDir, 'base_a.mp4')
  const baseB = path.join(extraDir, 'base_b.mp4')
  try {
    await normalizeClip(inputPath, baseA)
    await normalizeClip(rawExtraPath, baseB)
  } catch (err) {
    console.warn(`[V2] Strategy D: failed to normalize clips before merge: ${err.message}`)
    return null
  }

  const combinedPath   = path.join(extraDir, 'combined.mp4')
  const concatListPath = path.join(extraDir, 'concat_extra.txt')
  fsSync.writeFileSync(
    concatListPath,
    [baseA, baseB].map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n') + '\n',
    'utf8'
  )

  try {
    await runFFmpeg([
      '-y', '-f', 'concat', '-safe', '0', '-i', concatListPath,
      '-c', 'copy', '-movflags', '+faststart', combinedPath,
    ], 'strategy-d-concat', concatListPath)
  } catch (err) {
    console.warn(`[V2] Strategy D: failed to merge original + extra clip: ${err.message}`)
    return null
  }

  if (!fsSync.existsSync(combinedPath) || fileSize(combinedPath) === 0) return null
  return combinedPath
}

// ── STEP 3: normalize ONE clip to an exact target duration via the strategy engine above, ──
// then apply the standard 720x1280/25fps/H264 baseline/yuv420p/no-audio normalization.
// `options.keyword` + `options.jobDir` are optional — without them, DOWNLOAD_MORE simply
// falls back to LOOP_WITH_CROSSFADE, so every existing call site keeps working unchanged.
async function normalizeClipDuration(inputPath, outputPath, targetDuration, options = {}) {
  if (!fsSync.existsSync(inputPath)) {
    throw new Error(`[V2] normalizeClipDuration: input clip does not exist: ${inputPath}`)
  }
  if (!(targetDuration > 0)) {
    throw new Error(`[V2] normalizeClipDuration: invalid target duration ${targetDuration} for ${inputPath}`)
  }

  const { keyword, jobDir, sceneLabel, _downloadAttempted } = options

  let clipDuration
  try {
    clipDuration = (await analyzeClip(inputPath)).duration
  } catch (err) {
    throw new Error(`[V2] normalizeClipDuration: could not analyze ${inputPath}: ${err.message}`)
  }

  const strategy = classifyStrategy(clipDuration, targetDuration)
  const label = sceneLabel != null ? `Scene ${sceneLabel}` : path.basename(inputPath)

  console.log(
    `[V2] ${label}\n` +
    `[V2]   Clip duration: ${clipDuration.toFixed(2)}s\n` +
    `[V2]   Target duration: ${targetDuration.toFixed(2)}s\n` +
    `[V2]   Strategy: ${strategy}`
  )

  try {
    switch (strategy) {
      case STRATEGIES.TRIM: {
        await runFFmpeg([
          '-y', '-i', inputPath, '-t', String(targetDuration), ...buildEncodeArgs(), outputPath,
        ], 'trim', inputPath)
        break
      }

      case STRATEGIES.SLOW: {
        const result = await encodeSlowed(inputPath, outputPath, clipDuration, targetDuration)
        if (result.extended) {
          console.log(`[V2]   Speed: ${(result.appliedSpeed * 100).toFixed(1)}% (capped) + loop to close gap\n[V2]   Loops: ${result.reps}\n[V2]   Crossfades: ${result.crossfades}`)
        } else {
          console.log(`[V2]   Speed: ${(result.appliedSpeed * 100).toFixed(1)}%`)
        }
        break
      }

      case STRATEGIES.LOOP_WITH_CROSSFADE: {
        const { crossfades, reps } = await runLoopedCrossfade(inputPath, outputPath, clipDuration, targetDuration)
        console.log(`[V2]   Loops: ${reps}\n[V2]   Crossfades: ${crossfades}`)
        break
      }

      case STRATEGIES.DOWNLOAD_MORE: {
        const merged = (!_downloadAttempted && keyword && jobDir)
          ? await tryStrategyD(inputPath, keyword, jobDir)
          : null

        if (merged) {
          console.log(`[V2]   Downloaded extra clip for "${keyword}" — merging and re-evaluating strategy`)
          return normalizeClipDuration(merged, outputPath, targetDuration, { ...options, _downloadAttempted: true })
        }

        console.log('[V2]   No extra clip available — falling back to LOOP_WITH_CROSSFADE')
        const { crossfades, reps } = await runLoopedCrossfade(inputPath, outputPath, clipDuration, targetDuration)
        console.log(`[V2]   Loops: ${reps}\n[V2]   Crossfades: ${crossfades}`)
        break
      }
    }
  } catch (err) {
    throw new Error(`[V2] normalizeClipDuration failed for ${inputPath} -> ${outputPath}: ${err.message}`)
  }

  if (!fsSync.existsSync(outputPath) || fileSize(outputPath) === 0) {
    throw new Error(`[V2] normalizeClipDuration produced no output for ${inputPath} -> ${outputPath}`)
  }

  return outputPath
}

// ── STEP 3: allocate a per-scene target duration via the timing engine, then normalize every clip to it ──
// `keywordsForTiming` (optional, 1:1 with rawClipPaths) feeds the DOWNLOAD_MORE strategy so it
// knows what to search for; omitted entirely for callers that supply raw paths with no scene context.
async function prepareTimeline(rawClipPaths, jobDir, durationMinutes, scenesForTiming, keywordsForTiming) {
  if (!rawClipPaths || rawClipPaths.length === 0) {
    throw new Error('[V2] prepareTimeline: no raw clips provided')
  }

  const totalSecs = Math.round((durationMinutes || 3) * 60)

  // scenesForTiming (from downloadSceneClips) lines up 1:1 with rawClipPaths.
  // Callers that hand in rawClipPaths directly (no scene text) fall back to
  // content-less scene stubs, which the 'weighted' strategy reduces to an
  // equal split — identical to the old behaviour.
  const scenesInput = (Array.isArray(scenesForTiming) && scenesForTiming.length === rawClipPaths.length)
    ? scenesForTiming
    : rawClipPaths.map((_, i) => ({ scene_number: i + 1 }))

  const timing = calculateSceneTiming({ scenes: scenesInput, narrationDuration: totalSecs })

  console.log(
    `[V2] Scene timing: [${timing.map(t => t.duration.toFixed(2)).join('s, ')}s] ` +
    `(${totalSecs}s total / ${rawClipPaths.length} scenes)`
  )

  const normalizedDir = path.join(jobDir, 'normalized')
  await fs.ensureDir(normalizedDir)

  const normalizedPaths = []

  for (let i = 0; i < rawClipPaths.length; i++) {
    const rawPath = rawClipPaths[i]
    const outPath = path.join(normalizedDir, `clip_${i}.mp4`)
    const targetDuration = timing[i]?.duration ?? (totalSecs / rawClipPaths.length)
    const keyword = Array.isArray(keywordsForTiming) ? keywordsForTiming[i] : undefined
    const sceneLabel = scenesInput[i]?.scene_number ?? (i + 1)

    console.log(`[V2] Normalizing clip ${i + 1}/${rawClipPaths.length}...`)
    await normalizeClipDuration(rawPath, outPath, targetDuration, { keyword, jobDir, sceneLabel })
    normalizedPaths.push(outPath)
  }

  console.log('[V2] Timeline ready')

  return normalizedPaths
}

// ── Normalize every downloaded clip sequentially into <jobDir>/normalized/ (fixed-duration variant, kept for compatibility) ──
async function normalizeAllClips(rawClipPaths, jobDir) {
  if (!rawClipPaths || rawClipPaths.length === 0) {
    throw new Error('[V2] normalizeAllClips: no raw clips provided')
  }

  const normalizedDir = path.join(jobDir, 'normalized')
  await fs.ensureDir(normalizedDir)

  const normalizedPaths = []

  for (let i = 0; i < rawClipPaths.length; i++) {
    const rawPath = rawClipPaths[i]
    const outPath = path.join(normalizedDir, `clip_${i}.mp4`)

    console.log(`[V2] Normalizing clip ${i + 1}/${rawClipPaths.length}...`)
    await normalizeClip(rawPath, outPath)
    normalizedPaths.push(outPath)
  }

  return normalizedPaths
}

// ── STEP 3: build concat.txt referencing ONLY normalized clips ──
function buildConcatList(normalizedPaths, jobDir) {
  if (!normalizedPaths || normalizedPaths.length === 0) {
    throw new Error('[V2] buildConcatList: no normalized clips provided')
  }

  console.log('[V2] Building concat...')

  const concatPath = path.join(jobDir, 'concat.txt')
  const lines = normalizedPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`)
  fsSync.writeFileSync(concatPath, lines.join('\n') + '\n', 'utf8')

  return concatPath
}

// ── STEP 4: concatenate normalized clips into merged.mp4 (stream copy, since all clips share identical params) ──
async function concatNormalizedClips(concatPath, jobDir) {
  if (!fsSync.existsSync(concatPath)) {
    throw new Error(`[V2] concatNormalizedClips: concat list not found: ${concatPath}`)
  }

  console.log('[V2] Concatenating...')

  const mergedPath = path.join(jobDir, 'merged.mp4')

  try {
    await runFFmpeg([
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatPath,
      '-c', 'copy',
      '-movflags', '+faststart',
      mergedPath,
    ], 'concat-copy', concatPath)
  } catch (copyErr) {
    console.warn(`[V2] Concat via stream copy failed, retrying with re-encode: ${copyErr.message}`)
    try {
      await runFFmpeg([
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatPath,
        '-c:v', 'libx264',
        '-profile:v', 'baseline',
        '-level:v', '3.0',
        '-preset', 'ultrafast',
        '-crf', '28',
        '-pix_fmt', 'yuv420p',
        '-r', String(TARGET_FPS),
        '-movflags', '+faststart',
        mergedPath,
      ], 'concat-reencode', concatPath)
    } catch (reencodeErr) {
      throw new Error(
        `[V2] concatNormalizedClips failed on both copy and re-encode paths.\n` +
        `Copy error: ${copyErr.message}\nRe-encode error: ${reencodeErr.message}`
      )
    }
  }

  if (!fsSync.existsSync(mergedPath) || fileSize(mergedPath) === 0) {
    throw new Error(`[V2] concatNormalizedClips produced no output: ${mergedPath}`)
  }

  return mergedPath
}

// ── Transitions: validate/clamp the requested mode + duration (default: none, 0.5s) ──
const VALID_TRANSITIONS = new Set(['none', 'fade', 'crossfade'])
function resolveTransition(transition, transitionDuration) {
  const t = VALID_TRANSITIONS.has(transition) ? transition : 'none'
  let d = Number(transitionDuration)
  if (!isFinite(d)) d = 0.5
  d = Math.min(1.0, Math.max(0.25, d))
  return { transition: t, transitionDuration: d }
}

// ── V2.3 Cinematic Transition Engine integration — fully opt-in ──────────────
// Resolves whether the Transition Engine should run for this render, and if so
// which style. Backward compatibility is the whole point of this function:
//   - transitionStyle omitted/null   -> null (engine untouched — pre-V2.3 path)
//   - transitionStyle === 'none'     -> null (explicit opt-out)
//   - transitionDuration === 0       -> null (explicit opt-out, either system)
//   - a recognized style             -> that style
//   - anything else while opted in   -> 'auto' (documented default)
// Existing callers that never pass transitionStyle at all get case 1 on every
// render, so nothing about their behavior changes.
const TRANSITION_ENGINE_STYLES = new Set([
  'auto', 'fade', 'dissolve', 'cut', 'slide-left', 'slide-right',
  'zoom-in', 'zoom-out', 'blur-fade', 'flash', 'dip-to-black',
])

function resolveTransitionEngineStyle(transitionStyle, transitionDuration) {
  if (transitionStyle === undefined || transitionStyle === null) return null
  if (transitionStyle === 'none') return null
  if (Number(transitionDuration) === 0) return null
  if (TRANSITION_ENGINE_STYLES.has(transitionStyle)) return transitionStyle
  return 'auto'
}

// ── Transitions ('fade' mode): bake fade-in/out into each clip, then concat via demuxer as usual ──
async function applyFadeTransitions(normalizedPaths, jobDir, transitionDuration) {
  if (!normalizedPaths || normalizedPaths.length < 2) return normalizedPaths

  console.log(`[V2] Applying fade transitions (${transitionDuration}s)...`)

  const fadedDir = path.join(jobDir, 'normalized_fade')
  await fs.ensureDir(fadedDir)

  const fadedPaths = []

  for (let i = 0; i < normalizedPaths.length; i++) {
    const inputPath  = normalizedPaths[i]
    const outputPath = path.join(fadedDir, `clip_${i}.mp4`)
    const duration   = await getClipDuration(inputPath)

    const filters = []
    if (i > 0) filters.push(`fade=t=in:st=0:d=${transitionDuration}`)
    if (i < normalizedPaths.length - 1) {
      const fadeOutStart = Math.max(0, duration - transitionDuration)
      filters.push(`fade=t=out:st=${fadeOutStart.toFixed(3)}:d=${transitionDuration}`)
    }

    if (filters.length === 0) {
      fadedPaths.push(inputPath)
      continue
    }

    await runFFmpeg([
      '-y',
      '-i', inputPath,
      '-vf', filters.join(','),
      '-c:v', 'libx264',
      '-profile:v', 'baseline',
      '-level:v', '3.0',
      '-preset', 'ultrafast',
      '-crf', '28',
      '-pix_fmt', 'yuv420p',
      '-r', String(TARGET_FPS),
      '-an',
      '-movflags', '+faststart',
      outputPath,
    ], 'fade-transition', inputPath)

    fadedPaths.push(outputPath)
  }

  return fadedPaths
}

// ── Detect whether the resolved FFmpeg build supports the `xfade` filter (added in FFmpeg 4.3 — ──
// older bundled/system builds silently error out otherwise). Result is cached for the process lifetime.
let _xfadeSupported
async function ffmpegSupportsXfade() {
  if (_xfadeSupported !== undefined) return _xfadeSupported

  return new Promise((resolve) => {
    let proc
    try {
      proc = spawn(FFMPEG_BIN, ['-hide_banner', '-filters'], { stdio: ['ignore', 'pipe', 'ignore'] })
    } catch {
      _xfadeSupported = false
      return resolve(false)
    }

    let out = ''
    proc.stdout.on('data', d => { out += d.toString() })
    proc.on('close', () => {
      _xfadeSupported = /\bxfade\b/.test(out)
      resolve(_xfadeSupported)
    })
    proc.on('error', () => {
      _xfadeSupported = false
      resolve(false)
    })
  })
}

// ── Transitions ('crossfade' mode): chain xfade filters across all clips, producing merged.mp4 directly. ──
// Falls back to 'fade' mode automatically if the resolved FFmpeg build lacks the xfade filter.
async function concatWithCrossfade(normalizedPaths, jobDir, transitionDuration) {
  if (!normalizedPaths || normalizedPaths.length === 0) {
    throw new Error('[V2] concatWithCrossfade: no normalized clips provided')
  }

  const mergedPath = path.join(jobDir, 'merged.mp4')

  if (normalizedPaths.length === 1) {
    await fs.copy(normalizedPaths[0], mergedPath)
    return mergedPath
  }

  if (!(await ffmpegSupportsXfade())) {
    console.warn('[V2] Crossfade: xfade filter not supported by this FFmpeg build — falling back to fade transitions')
    const faded = await applyFadeTransitions(normalizedPaths, jobDir, transitionDuration)
    const concatPath = buildConcatList(faded, jobDir)
    return concatNormalizedClips(concatPath, jobDir)
  }

  console.log(`[V2] Building crossfade timeline (${transitionDuration}s transitions)...`)

  const durations = []
  for (const p of normalizedPaths) durations.push(await getClipDuration(p))

  const inputArgs = []
  normalizedPaths.forEach(p => { inputArgs.push('-i', p) })

  let filter = ''
  let cumulative = durations[0]
  let lastLabel = '0'

  for (let i = 1; i < normalizedPaths.length; i++) {
    const offset   = Math.max(0, cumulative - transitionDuration)
    const outLabel = i === normalizedPaths.length - 1 ? 'vout' : `v${i}`
    filter += `[${lastLabel}][${i}:v]xfade=transition=fade:duration=${transitionDuration}:offset=${offset.toFixed(3)}[${outLabel}];`
    cumulative = cumulative + durations[i] - transitionDuration
    lastLabel = outLabel
  }
  filter = filter.replace(/;$/, '')

  try {
    await runFFmpeg([
      '-y',
      ...inputArgs,
      '-filter_complex', filter,
      '-map', `[${lastLabel}]`,
      '-c:v', 'libx264',
      '-profile:v', 'baseline',
      '-level:v', '3.0',
      '-preset', 'ultrafast',
      '-crf', '28',
      '-pix_fmt', 'yuv420p',
      '-r', String(TARGET_FPS),
      '-movflags', '+faststart',
      mergedPath,
    ], 'crossfade-concat', jobDir)
  } catch (err) {
    throw new Error(`[V2] concatWithCrossfade failed: ${err.message}`)
  }

  if (!fsSync.existsSync(mergedPath) || fileSize(mergedPath) === 0) {
    throw new Error(`[V2] concatWithCrossfade produced no output: ${mergedPath}`)
  }

  return mergedPath
}

// ── Voice sync: extend (loop ONLY the last scene) or trim the final video to match narration exactly ──
// Never stretches timestamps, never touches audio speed/pitch.
async function syncVideoToVoice(mergedPath, voicePath, lastClipPath, jobDir) {
  if (!voicePath || !fsSync.existsSync(voicePath)) return mergedPath

  const videoDuration = await getClipDuration(mergedPath)
  const voiceDuration  = await getClipDuration(voicePath)
  const delta = voiceDuration - videoDuration

  console.log(
    `[V2] Voice sync: video=${videoDuration.toFixed(3)}s voice=${voiceDuration.toFixed(3)}s delta=${delta.toFixed(3)}s`
  )

  if (Math.abs(delta) < 0.05) {
    console.log('[V2] Voice sync: durations already aligned, no adjustment needed')
    return mergedPath
  }

  const syncedPath = path.join(jobDir, 'merged_synced.mp4')

  if (delta > 0) {
    console.log(`[V2] Voice sync: extending video by looping last scene (+${delta.toFixed(3)}s)`)

    if (!lastClipPath || !fsSync.existsSync(lastClipPath)) {
      throw new Error('[V2] syncVideoToVoice: cannot extend — last normalized clip is unavailable')
    }

    const extensionPath = path.join(jobDir, 'extension.mp4')
    await normalizeClipDuration(lastClipPath, extensionPath, delta)

    const extendConcatPath = path.join(jobDir, 'concat_extend.txt')
    const lines = [mergedPath, extensionPath].map(p => `file '${p.replace(/'/g, "'\\''")}'`)
    fsSync.writeFileSync(extendConcatPath, lines.join('\n') + '\n', 'utf8')

    await runFFmpeg([
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', extendConcatPath,
      '-c', 'copy',
      '-movflags', '+faststart',
      syncedPath,
    ], 'voice-sync-extend', mergedPath)
  } else {
    console.log(`[V2] Voice sync: trimming video to narration length (${voiceDuration.toFixed(3)}s)`)

    await runFFmpeg([
      '-y',
      '-i', mergedPath,
      '-t', String(voiceDuration),
      '-c:v', 'libx264',
      '-profile:v', 'baseline',
      '-level:v', '3.0',
      '-preset', 'ultrafast',
      '-crf', '28',
      '-pix_fmt', 'yuv420p',
      '-r', String(TARGET_FPS),
      '-movflags', '+faststart',
      syncedPath,
    ], 'voice-sync-trim', mergedPath)
  }

  if (!fsSync.existsSync(syncedPath) || fileSize(syncedPath) === 0) {
    throw new Error(`[V2] syncVideoToVoice produced no output: ${syncedPath}`)
  }

  return syncedPath
}

// ── STEP 5: merge voice track, or pass merged.mp4 through as movie.mp4 ──
async function mergeVoiceTrack(mergedPath, voicePath, jobDir) {
  console.log('[V2] Voice merge...')

  const moviePath = path.join(jobDir, 'movie.mp4')

  if (!voicePath || !fsSync.existsSync(voicePath)) {
    console.log('[V2] No voice track provided — movie.mp4 = merged.mp4')
    await fs.copy(mergedPath, moviePath)
    return moviePath
  }

  try {
    await runFFmpeg([
      '-y',
      '-i', mergedPath,
      '-i', voicePath,
      '-map', '0:v:0',
      '-map', '1:a:0',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-ar', '44100',
      '-shortest',
      '-movflags', '+faststart',
      moviePath,
    ], 'voice-merge', voicePath)
  } catch (err) {
    throw new Error(`[V2] mergeVoiceTrack failed for ${mergedPath} + ${voicePath}: ${err.message}`)
  }

  if (!fsSync.existsSync(moviePath) || fileSize(moviePath) === 0) {
    throw new Error(`[V2] mergeVoiceTrack produced no output: ${moviePath}`)
  }

  return moviePath
}

// ── STEP 7 + 8: validate the final movie via ffprobe BEFORE any upload happens ──
async function validateFinalMovie(moviePath, expectedDurationSecs) {
  console.log('[V2] Validation')

  if (!fsSync.existsSync(moviePath)) {
    throw new Error(`[V2] Validation failed: movie file does not exist: ${moviePath}`)
  }
  const size = fileSize(moviePath)
  if (size <= 0) {
    throw new Error(`[V2] Validation failed: movie file is empty: ${moviePath}`)
  }

  const info = await probeMovie(moviePath)
  console.log(
    `[V2] Validation probe: ${info.width}x${info.height} | ${info.fps.toFixed(2)}fps | ` +
    `${info.codec} | ${info.pixFmt} | ${info.duration.toFixed(3)}s`
  )

  const errors = []
  if (info.width !== TARGET_WIDTH || info.height !== TARGET_HEIGHT) {
    errors.push(`resolution mismatch: expected ${TARGET_WIDTH}x${TARGET_HEIGHT}, got ${info.width}x${info.height}`)
  }
  if (Math.round(info.fps) !== TARGET_FPS) {
    errors.push(`fps mismatch: expected ${TARGET_FPS}, got ${info.fps.toFixed(2)}`)
  }
  if (info.codec !== 'h264') {
    errors.push(`codec mismatch: expected h264, got ${info.codec}`)
  }
  if (info.pixFmt !== 'yuv420p') {
    errors.push(`pix_fmt mismatch: expected yuv420p, got ${info.pixFmt}`)
  }
  if (expectedDurationSecs && Math.abs(info.duration - expectedDurationSecs) > 0.5) {
    errors.push(
      `duration mismatch: expected ~${expectedDurationSecs.toFixed(3)}s (±0.5s), got ${info.duration.toFixed(3)}s`
    )
  }

  if (errors.length > 0) {
    throw new Error(`[V2] Validation failed for ${moviePath}:\n- ${errors.join('\n- ')}`)
  }

  console.log('[V2] Validation passed')
  return info
}

// ── STEP 6: reuse the EXISTING caption-burn implementation via its own API (no reimplementation) ──
async function burnCaptions(moviePath, movieId, script, captionOptions = {}) {
  if (!script || !script.trim()) {
    console.log('[V2] Burning captions... skipped (no script provided)')
    return null
  }

  console.log('[V2] Burning captions...')

  const port = process.env.PORT || 3001
  const captionApiUrl = `http://127.0.0.1:${port}/api/burn-captions`

  let tempUpload
  try {
    tempUpload = await uploadMovie(moviePath, `${movieId}_precaption`)
  } catch (err) {
    throw new Error(`[V2] burnCaptions: failed to stage temp upload for caption input: ${err.message}`)
  }

  try {
    const resp = await axios.post(captionApiUrl, {
      video_url: tempUpload.videoUrl,
      script,
      ...captionOptions,
    }, { timeout: 300000 })

    if (!resp.data || !resp.data.video_url) {
      throw new Error(`Caption API returned no video_url: ${JSON.stringify(resp.data)}`)
    }

    return resp.data.video_url
  } catch (err) {
    const detail = err.response ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}` : err.message
    throw new Error(`[V2] burnCaptions: caption API call failed (${captionApiUrl}): ${detail}`)
  }
}

// ── TEMPORARY runtime diagnostics: dump the exact Cloudinary config in effect right before an ──
// upload attempt. Logging only — no behavior/config/retry change. Safe to remove once the
// worker/.env vs. frontend .env.local credential mismatch (see RC7 verification) is resolved.
function logCloudinaryRuntimeDiagnostics(cloudinary) {
  function maskKey(key) {
    if (!key) return undefined
    return key.slice(0, 6) + '*'.repeat(Math.max(0, key.length - 6))
  }

  const resolved = cloudinary.config()

  console.log('================ CLOUDINARY RUNTIME ================')
  console.log('process.env.CLOUDINARY_CLOUD_NAME:', process.env.CLOUDINARY_CLOUD_NAME)
  console.log('process.env.CLOUDINARY_API_KEY (masked):', maskKey(process.env.CLOUDINARY_API_KEY))
  console.log('process.env.CLOUDINARY_API_SECRET exists:', !!process.env.CLOUDINARY_API_SECRET)
  console.log('process.env.CLOUDINARY_URL exists:', !!process.env.CLOUDINARY_URL)
  console.log('cloudinary.config().cloud_name:', resolved.cloud_name)
  console.log('cloudinary.config().api_key:', maskKey(resolved.api_key))
  console.log('====================================================')
}

// ── STEP 7: reuse existing Cloudinary integration to upload the final movie — with automatic retry ──
async function uploadMovie(moviePath, movieId) {
  if (!fsSync.existsSync(moviePath)) {
    throw new Error(`[V2] uploadMovie: file does not exist: ${moviePath}`)
  }

  console.log('[V2] Uploading...')

  const cloudinary = require('cloudinary').v2
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })

  logCloudinaryRuntimeDiagnostics(cloudinary)

  try {
    const uploaded = await withRetry(() => cloudinary.uploader.upload(moviePath, {
      resource_type: 'video',
      folder: 'reelforge/movies',
      public_id: `movie_${movieId ?? 'x'}_final_${Date.now()}`,
      timeout: Number(process.env.V2_CLOUDINARY_TIMEOUT_MS) || 120000,
    }), { label: `Cloudinary upload (${path.basename(moviePath)})` })

    if (!uploaded || !uploaded.secure_url) {
      throw new Error('Cloudinary upload returned no secure_url')
    }

    return { videoUrl: uploaded.secure_url, raw: uploaded }
  } catch (err) {
    logUploadFailureDiagnostics(err, moviePath)
    throw new Error(`[V2] uploadMovie: Cloudinary upload failed for ${moviePath}: ${err.message}`)
  }
}

// ── Detailed diagnostics for a failed Cloudinary upload — logging only, no behavior change. ──
// `err` may be the wrapped withRetry error; its `.cause` (if present) is the original
// axios/Cloudinary SDK error, which is what actually carries response/http_code detail.
function logUploadFailureDiagnostics(err, moviePath) {
  const original = err && err.cause ? err.cause : err

  const apiKey = process.env.CLOUDINARY_API_KEY || ''

  console.error('----------------------------------------')
  console.error('UPLOAD FAILED')
  console.error('----------------------------------------')
  console.error('File:', moviePath)
  console.error('Status:', original?.response?.status)
  console.error('Status Text:', original?.response?.statusText)
  console.error('Request URL:', original?.config?.url)
  console.error('Response Headers:', original?.response?.headers ? JSON.stringify(original.response.headers) : undefined)
  console.error('Response Body:', original?.response?.data ? JSON.stringify(original.response.data) : undefined)
  console.error('Stack:', original?.stack)
  console.error('Cloudinary Cloud Name:', process.env.CLOUDINARY_CLOUD_NAME)
  console.error('Cloudinary API Key (first 8 digits only):', apiKey ? apiKey.slice(0, 8) : undefined)
  console.error('Whether CLOUDINARY_URL exists:', !!process.env.CLOUDINARY_URL)
  console.error('----------------------------------------')
  console.error('Cloudinary SDK error fields:')
  console.error('  http_code:', original?.http_code)
  console.error('  message:', original?.message)
  console.error('  name:', original?.name)
  console.error('----------------------------------------')
}

// ── cleanup temp job directory (downloads/, normalized/, concat.txt, merged.mp4, voice.wav, everything) ──
async function cleanup(jobDir) {
  console.log('[V2] Cleanup')
  try {
    await fs.remove(jobDir)
    console.log(`[V2] Cleanup: removed ${jobDir}`)
  } catch (err) {
    console.warn(`[V2] Cleanup failed for ${jobDir} (non-fatal): ${err.message}`)
  }
}

// ── Full pipeline orchestration ──
// Accepts EITHER pre-downloaded `rawClipPaths`, OR `scenes` (+ optional voice_url / voice_data)
// in which case MovieAssemblerV2 performs the download itself (Step 1).
// `transitionStyle` (V2.3, optional): 'auto' | 'fade' | 'dissolve' | 'cut' | 'slide-left' |
// 'slide-right' | 'zoom-in' | 'zoom-out' | 'blur-fade' | 'flash' | 'dip-to-black' | 'none'.
// Omitted entirely (existing callers), 'none', or transitionDuration === 0 all mean the
// pre-V2.3 merge path runs exactly as before — see resolveTransitionEngineStyle.
async function assembleMovie({
  rawClipPaths, scenes, movie_id, movieId, jobDir, voicePath, voice_url, voice_data, duration_minutes,
  transition, transitionDuration, transitionStyle, captionScript, captionOptions, onProgress, sendProgress,
}) {
  const progress = (data) => {
    if (typeof onProgress === 'function') onProgress(data)
    if (typeof sendProgress === 'function') sendProgress(data)
  }
  const resolvedMovieId = movieId ?? movie_id
  const resolvedJobDir  = jobDir || path.join(os.tmpdir(), `movie_${uuidv4().slice(0, 8)}`)
  const { transition: resolvedTransition, transitionDuration: resolvedTransitionDuration } =
    resolveTransition(transition, transitionDuration)
  const transitionEngineStyle = resolveTransitionEngineStyle(transitionStyle, transitionDuration)

  let resolvedRawClipPaths = rawClipPaths
  let resolvedVoicePath    = voicePath
  let completedScenes      = []
  let scenesForTiming      = null
  let keywordsForTiming    = null

  const timings   = {}
  const startedAt = Date.now()
  const cpuStart  = process.cpuUsage()

  await fs.ensureDir(resolvedJobDir)

  try {
    // ── Download ────────────────────────────────────────────────────────────
    console.log('[V2] Download')
    const downloadStart = Date.now()

    if (scenes && scenes.length) {
      const clipEntries = await downloadSceneClips(scenes, resolvedJobDir, progress)
      resolvedRawClipPaths = clipEntries.map(c => c.path)
      completedScenes = clipEntries.map(c => ({ scene_number: c.scene.scene_number, keyword: c.keyword }))
      scenesForTiming = clipEntries.map(c => c.scene)
      keywordsForTiming = clipEntries.map(c => c.keyword)

      if (!resolvedVoicePath) {
        const audioSource = voice_url || voice_data
        resolvedVoicePath = await downloadVoiceTrack(audioSource, resolvedJobDir)
      }
    } else {
      progress({ type: 'progress', pct: 5, message: 'Clips already downloaded, starting normalization...' })
      // rawClipPaths supplied directly by the caller — no behaviour change to existing download logic.
    }

    if (!resolvedRawClipPaths || resolvedRawClipPaths.length === 0) {
      throw new Error('[V2] assembleMovie: no raw clips available (provide rawClipPaths or scenes)')
    }

    timings.downloadMs = Date.now() - downloadStart
    progress({ type: 'progress', pct: 20, message: 'Normalizing clips...' })

    // ── Normalize + Timeline ───────────────────────────────────────────────
    console.log('[V2] Normalize')
    console.log('[V2] Timeline')
    const normalizeStart = Date.now()

    let normalizedPaths = await prepareTimeline(resolvedRawClipPaths, resolvedJobDir, duration_minutes, scenesForTiming, keywordsForTiming)

    // Scene count preserved / no dropped or duplicated clips (Step 6 validation) —
    // checked once here, upstream of either merge path, since prepareTimeline is
    // the only place clips could structurally go missing.
    if (normalizedPaths.length !== resolvedRawClipPaths.length) {
      throw new Error(
        `[V2] assembleMovie: clip count mismatch after normalization — ${resolvedRawClipPaths.length} in, ${normalizedPaths.length} out`
      )
    }

    // The Transition Engine bakes its own transitions in during rendering below —
    // skip the legacy pre-bake so a caller that (unusually) sets both the old
    // `transition: 'fade'` and a new `transitionStyle` doesn't get double transitions.
    if (resolvedTransition === 'fade' && !transitionEngineStyle) {
      normalizedPaths = await applyFadeTransitions(normalizedPaths, resolvedJobDir, resolvedTransitionDuration)
    }

    timings.normalizeMs = Date.now() - normalizeStart
    progress({ type: 'progress', pct: 45, message: 'Timeline ready.' })

    // ── Render (concat / crossfade / Cinematic Transition Engine) ──────────
    console.log('[V2] Render')
    const renderStart = Date.now()

    let mergedPath
    let actualRenderedDuration = null

    if (transitionEngineStyle) {
      const sceneDurations = await Promise.all(normalizedPaths.map(p => getClipDuration(p)))
      const transitionScenes = normalizedPaths.map((_, i) => {
        const base = (scenesForTiming && scenesForTiming[i]) || {}
        return { ...base, scene_number: base.scene_number ?? (i + 1), duration: sceneDurations[i] }
      })

      const transitionGraph = buildTransitionGraph({
        scenes: transitionScenes,
        transitionStyle: transitionEngineStyle,
        transitionDuration,
      })

      mergedPath = path.join(resolvedJobDir, 'merged.mp4')
      const renderResult = await renderTransitionChain(normalizedPaths, transitionGraph, mergedPath)
      actualRenderedDuration = renderResult.actualDuration

      console.log(
        `[V2] Transition Engine Enabled\n` +
        `[V2]   Style: ${transitionEngineStyle}\n` +
        `[V2]   Transitions Applied: ${transitionGraph.transitions.length}\n` +
        `[V2]   Render Duration: ${transitionGraph.totalDuration.toFixed(2)} sec\n` +
        `[V2]   Actual Output: ${actualRenderedDuration.toFixed(2)} sec` +
        (renderResult.downgradedToHardCuts ? '\n[V2]   (xfade unsupported by this FFmpeg build — rendered as hard cuts)' : '')
      )
    } else if (resolvedTransition === 'crossfade') {
      mergedPath = await concatWithCrossfade(normalizedPaths, resolvedJobDir, resolvedTransitionDuration)
    } else {
      const concatPath = buildConcatList(normalizedPaths, resolvedJobDir)
      mergedPath = await concatNormalizedClips(concatPath, resolvedJobDir)
    }

    timings.renderMs = Date.now() - renderStart
    progress({ type: 'progress', pct: 65, message: 'Clips concatenated.' })

    // ── Voice sync + merge ──────────────────────────────────────────────────
    console.log('[V2] Voice')
    const voiceStart = Date.now()

    const syncedMergedPath = await syncVideoToVoice(
      mergedPath, resolvedVoicePath, normalizedPaths[normalizedPaths.length - 1], resolvedJobDir
    )
    const moviePathPreCaption = await mergeVoiceTrack(syncedMergedPath, resolvedVoicePath, resolvedJobDir)

    timings.voiceMs = Date.now() - voiceStart
    progress({ type: 'progress', pct: 82, message: 'Voice track merged.' })

    // ── Validation — MUST pass before any upload, captioned or not ─────────
    const expectedDuration = (resolvedVoicePath && fsSync.existsSync(resolvedVoicePath))
      ? await getClipDuration(resolvedVoicePath)
      : await getClipDuration(moviePathPreCaption)

    await validateFinalMovie(moviePathPreCaption, expectedDuration)

    // ── Captions ─────────────────────────────────────────────────────────
    console.log('[V2] Captions')
    progress({ type: 'progress', pct: 90, message: 'Burning captions...' })
    const captionedUrl = await burnCaptions(moviePathPreCaption, resolvedMovieId, captionScript, captionOptions)

    let videoUrl
    if (captionedUrl) {
      videoUrl = captionedUrl
    } else {
      console.log('[V2] Upload')
      const uploadStart = Date.now()
      progress({ type: 'progress', pct: 96, message: 'Uploading to Cloudinary...' })

      const uploaded = await uploadMovie(moviePathPreCaption, resolvedMovieId)
      timings.uploadMs = Date.now() - uploadStart

      if (!uploaded.videoUrl) {
        throw new Error('[V2] Upload validation failed: Cloudinary returned no URL')
      }

      videoUrl = uploaded.videoUrl
    }

    timings.totalMs = Date.now() - startedAt
    const cpuUsage = process.cpuUsage(cpuStart)
    const memory   = process.memoryUsage()

    console.log(
      `[V2] Health metrics: download=${(timings.downloadMs / 1000).toFixed(2)}s ` +
      `normalize=${(timings.normalizeMs / 1000).toFixed(2)}s ` +
      `render=${(timings.renderMs / 1000).toFixed(2)}s ` +
      `voice=${(timings.voiceMs / 1000).toFixed(2)}s ` +
      `upload=${((timings.uploadMs || 0) / 1000).toFixed(2)}s ` +
      `total=${(timings.totalMs / 1000).toFixed(2)}s ` +
      `memory=${(memory.rss / 1024 / 1024).toFixed(1)}MB ` +
      `cpuUser=${(cpuUsage.user / 1e6).toFixed(2)}s cpuSystem=${(cpuUsage.system / 1e6).toFixed(2)}s`
    )

    console.log('[V2] Finished')

    return { videoUrl, moviePath: moviePathPreCaption, jobDir: resolvedJobDir, completedScenes, timings }
  } finally {
    await cleanup(resolvedJobDir)
  }
}

module.exports = {
  runFFmpeg,
  withRetry,
  getClipDuration,
  probeMovie,
  normalizeClip,
  normalizeClipDuration,
  classifyStrategy,
  computeLoopPlan,
  STRATEGIES,
  normalizeAllClips,
  prepareTimeline,
  buildConcatList,
  concatNormalizedClips,
  resolveTransition,
  resolveTransitionEngineStyle,
  applyFadeTransitions,
  ffmpegSupportsXfade,
  concatWithCrossfade,
  syncVideoToVoice,
  validateFinalMovie,
  mergeVoiceTrack,
  burnCaptions,
  uploadMovie,
  cleanup,
  assembleMovie,
}
