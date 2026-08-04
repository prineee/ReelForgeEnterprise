'use strict'

// ── Camera Motion Engine (V2.6) ─────────────────────────────────────────────
// Applies subtle, cinematic camera movement to an already-normalized clip
// (720x1280 / 25fps / H264 baseline / yuv420p / no audio) via a single FFmpeg
// pass: a time-varying `crop` window (expressions in `t`, seconds) followed by
// a `scale` back to the target frame size. Shrinking the crop window over
// time and rescaling it back up reads as a zoom-in; sliding the crop's x/y
// offset reads as a pan/tilt. This avoids `zoompan`'s well-known frame-timing
// quirks on real (non-still) video sources.
//
// Hard safety caps (never exceeded regardless of caller-supplied intensity):
//   - Zoom:  1.20x maximum
//   - Pan:   15% of frame width/height maximum
// Motion is always centered (zoom) or margin-bounded (pan/tilt), so a
// portrait-framed subject is never pushed out of frame or cropped
// aggressively at the edges.

const { spawn } = require('child_process')
const fsSync     = require('fs')
const { FFMPEG_BIN } = require('./ffmpegUtils')
const { analyzeClip } = require('./clipAnalyzer')

const TARGET_WIDTH  = 720
const TARGET_HEIGHT = 1280
const TARGET_FPS    = 25

// ── Step 3: supported motion types ──────────────────────────────────────────
const MOTION_TYPES = [
  'static', 'push-in', 'push-out', 'slow-zoom',
  'pan-left', 'pan-right', 'tilt-up', 'tilt-down', 'ken-burns',
]

// aiDirector.js emits Title Case labels ('Push In', 'Ken Burns', ...) — this
// map is the single source of truth translating those labels onto the motion
// type strings this engine understands, so callers never hand-roll the
// mapping themselves.
const MOTION_LABEL_TO_TYPE = {
  'Static':    'static',
  'Push In':   'push-in',
  'Push Out':  'push-out',
  'Slow Zoom': 'slow-zoom',
  'Pan Left':  'pan-left',
  'Pan Right': 'pan-right',
  'Tilt Up':   'tilt-up',
  'Tilt Down': 'tilt-down',
  'Ken Burns': 'ken-burns',
}

// ── Motion rules (Step "Motion Rules") ──────────────────────────────────────
const MAX_ZOOM         = 1.20  // maximum zoom factor
const MAX_PAN_FRACTION = 0.15  // maximum pan/tilt offset, as a fraction of width/height

// ── Step 5: platform/preset motion intensity ────────────────────────────────
// Scales how much of the hard-capped zoom/pan budget a render actually uses —
// never the caps themselves. 1.0 = full budget (MAX_ZOOM / MAX_PAN_FRACTION),
// lower values proportionally gentler.
const PLATFORM_INTENSITY = {
  tiktok:           1.0,  // high energy
  'youtube-shorts': 0.9,
  instagram:        0.8,  // medium-high
  facebook:         0.6,
  youtube:          0.5,
  linkedin:         0.3,  // corporate/professional delivery format
}

const PRESET_INTENSITY = {
  advertisement:       0.9,
  cinematic:           0.8,
  motivational:        0.8,
  storytelling:        0.7,
  'product-demo':      0.7,
  documentary:         0.5,  // low
  news:                0.4,
  educational:         0.4,
  corporate:           0.25, // minimal — not an aiDirector preset name, but
                             // honored here in case a caller passes it directly
  'podcast-highlight': 0.4,
}

const DEFAULT_PLATFORM_INTENSITY = 0.6
const DEFAULT_PRESET_INTENSITY   = 0.7
const MIN_INTENSITY              = 0.15 // never fully static by default — a floor, not a cap

/**
 * Resolve a 0..1 motion intensity from the movieStyle (preset) and
 * targetPlatform names produced by aiDirector.createDirectingPlan. Composes
 * multiplicatively (same pattern as aiDirector's own paceMultiplier), then
 * floors at MIN_INTENSITY so "minimal" never means literally zero motion.
 */
function resolveMotionIntensity(movieStyle, targetPlatform) {
  const platformFactor = PLATFORM_INTENSITY[targetPlatform] ?? DEFAULT_PLATFORM_INTENSITY
  const presetFactor    = PRESET_INTENSITY[movieStyle] ?? DEFAULT_PRESET_INTENSITY
  const combined = platformFactor * presetFactor
  return Math.max(MIN_INTENSITY, Math.min(1, combined))
}

function fileSize(p) {
  try { return fsSync.statSync(p).size } catch { return 0 }
}

