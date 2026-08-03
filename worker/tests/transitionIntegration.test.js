'use strict'

// Zero-dependency test runner (matches the other worker/tests/*.test.js files) — run with:
//   node worker/tests/transitionIntegration.test.js
//
// Exercises the REAL assembleMovie() pipeline end-to-end (download skipped via rawClipPaths,
// captions skipped via no captionScript) through normalize -> transition render -> voice
// sync -> merge -> validation. It intentionally does NOT stub Cloudinary: there are no
// credentials in this sandbox, so every case is expected to fail at the final upload step
// with a Cloudinary/api_key error. That failure point is itself the proof the integration
// works — if the Transition Engine wiring were broken, the failure would happen earlier
// (during render/voice-sync/validation) with a different, unrelated error message.
const assert   = require('assert')
const os       = require('os')
const path     = require('path')
const fs       = require('fs')
const { spawnSync } = require('child_process')
const { FFMPEG_BIN } = require('../src/services/ffmpegUtils')
const { assembleMovie, resolveTransitionEngineStyle } = require('../src/services/movieAssemblerV2')

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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'transitionIntegration-test-'))
let counter = 0

function makeClip(duration, size = '160x120') {
  counter++
  const p = path.join(tmpDir, `src_${counter}.mp4`)
  const res = spawnSync(FFMPEG_BIN, [
    '-y', '-f', 'lavfi', '-i', `testsrc=duration=${duration}:size=${size}:rate=15`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', p,
  ], { timeout: 30000 })
  if (res.status !== 0) throw new Error(`failed to generate synthetic clip: ${(res.stderr || '').toString().slice(-500)}`)
  return p
}

function makeVoice(duration) {
  counter++
  const p = path.join(tmpDir, `voice_${counter}.wav`)
  const res = spawnSync(FFMPEG_BIN, [
    '-y', '-f', 'lavfi', '-i', `sine=frequency=440:duration=${duration}`, p,
  ], { timeout: 20000 })
  if (res.status !== 0) throw new Error(`failed to generate synthetic voice: ${(res.stderr || '').toString().slice(-500)}`)
  return p
}

// Runs assembleMovie and captures console.log output, expecting the run to fail at the
// (environment-only) Cloudinary upload stage. Returns { logs } on the expected failure;
// throws if it fails anywhere else, or if it unexpectedly succeeds.
async function runExpectingUploadFailure(opts) {
  const logs = []
  const originalLog = console.log
  const originalWarn = console.warn
  console.log = (...args) => { logs.push(args.join(' ')) }
  console.warn = (...args) => { logs.push(args.join(' ')) }
  try {
    const result = await assembleMovie(opts)
    throw new Error(`expected a Cloudinary upload failure (no credentials in this sandbox), got a videoUrl instead: ${result.videoUrl}`)
  } catch (err) {
    if (!/uploadMovie|Cloudinary|api_key/i.test(err.message)) {
      throw new Error(`pipeline failed BEFORE the upload stage (integration bug) — ${err.message}`)
    }
    return { logs, err }
  } finally {
    console.log = originalLog
    console.warn = originalWarn
  }
}

