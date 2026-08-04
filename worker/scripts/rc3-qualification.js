'use strict'

// ReelForge Enterprise — MovieAssembler V2 Production Qualification Suite (RC3)
//
// Exercises the REAL rendering pipeline (normalize, timeline allocation, transitions,
// voice sync, ffprobe validation, cleanup) through real FFmpeg on locally generated
// synthetic fixtures. The network boundary (Cloudinary upload, the /api/burn-captions
// HTTP call) is mocked so this suite never touches production Cloudinary/Pexels/Pixabay
// accounts or quota — see RC3_RENDER_REPORT.md "Known limits" for why, and how to run a
// live-credentials pass deliberately.
//
// Run: node scripts/rc3-qualification.js

require('dotenv').config()

const path      = require('path')
const os        = require('os')
const fsSync    = require('fs')
const fs        = require('fs-extra')
const { spawn } = require('child_process')
const express   = require('express')

const { FFMPEG_BIN } = require('../src/services/ffmpegUtils')

// ── Mock the network boundary BEFORE anything calls it ──────────────────────────
// Both cloudinary.v2 and axios are Node module-cache singletons: every file that does
// `require('cloudinary').v2` or `require('axios')` gets the same object, and every call
// site (`cloudinary.uploader.upload(...)`, `axios.post(...)`) is a live property lookup
// at call time — so patching the shared object here intercepts every caller, including
// movieAssemblerV2.js and reelRoutes.js, without touching their source.
const cloudinary = require('cloudinary').v2
const axios      = require('axios')

let mockUploadCount = 0
let mockUploadBytes = 0
let mockUploadFailuresRemaining = 0 // used by the retry test to force N failures then succeed

cloudinary.uploader.upload = async function mockUpload(filePath, opts) {
  if (mockUploadFailuresRemaining > 0) {
    mockUploadFailuresRemaining--
    throw new Error('mock Cloudinary transient failure (simulated)')
  }
  if (!fsSync.existsSync(filePath)) throw new Error(`mock upload: file missing ${filePath}`)
  const size = fsSync.statSync(filePath).size
  if (size <= 0) throw new Error(`mock upload: file empty ${filePath}`)
  await new Promise(r => setTimeout(r, 15)) // simulate small network latency
  mockUploadCount++
  mockUploadBytes += size
  // Use the caller-supplied public_id (unique per movieId, as real uploadMovie() sets it) rather than
  // the file basename ("movie.mp4" for every job) — the basename collided across concurrent renders.
  const uniquePart = (opts && opts.public_id) || `${path.basename(filePath)}_${Date.now()}_${Math.random().toString(36).slice(2)}`
  return { secure_url: `https://fake-cdn.test/rc3/${uniquePart}.mp4`, bytes: size }
}

const realAxiosPost = axios.post.bind(axios)
axios.post = async function mockAxiosPost(url, body, config) {
  if (typeof url === 'string' && url.includes('/api/burn-captions')) {
    await new Promise(r => setTimeout(r, 15))
    return { data: { video_url: `https://fake-cdn.test/rc3/captioned_${Date.now()}.mp4` } }
  }
  return realAxiosPost(url, body, config)
}

const MovieAssemblerV2 = require('../src/services/movieAssemblerV2')

// ── Test harness ──────────────────────────────────────────────────────────────
const results = []

async function runTest(category, name, fn) {
  const start = Date.now()
  try {
    const extra = await fn()
    const ms = Date.now() - start
    results.push({ category, name, pass: true, ms, extra: extra || null })
    console.log(`[RC3] PASS  ${category} :: ${name}  (${ms}ms)`)
    return extra
  } catch (err) {
    const ms = Date.now() - start
    results.push({ category, name, pass: false, ms, error: err.message })
    console.error(`[RC3] FAIL  ${category} :: ${name}  (${ms}ms) -- ${err.message}`)
    return null
  }
}

// ── Fixture generation ───────────────────────────────────────────────────────
function runFfmpegSync(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    proc.stderr.on('data', d => { stderr += d.toString() })
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(stderr.slice(-500))))
    proc.on('error', reject)
  })
}

