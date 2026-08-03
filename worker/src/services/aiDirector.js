'use strict'

// ── AI Director Engine (V2.5) ────────────────────────────────────────────────
// An independent DECISION engine: it plans how a movie should be edited
// (pacing, camera motion, transitions, emotion, clip ranking) but never
// touches FFmpeg, never writes a file, and is not called from anywhere in the
// render pipeline yet. Renderer integration is a future sprint — this module
// only produces the plan a renderer could later execute.
//
// Pure, deterministic, synchronous: no I/O, no randomness, no network/AI API
// calls. The same input always produces the exact same output, which is what
// makes every decision here testable and auditable.
//
// Decision hierarchy (highest authority first):
//   1. Emotion classification — drives pacing weight and motion pool
//      everywhere, and is authoritative for transition TYPE in every specific
//      category (action always cuts, travel always slides, ...). Only the
//      neutral 'calm' default is adjustable by preset/platform styling.
//   2. Commercial preset (movieStyle) — a creative-direction bias on top of
//      the emotion-driven picks (pacing multiplier, preferred motion pool,
//      and the transition pick for 'calm' scenes only).
//   3. Target platform — a delivery-format bias (pacing multiplier + duration
//      clamps, preferred motion pool, and the transition pick for 'calm'
//      scenes only), consulted after preset.
//   4. Visual rhythm — a final pass over the whole transition sequence that
//      breaks up any run of more than 3 identical consecutive transitions,
//      regardless of what produced them.

const { calculateSceneTiming } = require('./sceneTiming')