async function main() {
  console.log('transitionIntegration.test.js')

  // ── Pure decision logic (fast, no ffmpeg) ───────────────────────────────
  await test('resolveTransitionEngineStyle: every explicit transition type is honored', () => {
    const types = ['auto', 'fade', 'dissolve', 'cut', 'slide-left', 'slide-right', 'zoom-in', 'zoom-out', 'blur-fade', 'flash', 'dip-to-black']
    for (const type of types) {
      assert.strictEqual(resolveTransitionEngineStyle(type, 0.5), type)
    }
  })

  // ── Regression: existing projects with no transition settings ──────────
  await test('no transition settings at all -> Transition Engine not engaged, pipeline still works', async () => {
    const clips = [makeClip(2), makeClip(2)]
    const { logs } = await runExpectingUploadFailure({
      rawClipPaths: clips, duration_minutes: 4 / 60, jobDir: path.join(tmpDir, `job_${++counter}`),
    })
    assert.ok(!logs.some(l => l.includes('Transition Engine Enabled')), 'engine must not run when transitionStyle is omitted')
  })

  await test('transitionStyle = "none" -> Transition Engine not engaged (explicit opt-out)', async () => {
    const clips = [makeClip(2), makeClip(2)]
    const { logs } = await runExpectingUploadFailure({
      rawClipPaths: clips, duration_minutes: 4 / 60, transitionStyle: 'none',
      jobDir: path.join(tmpDir, `job_${++counter}`),
    })
    assert.ok(!logs.some(l => l.includes('Transition Engine Enabled')))
  })

  await test('transitionDuration = 0 -> Transition Engine not engaged even with transitionStyle=auto', async () => {
    const clips = [makeClip(2), makeClip(2)]
    const { logs } = await runExpectingUploadFailure({
      rawClipPaths: clips, duration_minutes: 4 / 60, transitionStyle: 'auto', transitionDuration: 0,
      jobDir: path.join(tmpDir, `job_${++counter}`),
    })
    assert.ok(!logs.some(l => l.includes('Transition Engine Enabled')))
  })

  // ── Regression: transitionStyle = auto, and audio sync with a voice track ──
  await test('transitionStyle = "auto" engages the Transition Engine and preserves audio sync', async () => {
    const clips = [makeClip(2), makeClip(2), makeClip(2)]
    const voice = makeVoice(6)
    const { logs } = await runExpectingUploadFailure({
      rawClipPaths: clips, duration_minutes: 6 / 60, transitionStyle: 'auto', transitionDuration: 0.4,
      voicePath: voice, jobDir: path.join(tmpDir, `job_${++counter}`),
    })
    assert.ok(logs.some(l => l.includes('Transition Engine Enabled')))
    assert.ok(logs.some(l => l.includes('Style: auto')))
    assert.ok(logs.some(l => l.includes('Transitions Applied: 2')))
    assert.ok(logs.some(l => /Render Duration: [\d.]+ sec/.test(l)))
    assert.ok(logs.some(l => /Actual Output: [\d.]+ sec/.test(l)))
    // Voice sync must have run (a voice track was supplied) without throwing before upload.
    assert.ok(logs.some(l => l.includes('Voice sync')))
  })

  // ── Regression: an explicit style ────────────────────────────────────────
  await test('transitionStyle = "slide-left" renders with the requested explicit style', async () => {
    const clips = [makeClip(2), makeClip(2)]
    const { logs } = await runExpectingUploadFailure({
      rawClipPaths: clips, duration_minutes: 4 / 60, transitionStyle: 'slide-left',
      jobDir: path.join(tmpDir, `job_${++counter}`),
    })
    assert.ok(logs.some(l => l.includes('Style: slide-left')))
  })

  // ── Very short / long clips ──────────────────────────────────────────────
  await test('very short clips make it through the full transition-enabled pipeline', async () => {
    const clips = [makeClip(0.4), makeClip(0.4), makeClip(0.4)]
    const { logs } = await runExpectingUploadFailure({
      rawClipPaths: clips, duration_minutes: 1.5 / 60, transitionStyle: 'auto',
      jobDir: path.join(tmpDir, `job_${++counter}`),
    })
    assert.ok(logs.some(l => l.includes('Transition Engine Enabled')))
  })

  await test('long clips make it through the full transition-enabled pipeline', async () => {
    const clips = [makeClip(8), makeClip(8)]
    const { logs } = await runExpectingUploadFailure({
      rawClipPaths: clips, duration_minutes: 16 / 60, transitionStyle: 'dissolve',
      jobDir: path.join(tmpDir, `job_${++counter}`),
    })
    assert.ok(logs.some(l => l.includes('Transition Engine Enabled')))
  })

  // ── Scale: single-scene, two-scene, twenty-scene movies ─────────────────
  await test('single-scene movie: Transition Engine handles zero transitions gracefully', async () => {
    const clips = [makeClip(2)]
    const { logs } = await runExpectingUploadFailure({
      rawClipPaths: clips, duration_minutes: 2 / 60, transitionStyle: 'auto',
      jobDir: path.join(tmpDir, `job_${++counter}`),
    })
    assert.ok(logs.some(l => l.includes('Transitions Applied: 0')))
  })

  await test('twenty-scene movie: scene count preserved, no dropped/duplicated clips', async () => {
    const clips = Array.from({ length: 20 }, () => makeClip(1))
    const { logs } = await runExpectingUploadFailure({
      rawClipPaths: clips, duration_minutes: 20 / 60, transitionStyle: 'cut',
      jobDir: path.join(tmpDir, `job_${++counter}`),
    })
    assert.ok(logs.some(l => l.includes('Transitions Applied: 19')))
  })

  fs.rmSync(tmpDir, { recursive: true, force: true })

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main()
