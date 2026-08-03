'use strict'

// Zero-dependency test runner (matches sceneTiming.test.js / clipAnalyzer.test.js) — run with:
//   node worker/tests/normalizeClipDuration.test.js
const assert   = require('assert')
const os       = require('os')
const path     = require('path')
const fs       = require('fs')
const { spawnSync } = require('child_process')
const { FFMPEG_BIN } = require('../src/services/ffmpegUtils')
const { analyzeClip } = require('../src/services/clipAnalyzer')
const {
  normalizeClipDuration,
  classifyStrategy,
  computeLoopPlan,
  STRATEGIES,
} = require('../src/services/movieAssemblerV2')

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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'normalizeClipDuration-test-'))
let clipCounter = 0

function makeSyntheticClip(duration, { width = 320, height = 240, fps = 25 } = {}) {
  clipCounter++
  const outPath = path.join(tmpDir, `clip_${clipCounter}.mp4`)
  const res = spawnSync(FFMPEG_BIN, [
    '-y',
    '-f', 'lavfi', '-i', `testsrc=duration=${duration}:size=${width}x${height}:rate=${fps}`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
    outPath,
  ], { timeout: 30000 })
  if (res.status !== 0) {
    throw new Error(`failed to generate synthetic clip: ${(res.stderr || '').toString().slice(-500)}`)
  }
  return outPath
}

function makeCorruptFile() {
  clipCounter++
  const outPath = path.join(tmpDir, `corrupt_${clipCounter}.mp4`)
  fs.writeFileSync(outPath, 'this is not a video file')
  return outPath
}

async function assertGoodOutput(outputPath, expectedDuration, toleranceSecs = 0.35) {
  assert.ok(fs.existsSync(outputPath), `output does not exist: ${outputPath}`)
  assert.ok(fs.statSync(outputPath).size > 0, `output is empty: ${outputPath}`)

  const info = await analyzeClip(outputPath)
  assert.ok(
    Math.abs(info.duration - expectedDuration) <= toleranceSecs,
    `duration ${info.duration.toFixed(3)}s not within ${toleranceSecs}s of target ${expectedDuration}s`
  )
  assert.strictEqual(info.width, 720, `expected width 720, got ${info.width}`)
  assert.strictEqual(info.height, 1280, `expected height 1280, got ${info.height}`)
  assert.strictEqual(info.codec, 'h264', `expected h264, got ${info.codec}`)
}