// ── Reusable FFmpeg runner (mirrors the pattern used by transitionEngine.js ──
// and movieAssemblerV2.js — logs command, captures stderr, hard timeout).
const FFMPEG_TIMEOUT_MS = Number(process.env.V2_FFMPEG_TIMEOUT_MS) || 5 * 60 * 1000

function runFFmpeg(args, label, timeoutMs = FFMPEG_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    console.log(`[CameraMotion] [ffmpeg:${label}] ${FFMPEG_BIN} ${args.join(' ')}`)

    let proc
    try {
      proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    } catch (err) {
      return reject(new Error(`[CameraMotion] FFmpeg failed to spawn for stage "${label}": ${err.message}`))
    }

    let stderr   = ''
    let timedOut = false
    let settled  = false

    const timer = setTimeout(() => {
      timedOut = true
      console.error(`[CameraMotion] FFmpeg stage "${label}" exceeded ${timeoutMs}ms — killing process`)
      proc.kill('SIGKILL')
    }, timeoutMs)

    proc.stdout && proc.stdout.on('data', () => {})
    proc.stderr.on('data', d => { stderr += d.toString() })

    proc.on('error', err => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(`[CameraMotion] FFmpeg process error for stage "${label}": ${err.message}`))
    })

    proc.on('close', (code, signal) => {
      if (settled) return
      settled = true
      clearTimeout(timer)

      if (timedOut) {
        return reject(new Error(
          `[CameraMotion] FFmpeg stage "${label}" timed out after ${timeoutMs}ms and was killed\n` +
          `--- stderr tail ---\n${stderr.slice(-4000)}`
        ))
      }
      if (code === 0) return resolve({ code, stderr })

      reject(new Error(
        `[CameraMotion] FFmpeg stage "${label}" failed — exit code: ${code}, signal: ${signal || 'none'}\n` +
        `--- stderr tail ---\n${stderr.slice(-4000)}`
      ))
    })
  })
}

