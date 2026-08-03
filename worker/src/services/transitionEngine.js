'use strict'

// ── Cinematic Transition Engine ─────────────────────────────────────────────
// Standalone, self-contained service: given a sequence of scenes (each with a
// known duration) it plans WHICH transition goes between every consecutive
// pair and HOW LONG it lasts (buildTransitionGraph), can turn that plan into
// an FFmpeg filter_complex graph (buildFilterComplex), and can optionally
// render it (renderTransitionChain). It does not import from or modify
// movieAssemblerV2.js — it only reads the shared FFMPEG_BIN constant from
// ffmpegUtils.js, the same way every other service in this codebase does.

const { spawn } = require('child_process')
const fsSync     = require('fs')
const { FFMPEG_BIN, FFPROBE_BIN } = require('./ffmpegUtils')

const TARGET_WIDTH  = 720
const TARGET_HEIGHT = 1280
const TARGET_FPS    = 25

// ── Supported transition types (Step 2) ─────────────────────────────────────
const TRANSITION_TYPES = [
  'fade', 'dissolve', 'slide-left', 'slide-right',
  'zoom-in', 'zoom-out', 'blur-fade', 'dip-to-black', 'flash', 'cut',
]

const DEFAULT_TRANSITION = 'fade'
const DEFAULT_DURATION   = 0.5
const MIN_DURATION       = 0.1
const MAX_DURATION       = 1.5

// Map our editorial transition names onto FFmpeg's native `xfade` transition
// catalog so every type renders with a single well-supported filter — no
// custom per-effect filtergraphs to hand-roll or maintain. 'cut' has no xfade
// equivalent (it's a hard join, handled specially in buildFilterComplex).
// 'zoom-out' and 'blur-fade' have no exact native xfade match; the closest
// visual analogs are used instead of inventing a bespoke filter chain:
//   zoom-out  -> circleclose (a closing/shrinking reveal reads as "zooming out")
//   blur-fade -> hblur       (native horizontal blur wipe)
const XFADE_TRANSITION_MAP = {
  'fade':         'fade',
  'dissolve':     'dissolve',
  'slide-left':   'slideleft',
  'slide-right':  'slideright',
  'zoom-in':      'zoomin',
  'zoom-out':     'circleclose',
  'blur-fade':    'hblur',
  'dip-to-black': 'fadeblack',
  'flash':        'fadewhite',
  'cut':          null,
}

// ── Automatic transition selection (Step 3) ─────────────────────────────────
// Decision logic: each incoming ("to") scene's text fields are scanned for
// mood keywords. The FIRST matching mood in MOOD_PRIORITY wins — action beats
// suspense beats emotional beats travel beats calm — because pacing/safety
// cues (a chase, an explosion) should dominate the edit even if a scene's
// description also mentions calmer imagery in passing. A scene can also set
// `scene.mood` directly to bypass keyword scanning entirely. Scenes matching
// no keyword fall back to DEFAULT_TRANSITION ('fade'), same as non-auto mode.
const MOOD_KEYWORDS = {
  action:    ['chase', 'explosion', 'fight', 'battle', 'run', 'running', 'sprint', 'crash', 'combat', 'war', 'gunfire', 'punch', 'intense'],
  suspense:  ['suspense', 'mystery', 'tension', 'dark', 'shadow', 'threat', 'danger', 'ominous', 'lurking', 'creeping', 'eerie'],
  emotional: ['cry', 'tears', 'love', 'heartbreak', 'emotional', 'grief', 'reunion', 'embrace', 'hug', 'sorrow', 'weeping'],
  travel:    ['journey', 'travel', 'road', 'drive', 'flight', 'airport', 'destination', 'arriving', 'voyage', 'trip', 'highway'],
  calm:      ['calm', 'quiet', 'peaceful', 'serene', 'gentle', 'relax', 'still', 'tranquil', 'soft'],
}

const MOOD_PRIORITY = ['action', 'suspense', 'emotional', 'travel', 'calm']

const MOOD_TRANSITION_MAP = {
  action:    'cut',
  suspense:  'dip-to-black',
  emotional: 'dissolve',
  travel:    'slide-left',
  calm:      'fade',
}