async function main() {
  console.log('normalizeClipDuration.test.js')

  // ── Pure strategy-selection logic ──────────────────────────────────────────
  await test('classifyStrategy: clip >= target -> TRIM', () => {
    assert.strictEqual(classifyStrategy(20, 10), STRATEGIES.TRIM)
    assert.strictEqual(classifyStrategy(10, 10), STRATEGIES.TRIM)
  })

  await test('classifyStrategy: clip 70-100% of target -> SLOW', () => {
    assert.strictEqual(classifyStrategy(9, 10), STRATEGIES.SLOW)
    assert.strictEqual(classifyStrategy(7, 10), STRATEGIES.SLOW)
  })

  await test('classifyStrategy: clip 40-70% of target -> LOOP_WITH_CROSSFADE', () => {
    assert.strictEqual(classifyStrategy(6.9, 10), STRATEGIES.LOOP_WITH_CROSSFADE)
    assert.strictEqual(classifyStrategy(4, 10), STRATEGIES.LOOP_WITH_CROSSFADE)
  })

  await test('classifyStrategy: clip under 40% of target -> DOWNLOAD_MORE', () => {
    assert.strictEqual(classifyStrategy(3.9, 10), STRATEGIES.DOWNLOAD_MORE)
    assert.strictEqual(classifyStrategy(0.5, 10), STRATEGIES.DOWNLOAD_MORE)
  })

  await test('computeLoopPlan: always produces a valid, exceeding-target plan', () => {
    for (const [clipDuration, targetDuration] of [[1, 10], [3, 8], [0.2, 5], [6, 25]]) {
      const { crossfadeDuration, reps } = computeLoopPlan(clipDuration, targetDuration)
      assert.ok(reps >= 2, `reps should be >= 2, got ${reps}`)
      assert.ok(crossfadeDuration > 0 && crossfadeDuration < clipDuration + 0.01, `crossfadeDuration ${crossfadeDuration} invalid for clip ${clipDuration}`)
      const totalTimeline = clipDuration + (reps - 1) * (clipDuration - crossfadeDuration)
      assert.ok(totalTimeline >= targetDuration, `plan for ${clipDuration}/${targetDuration} undershoots: ${totalTimeline}`)
    }
  })

  // ── Strategy A: long clip -> clean trim ─────────────────────────────────────
  await test('long clip (12s) trimmed cleanly to 5s target (Strategy A)', async () => {
    const clip = makeSyntheticClip(12)
    const out  = path.join(tmpDir, 'out_trim.mp4')
    await normalizeClipDuration(clip, out, 5)
    await assertGoodOutput(out, 5)
  })

  // ── Strategy A: exact-length clip ───────────────────────────────────────────
  await test('exact-length clip (5s) matches 5s target (Strategy A)', async () => {
    const clip = makeSyntheticClip(5)
    const out  = path.join(tmpDir, 'out_exact.mp4')
    await normalizeClipDuration(clip, out, 5)
    await assertGoodOutput(out, 5)
  })

  // ── Strategy B: slightly short clip -> slowed playback ──────────────────────
  await test('slightly short clip (85% of target) slowed to match (Strategy B)', async () => {
    const clip = makeSyntheticClip(8.5)
    const out  = path.join(tmpDir, 'out_slow.mp4')
    await normalizeClipDuration(clip, out, 10)
    await assertGoodOutput(out, 10)
  })

  // ── Strategy B overflow: clip needs >10% slowdown -> slow + crossfade top-up ──
  await test('clip needing more than 10% slowdown still reaches target (Strategy B + loop top-up)', async () => {
    const clip = makeSyntheticClip(7.2) // 72% of target — inside SLOW band, but 10% cap alone can't close the gap
    const out  = path.join(tmpDir, 'out_slow_topup.mp4')
    await normalizeClipDuration(clip, out, 10)
    await assertGoodOutput(out, 10)
  })

  // ── Strategy C: mid-short clip -> seamless loop with crossfade ──────────────
  await test('mid-short clip (50% of target) loops seamlessly (Strategy C)', async () => {
    const clip = makeSyntheticClip(5)
    const out  = path.join(tmpDir, 'out_loop.mp4')
    await normalizeClipDuration(clip, out, 10)
    await assertGoodOutput(out, 10)
  })

  // ── Strategy D: very short clip with no keyword/jobDir falls back to loop ───
  await test('very short clip (20% of target), no keyword available, falls back to LOOP_WITH_CROSSFADE (Strategy D)', async () => {
    const clip = makeSyntheticClip(2)
    const out  = path.join(tmpDir, 'out_download_fallback.mp4')
    await normalizeClipDuration(clip, out, 10)
    await assertGoodOutput(out, 10)
  })

  // ── Strategy D: keyword provided but no stock-API keys configured in this env ──
  // — download attempt fails fast (no network call, since downloadOneClip short-circuits
  // without an API key) and falls back to LOOP_WITH_CROSSFADE, same as above.
  await test('very short clip with a keyword still succeeds when no extra clip can be fetched', async () => {
    const clip = makeSyntheticClip(2)
    const out  = path.join(tmpDir, 'out_download_keyword_fallback.mp4')
    await normalizeClipDuration(clip, out, 10, { keyword: 'test keyword', jobDir: tmpDir, sceneLabel: 99 })
    await assertGoodOutput(out, 10)
  })

  // ── Missing clip ──────────────────────────────────────────────────────────
  await test('missing input clip throws', async () => {
    const out = path.join(tmpDir, 'out_missing.mp4')
    await assert.rejects(
      () => normalizeClipDuration(path.join(tmpDir, 'does-not-exist.mp4'), out, 5),
      /does not exist/
    )
  })

  // ── Corrupt clip ──────────────────────────────────────────────────────────
  await test('corrupt input clip throws', async () => {
    const clip = makeCorruptFile()
    const out  = path.join(tmpDir, 'out_corrupt.mp4')
    await assert.rejects(
      () => normalizeClipDuration(clip, out, 5),
      /could not analyze/
    )
  })

  // ── Invalid target duration ─────────────────────────────────────────────────
  await test('invalid target duration throws', async () => {
    const clip = makeSyntheticClip(3)
    const out  = path.join(tmpDir, 'out_invalid_target.mp4')
    await assert.rejects(() => normalizeClipDuration(clip, out, 0))
    await assert.rejects(() => normalizeClipDuration(clip, out, -5))
  })

  fs.rmSync(tmpDir, { recursive: true, force: true })

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main()
