'use strict'

// Zero-dependency test runner (matches sceneTiming.test.js) — run with:
//   node worker/tests/clipAnalyzer.test.js
const assert   = require('assert')
const os       = require('os')
const path     = require('path')
const fs       = require('fs')
const { spawnSync } = require('child_process')
const { FFMPEG_BIN } = require('../src/services/ffmpegUtils')
const { analyzeClip } = require('../src/services/clipAnalyzer')

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

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'clipAnalyzer-test-'))

function makeSyntheticClip(name, { duration = 2, width = 320, height = 240, fps = 25, withAudio = false } = {}) {
  const outPath = path.join(tmpDir, name)
  const args = [
    '-y',
    '-f', 'lavfi', '-i', `testsrc=duration=${duration}:size=${width}x${height}:rate=${fps}`,
  ]
  if (withAudio) {
    args.push('-f', 'lavfi', '-i', `sine=frequency=440:duration=${duration}`)
  }
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p')
  if (withAudio) args.push('-c:a', 'aac')
  args.push(outPath)

  const res = spawnSync(FFMPEG_BIN, args, { timeout: 30000 })
  if (res.status !== 0) {
    throw new Error(`failed to generate synthetic clip ${name}: ${(res.stderr || '').toString().slice(-500)}`)
  }
  return outPath
}

function makeCorruptFile(name) {
  const outPath = path.join(tmpDir, name)
  fs.writeFileSync(outPath, 'this is not a video file')
  return outPath
}

async function main() {
  console.log('clipAnalyzer.test.js')

  const silentClip = makeSyntheticClip('silent.mp4', { duration: 2, width: 320, height: 240, fps: 25 })
  const audioClip  = makeSyntheticClip('with-audio.mp4', { duration: 1, width: 160, height: 120, fps: 24, withAudio: true })
  const corruptClip = makeCorruptFile('corrupt.mp4')

  await test('reports correct duration/width/height/fps for a synthetic clip', async () => {
    const info = await analyzeClip(silentClip)
    assert.ok(Math.abs(info.duration - 2) < 0.2, `expected ~2s, got ${info.duration}`)
    assert.strictEqual(info.width, 320)
    assert.strictEqual(info.height, 240)
    assert.ok(Math.abs(info.fps - 25) < 1, `expected ~25fps, got ${info.fps}`)
    assert.strictEqual(info.codec, 'h264')
    assert.strictEqual(info.hasAudio, false)
    assert.strictEqual(info.rotation, 0)
  })

  await test('detects an audio stream when present', async () => {
    const info = await analyzeClip(audioClip)
    assert.strictEqual(info.hasAudio, true)
  })

  await test('returns a positive bitrate', async () => {
    const info = await analyzeClip(silentClip)
    assert.ok(info.bitrate > 0, `expected bitrate > 0, got ${info.bitrate}`)
  })

  await test('missing file throws', async () => {
    await assert.rejects(() => analyzeClip(path.join(tmpDir, 'does-not-exist.mp4')))
  })

  await test('corrupt file throws', async () => {
    await assert.rejects(() => analyzeClip(corruptClip))
  })

  fs.rmSync(tmpDir, { recursive: true, force: true })

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main()