function sceneText(scene) {
  return [scene.title, scene.description, scene.voiceover, scene.visual_prompt, scene.visualNote]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function classifyMood(scene) {
  if (scene.mood && MOOD_TRANSITION_MAP[scene.mood]) return scene.mood
  const text = sceneText(scene)
  for (const mood of MOOD_PRIORITY) {
    if (MOOD_KEYWORDS[mood].some(kw => text.includes(kw))) return mood
  }
  return null
}

function selectAutoTransition(toScene) {
  const mood = classifyMood(toScene)
  return mood ? MOOD_TRANSITION_MAP[mood] : DEFAULT_TRANSITION
}

// ── Input validation / safety clamping (Step 5) ─────────────────────────────
function normalizeStyle(transitionStyle) {
  if (transitionStyle === 'auto') return 'auto'
  if (TRANSITION_TYPES.includes(transitionStyle)) return transitionStyle
  return DEFAULT_TRANSITION
}

function clampRequestedDuration(transitionDuration) {
  const d = Number(transitionDuration)
  if (!isFinite(d)) return DEFAULT_DURATION
  return Math.max(MIN_DURATION, Math.min(MAX_DURATION, d))
}

// Transition duration must always be strictly less than either adjoining
// clip's duration (Step 5) — capped at 40% of the shorter clip so a crossfade
// never eats an entire short scene, with a small floor so it's never ~0.
function clampTransitionDuration(requestedDuration, fromDuration, toDuration) {
  const safeCeiling = Math.max(MIN_DURATION, Math.min(fromDuration, toDuration) * 0.4)
  return Math.max(MIN_DURATION, Math.min(requestedDuration, safeCeiling))
}

// ── Step 6 diagnostics ───────────────────────────────────────────────────────
function logTransitionGraph(transitions) {
  for (const t of transitions) {
    console.log(
      `[TransitionEngine] Scene ${t.fromScene} -> Scene ${t.toScene}\n` +
      `[TransitionEngine]   Transition: ${t.type}\n` +
      `[TransitionEngine]   Duration: ${t.duration.toFixed(2)}s\n` +
      `[TransitionEngine]   Offset: ${t.offset.toFixed(2)}s`
    )
  }
}

/**
 * Plan the transition between every consecutive pair of scenes.
 *
 * scenes: [{ scene_number, duration, title?, description?, voiceover?,
 *            visual_prompt?, visualNote?, mood? }, ...] — `duration` (seconds)
 *   is required on every scene; this is meant to be called once each scene's
 *   exact normalized-clip duration is already known (e.g. after
 *   movieAssemblerV2's prepareTimeline/normalizeClipDuration has run).
 * transitionStyle: one of TRANSITION_TYPES, or 'auto', or omitted (-> 'fade').
 * transitionDuration: requested seconds, clamped to [MIN_DURATION, MAX_DURATION]
 *   and then further clamped per-pair by clampTransitionDuration.
 *
 * Returns { transitions: [{ fromScene, toScene, type, duration, offset }],
 *           totalDuration } — totalDuration accounts for the time each
 *   crossfade compresses out of the naive sum of scene durations, which is
 *   exactly what downstream audio/voice sync needs to stay accurate (Step 5:
 *   "preserve audio synchronization") — whatever merges the voice track later
 *   should treat totalDuration, not sum(scene.duration), as the video length.
 */
function buildTransitionGraph({ scenes, transitionStyle, transitionDuration } = {}) {
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return { transitions: [], totalDuration: 0 }
  }

  scenes.forEach((s, i) => {
    if (!(Number(s.duration) > 0)) {
      throw new Error(`[TransitionEngine] buildTransitionGraph: scene ${s.scene_number ?? i + 1} has an invalid duration (${s.duration})`)
    }
  })

  const style = normalizeStyle(transitionStyle)
  const requestedDuration = clampRequestedDuration(transitionDuration)

  const transitions = []
  let cumulative    = scenes[0].duration
  let totalDuration = scenes[0].duration

  for (let i = 1; i < scenes.length; i++) {
    const from = scenes[i - 1]
    const to   = scenes[i]
    const fromScene = from.scene_number ?? i
    const toScene   = to.scene_number ?? (i + 1)

    const type = style === 'auto' ? selectAutoTransition(to) : style

    if (type === 'cut') {
      const offset = cumulative
      transitions.push({ fromScene, toScene, type: 'cut', duration: 0, offset })
      cumulative    += to.duration
      totalDuration += to.duration
      continue
    }

    const duration = clampTransitionDuration(requestedDuration, from.duration, to.duration)
    const offset   = Math.max(0, cumulative - duration)

    transitions.push({ fromScene, toScene, type, duration, offset })
    cumulative    = cumulative + to.duration - duration
    totalDuration = totalDuration + to.duration - duration
  }

  // No dropped scenes (Step 5): every gap between N scenes must produce exactly
  // one transition. Structurally guaranteed by the loop above — this is a cheap
  // safety net against a future refactor silently skipping a pair.
  if (transitions.length !== scenes.length - 1) {
    throw new Error(
      `[TransitionEngine] buildTransitionGraph: expected ${scenes.length - 1} transitions for ${scenes.length} scenes, built ${transitions.length}`
    )
  }

  logTransitionGraph(transitions)

  return { transitions, totalDuration }
}

