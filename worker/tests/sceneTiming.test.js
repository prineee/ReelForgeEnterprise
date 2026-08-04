'use strict'

// Zero-dependency test runner (the worker project has no test framework
// installed) — run with: node worker/tests/sceneTiming.test.js
const assert = require('assert')
const { calculateSceneTiming } = require('../src/services/sceneTiming')

const TOLERANCE = 0.1

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
    description: textFn ? textFn(i) : `Scene ${i + 1} description`,
  }))
}

function assertConsistentTimeline(timeline, narrationDuration, expectedLength) {
  assert.strictEqual(timeline.length, expectedLength, `expected ${expectedLength} entries, got ${timeline.length}`)

  const total = timeline.reduce((sum, t) => sum + t.duration, 0)
  assert.ok(
    Math.abs(total - narrationDuration) <= TOLERANCE,
    `sum(duration)=${total} vs narrationDuration=${narrationDuration} (diff > ${TOLERANCE})`
  )

  if (timeline.length > 0) {
    assert.strictEqual(timeline[0].start, 0, 'first scene must start at 0')
  }

  for (let i = 0; i < timeline.length; i++) {
    const t = timeline[i]
    assert.ok(t.duration >= 0, `scene ${t.scene_number} has negative duration`)
    assert.ok(
      Math.abs(t.end - (t.start + t.duration)) < 1e-9,
      `scene ${t.scene_number}: end !== start + duration`
    )
    if (i > 0) {
      assert.ok(
        Math.abs(t.start - timeline[i - 1].end) < 1e-9,
        `scene ${t.scene_number}: start does not follow previous scene's end`
      )
    }
  }
}

console.log('sceneTiming.test.js')

test('2 scenes — equal strategy splits evenly', () => {
  const scenes = makeScenes(2)
  const timeline = calculateSceneTiming({ scenes, narrationDuration: 60, strategy: 'equal' })
  assertConsistentTimeline(timeline, 60, 2)
  assert.strictEqual(timeline[0].duration, 30)
  assert.strictEqual(timeline[1].duration, 30)
})

test('2 scenes — weighted strategy gives the richer scene more time', () => {
  const scenes = [
    { scene_number: 1, description: 'A girl walks' },
    { scene_number: 2, description: 'The girl runs through the forest while being chased by a wolf' },
  ]
  const timeline = calculateSceneTiming({ scenes, narrationDuration: 60 })
  assertConsistentTimeline(timeline, 60, 2)
  assert.ok(timeline[1].duration > timeline[0].duration, 'scene with action + more text should get more duration')
})

test('5 scenes — weighted strategy stays internally consistent', () => {
  const scenes = makeScenes(5, (i) => (i % 2 === 0 ? 'A calm short moment' : 'A furious chase and explosion scene with much more dialogue'))
  const timeline = calculateSceneTiming({ scenes, narrationDuration: 90 })
  assertConsistentTimeline(timeline, 90, 5)
})

test('10 scenes — dialogue strategy rewards longer voiceover', () => {
  const scenes = makeScenes(10, (i) => `word `.repeat(i + 1).trim())
  const timeline = calculateSceneTiming({
    scenes: scenes.map((s, i) => ({ scene_number: s.scene_number, voiceover: s.description })),
    narrationDuration: 120,
    strategy: 'dialogue',
  })
  assertConsistentTimeline(timeline, 120, 10)
  // durations should be non-decreasing as dialogue word count increases
  for (let i = 1; i < timeline.length; i++) {
    assert.ok(timeline[i].duration >= timeline[i - 1].duration - 1e-6, `scene ${i + 1} duration should not be less than scene ${i}`)
  }
})

test('empty list returns []', () => {
  const timeline = calculateSceneTiming({ scenes: [], narrationDuration: 60 })
  assert.deepStrictEqual(timeline, [])
})

test('1 scene consumes the entire narration duration', () => {
  const scenes = makeScenes(1)
  const timeline = calculateSceneTiming({ scenes, narrationDuration: 42.5 })
  assertConsistentTimeline(timeline, 42.5, 1)
  assert.strictEqual(timeline[0].duration, 42.5)
  assert.strictEqual(timeline[0].start, 0)
  assert.strictEqual(timeline[0].end, 42.5)
})

test('90 minute movie (30 scenes)', () => {
  const scenes = makeScenes(30, (i) => (i % 3 === 0 ? 'An intense battle and explosion' : 'A quiet walk'))
  const narrationDuration = 90 * 60
  const timeline = calculateSceneTiming({ scenes, narrationDuration })
  assertConsistentTimeline(timeline, narrationDuration, 30)
})

test('3 hour movie (1000 scenes) — correctness and performance', () => {
  const scenes = makeScenes(1000, (i) => (i % 5 === 0 ? 'A desperate, terrified chase through fire and explosions' : 'A short scene'))
  const narrationDuration = 3 * 60 * 60

  const startedAt = Date.now()
  const timeline = calculateSceneTiming({ scenes, narrationDuration })
  const elapsedMs = Date.now() - startedAt

  assertConsistentTimeline(timeline, narrationDuration, 1000)
  assert.ok(elapsedMs < 500, `1000-scene timing took ${elapsedMs}ms, expected < 500ms`)
})

test('cinematic strategy produces a valid, consistent timeline', () => {
  const scenes = makeScenes(6, (i) => (i === 2 ? 'An epic furious battle with explosions and terror' : 'A brief establishing shot'))
  const timeline = calculateSceneTiming({ scenes, narrationDuration: 60, strategy: 'cinematic' })
  assertConsistentTimeline(timeline, 60, 6)
})

test('unknown strategy falls back to the weighted default instead of throwing', () => {
  const scenes = makeScenes(3)
  const timeline = calculateSceneTiming({ scenes, narrationDuration: 30, strategy: 'not-a-real-strategy' })
  assertConsistentTimeline(timeline, 30, 3)
})

test('negative narrationDuration throws', () => {
  assert.throws(() => calculateSceneTiming({ scenes: makeScenes(2), narrationDuration: -5 }))
})

test('missing scenes returns [] rather than throwing', () => {
  const timeline = calculateSceneTiming({ narrationDuration: 60 })
  assert.deepStrictEqual(timeline, [])
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exit(1)
