'use strict'

// Zero-dependency test runner (matches sceneTiming.test.js / clipAnalyzer.test.js /
// normalizeClipDuration.test.js) — run with: node worker/tests/transitionEngine.test.js
const assert   = require('assert')
const os       = require('os')
const path     = require('path')
const fs       = require('fs')
const { spawnSync } = require('child_process')
const { FFMPEG_BIN } = require('../src/services/ffmpegUtils')
const { analyzeClip } = require('../src/services/clipAnalyzer')
const {
  TRANSITION_TYPES,
  DEFAULT_TRANSITION,
  buildTransitionGraph,
  buildFilterComplex,
  renderTransitionChain,
  ffmpegSupportsXfade,
  classifyMood,
  selectAutoTransition,
  clampTransitionDuration,
} = require('../src/services/transitionEngine')

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    passed++
    console.log(`  ok - ${name}`)
  } catch (err) {
    failed++
    console.error(`  FAIL - ${name}`)
    console.error(`    ${err.message}`)
  }
}

function makeScenes(n, duration = 5) {
  return Array.from({ length: n }, (_, i) => ({ scene_number: i + 1, duration }))
}

function sumDurations(scenes) {
  return scenes.reduce((s, sc) => s + sc.duration, 0)
}

function assertConsistentGraph(graph, scenes) {
  assert.strictEqual(graph.transitions.length, Math.max(0, scenes.length - 1))
  // sequential coverage: every fromScene->toScene pair matches consecutive scenes
  for (let i = 0; i < graph.transitions.length; i++) {
    assert.strictEqual(graph.transitions[i].fromScene, scenes[i].scene_number)
    assert.strictEqual(graph.transitions[i].toScene, scenes[i + 1].scene_number)
  }
  assert.ok(graph.totalDuration > 0 || scenes.length === 0)
  assert.ok(graph.totalDuration <= sumDurations(scenes) + 1e-6, 'crossfades/cuts can never exceed the naive sum of durations')
}

