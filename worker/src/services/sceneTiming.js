'use strict'

// ── Smart Scene Timing Engine ──────────────────────────────────────────────
// Allocates per-scene durations from a pool of narration time, replacing the
// old `totalDuration / sceneCount` fixed split (the cause of heavy FFmpeg
// frame duplication when a handful of scenes were each stretched to an
// identical, oversized duration).
//
// Pure function, no I/O — safe to call for up to ~1000 scenes with no
// noticeable slowdown (single O(n) pass over the scene list).

const STRATEGIES = new Set(['equal', 'weighted', 'dialogue', 'cinematic'])
const DEFAULT_STRATEGY = 'weighted'
const VALIDATION_TOLERANCE_SECS = 0.1

const ACTION_KEYWORDS = [
  'run', 'runs', 'running', 'ran', 'chase', 'chased', 'chasing',
  'fight', 'fighting', 'fought', 'jump', 'jumps', 'jumping', 'jumped',
  'explode', 'explodes', 'exploding', 'explosion', 'crash', 'crashing',
  'escape', 'escapes', 'escaping', 'flee', 'flees', 'fleeing',
  'battle', 'attack', 'attacks', 'attacking', 'sprint', 'sprinting',
  'race', 'racing', 'struggle', 'struggling', 'fall', 'falls', 'falling',
  'climb', 'climbs', 'climbing', 'punch', 'punching', 'shoot', 'shooting',
]

const EMOTION_KEYWORDS = [
  'afraid', 'fear', 'terrified', 'scared', 'angry', 'furious', 'rage',
  'sad', 'crying', 'weeping', 'joy', 'happy', 'excited', 'shocked',
  'shock', 'surprised', 'desperate', 'panic', 'panicked', 'love',
  'heartbroken', 'anxious', 'nervous', 'tense', 'terror', 'grief',
]

function roundTo(value, decimals) {
  const f = 10 ** decimals
  return Math.round(value * f) / f
}

function wordCount(text) {
  if (!text) return 0
  const trimmed = String(text).trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

function countKeywordHits(text, keywords) {
  if (!text) return 0
  const lower = String(text).toLowerCase()
  let hits = 0
  for (let i = 0; i < keywords.length; i++) {
    if (lower.indexOf(keywords[i]) !== -1) hits++
  }
  return hits
}

// Dialogue/voiceover and visual-description text can arrive under several
// field names depending on which route produced the scene object.
function sceneDialogue(scene) {
  return scene.dialogue || scene.voiceover || scene.narration || ''
}

function sceneDescription(scene) {
  return scene.description || scene.visual_prompt || scene.visualNote || scene.title || ''
}

// weight priority, highest to lowest: dialogue length > description length > action keywords > emotion keywords
function weightedScore(scene) {
  const dialogue    = sceneDialogue(scene)
  const description = sceneDescription(scene)
  const combined     = `${dialogue} ${description}`

  let weight = 1 // baseline so every scene always gets some screen time
  weight += wordCount(dialogue) * 0.5
  weight += wordCount(description) * 0.2
  weight += countKeywordHits(combined, ACTION_KEYWORDS) * 2
  weight += countKeywordHits(combined, EMOTION_KEYWORDS) * 1.5
  return weight
}

const WEIGHT_FNS = {
  equal: () => 1,
  weighted: weightedScore,
  dialogue: (scene) => 1 + wordCount(sceneDialogue(scene)),
  // Same signal as `weighted`, but compressed with sqrt so no single scene
  // dominates screen time purely from word count — closer to real edit pacing.
  cinematic: (scene) => Math.sqrt(weightedScore(scene)),
}

function validateTiming(timeline, narrationDuration) {
  const total = timeline.reduce((sum, t) => sum + t.duration, 0)
  const diff = Math.abs(total - narrationDuration)
  if (diff > VALIDATION_TOLERANCE_SECS) {
    throw new Error(
      `[sceneTiming] Validation failed: sum(duration)=${total.toFixed(3)}s vs ` +
      `narrationDuration=${narrationDuration.toFixed(3)}s (diff=${diff.toFixed(3)}s > ${VALIDATION_TOLERANCE_SECS}s)`
    )
  }
}

/**
 * calculateSceneTiming({ scenes, narrationDuration, strategy })
 * Returns [{ scene_number, start, duration, end }, ...] covering exactly
 * `narrationDuration` seconds (sum(duration) matches within 0.1s, always
 * enforced exactly by construction).
 */
function calculateSceneTiming({ scenes, narrationDuration, strategy } = {}) {
  const list = Array.isArray(scenes) ? scenes : []
  if (list.length === 0) return []

  const duration = Number(narrationDuration)
  if (!Number.isFinite(duration) || duration < 0) {
    throw new Error('[sceneTiming] narrationDuration must be a non-negative number')
  }

  const resolvedStrategy = STRATEGIES.has(strategy) ? strategy : DEFAULT_STRATEGY
  const weightFn = WEIGHT_FNS[resolvedStrategy]

  let weights = list.map(weightFn)
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  if (!(totalWeight > 0)) weights = list.map(() => 1) // degenerate all-zero weights -> fall back to equal split

  const finalTotalWeight = weights.reduce((a, b) => a + b, 0)
  const durations = weights.map(w => roundTo((w / finalTotalWeight) * duration, 2))

  // Absorb rounding drift into the final scene so the total always matches
  // narrationDuration exactly, no matter how many scenes are involved.
  const allocated = durations.slice(0, -1).reduce((a, b) => a + b, 0)
  durations[durations.length - 1] = roundTo(duration - allocated, 2)

  let cursor = 0
  const timeline = list.map((scene, i) => {
    const start = roundTo(cursor, 2)
    const sceneDuration = durations[i]
    cursor += sceneDuration
    return {
      scene_number: scene.scene_number ?? i + 1,
      start,
      duration: sceneDuration,
      end: roundTo(cursor, 2),
    }
  })

  validateTiming(timeline, duration)
  return timeline
}

module.exports = { calculateSceneTiming, STRATEGIES, DEFAULT_STRATEGY }