async function makeFixtureClip(outPath, durationSecs) {
  await runFfmpegSync([
    '-y', '-f', 'lavfi', '-i', `testsrc=duration=${durationSecs}:size=640x480:rate=30`,
    '-c:v', 'libx264', '-pix_fmt', 'yuv420p', outPath,
  ])
}

async function makeFixtureVoice(outPath, durationSecs) {
  await runFfmpegSync([
    '-y', '-f', 'lavfi', '-i', `sine=frequency=440:duration=${durationSecs}`,
    '-c:a', 'pcm_s16le', outPath,
  ])
}

function dirSize(dir) {
  let total = 0
  function walk(d) {
    let entries
    try { entries = fsSync.readdirSync(d, { withFileTypes: true }) } catch { return }
    for (const e of entries) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else { try { total += fsSync.statSync(p).size } catch { /* ignore */ } }
    }
  }
  walk(dir)
  return total
}

// ── Report accumulators ──────────────────────────────────────────────────────
const perf = {
  renderMs: [],
  normalizeMs: [],
  uploadMs: [],
  peakHeapMB: 0,
  peakRssMB: 0,
  largestTempDirBytes: 0,
}

function recordPerf(timings) {
  if (!timings) return
  if (timings.totalMs)     perf.renderMs.push(timings.totalMs)
  if (timings.normalizeMs) perf.normalizeMs.push(timings.normalizeMs)
  if (timings.uploadMs)    perf.uploadMs.push(timings.uploadMs)
}

function sampleMemory() {
  const mem = process.memoryUsage()
  perf.peakHeapMB = Math.max(perf.peakHeapMB, mem.heapUsed / 1024 / 1024)
  perf.peakRssMB  = Math.max(perf.peakRssMB, mem.rss / 1024 / 1024)
}

function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0 }