const ENCODE_TAIL = [
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

// ── Pure filter-graph builder (no I/O) — one time-varying `crop` window per ──
// motion type, expressed in terms of `t` (seconds, provided by FFmpeg per
// frame), followed by a scale back to the fixed target frame size. Exported
// for direct unit testing of the geometry without spawning FFmpeg.
function buildMotionFilter(type, duration, zoomDelta, panFraction, width = TARGET_WIDTH, height = TARGET_HEIGHT) {
  const dur = Math.max(0.1, Number(duration) || 0.1)
  // Commas here are safe unescaped: each expression is wrapped in single
  // quotes at the call site (w='...':h='...'...), which the FFmpeg filtergraph
  // parser treats as a literal span — AVExpr then parses the comma itself as
  // its normal min(x,y) argument separator.
  const P = `min(1,t/${dur.toFixed(3)})`        // 0 -> 1 progress ramp
  const R = `(1-min(1,t/${dur.toFixed(3)}))`    // 1 -> 0 reverse ramp

  let cropW, cropH, x, y

  switch (type) {
    case 'push-in': {
      cropW = `${width}/(1+${zoomDelta.toFixed(4)}*${P})`
      cropH = `${height}/(1+${zoomDelta.toFixed(4)}*${P})`
      x = `(${width}-(${cropW}))/2`
      y = `(${height}-(${cropH}))/2`
      break
    }
    case 'push-out': {
      cropW = `${width}/(1+${zoomDelta.toFixed(4)}*${R})`
      cropH = `${height}/(1+${zoomDelta.toFixed(4)}*${R})`
      x = `(${width}-(${cropW}))/2`
      y = `(${height}-(${cropH}))/2`
      break
    }
    case 'slow-zoom': {
      const d = zoomDelta * 0.6 // gentler, slower ramp than push-in
      cropW = `${width}/(1+${d.toFixed(4)}*${P})`
      cropH = `${height}/(1+${d.toFixed(4)}*${P})`
      x = `(${width}-(${cropW}))/2`
      y = `(${height}-(${cropH}))/2`
      break
    }
    case 'pan-left': {
      cropW = `${width}*(1-${panFraction.toFixed(4)})`
      cropH = `${height}`
      x = `${width}*${panFraction.toFixed(4)}*${R}`
      y = `0`
      break
    }
    case 'pan-right': {
      cropW = `${width}*(1-${panFraction.toFixed(4)})`
      cropH = `${height}`
      x = `${width}*${panFraction.toFixed(4)}*${P}`
      y = `0`
      break
    }
    case 'tilt-up': {
      cropW = `${width}`
      cropH = `${height}*(1-${panFraction.toFixed(4)})`
      x = `0`
      y = `${height}*${panFraction.toFixed(4)}*${R}`
      break
    }
    case 'tilt-down': {
      cropW = `${width}`
      cropH = `${height}*(1-${panFraction.toFixed(4)})`
      x = `0`
      y = `${height}*${panFraction.toFixed(4)}*${P}`
      break
    }
    case 'ken-burns': {
      const kbZoom = zoomDelta * 0.7
      const kbPan  = panFraction * 0.6
      cropW = `${width}/(1+${kbZoom.toFixed(4)}*${P})`
      cropH = `${height}/(1+${kbZoom.toFixed(4)}*${P})`
      x = `(${width}-(${cropW}))/2+${width}*${kbPan.toFixed(4)}*${P}/2`
      y = `(${height}-(${cropH}))/2+${height}*${kbPan.toFixed(4)}*${P}/2`
      break
    }
    default:
      throw new Error(`[CameraMotion] buildMotionFilter: unsupported motion type "${type}"`)
  }

  return [
    `crop=w='${cropW}':h='${cropH}':x='${x}':y='${y}'`,
    `scale=${width}:${height}`,
    'setsar=1:1',
    `fps=${TARGET_FPS}`,
    'format=yuv420p',
  ].join(',')
}

/**
 * applyCameraMotion(inputVideo, outputVideo, motionType, options)
 *
 * options:
 *   - intensity (0..1, default 1): scales zoom/pan magnitude within the hard
 *     caps (MAX_ZOOM / MAX_PAN_FRACTION) — never beyond them, regardless of
 *     what's passed in.
 *   - width / height (default 720x1280): must match the already-normalized
 *     input frame size.
 *
 * Returns { motionType, applied, zoomDelta, panFraction, duration }.
 */
async function applyCameraMotion(inputVideo, outputVideo, motionType, options = {}) {
  if (!fsSync.existsSync(inputVideo)) {
    throw new Error(`[CameraMotion] applyCameraMotion: input clip does not exist: ${inputVideo}`)
  }

  const { intensity = 1, width = TARGET_WIDTH, height = TARGET_HEIGHT } = options
  const type = MOTION_TYPES.includes(motionType) ? motionType : 'static'
  const clampedIntensity = Math.max(0, Math.min(1, Number(intensity)))

  const zoomDelta   = (MAX_ZOOM - 1) * clampedIntensity   // never exceeds MAX_ZOOM - 1 (0.20)
  const panFraction = MAX_PAN_FRACTION * clampedIntensity // never exceeds MAX_PAN_FRACTION (0.15)

  let duration = 0
  try {
    duration = (await analyzeClip(inputVideo)).duration
  } catch (err) {
    throw new Error(`[CameraMotion] applyCameraMotion: could not analyze ${inputVideo}: ${err.message}`)
  }

  if (type === 'static' || !(duration > 0)) {
    await runFFmpeg([
      '-y', '-i', inputVideo,
      '-vf', [`scale=${width}:${height}`, 'setsar=1:1', `fps=${TARGET_FPS}`, 'format=yuv420p'].join(','),
      ...ENCODE_TAIL, outputVideo,
    ], 'motion-static')
  } else {
    const vf = buildMotionFilter(type, duration, zoomDelta, panFraction, width, height)
    try {
      await runFFmpeg(['-y', '-i', inputVideo, '-vf', vf, ...ENCODE_TAIL, outputVideo], `motion-${type}`)
    } catch (err) {
      throw new Error(`[CameraMotion] applyCameraMotion failed for ${inputVideo} -> ${outputVideo} (type=${type}): ${err.message}`)
    }
  }

  if (!fsSync.existsSync(outputVideo) || fileSize(outputVideo) === 0) {
    throw new Error(`[CameraMotion] applyCameraMotion produced no output for ${inputVideo} -> ${outputVideo}`)
  }

  console.log(
    `[CameraMotion] ${motionType} -> ${type} | intensity=${clampedIntensity.toFixed(2)} | ` +
    `zoom=+${(zoomDelta * 100).toFixed(1)}% | pan=${(panFraction * 100).toFixed(1)}% | duration=${duration.toFixed(2)}s`
  )

  return { motionType: type, applied: type !== 'static', zoomDelta, panFraction, duration }
}

module.exports = {
  applyCameraMotion,
  buildMotionFilter,
  resolveMotionIntensity,
  MOTION_TYPES,
  MOTION_LABEL_TO_TYPE,
  MAX_ZOOM,
  MAX_PAN_FRACTION,
}