// ── Step 4: FFmpeg filter_complex graph builder (pure — no I/O) ─────────────
// Assumes `clipCount` inputs will be passed to ffmpeg as `-i` in scene order
// (input index i == scene index i). Chains xfade (or, for 'cut' pairs, the
// plain `concat` filter — a hard join needs no crossfade filter at all) across
// every pair in one pass, so the whole movie re-encodes exactly once instead
// of once per transition ("do not re-render entire scenes unnecessarily").
function buildFilterComplex(clipCount, transitions) {
  if (!(clipCount >= 1)) {
    throw new Error('[TransitionEngine] buildFilterComplex: clipCount must be >= 1')
  }
  if (transitions.length !== clipCount - 1) {
    throw new Error(`[TransitionEngine] buildFilterComplex: expected ${clipCount - 1} transitions for ${clipCount} clips, got ${transitions.length}`)
  }

  const tail = [
    `scale=${TARGET_WIDTH}:${TARGET_HEIGHT}:force_original_aspect_ratio=increase`,
    `crop=${TARGET_WIDTH}:${TARGET_HEIGHT}`,
    `fps=${TARGET_FPS}`,
    'format=yuv420p',
    'setsar=1:1',
  ].join(',')

  if (clipCount === 1) {
    return { filter: `[0:v]${tail}[vfinal]`, outputLabel: 'vfinal' }
  }

  let filter = ''
  let lastLabel = '0:v'

  transitions.forEach((t, i) => {
    const curInputLabel = `${i + 1}:v`
    const outLabel = `pair${i}`
    const xfadeName = XFADE_TRANSITION_MAP[t.type]

    filter += xfadeName
      ? `[${lastLabel}][${curInputLabel}]xfade=transition=${xfadeName}:duration=${t.duration.toFixed(3)}:offset=${t.offset.toFixed(3)}[${outLabel}];`
      : `[${lastLabel}][${curInputLabel}]concat=n=2:v=1:a=0[${outLabel}];`

    lastLabel = outLabel
  })

  filter += `[${lastLabel}]${tail}[vfinal]`

  return { filter, outputLabel: 'vfinal' }
}

// ── xfade support detection (Step 7 resilience) ──────────────────────────────
// Mirrors the same capability check movieAssemblerV2.js already uses for its
// own crossfade feature. If the resolved FFmpeg build predates the `xfade`
// filter, every non-cut transition is rendered as a hard cut instead of
// failing the whole render — planning (buildTransitionGraph's returned types)
// still reports the intended transition for diagnostics either way.
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

function runFFmpeg(args, label, timeoutMs) {
  return new Promise((resolve, reject) => {
    let proc
    try {
      proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    } catch (err) {
      return reject(new Error(`[TransitionEngine] FFmpeg failed to spawn for ${label}: ${err.message}`))
    }

    let stderr  = ''
    let settled = false
    let timedOut = false

    const timer = setTimeout(() => {
      timedOut = true
      proc.kill('SIGKILL')
    }, timeoutMs)

    proc.stderr.on('data', d => { stderr += d.toString() })

    proc.on('error', err => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error(`[TransitionEngine] FFmpeg process error for ${label}: ${err.message}`))
    })

    proc.on('close', code => {
      if (settled) return
      settled = true
      clearTimeout(timer)

      if (timedOut) {
        return reject(new Error(`[TransitionEngine] FFmpeg timed out after ${timeoutMs}ms for ${label}`))
      }
      if (code === 0) {
        return resolve()
      }
      reject(new Error(
        `[TransitionEngine] FFmpeg exited ${code} for ${label}\n--- stderr tail ---\n${stderr.slice(-2000)}`
      ))
    })
  })
}

