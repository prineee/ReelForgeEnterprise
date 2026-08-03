'use strict'

// Zero-dependency test runner (matches the other worker/tests/*.test.js files) — run with:
//   node worker/tests/aiDirector.test.js
const assert = require('assert')
const {
  createDirectingPlan,
  classifyEmotion,
  rankClips,
  scoreClip,
  enforceVisualRhythm,
  EMOTION_CATEGORIES,
  CAMERA_MOTIONS,
  PRESET_NAMES,
  PLATFORM_NAMES,
} = require('../src/services/aiDirector')

let passed = 0
let failed = 0

function test(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ok - ${name}`)
  } catch (err) {
    failed++
    console.error(`  FAIL - ${name}`)
    console.error(`    ${err.message}`)
  }
}

function makeScenes(n, textFn) {
  return Array.from({ length: n }, (_, i) => ({
    scene_number: i + 1,
    description: textFn ? textFn(i) : `Scene ${i + 1} description with some words in it`,
  }))
}

function assertConsistentPlan(plan, sceneCount) {
  assert.strictEqual(plan.sceneTiming.length, sceneCount)
  assert.strictEqual(plan.emotions.length, sceneCount)
  assert.strictEqual(plan.motions.length, sceneCount)
  assert.strictEqual(plan.transitions.length, Math.max(0, sceneCount - 1))

  plan.sceneTiming.forEach(t => assert.ok(t.duration > 0, `scene ${t.scene_number} has non-positive duration`))
  plan.emotions.forEach(e => assert.ok(EMOTION_CATEGORIES.includes(e.emotion), `unknown emotion: ${e.emotion}`))
  plan.motions.forEach(m => assert.ok(CAMERA_MOTIONS.includes(m.motion), `unknown motion: ${m.motion}`))

  for (let i = 0; i < plan.transitions.length; i++) {
    assert.strictEqual(plan.transitions[i].fromScene, plan.sceneTiming[i].scene_number)
    assert.strictEqual(plan.transitions[i].toScene, plan.sceneTiming[i + 1].scene_number)
  }
}

console.log('aiDirector.test.js')

// ── Scale: 1 / 2 / 10 / 50 scenes ───────────────────────────────────────────
test('1 scene: no transitions, valid pacing/motion/emotion', () => {
  const plan = createDirectingPlan({ scenes: makeScenes(1), duration: 10 })
  assertConsistentPlan(plan, 1)
  assert.deepStrictEqual(plan.transitions, [])
})

test('2 scenes: exactly 1 transition', () => {
  const plan = createDirectingPlan({ scenes: makeScenes(2), duration: 10 })
  assertConsistentPlan(plan, 2)
})

test('10 scenes: internally consistent plan', () => {
  const plan = createDirectingPlan({ scenes: makeScenes(10), duration: 60 })
  assertConsistentPlan(plan, 10)
})

test('50 scenes: internally consistent plan', () => {
  const plan = createDirectingPlan({ scenes: makeScenes(50), duration: 300 })
  assertConsistentPlan(plan, 50)
})

// ── Commercial presets ───────────────────────────────────────────────────────
test('every documented preset name is honored (echoed back unchanged)', () => {
  for (const preset of PRESET_NAMES) {
    const plan = createDirectingPlan({ scenes: makeScenes(3), duration: 15, movieStyle: preset })
    assert.strictEqual(plan.movieStyle, preset)
    assertConsistentPlan(plan, 3)
  }
})

test('documentary paces slower than advertisement for identical scenes', () => {
  const scenes = makeScenes(5)
  const doc = createDirectingPlan({ scenes, duration: 30, movieStyle: 'documentary' })
  const ad  = createDirectingPlan({ scenes, duration: 30, movieStyle: 'advertisement' })
  assert.ok(doc.pacing.paceMultiplier > ad.pacing.paceMultiplier)
})

test('motivational preset resolves and biases toward Push In / Slow Zoom / dissolve / fade', () => {
  const plan = createDirectingPlan({ scenes: makeScenes(4, () => 'A neutral scene with no strong keywords'), duration: 20, movieStyle: 'motivational' })
  assert.strictEqual(plan.movieStyle, 'motivational')
  plan.motions.forEach(m => assert.ok(['Push In', 'Slow Zoom'].includes(m.motion) || CAMERA_MOTIONS.includes(m.motion)))
})

test('educational preset resolves correctly', () => {
  const plan = createDirectingPlan({ scenes: makeScenes(4), duration: 20, movieStyle: 'educational' })
  assert.strictEqual(plan.movieStyle, 'educational')
  assertConsistentPlan(plan, 4)
})

test('storytelling preset resolves correctly', () => {
  const plan = createDirectingPlan({ scenes: makeScenes(4), duration: 20, movieStyle: 'storytelling' })
  assert.strictEqual(plan.movieStyle, 'storytelling')
  assertConsistentPlan(plan, 4)
})

test('unrecognized movieStyle falls back to the documented default (cinematic)', () => {
  const plan = createDirectingPlan({ scenes: makeScenes(2), duration: 10, movieStyle: 'not-a-real-style' })
  assert.strictEqual(plan.movieStyle, 'cinematic')
})

// ── Emotion-driven content: Travel, Corporate ───────────────────────────────
test('travel-themed scene classifies as travel and gets a slide transition', () => {
  const scenes = [
    { scene_number: 1, description: 'A calm quiet start' },
    { scene_number: 2, description: 'Their journey continues down the highway on an adventure' },
  ]
  const plan = createDirectingPlan({ scenes, duration: 10 })
  assert.strictEqual(plan.emotions[1].emotion, 'travel')
  assert.strictEqual(plan.transitions[0].type, 'slide-left')
})

test('corporate-themed scene classifies as corporate and gets a cut transition', () => {
  const scenes = [
    { scene_number: 1, description: 'A calm quiet start' },
    { scene_number: 2, description: 'The company team discusses quarterly business strategy in a corporate meeting' },
  ]
  const plan = createDirectingPlan({ scenes, duration: 10 })
  assert.strictEqual(plan.emotions[1].emotion, 'corporate')
  assert.strictEqual(plan.transitions[0].type, 'cut')
})

// ── Target platforms ─────────────────────────────────────────────────────────
test('youtube-shorts clamps scene duration and biases faster pacing than youtube', () => {
  const scenes = makeScenes(4, () => 'A scene with a decently long descriptive sentence about something happening here')
  const yt = createDirectingPlan({ scenes, duration: 60, targetPlatform: 'youtube' })
  const shorts = createDirectingPlan({ scenes, duration: 60, targetPlatform: 'youtube-shorts' })
  assert.ok(shorts.pacing.paceMultiplier < yt.pacing.paceMultiplier)
  shorts.sceneTiming.forEach(t => assert.ok(t.duration <= 6.001, `shorts scene exceeded 6s cap: ${t.duration}`))
})

test('instagram (reels) clamps scene duration to its documented cap', () => {
  const plan = createDirectingPlan({ scenes: makeScenes(4), duration: 60, targetPlatform: 'instagram' })
  plan.sceneTiming.forEach(t => assert.ok(t.duration <= 7.001))
})

test('tiktok is the fastest-paced platform and favors cut transitions', () => {
  const scenes = makeScenes(6, () => 'A neutral descriptive scene')
  const tiktok = createDirectingPlan({ scenes, duration: 40, targetPlatform: 'tiktok' })
  const yt = createDirectingPlan({ scenes, duration: 40, targetPlatform: 'youtube' })
  assert.ok(tiktok.pacing.paceMultiplier < yt.pacing.paceMultiplier)
  tiktok.sceneTiming.forEach(t => assert.ok(t.duration <= 5.001))
})

test('unrecognized targetPlatform falls back to the documented default (youtube)', () => {
  const plan = createDirectingPlan({ scenes: makeScenes(2), duration: 10, targetPlatform: 'myspace' })
  assert.strictEqual(plan.targetPlatform, 'youtube')
})

// ── Empty script / missing narration / long narration ──────────────────────
test('empty scenes array returns an empty, non-throwing plan', () => {
  const plan = createDirectingPlan({ scenes: [] })
  assert.deepStrictEqual(plan.sceneTiming, [])
  assert.deepStrictEqual(plan.emotions, [])
  assert.deepStrictEqual(plan.motions, [])
  assert.deepStrictEqual(plan.transitions, [])
  assert.deepStrictEqual(plan.rankedClips, [])
})

test('completely empty call (no args at all) does not throw', () => {
  const plan = createDirectingPlan()
  assert.deepStrictEqual(plan.sceneTiming, [])
})

test('missing narration/duration falls back to a flat per-scene estimate', () => {
  const scenes = makeScenes(3, () => '') // no voiceover/description text either
  const plan = createDirectingPlan({ scenes })
  assert.strictEqual(plan.pacing.plannedTotalDuration, 18) // 3 scenes * 6s fallback
  assertConsistentPlan(plan, 3)
})

test('missing duration but present narration text estimates duration from word count', () => {
  const narration = Array(30).fill('word').join(' ') // 30 words / 2.5 wps = 12s
  const plan = createDirectingPlan({ scenes: makeScenes(2, () => ''), narration })
  assert.strictEqual(plan.pacing.plannedTotalDuration, 12)
})

test('long narration (thousands of words) computes a large duration without error', () => {
  const narration = Array(3000).fill('word').join(' ')
  const plan = createDirectingPlan({ scenes: makeScenes(5, () => ''), narration })
  assert.strictEqual(plan.pacing.plannedTotalDuration, 1200) // 3000 / 2.5
  assertConsistentPlan(plan, 5)
})

// ── Mixed emotions ────────────────────────────────────────────────────────
test('mixed-emotion scene set produces a varied mix of emotions/motions/transitions', () => {
  const scenes = [
    { scene_number: 1, description: 'A calm quiet peaceful morning' },
    { scene_number: 2, description: 'An intense chase and explosion' },
    { scene_number: 3, description: 'A tearful emotional reunion embrace' },
    { scene_number: 4, description: 'Their journey down the highway' },
    { scene_number: 5, description: 'A dark ominous suspenseful shadow' },
    { scene_number: 6, description: 'The company team strategy meeting' },
  ]
  const plan = createDirectingPlan({ scenes, duration: 30 })
  const emotionSet = new Set(plan.emotions.map(e => e.emotion))
  const transitionSet = new Set(plan.transitions.map(t => t.type))
  assert.ok(emotionSet.size >= 4, `expected a varied emotion mix, got: ${[...emotionSet]}`)
  assert.ok(transitionSet.size >= 3, `expected a varied transition mix, got: ${[...transitionSet]}`)
})

// ── Visual rhythm enforcement ────────────────────────────────────────────────
test('enforceVisualRhythm breaks up runs of more than 3 identical consecutive transitions', () => {
  const input = ['cut', 'cut', 'cut', 'cut', 'cut', 'cut', 'cut']
  const result = enforceVisualRhythm(input)
  let runType = null, runLength = 0, maxRun = 0
  for (const t of result) {
    runLength = t === runType ? runLength + 1 : 1
    runType = t
    maxRun = Math.max(maxRun, runLength)
  }
  assert.ok(maxRun <= 3, `max consecutive run was ${maxRun}, expected <= 3`)
})

test('enforceVisualRhythm is a no-op for fewer than 4 transitions regardless of repetition', () => {
  const input = ['cut', 'cut', 'cut']
  assert.deepStrictEqual(enforceVisualRhythm(input), input)
})

test('all-action scene set (all cuts) never exceeds 3 consecutive identical transitions end-to-end', () => {
  const scenes = makeScenes(8, () => 'An intense chase, explosion, and battle')
  const plan = createDirectingPlan({ scenes, duration: 40 })
  let runType = null, runLength = 0, maxRun = 0
  for (const t of plan.transitions) {
    runLength = t.type === runType ? runLength + 1 : 1
    runType = t.type
    maxRun = Math.max(maxRun, runLength)
  }
  assert.ok(maxRun <= 3, `max consecutive run was ${maxRun}`)
})

// ── Emotion classification unit tests ───────────────────────────────────────
test('classifyEmotion: explicit scene.mood overrides keyword scanning', () => {
  assert.strictEqual(classifyEmotion({ mood: 'suspense', description: 'a calm quiet day' }), 'suspense')
})
test('classifyEmotion: no keyword match falls back to calm', () => {
  assert.strictEqual(classifyEmotion({ description: 'A man opens a door' }), 'calm')
})
test('classifyEmotion: action keyword outranks calm keyword in the same scene', () => {
  assert.strictEqual(classifyEmotion({ description: 'A calm morning shattered by an explosion' }), 'action')
})

// ── Stock clip ranking ───────────────────────────────────────────────────────
test('scoreClip: fully-specified ideal candidate scores near 100', () => {
  const candidate = {
    tags: ['cinematic', 'aerial', 'travel'], width: 1080, height: 1920,
    motion: 'high', brightness: 0.55, orientation: 'portrait',
  }
  const { score } = scoreClip(candidate, { keywords: ['travel', 'aerial'], motionEnergy: 'high', targetOrientation: 'portrait', targetWidth: 720, targetHeight: 1280 })
  assert.ok(score >= 85, `expected a high score, got ${score}`)
})

test('scoreClip: candidate with no metadata at all still scores a neutral ~50', () => {
  const { score } = scoreClip({}, {})
  assert.ok(score >= 45 && score <= 55, `expected neutral score, got ${score}`)
})

test('scoreClip: score is a single-decimal number (matches "score: 91.3" spec example)', () => {
  const { score } = scoreClip({ width: 1080, height: 1920, brightness: 0.5 }, {})
  assert.strictEqual(score, Math.round(score * 10) / 10)
})

test('rankClips: sorts candidates best-first, highest score wins', () => {
  const candidates = [
    { id: 'low', width: 100, height: 100 },
    { id: 'high', width: 1080, height: 1920, tags: ['cinematic', 'travel'], brightness: 0.55, orientation: 'portrait' },
  ]
  const ranked = rankClips(candidates, { keywords: ['travel'], targetOrientation: 'portrait', targetWidth: 720, targetHeight: 1280 })
  assert.strictEqual(ranked[0].id, 'high')
  assert.ok(ranked[0].score >= ranked[1].score)
})

test('rankClips: empty/missing candidates returns an empty array, never throws', () => {
  assert.deepStrictEqual(rankClips([], {}), [])
  assert.deepStrictEqual(rankClips(undefined, {}), [])
})

test('createDirectingPlan: rankedClips is populated only for scenes with candidateClips', () => {
  const scenes = [
    { scene_number: 1, description: 'A calm walk', candidateClips: [{ id: 'a', width: 720, height: 1280 }, { id: 'b', width: 200, height: 200 }] },
    { scene_number: 2, description: 'Another scene, no candidates supplied' },
  ]
  const plan = createDirectingPlan({ scenes, duration: 10 })
  assert.strictEqual(plan.rankedClips.length, 1)
  assert.strictEqual(plan.rankedClips[0].scene_number, 1)
  assert.strictEqual(plan.rankedClips[0].candidates.length, 2)
  assert.ok(plan.rankedClips[0].candidates[0].score >= plan.rankedClips[0].candidates[1].score)
})

// ── Purity / determinism / no I/O ────────────────────────────────────────────
test('identical input always produces identical output (pure/deterministic)', () => {
  const scenes = makeScenes(6, (i) => (i % 2 === 0 ? 'An intense chase' : 'A calm quiet walk'))
  const a = createDirectingPlan({ scenes, duration: 30, movieStyle: 'cinematic', targetPlatform: 'tiktok' })
  const b = createDirectingPlan({ scenes, duration: 30, movieStyle: 'cinematic', targetPlatform: 'tiktok' })
  assert.deepStrictEqual(a, b)
})

// ── Performance: 1000 scenes ─────────────────────────────────────────────────
test('1000 scenes: correctness and performance (<1s)', () => {
  const scenes = makeScenes(1000, (i) => (i % 5 === 0 ? 'A desperate chase through fire and explosions' : 'A short calm scene'))
  const startedAt = Date.now()
  const plan = createDirectingPlan({ scenes, duration: 3000, movieStyle: 'documentary', targetPlatform: 'youtube' })
  const elapsedMs = Date.now() - startedAt

  assertConsistentPlan(plan, 1000)
  assert.ok(elapsedMs < 1000, `1000-scene plan took ${elapsedMs}ms, expected < 1000ms`)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