async function main() {
  console.log('transitionEngine.test.js')

  // ── buildTransitionGraph: scale/shape ───────────────────────────────────
  await test('2 scenes -> 1 transition', () => {
    const scenes = makeScenes(2)
    const graph = buildTransitionGraph({ scenes, transitionStyle: 'fade', transitionDuration: 0.5 })
    assertConsistentGraph(graph, scenes)
    assert.strictEqual(graph.transitions[0].type, 'fade')
  })

  await test('5 scenes -> 4 transitions, consistent chain', () => {
    const scenes = makeScenes(5, 4)
    const graph = buildTransitionGraph({ scenes, transitionStyle: 'dissolve', transitionDuration: 0.5 })
    assertConsistentGraph(graph, scenes)
  })

  await test('20 scenes -> 19 transitions, correctness and performance', () => {
    const scenes = makeScenes(20, 6)
    const t0 = Date.now()
    const graph = buildTransitionGraph({ scenes, transitionStyle: 'auto', transitionDuration: 0.5 })
    const elapsedMs = Date.now() - t0
    assertConsistentGraph(graph, scenes)
    assert.ok(elapsedMs < 200, `20-scene graph took ${elapsedMs}ms, expected < 200ms`)
  })

  await test('1 scene -> no transitions, totalDuration = scene duration', () => {
    const scenes = makeScenes(1, 7.5)
    const graph = buildTransitionGraph({ scenes, transitionStyle: 'fade' })
    assert.deepStrictEqual(graph.transitions, [])
    assert.strictEqual(graph.totalDuration, 7.5)
  })

  await test('0 scenes -> empty graph', () => {
    const graph = buildTransitionGraph({ scenes: [] })
    assert.deepStrictEqual(graph.transitions, [])
    assert.strictEqual(graph.totalDuration, 0)
  })

  // ── Safety: durations and clip-length interplay ─────────────────────────
  await test('very short clips: transition duration always stays below clip duration', () => {
    const scenes = makeScenes(6, 0.3)
    const graph = buildTransitionGraph({ scenes, transitionStyle: 'fade', transitionDuration: 1.0 })
    graph.transitions.forEach(t => {
      assert.ok(t.duration < 0.3, `transition duration ${t.duration} not below 0.3s clip`)
      assert.ok(t.offset >= 0, 'offset must never be negative')
    })
  })

  await test('long clips: requested transition duration is honored (no unnecessary clamping)', () => {
    const scenes = makeScenes(4, 60)
    const graph = buildTransitionGraph({ scenes, transitionStyle: 'dissolve', transitionDuration: 0.5 })
    graph.transitions.forEach(t => assert.strictEqual(t.duration, 0.5))
  })

  await test('clampTransitionDuration caps at 40% of the shorter adjoining clip', () => {
    assert.ok(clampTransitionDuration(1.0, 1, 10) <= 0.4)
    assert.ok(clampTransitionDuration(1.0, 10, 1) <= 0.4)
    assert.strictEqual(clampTransitionDuration(0.2, 100, 100), 0.2)
  })

  await test('requested transitionDuration outside [0.1, 1.5] is clamped', () => {
    const scenes = makeScenes(2, 100)
    const tooBig = buildTransitionGraph({ scenes, transitionStyle: 'fade', transitionDuration: 10 })
    assert.strictEqual(tooBig.transitions[0].duration, 1.5)
    const tooSmall = buildTransitionGraph({ scenes, transitionStyle: 'fade', transitionDuration: 0.001 })
    assert.strictEqual(tooSmall.transitions[0].duration, 0.1)
  })

  await test('invalid scene duration throws', () => {
    assert.throws(() => buildTransitionGraph({ scenes: [{ scene_number: 1, duration: 5 }, { scene_number: 2, duration: 0 }] }))
    assert.throws(() => buildTransitionGraph({ scenes: [{ scene_number: 1, duration: -3 }] }))
  })

  // ── Explicit style selection covers every supported type ───────────────
  await test('every supported transition type can be explicitly requested', () => {
    for (const type of TRANSITION_TYPES) {
      const scenes = makeScenes(2, 10)
      const graph = buildTransitionGraph({ scenes, transitionStyle: type, transitionDuration: 0.5 })
      assert.strictEqual(graph.transitions[0].type, type)
    }
  })

  await test('cut transitions have zero duration and no overlap savings', () => {
    const scenes = makeScenes(3, 5)
    const graph = buildTransitionGraph({ scenes, transitionStyle: 'cut' })
    assert.strictEqual(graph.totalDuration, 15)
    graph.transitions.forEach(t => assert.strictEqual(t.duration, 0))
  })

  await test('unknown/omitted style falls back to the documented default (fade)', () => {
    const scenes = makeScenes(2, 5)
    const graph1 = buildTransitionGraph({ scenes, transitionStyle: 'not-a-real-style' })
    const graph2 = buildTransitionGraph({ scenes })
    assert.strictEqual(graph1.transitions[0].type, DEFAULT_TRANSITION)
    assert.strictEqual(graph2.transitions[0].type, DEFAULT_TRANSITION)
  })

  // ── Auto mode: mood -> transition mapping ───────────────────────────────
  await test('auto mode: calm scene -> fade', () => {
    assert.strictEqual(selectAutoTransition({ description: 'A calm and peaceful morning' }), 'fade')
  })
  await test('auto mode: fast action scene -> cut', () => {
    assert.strictEqual(selectAutoTransition({ description: 'An intense car chase and explosion' }), 'cut')
  })
  await test('auto mode: emotional scene -> dissolve', () => {
    assert.strictEqual(selectAutoTransition({ description: 'She breaks into tears during the reunion' }), 'dissolve')
  })
  await test('auto mode: travel scene -> slide', () => {
    assert.strictEqual(selectAutoTransition({ description: 'Their journey continues down the highway' }), 'slide-left')
  })
  await test('auto mode: suspenseful scene -> dip-to-black', () => {
    assert.strictEqual(selectAutoTransition({ description: 'A dark and ominous shadow creeps closer' }), 'dip-to-black')
  })
  await test('auto mode: unrecognized scene falls back to default', () => {
    assert.strictEqual(selectAutoTransition({ description: 'A man opens a door' }), DEFAULT_TRANSITION)
  })
  await test('auto mode: explicit scene.mood overrides keyword scanning', () => {
    assert.strictEqual(classifyMood({ mood: 'suspense', description: 'a calm quiet day' }), 'suspense')
  })
  await test('auto mode: action keyword takes priority over calm keyword in the same scene', () => {
    assert.strictEqual(selectAutoTransition({ description: 'A calm morning shattered by an explosion' }), 'cut')
  })

  await test('mixed transition types: auto mode produces varied types across a diverse scene set', () => {
    const scenes = [
      { scene_number: 1, duration: 5, description: 'A calm quiet morning' },
      { scene_number: 2, duration: 5, description: 'An intense chase and explosion' },
      { scene_number: 3, duration: 5, description: 'A tearful emotional reunion' },
      { scene_number: 4, duration: 5, description: 'Their journey down the highway' },
      { scene_number: 5, duration: 5, description: 'A dark ominous shadow' },
    ]
    const graph = buildTransitionGraph({ scenes, transitionStyle: 'auto', transitionDuration: 0.5 })
    const types = new Set(graph.transitions.map(t => t.type))
    assert.ok(types.size >= 3, `expected a varied mix of transition types, got: ${[...types]}`)
  })

  // ── buildFilterComplex: pure filter-graph construction ──────────────────
  await test('buildFilterComplex: single clip needs no transition filters', () => {
    const { filter, outputLabel } = buildFilterComplex(1, [])
    assert.strictEqual(outputLabel, 'vfinal')
    assert.ok(filter.includes('[0:v]'))
  })

  await test('buildFilterComplex: mixed cut/crossfade pairs use concat and xfade respectively', () => {
    const scenes = [
      { scene_number: 1, duration: 5 }, { scene_number: 2, duration: 5 }, { scene_number: 3, duration: 5 },
    ]
    const graph = buildTransitionGraph({ scenes, transitionStyle: 'cut' })
    graph.transitions[0] = { ...graph.transitions[0], type: 'dissolve', duration: 0.5 }
    const { filter } = buildFilterComplex(3, graph.transitions)
    assert.ok(filter.includes('xfade=transition=dissolve'), 'expected an xfade for the dissolve pair')
    assert.ok(filter.includes('concat=n=2:v=1:a=0'), 'expected a concat filter for the cut pair')
  })

  await test('buildFilterComplex: mismatched transitions count throws', () => {
    assert.throws(() => buildFilterComplex(3, []))
  })

  // ── Real FFmpeg integration ──────────────────────────────────────────────
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transitionEngine-test-'))
  let clipCounter = 0
  function makeSyntheticClip(duration) {
    clipCounter++
    const outPath = path.join(tmpDir, `clip_${clipCounter}.mp4`)
    const res = spawnSync(FFMPEG_BIN, [
      '-y', '-f', 'lavfi', '-i', `testsrc=duration=${duration}:size=320x240:rate=25`,
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outPath,
    ], { timeout: 30000 })
    if (res.status !== 0) throw new Error(`failed to generate synthetic clip: ${(res.stderr || '').toString().slice(-500)}`)
    return outPath
  }

  const xfadeSupported = await ffmpegSupportsXfade()
  console.log(`  (this FFmpeg build ${xfadeSupported ? 'supports' : 'does NOT support'} xfade — ${xfadeSupported ? 'true crossfades' : 'hard-cut fallback'} will be exercised below)`)

  await test('renderTransitionChain: cut transitions render correctly and preserve total duration', async () => {
    const durations = [3, 2, 4]
    const clips = durations.map(makeSyntheticClip)
    const scenes = durations.map((d, i) => ({ scene_number: i + 1, duration: d }))
    const graph = buildTransitionGraph({ scenes, transitionStyle: 'cut' })

    const out = path.join(tmpDir, 'rendered_cut.mp4')
    const result = await renderTransitionChain(clips, graph, out)

    assert.strictEqual(result.downgradedToHardCuts, false, 'cut-only graphs never need the xfade fallback')
    const info = await analyzeClip(result.outputPath)
    assert.strictEqual(info.width, 720)
    assert.strictEqual(info.height, 1280)
    assert.strictEqual(info.codec, 'h264')
    assert.ok(Math.abs(result.actualDuration - graph.totalDuration) < 0.3, `actualDuration ${result.actualDuration} vs planned ${graph.totalDuration}`)
  })

  await test('renderTransitionChain: crossfade style renders and reports actualDuration honestly (whether or not xfade is supported)', async () => {
    const durations = [4, 4, 4]
    const clips = durations.map(makeSyntheticClip)
    const scenes = durations.map((d, i) => ({ scene_number: i + 1, duration: d }))
    const graph = buildTransitionGraph({ scenes, transitionStyle: 'dissolve', transitionDuration: 0.5 })

    const out = path.join(tmpDir, 'rendered_dissolve.mp4')
    const result = await renderTransitionChain(clips, graph, out)

    assert.strictEqual(result.downgradedToHardCuts, !xfadeSupported)
    const expectedDuration = xfadeSupported ? graph.totalDuration : durations.reduce((a, b) => a + b, 0)
    assert.ok(Math.abs(result.actualDuration - expectedDuration) < 0.3, `actualDuration ${result.actualDuration} vs expected ${expectedDuration}`)
  })

  await test('renderTransitionChain: mismatched clip/transition counts throws', async () => {
    const clips = [makeSyntheticClip(2), makeSyntheticClip(2)]
    const graph = buildTransitionGraph({ scenes: makeScenes(3, 2), transitionStyle: 'cut' })
    await assert.rejects(() => renderTransitionChain(clips, graph, path.join(tmpDir, 'bad.mp4')))
  })

  await test('renderTransitionChain: missing clip throws', async () => {
    const graph = buildTransitionGraph({ scenes: makeScenes(2, 2), transitionStyle: 'cut' })
    await assert.rejects(() => renderTransitionChain(
      [path.join(tmpDir, 'nope.mp4'), path.join(tmpDir, 'nope2.mp4')], graph, path.join(tmpDir, 'bad2.mp4')
    ))
  })

  fs.rmSync(tmpDir, { recursive: true, force: true })

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main()