function roundTo(value, decimals) {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

function wordCount(text) {
  if (!text) return 0
  const trimmed = String(text).trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

// ══════════════════════════════════════════════════════════════════════════
// 6. Emotion Detection
// ══════════════════════════════════════════════════════════════════════════
// Keyword-scanned classification over every text field a scene might carry.
// `scene.mood` / `scene.emotion` can override the scan directly. On no match,
// falls back to 'calm' — the lowest-energy, least disruptive default.
const EMOTION_KEYWORDS = {
  action:        ['chase', 'explosion', 'fight', 'battle', 'run', 'running', 'sprint', 'crash', 'combat', 'war', 'gunfire', 'punch', 'intense', 'adrenaline'],
  suspense:      ['suspense', 'mystery', 'tension', 'dark', 'shadow', 'threat', 'danger', 'ominous', 'lurking', 'creeping', 'eerie'],
  emotional:     ['cry', 'tears', 'love', 'heartbreak', 'emotional', 'grief', 'reunion', 'embrace', 'hug', 'sorrow', 'weeping', 'touching'],
  inspirational: ['inspire', 'dream', 'achieve', 'success', 'motivate', 'overcome', 'believe', 'potential', 'empower', 'triumph'],
  educational:   ['learn', 'lesson', 'tutorial', 'explain', 'how to', 'understand', 'teach', 'guide', 'step by step', 'concept', 'knowledge'],
  corporate:     ['business', 'company', 'team', 'strategy', 'meeting', 'professional', 'enterprise', 'corporate', 'brand', 'quarterly', 'revenue'],
  travel:        ['journey', 'travel', 'road', 'drive', 'flight', 'airport', 'destination', 'arriving', 'voyage', 'trip', 'highway', 'explore', 'adventure'],
  calm:          ['calm', 'quiet', 'peaceful', 'serene', 'gentle', 'relax', 'still', 'tranquil', 'soft'],
}

// Priority when a scene's text matches more than one category — pacing/tone
// -critical categories (action, suspense, strong emotion) outrank thematic
// ones (travel, corporate) which outrank the neutral default (calm).
const EMOTION_PRIORITY = ['action', 'suspense', 'emotional', 'inspirational', 'educational', 'corporate', 'travel', 'calm']
const DEFAULT_EMOTION  = 'calm'
const EMOTION_CATEGORIES = Object.freeze(Object.keys(EMOTION_KEYWORDS))

function sceneText(scene) {
  return [
    scene.title, scene.description, scene.voiceover, scene.dialogue,
    scene.narration, scene.visual_prompt, scene.visualNote,
  ].filter(Boolean).join(' ').toLowerCase()
}

function classifyEmotion(scene) {
  const override = scene.mood || scene.emotion
  if (override && EMOTION_KEYWORDS[override]) return override

  const text = sceneText(scene)
  for (const emotion of EMOTION_PRIORITY) {
    if (EMOTION_KEYWORDS[emotion].some(kw => text.includes(kw))) return emotion
  }
  return DEFAULT_EMOTION
}

// How much motion energy each emotion calls for — used both to pick a motion
// pool (below) and as scoring context for stock clip ranking.
const EMOTION_MOTION_ENERGY = {
  action: 'high', suspense: 'high', travel: 'medium', inspirational: 'medium',
  emotional: 'medium', educational: 'low', corporate: 'low', calm: 'low',
}

// ══════════════════════════════════════════════════════════════════════════
// 2. Camera Motion
// ══════════════════════════════════════════════════════════════════════════
// One pool per emotion, sized to the "action -> more motion, calm -> less
// motion" rule: high-energy categories never include 'Static'; low-energy
// categories lean on 'Static'/'Ken Burns'. Collectively every one of the 9
// supported motions appears in at least one pool.
const CAMERA_MOTIONS = Object.freeze([
  'Static', 'Push In', 'Push Out', 'Slow Zoom', 'Pan Left', 'Pan Right', 'Tilt Up', 'Tilt Down', 'Ken Burns',
])

const EMOTION_MOTION_POOLS = {
  action:        ['Push In', 'Push Out', 'Pan Left', 'Pan Right'],
  suspense:      ['Slow Zoom', 'Push In', 'Tilt Up'],
  travel:        ['Pan Left', 'Pan Right', 'Ken Burns', 'Tilt Down'],
  inspirational: ['Push In', 'Ken Burns', 'Slow Zoom'],
  emotional:     ['Slow Zoom', 'Push In', 'Static'],
  educational:   ['Static', 'Ken Burns', 'Pan Left'],
  corporate:     ['Static', 'Slow Zoom'],
  calm:          ['Static', 'Ken Burns', 'Slow Zoom'],
}

function pickFromPool(pool, index) {
  return pool[index % pool.length]
}

// Preset bias (creative direction) is tried before platform bias (delivery
// format) — cinematography style is treated as more of an artistic choice
// than a platform requirement. Either bias only applies where it actually
// overlaps the emotion's energy-appropriate pool; otherwise the emotion pool
// alone decides.
function resolveMotion(emotion, index, presetProfile, platformProfile) {
  const emotionPool = EMOTION_MOTION_POOLS[emotion] || EMOTION_MOTION_POOLS[DEFAULT_EMOTION]
  const biasCandidates = [presetProfile.motionBias, platformProfile.motionBias].filter(Boolean)

  for (const bias of biasCandidates) {
    const intersection = emotionPool.filter(m => bias.includes(m))
    if (intersection.length > 0) return pickFromPool(intersection, index)
  }
  return pickFromPool(emotionPool, index)
}

// ══════════════════════════════════════════════════════════════════════════
// 3. Transition Style + 4. Visual Rhythm
// ══════════════════════════════════════════════════════════════════════════
// Transition type strings match transitionEngine.js's TRANSITION_TYPES
// exactly, so this plan is directly consumable by V2.3 without translation.
const EMOTION_TRANSITION_MAP = {
  action: 'cut', travel: 'slide-left', emotional: 'dissolve', suspense: 'dip-to-black',
  calm: 'fade', educational: 'fade', inspirational: 'dissolve', corporate: 'cut',
}

// Emotion is authoritative for transition TYPE across every specific category
// — action always cuts, travel always slides, and so on, regardless of
// movieStyle/targetPlatform. Only the neutral 'calm' default (no strong
// signal either way) is adjustable by preset/platform styling; every other
// category communicates something specific enough that a delivery-format or
// creative-direction preference should never silently swap it out.
function resolveTransitionType(emotion, index, presetProfile, platformProfile) {
  const base = EMOTION_TRANSITION_MAP[emotion] || EMOTION_TRANSITION_MAP[DEFAULT_EMOTION]
  if (emotion !== DEFAULT_EMOTION) return base

  const biasCandidates = [presetProfile.transitionBias, platformProfile.transitionBias].filter(Boolean)
  for (const bias of biasCandidates) {
    if (bias.length > 0) return pickFromPool(bias, index)
  }
  return base
}

const RHYTHM_FALLBACK_POOL = ['fade', 'cut', 'dissolve', 'slide-left', 'zoom-in']
const MAX_CONSECUTIVE_REPEATS = 3

// Never repeat one transition more than 3 consecutive times. Too few scenes
// to matter (< 4 transitions total) is a no-op, per spec.
function enforceVisualRhythm(types) {
  if (types.length <= MAX_CONSECUTIVE_REPEATS) return types.slice()

  const result = types.slice()
  let runType = null
  let runLength = 0

  for (let i = 0; i < result.length; i++) {
    if (result[i] === runType) {
      runLength++
    } else {
      runType = result[i]
      runLength = 1
    }

    if (runLength > MAX_CONSECUTIVE_REPEATS) {
      const prev = result[i - 1]
      const replacement = RHYTHM_FALLBACK_POOL.find(t => t !== runType && t !== prev) || RHYTHM_FALLBACK_POOL[0]
      result[i] = replacement
      runType = replacement
      runLength = 1
    }
  }
  return result
}

// ══════════════════════════════════════════════════════════════════════════
// 8. Commercial Presets + 7. Target Platform
// ══════════════════════════════════════════════════════════════════════════
// paceMultiplier composes multiplicatively (preset * platform) on top of the
// base rhythm-weighted duration from sceneTiming.js. motionBias/transitionBias
// are preferred pools consulted by resolveMotion/resolveTransitionType above.
const PRESET_PROFILES = {
  cinematic:           { paceMultiplier: 1.2,  motionBias: ['Slow Zoom', 'Ken Burns', 'Push In'],          transitionBias: ['dissolve', 'fade'] },
  documentary:         { paceMultiplier: 1.1,  motionBias: ['Static', 'Pan Left', 'Pan Right', 'Ken Burns'], transitionBias: ['fade', 'dissolve'] },
  advertisement:       { paceMultiplier: 0.6,  motionBias: ['Push In', 'Push Out'],                        transitionBias: ['cut', 'flash'] },
  motivational:        { paceMultiplier: 0.9,  motionBias: ['Push In', 'Slow Zoom'],                       transitionBias: ['dissolve', 'fade'] },
  educational:         { paceMultiplier: 1.15, motionBias: ['Static', 'Ken Burns'],                        transitionBias: ['fade', 'cut'] },
  storytelling:        { paceMultiplier: 1.0,  motionBias: null,                                           transitionBias: ['dissolve', 'fade'] },
  'product-demo':      { paceMultiplier: 0.8,  motionBias: ['Push In', 'Slow Zoom'],                       transitionBias: ['cut'] },
  news:                { paceMultiplier: 0.7,  motionBias: ['Static', 'Push In'],                          transitionBias: ['cut'] },
  'podcast-highlight': { paceMultiplier: 0.9,  motionBias: ['Static', 'Slow Zoom'],                        transitionBias: ['fade', 'cut'] },
}
const DEFAULT_PRESET = 'cinematic'
const PRESET_NAMES = Object.freeze(Object.keys(PRESET_PROFILES))

const PLATFORM_PROFILES = {
  youtube:           { paceMultiplier: 1.15, minSceneDuration: 2,   maxSceneDuration: 25, motionBias: null,                                transitionBias: ['fade', 'dissolve'] },
  'youtube-shorts':  { paceMultiplier: 0.55, minSceneDuration: 1,   maxSceneDuration: 6,  motionBias: ['Push In', 'Pan Left', 'Pan Right'], transitionBias: ['cut', 'slide-left', 'slide-right'] },
  instagram:         { paceMultiplier: 0.65, minSceneDuration: 1,   maxSceneDuration: 7,  motionBias: ['Push In', 'Ken Burns'],             transitionBias: ['cut', 'dissolve'] },
  facebook:          { paceMultiplier: 0.85, minSceneDuration: 1.5, maxSceneDuration: 10, motionBias: null,                                transitionBias: ['cut', 'fade'] },
  linkedin:          { paceMultiplier: 1.2,  minSceneDuration: 2.5, maxSceneDuration: 20, motionBias: ['Static', 'Slow Zoom'],              transitionBias: ['cut', 'fade'] },
  tiktok:            { paceMultiplier: 0.45, minSceneDuration: 1,   maxSceneDuration: 5,  motionBias: ['Push In', 'Pan Left', 'Pan Right', 'Push Out'], transitionBias: ['cut'] },
}
const DEFAULT_PLATFORM = 'youtube'
const PLATFORM_NAMES = Object.freeze(Object.keys(PLATFORM_PROFILES))

function resolvePreset(movieStyle) {
  const name = PRESET_PROFILES[movieStyle] ? movieStyle : DEFAULT_PRESET
  return { name, profile: PRESET_PROFILES[name] }
}

function resolvePlatform(targetPlatform) {
  const name = PLATFORM_PROFILES[targetPlatform] ? targetPlatform : DEFAULT_PLATFORM
  return { name, profile: PLATFORM_PROFILES[name] }
}

// ══════════════════════════════════════════════════════════════════════════
// 1. Scene Pacing
// ══════════════════════════════════════════════════════════════════════════
// Base rhythm/dialogue-density weighting is delegated to sceneTiming.js
// (already covers sentence length + dialogue density via its 'weighted'
// strategy). This layer adds the two signals sceneTiming doesn't model —
// punctuation and emphasis — as a per-scene multiplier, then applies the
// preset/platform pacing multiplier and per-platform duration clamps.
const WORDS_PER_SECOND = 2.5 // ~150 wpm average narration speaking rate
const FALLBACK_SECONDS_PER_SCENE = 6

function punctuationEmphasisMultiplier(text) {
  if (!text) return 1
  const exclamations = (text.match(/!/g) || []).length
  const questions    = (text.match(/\?/g) || []).length
  const ellipses     = (text.match(/\.\.\.|…/g) || []).length
  const capsWords    = (text.match(/\b[A-Z]{2,}\b/g) || []).length

  // Exclamation marks / emphasis (caps) read as energy -> pacing tightens slightly.
  // Trailing ellipses read as an unhurried beat -> pacing loosens slightly.
  let multiplier = 1
  multiplier -= Math.min(0.15, exclamations * 0.03 + capsWords * 0.02)
  multiplier -= Math.min(0.08, questions * 0.02)
  multiplier += Math.min(0.2, ellipses * 0.05)
  return Math.max(0.75, Math.min(1.25, multiplier))
}

function resolveTotalDuration({ duration, narration, script, scenes }) {
  const d = Number(duration)
  if (Number.isFinite(d) && d > 0) return d

  const sceneVoiceText = scenes.map(s => s.voiceover || s.dialogue || s.narration || '').join(' ')
  const fallbackText = sceneVoiceText.trim() || narration || script || ''
  const words = wordCount(fallbackText)
  if (words > 0) return roundTo(words / WORDS_PER_SECOND, 2)

  return Math.max(1, scenes.length) * FALLBACK_SECONDS_PER_SCENE
}

/**
 * Base rhythm-weighted duration per scene (sceneTiming.js), then the
 * punctuation/emphasis multiplier, then preset*platform pacing multiplier,
 * then clamped to the platform's [min, max] scene duration. Returns
 * { sceneTiming, plannedTotalDuration, actualTotalDuration } — the two
 * totals are reported separately (rather than silently forced equal) because
 * per-scene clamping can genuinely change the achievable total; callers
 * needing an exact total should treat actualTotalDuration as ground truth,
 * the same "measure, don't assume" principle used elsewhere in this pipeline.
 */
function buildScenePacing(scenes, totalDuration, presetProfile, platformProfile) {
  const baseTimeline = calculateSceneTiming({ scenes, narrationDuration: totalDuration, strategy: 'weighted' })
  const paceMultiplier = presetProfile.paceMultiplier * platformProfile.paceMultiplier

  const rawDurations = baseTimeline.map((t, i) => {
    const scene = scenes[i]
    const text = `${scene.voiceover || scene.dialogue || scene.narration || ''} ${scene.description || ''}`
    const emphasisMultiplier = punctuationEmphasisMultiplier(text)
    const adjusted = t.duration * emphasisMultiplier * paceMultiplier
    return Math.min(platformProfile.maxSceneDuration, Math.max(platformProfile.minSceneDuration, roundTo(adjusted, 2)))
  })

  let cursor = 0
  const sceneTiming = rawDurations.map((duration, i) => {
    const start = roundTo(cursor, 2)
    cursor += duration
    return { scene_number: scenes[i].scene_number ?? i + 1, start, duration: roundTo(duration, 2), end: roundTo(cursor, 2) }
  })

  return {
    sceneTiming,
    plannedTotalDuration: roundTo(totalDuration, 2),
    actualTotalDuration: roundTo(cursor, 2),
    paceMultiplier: roundTo(paceMultiplier, 3),
  }
}

// ══════════════════════════════════════════════════════════════════════════
// 5. Stock Clip Ranking
// ══════════════════════════════════════════════════════════════════════════
// Six weighted components, each scored 0-100, combined into one 0-100 score
// (one decimal, matching the spec's "score: 91.3" example). Every component
// degrades to a neutral 50 when the candidate is missing the field it needs
// — a candidate with incomplete metadata is never unfairly punished, just
// scored on what's actually known about it.
const SCORE_WEIGHTS = Object.freeze({
  relevance: 0.30, motion: 0.15, orientation: 0.15, resolution: 0.15, lighting: 0.10, cinematicAppeal: 0.15,
})
const CINEMATIC_KEYWORDS = ['cinematic', '4k', 'slow motion', 'professional', 'drone', 'aerial', 'bokeh']
const MOTION_ENERGY_LEVELS = { low: 0, medium: 1, high: 2 }

function candidateText(candidate) {
  return ((Array.isArray(candidate.tags) ? candidate.tags.join(' ') : '') + ' ' + (candidate.description || '')).toLowerCase()
}

function scoreRelevance(candidate, keywords) {
  const text = candidateText(candidate)
  if (!text.trim() || !keywords || keywords.length === 0) return 50
  const kws = keywords.map(k => String(k).toLowerCase())
  const hits = kws.filter(k => text.includes(k)).length
  return Math.round(Math.min(100, 40 + (hits / kws.length) * 60))
}

function scoreMotion(candidate, motionEnergy) {
  if (!candidate.motion || !motionEnergy) return 50
  const diff = Math.abs((MOTION_ENERGY_LEVELS[candidate.motion] ?? 1) - (MOTION_ENERGY_LEVELS[motionEnergy] ?? 1))
  return diff === 0 ? 100 : diff === 1 ? 65 : 30
}

function inferOrientation(candidate) {
  if (candidate.orientation) return candidate.orientation
  if (candidate.width && candidate.height) return candidate.height >= candidate.width ? 'portrait' : 'landscape'
  return null
}

function scoreOrientation(candidate, targetOrientation) {
  const o = inferOrientation(candidate)
  if (!o) return 50
  return o === (targetOrientation || 'portrait') ? 100 : 35
}

function scoreResolution(candidate, targetWidth, targetHeight) {
  if (!candidate.width || !candidate.height) return 50
  const targetPixels = (targetWidth || 720) * (targetHeight || 1280)
  const candidatePixels = candidate.width * candidate.height
  if (candidatePixels >= targetPixels) return 100
  return Math.max(20, Math.round((candidatePixels / targetPixels) * 100))
}

function scoreLighting(candidate) {
  const b = candidate.brightness
  if (typeof b !== 'number') return 50
  const idealMid = 0.55
  return Math.max(20, Math.round(100 - Math.abs(b - idealMid) * 160))
}

function scoreCinematicAppeal(candidate, targetWidth, targetHeight) {
  const text = candidateText(candidate)
  let score = 50 + CINEMATIC_KEYWORDS.filter(k => text.includes(k)).length * 8

  if (candidate.width && candidate.height) {
    const targetRatio = (targetWidth || 720) / (targetHeight || 1280)
    const candidateRatio = candidate.width / candidate.height
    score -= Math.min(20, Math.abs(candidateRatio - targetRatio) * 40)
  }
  return Math.max(0, Math.min(100, Math.round(score)))
}

/** Score one candidate clip. Returns the six 0-100 components plus a combined `score` (0-100, 1 decimal). */
function scoreClip(candidate, context = {}) {
  const relevance       = scoreRelevance(candidate, context.keywords)
  const motion          = scoreMotion(candidate, context.motionEnergy)
  const orientation      = scoreOrientation(candidate, context.targetOrientation)
  const resolution       = scoreResolution(candidate, context.targetWidth, context.targetHeight)
  const lighting          = scoreLighting(candidate)
  const cinematicAppeal   = scoreCinematicAppeal(candidate, context.targetWidth, context.targetHeight)

  const score =
    relevance * SCORE_WEIGHTS.relevance +
    motion * SCORE_WEIGHTS.motion +
    orientation * SCORE_WEIGHTS.orientation +
    resolution * SCORE_WEIGHTS.resolution +
    lighting * SCORE_WEIGHTS.lighting +
    cinematicAppeal * SCORE_WEIGHTS.cinematicAppeal

  return { relevance, motion, orientation, resolution, lighting, cinematicAppeal, score: roundTo(score, 1) }
}

/**
 * Rank candidate clips best-first. The renderer (a future sprint) selects
 * ranked[0]. Context: { keywords: string[], motionEnergy: 'low'|'medium'|'high',
 * targetOrientation, targetWidth, targetHeight }.
 */
function rankClips(candidates, context = {}) {
  if (!Array.isArray(candidates) || candidates.length === 0) return []
  return candidates
    .map(candidate => {
      const scored = scoreClip(candidate, context)
      return {
        ...candidate,
        score: scored.score,
        scoreBreakdown: {
          relevance: scored.relevance, motion: scored.motion, orientation: scored.orientation,
          resolution: scored.resolution, lighting: scored.lighting, cinematicAppeal: scored.cinematicAppeal,
        },
      }
    })
    .sort((a, b) => b.score - a.score)
}

// ══════════════════════════════════════════════════════════════════════════
// Orchestration
// ══════════════════════════════════════════════════════════════════════════

/**
 * createDirectingPlan({ script, narration, scenes, movieStyle, targetPlatform, duration })
 *
 * Pure, synchronous, deterministic. Returns one directing plan object:
 *   { movieStyle, targetPlatform, pacing, sceneTiming, emotions, motions,
 *     transitions, rankedClips }
 *
 * `duration` (seconds) is used verbatim when given; otherwise it's estimated
 * from scene voiceover / narration / script text at ~150 words/minute, and as
 * a last resort from a flat 6s-per-scene default. `movieStyle`/`targetPlatform`
 * fall back to 'cinematic'/'youtube' when omitted or unrecognized — every
 * input is optional, nothing here throws on missing data.
 */
function createDirectingPlan({ script, narration, scenes, movieStyle, targetPlatform, duration } = {}) {
  const sceneList = Array.isArray(scenes) ? scenes : []

  const { name: resolvedPreset, profile: presetProfile } = resolvePreset(movieStyle)
  const { name: resolvedPlatform, profile: platformProfile } = resolvePlatform(targetPlatform)

  if (sceneList.length === 0) {
    return {
      movieStyle: resolvedPreset,
      targetPlatform: resolvedPlatform,
      pacing: { plannedTotalDuration: 0, actualTotalDuration: 0, paceMultiplier: presetProfile.paceMultiplier * platformProfile.paceMultiplier },
      sceneTiming: [],
      emotions: [],
      motions: [],
      transitions: [],
      rankedClips: [],
    }
  }

  const totalDuration = resolveTotalDuration({ duration, narration, script, scenes: sceneList })
  const pacing = buildScenePacing(sceneList, totalDuration, presetProfile, platformProfile)

  const emotions = sceneList.map((scene, i) => ({
    scene_number: scene.scene_number ?? i + 1,
    emotion: classifyEmotion(scene),
  }))

  const motions = emotions.map((e, i) => ({
    scene_number: e.scene_number,
    motion: resolveMotion(e.emotion, i, presetProfile, platformProfile),
    energy: EMOTION_MOTION_ENERGY[e.emotion] || 'low',
  }))

  const rawTransitionTypes = []
  for (let i = 1; i < sceneList.length; i++) {
    rawTransitionTypes.push(resolveTransitionType(emotions[i].emotion, i, presetProfile, platformProfile))
  }
  const rhythmSafeTypes = enforceVisualRhythm(rawTransitionTypes)
  const transitions = rhythmSafeTypes.map((type, i) => ({
    fromScene: emotions[i].scene_number,
    toScene: emotions[i + 1].scene_number,
    type,
  }))

  const rankedClips = sceneList
    .map((scene, i) => {
      if (!Array.isArray(scene.candidateClips) || scene.candidateClips.length === 0) return null
      const context = {
        keywords: scene.visualKeywords || (scene.visual_prompt ? scene.visual_prompt.split(/\s+/) : []),
        motionEnergy: motions[i].energy,
        targetOrientation: 'portrait',
        targetWidth: 720,
        targetHeight: 1280,
      }
      return { scene_number: emotions[i].scene_number, candidates: rankClips(scene.candidateClips, context) }
    })
    .filter(Boolean)

  return {
    movieStyle: resolvedPreset,
    targetPlatform: resolvedPlatform,
    pacing,
    sceneTiming: pacing.sceneTiming,
    emotions,
    motions,
    transitions,
    rankedClips,
  }
}

module.exports = {
  createDirectingPlan,
  classifyEmotion,
  rankClips,
  scoreClip,
  enforceVisualRhythm,
  EMOTION_CATEGORIES,
  CAMERA_MOTIONS,
  PRESET_NAMES,
  PLATFORM_NAMES,
}