async function main() {
  const suiteRoot = path.join(os.tmpdir(), `rc3_qualification_${Date.now()}`)
  await fs.ensureDir(suiteRoot)

  console.log('[RC3] ============================================================')
  console.log('[RC3] MovieAssembler V2 — Production Qualification Suite (RC3)')
  console.log('[RC3] Fixtures + suite root:', suiteRoot)
  console.log('[RC3] ============================================================')

  // ── Fixtures ────────────────────────────────────────────────────────────────
  const fixturesDir = path.join(suiteRoot, 'fixtures')
  await fs.ensureDir(fixturesDir)

  const fixtureClips = []
  for (const [name, secs] of [['a.mp4', 3], ['b.mp4', 4], ['c.mp4', 6]]) {
    const p = path.join(fixturesDir, name)
    await makeFixtureClip(p, secs)
    fixtureClips.push(p)
  }

  const shortVoice = path.join(fixturesDir, 'voice_short.wav') // 12s — shorter than most test videos -> trim path
  await makeFixtureVoice(shortVoice, 12)

  function cycleClips(n) {
    return Array.from({ length: n }, (_, i) => fixtureClips[i % fixtureClips.length])
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 1. RENDER QUALIFICATION MATRIX
  // ══════════════════════════════════════════════════════════════════════════

  console.log('\n[RC3] --- Scene count sweep (fixed 60s movie) ---')
  for (const n of [1, 2, 5, 10, 20, 30]) {
    const extra = await runTest('scene-count', `${n} scene(s)`, async () => {
      sampleMemory()
      const result = await MovieAssemblerV2.assembleMovie({
        rawClipPaths: cycleClips(n),
        movieId: `rc3_scenes_${n}`,
        duration_minutes: 1,
      })
      sampleMemory()
      if (!result.videoUrl) throw new Error('no videoUrl returned')
      recordPerf(result.timings)
      return { timings: result.timings }
    })
    if (extra) recordPerf(extra.timings)
  }

  console.log('\n[RC3] --- Movie-length sweep (fixed 4 scenes) ---')
  for (const [label, minutes] of [['60-second movie', 1], ['3-minute movie', 3], ['5-minute movie', 5], ['10-minute movie', 10]]) {
    await runTest('duration', label, async () => {
      const result = await MovieAssemblerV2.assembleMovie({
        rawClipPaths: cycleClips(4),
        movieId: `rc3_dur_${minutes}`,
        duration_minutes: minutes,
      })
      if (!result.videoUrl) throw new Error('no videoUrl returned')
      recordPerf(result.timings)
    })
  }

  console.log('\n[RC3] --- Voice on/off ---')
  await runTest('voice', 'with voice', async () => {
    const result = await MovieAssemblerV2.assembleMovie({
      rawClipPaths: cycleClips(3),
      movieId: 'rc3_voice_on',
      duration_minutes: 1,
      voicePath: shortVoice,
    })
    if (!result.videoUrl) throw new Error('no videoUrl returned')
    recordPerf(result.timings)
  })
  await runTest('voice', 'without voice', async () => {
    const result = await MovieAssemblerV2.assembleMovie({
      rawClipPaths: cycleClips(3),
      movieId: 'rc3_voice_off',
      duration_minutes: 1,
    })
    if (!result.videoUrl) throw new Error('no videoUrl returned')
    recordPerf(result.timings)
  })

  console.log('\n[RC3] --- Captions on/off ---')
  await runTest('captions', 'captions on', async () => {
    const result = await MovieAssemblerV2.assembleMovie({
      rawClipPaths: cycleClips(3),
      movieId: 'rc3_captions_on',
      duration_minutes: 1,
      captionScript: 'This is an RC3 qualification caption burn test.',
    })
    if (!result.videoUrl || !result.videoUrl.includes('captioned')) {
      throw new Error(`expected captioned video_url, got: ${result.videoUrl}`)
    }
    recordPerf(result.timings)
  })
  await runTest('captions', 'captions off', async () => {
    const result = await MovieAssemblerV2.assembleMovie({
      rawClipPaths: cycleClips(3),
      movieId: 'rc3_captions_off',
      duration_minutes: 1,
    })
    if (!result.videoUrl || result.videoUrl.includes('captioned')) {
      throw new Error(`expected uncaptioned video_url, got: ${result.videoUrl}`)
    }
    recordPerf(result.timings)
  })

  console.log('\n[RC3] --- Transitions: none / fade / crossfade ---')
  const xfadeSupported = await MovieAssemblerV2.ffmpegSupportsXfade()
  console.log(`[RC3] FFmpeg xfade filter supported on this build: ${xfadeSupported}`)
  for (const transition of ['none', 'fade', 'crossfade']) {
    await runTest('transition', transition, async () => {
      const result = await MovieAssemblerV2.assembleMovie({
        rawClipPaths: cycleClips(3),
        movieId: `rc3_transition_${transition}`,
        duration_minutes: 0.5,
        transition,
      })
      if (!result.videoUrl) throw new Error('no videoUrl returned')
      recordPerf(result.timings)
    })
  }

  // ── One deep-dive golden-path render: independently probed AFTER cleanup by ────
  // copying the final movie.mp4 out via a progress-callback hook before assembleMovie's
  // own finally-block cleanup deletes it, so verification isn't just "did it throw."
  console.log('\n[RC3] --- Deep-dive independent verification (5 scenes, voice, fade) ---')
  let deepDiveProbe = null
  await runTest('deep-dive', 'independently-probed golden path', async () => {
    const keepAsidePath = path.join(suiteRoot, 'deep_dive_movie.mp4')
    const deepDiveJobDir = path.join(suiteRoot, 'deep_dive_job')
    const result = await MovieAssemblerV2.assembleMovie({
      rawClipPaths: cycleClips(5),
      movieId: 'rc3_deep_dive',
      duration_minutes: 1,
      voicePath: shortVoice,
      transition: 'fade',
      jobDir: deepDiveJobDir,
      onProgress: (data) => {
        if (data && data.pct === 82) {
          const moviePath = path.join(deepDiveJobDir, 'movie.mp4')
          if (fsSync.existsSync(moviePath)) fsSync.copyFileSync(moviePath, keepAsidePath)
        }
      },
    })
    if (!fsSync.existsSync(keepAsidePath)) throw new Error('deep-dive copy-out never fired')
    deepDiveProbe = await MovieAssemblerV2.probeMovie(keepAsidePath)
    const size = fsSync.statSync(keepAsidePath).size
    if (size <= 0) throw new Error('deep-dive movie file is empty')
    if (deepDiveProbe.width !== 720 || deepDiveProbe.height !== 1280) throw new Error(`bad resolution ${deepDiveProbe.width}x${deepDiveProbe.height}`)
    if (Math.round(deepDiveProbe.fps) !== 25) throw new Error(`bad fps ${deepDiveProbe.fps}`)
    if (deepDiveProbe.codec !== 'h264') throw new Error(`bad codec ${deepDiveProbe.codec}`)
    if (deepDiveProbe.pixFmt !== 'yuv420p') throw new Error(`bad pix_fmt ${deepDiveProbe.pixFmt}`)
    const voiceDur = await MovieAssemblerV2.getClipDuration(shortVoice)
    if (Math.abs(deepDiveProbe.duration - voiceDur) > 0.5) throw new Error(`audio sync off: video=${deepDiveProbe.duration}s voice=${voiceDur}s`)
    recordPerf(result.timings)
    return { probe: deepDiveProbe, fileSizeBytes: size, jobDir: result.jobDir }
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 3. MEMORY LEAK DETECTION
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[RC3] --- Memory leak detection (5 sequential renders) ---')
  const heapSamples = []
  let tempDirLeakDetected = false

  await runTest('memory', '5x sequential render heap trend', async () => {
    for (let i = 0; i < 5; i++) {
      if (global.gc) global.gc()
      const before = process.memoryUsage().heapUsed
      const result = await MovieAssemblerV2.assembleMovie({
        rawClipPaths: cycleClips(2),
        movieId: `rc3_mem_${i}`,
        duration_minutes: 0.5,
      })
      if (fsSync.existsSync(result.jobDir)) {
        tempDirLeakDetected = true
        console.warn(`[RC3] WARNING: jobDir still exists after cleanup: ${result.jobDir}`)
      }
      if (global.gc) global.gc()
      const after = process.memoryUsage().heapUsed
      heapSamples.push({ iteration: i, beforeMB: before / 1024 / 1024, afterMB: after / 1024 / 1024 })
      console.log(`[V2] Heap before=${(before / 1024 / 1024).toFixed(1)}MB after=${(after / 1024 / 1024).toFixed(1)}MB (iteration ${i})`)
      sampleMemory()
    }

    const firstAfter = heapSamples[0].afterMB
    const lastAfter   = heapSamples[heapSamples.length - 1].afterMB
    const growth      = lastAfter - firstAfter
    console.log(`[RC3] Heap growth across 5 runs: ${growth.toFixed(1)}MB (first=${firstAfter.toFixed(1)}MB last=${lastAfter.toFixed(1)}MB)`)
    if (tempDirLeakDetected) throw new Error('temp job directory was not cleaned up after a render')
    // Growth threshold is generous — without --expose-gc the numbers are noisy; we flag only gross leaks.
    if (growth > 200) throw new Error(`heap grew by ${growth.toFixed(1)}MB across 5 renders — possible leak`)

    return { heapSamples, growthMB: growth, gcAvailable: !!global.gc }
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 4. TIMEOUT + RETRY TESTING
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[RC3] --- Timeout + retry testing ---')

  await runTest('timeout', 'FFmpeg process timeout kills a hung/slow render', async () => {
    const slowClip = path.join(fixturesDir, 'slow.mp4')
    await makeFixtureClip(slowClip, 8)
    const outPath = path.join(suiteRoot, 'timeout_out.mp4')
    try {
      await MovieAssemblerV2.runFFmpeg(
        ['-y', '-i', slowClip, '-vf', 'scale=720:1280,fps=25', '-c:v', 'libx264', '-preset', 'veryslow', outPath],
        'rc3-timeout-test', slowClip, 50 // 50ms timeout — must fire
      )
      throw new Error('expected a timeout error but ffmpeg completed within 50ms')
    } catch (err) {
      if (!/timed out/i.test(err.message)) throw err
    }
  })

  await runTest('retry', 'withRetry succeeds after transient failures', async () => {
    let attempts = 0
    const value = await MovieAssemblerV2.withRetry(async () => {
      attempts++
      if (attempts < 3) throw new Error('transient')
      return 'ok'
    }, { label: 'rc3-retry-success', backoffsMs: [10, 10, 10] })
    if (value !== 'ok' || attempts !== 3) throw new Error(`unexpected retry outcome: value=${value} attempts=${attempts}`)
  })

  await runTest('retry', 'withRetry exhausts and throws after 3 attempts', async () => {
    let attempts = 0
    try {
      await MovieAssemblerV2.withRetry(async () => { attempts++; throw new Error('permanent') },
        { label: 'rc3-retry-exhaust', backoffsMs: [10, 10, 10] })
      throw new Error('expected withRetry to throw')
    } catch (err) {
      if (attempts !== 3) throw new Error(`expected 3 attempts, got ${attempts}`)
      if (!/failed after 3 attempts/.test(err.message)) throw err
    }
  })

  await runTest('retry', 'Cloudinary upload retries through transient failures', async () => {
    mockUploadFailuresRemaining = 2
    const clip = path.join(fixturesDir, 'a.mp4')
    const uploaded = await MovieAssemblerV2.uploadMovie(clip, 'rc3_upload_retry')
    if (!uploaded.videoUrl) throw new Error('upload did not eventually succeed')
    if (mockUploadFailuresRemaining !== 0) throw new Error('mock failures were not fully consumed')
  })

  console.log('[RC3] NOTE: live Cloudinary/download network timeout behaviour was NOT exercised against ' +
    'real endpoints in this run (network boundary is mocked) — see RC3_RENDER_REPORT.md "Known limits."')

  // ══════════════════════════════════════════════════════════════════════════
  // 5. CONCURRENCY TESTING
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[RC3] --- Concurrency testing ---')
  for (const n of [2, 5, 10]) {
    await runTest('concurrency', `${n} simultaneous renders`, async () => {
      const runs = Array.from({ length: n }, (_, i) =>
        MovieAssemblerV2.assembleMovie({
          rawClipPaths: cycleClips(2),
          movieId: `rc3_concurrent_${n}_${i}`,
          duration_minutes: 0.5,
        }).then(result => ({ ok: true, jobDir: result.jobDir, videoUrl: result.videoUrl }))
          .catch(err => ({ ok: false, error: err.message }))
      )
      const outcomes = await Promise.all(runs)

      const failed = outcomes.filter(o => !o.ok)
      if (failed.length > 0) throw new Error(`${failed.length}/${n} concurrent renders failed: ${failed[0].error}`)

      const jobDirs = outcomes.map(o => o.jobDir)
      const uniqueJobDirs = new Set(jobDirs)
      if (uniqueJobDirs.size !== n) throw new Error(`jobDir collision: ${uniqueJobDirs.size} unique out of ${n}`)

      const stillExist = jobDirs.filter(d => fsSync.existsSync(d))
      if (stillExist.length > 0) throw new Error(`${stillExist.length} jobDirs not cleaned up after concurrent run`)

      const urls = outcomes.map(o => o.videoUrl)
      if (new Set(urls).size !== n) throw new Error('duplicate videoUrl returned across concurrent renders')

      return { uniqueJobDirs: uniqueJobDirs.size }
    })
  }

  // ══════════════════════════════════════════════════════════════════════════
  // 6. REGRESSION SUITE — existing endpoints unchanged
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[RC3] --- Regression: existing endpoint behaviour ---')
  await runTest('regression', 'route table unchanged (8 routes, same paths/methods)', async () => {
    const router = require('../src/routes/reelRoutes.js')
    const routes = router.stack.filter(l => l.route).map(l => ({
      method: Object.keys(l.route.methods)[0].toUpperCase(),
      path: l.route.path,
    }))
    const expected = [
      ['POST', '/api/generate-video'],
      ['POST', '/generate-reel'],
      ['GET', '/api/status/:jobId'],
      ['POST', '/api/generate-movie-scenes'],
      ['POST', '/api/generate-pexels-scenes'],
      ['GET', '/api/queue/status'],
      ['GET', '/api/queue/job/:jobId'],
      ['POST', '/api/burn-captions'],
    ]
    if (routes.length !== expected.length) throw new Error(`route count changed: ${routes.length} vs ${expected.length}`)
    for (const [method, p] of expected) {
      if (!routes.some(r => r.method === method && r.path === p)) throw new Error(`missing route ${method} ${p}`)
    }
  })

  await runTest('regression', 'live HTTP: /api/generate-pexels-scenes validates scenes[] identically', async () => {
    const app = express()
    app.use(express.json())
    app.use(require('../src/routes/reelRoutes.js'))
    const server = await new Promise((resolve) => {
      const s = app.listen(0, () => resolve(s))
    })
    try {
      const port = server.address().port
      const res = await realAxiosPost(`http://127.0.0.1:${port}/api/generate-pexels-scenes`, {}, {
        responseType: 'text', validateStatus: () => true,
      })
      if (!String(res.data).includes('scenes[] required')) {
        throw new Error(`unexpected response body: ${String(res.data).slice(0, 200)}`)
      }
      if (!String(res.data).includes('"type":"error"')) {
        throw new Error('missing type:"error" SSE frame')
      }
    } finally {
      await new Promise(r => server.close(r))
    }
  })

  await runTest('regression', 'live HTTP: GET /api/queue/status responds 200', async () => {
    const app = express()
    app.use(require('../src/routes/reelRoutes.js'))
    const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)) })
    try {
      const port = server.address().port
      const res = await axios.get(`http://127.0.0.1:${port}/api/queue/status`, { validateStatus: () => true })
      if (res.status !== 200) throw new Error(`expected 200, got ${res.status}`)
    } finally {
      await new Promise(r => server.close(r))
    }
  })

  // ══════════════════════════════════════════════════════════════════════════
  // 7. LARGEST TEMP DIRECTORY (measured mid-render on the biggest matrix cases)
  // ══════════════════════════════════════════════════════════════════════════
  console.log('\n[RC3] --- Largest temp directory measurement ---')
  // Manually orchestrate the normalize+concat steps (no cleanup) purely to size the tree,
  // since assembleMovie()'s own finally-block cleanup removes the jobDir before we could measure it.
  await runTest('perf', 'largest temp dir — manual measurement (30 scenes, no cleanup)', async () => {
    const dir = path.join(suiteRoot, 'dirsize_manual')
    await fs.ensureDir(dir)
    const normalized = await MovieAssemblerV2.prepareTimeline(cycleClips(30), dir, 1)
    const concatPath = MovieAssemblerV2.buildConcatList(normalized, dir)
    await MovieAssemblerV2.concatNormalizedClips(concatPath, dir)
    const size = dirSize(dir)
    perf.largestTempDirBytes = Math.max(perf.largestTempDirBytes, size)
    await fs.remove(dir)
    return { bytes: size }
  })

  // ══════════════════════════════════════════════════════════════════════════
  // REPORT
  // ══════════════════════════════════════════════════════════════════════════
  await fs.remove(suiteRoot).catch(() => {})

  const passCount = results.filter(r => r.pass).length
  const failCount = results.filter(r => !r.pass).length
  const allPass = failCount === 0

  console.log('\n[RC3] ============================================================')
  console.log(`[RC3] RESULT: ${passCount}/${results.length} passed, ${failCount} failed`)
  console.log('[RC3] ============================================================')

  const reportData = {
    results, perf, passCount, failCount, allPass,
    xfadeSupported, mockUploadCount, mockUploadBytes,
    deepDiveProbe,
    generatedAt: new Date().toISOString(),
  }

  fsSync.writeFileSync(
    path.join(__dirname, 'rc3-results.json'),
    JSON.stringify(reportData, null, 2)
  )

  process.exitCode = allPass ? 0 : 1
}

main().catch(err => {
  console.error('[RC3] FATAL:', err)
  process.exitCode = 1
})