// ── Probe the real output duration rather than trust the planned totalDuration ──
// (needed because the xfade-unsupported fallback below changes what actually
// got rendered — see renderTransitionChain).
function getOutputDuration(filePath) {
  return new Promise((resolve, reject) => {
    let proc
    try {
      proc = spawn(FFPROBE_BIN, [
        '-v', 'error', '-show_entries', 'format=duration',
        '-of', 'default=noprint_wrappers=1:nokey=1', filePath,
      ], { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (err) {
      return reject(new Error(`[TransitionEngine] getOutputDuration: ffprobe failed to spawn: ${err.message}`))
    }
    let stdout = ''
    proc.stdout.on('data', d => { stdout += d.toString() })
    proc.on('error', reject)
    proc.on('close', code => {
      const d = parseFloat(stdout.trim())
      if (code === 0 && isFinite(d) && d > 0) resolve(d)
      else reject(new Error(`[TransitionEngine] getOutputDuration: could not determine duration for ${filePath}`))
    })
  })
}

/**
 * Render a transition graph across already-normalized clips into a single
 * output file, streaming clip-to-clip through one ffmpeg process (no
 * intermediate re-encodes per transition, no in-memory clip buffering).
 *
 * normalizedClipPaths: file paths, 1:1 and in the same order as the scenes
 *   array passed to buildTransitionGraph.
 *
 * Returns { outputPath, downgradedToHardCuts, actualDuration }. `actualDuration`
 * is measured from the rendered file, not copied from transitionGraph.totalDuration
 * — if this FFmpeg build lacks `xfade` and every transition downgrades to a hard
 * cut, none of the planned crossfade overlap actually happens, so the real output
 * is longer than the plan. Callers merging a voice track afterwards MUST sync
 * against actualDuration to keep audio in sync (Step 5).
 */
async function renderTransitionChain(normalizedClipPaths, transitionGraph, outputPath, options = {}) {
  if (!Array.isArray(normalizedClipPaths) || normalizedClipPaths.length === 0) {
    throw new Error('[TransitionEngine] renderTransitionChain: no clips provided')
  }
  for (const p of normalizedClipPaths) {
    if (!fsSync.existsSync(p)) {
      throw new Error(`[TransitionEngine] renderTransitionChain: clip does not exist: ${p}`)
    }
  }
  if (normalizedClipPaths.length !== transitionGraph.transitions.length + 1) {
    throw new Error(
      `[TransitionEngine] renderTransitionChain: ${normalizedClipPaths.length} clips but ` +
      `${transitionGraph.transitions.length} transitions (expected ${normalizedClipPaths.length - 1})`
    )
  }

  const { timeoutMs = 5 * 60 * 1000 } = options

  let transitions = transitionGraph.transitions
  let downgradedToHardCuts = false
  if (transitions.some(t => t.type !== 'cut') && !(await ffmpegSupportsXfade())) {
    console.warn('[TransitionEngine] xfade unsupported by this FFmpeg build — rendering all transitions as hard cuts')
    transitions = transitions.map(t => ({ ...t, type: 'cut', duration: 0 }))
    downgradedToHardCuts = true
  }

  const { filter, outputLabel } = buildFilterComplex(normalizedClipPaths.length, transitions)

  const inputArgs = []
  normalizedClipPaths.forEach(p => inputArgs.push('-i', p))

  const args = [
    '-y',
    ...inputArgs,
    '-filter_complex', filter,
    '-map', `[${outputLabel}]`,
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
  ]

  await runFFmpeg(args, outputPath, timeoutMs)

  if (!fsSync.existsSync(outputPath) || fsSync.statSync(outputPath).size === 0) {
    throw new Error(`[TransitionEngine] renderTransitionChain produced no output: ${outputPath}`)
  }

  const actualDuration = await getOutputDuration(outputPath)

  return { outputPath, downgradedToHardCuts, actualDuration }
}

module.exports = {
  TRANSITION_TYPES,
  DEFAULT_TRANSITION,
  DEFAULT_DURATION,
  buildTransitionGraph,
  buildFilterComplex,
  renderTransitionChain,
  ffmpegSupportsXfade,
  classifyMood,
  selectAutoTransition,
  clampTransitionDuration,
}
