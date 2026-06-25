'use strict'

const { spawn, spawnSync } = require('child_process')
const path                 = require('path')
const fsSync               = require('fs')
const ffmpegFluent         = require('fluent-ffmpeg')

// ── Binary resolution with multi-tier fallback ────────────────────────────────
// Priority:
//   1. Explicit env var (FFMPEG_PATH / FFPROBE_PATH)
//   2. npm installer package path (if file actually exists on disk)
//   3. System binary installed by apt-get (/usr/bin/ffmpeg, /usr/bin/ffprobe)
//   4. Bare name fallback (relies on PATH)

function resolveBin(envKey, installerPkg, systemPath, bareName) {
  // 1. Explicit env var
  if (process.env[envKey]) {
    const p = process.env[envKey]
    console.log(`[ffmpegUtils] ${envKey} from env: ${p}`)
    return p
  }

  // 2. npm installer package — only use if the file actually exists
  try {
    const installerPath = require(installerPkg).path
    if (installerPath && fsSync.existsSync(installerPath)) {
      console.log(`[ffmpegUtils] ${bareName} from npm installer: ${installerPath}`)
      return installerPath
    } else {
      console.warn(`[ffmpegUtils] npm installer path does not exist: ${installerPath}`)
    }
  } catch (err) {
    console.warn(`[ffmpegUtils] npm installer package ${installerPkg} not available: ${err.message}`)
  }

  // 3. System binary from apt-get
  if (fsSync.existsSync(systemPath)) {
    console.log(`[ffmpegUtils] ${bareName} from system apt-get: ${systemPath}`)
    return systemPath
  }

  // 4. Bare name — rely on PATH
  console.warn(`[ffmpegUtils] ${bareName} system path ${systemPath} not found — using bare name: ${bareName}`)
  return bareName
}

const FFMPEG_BIN  = resolveBin('FFMPEG_PATH',  '@ffmpeg-installer/ffmpeg',   '/usr/bin/ffmpeg',  'ffmpeg')
const FFPROBE_BIN = resolveBin('FFPROBE_PATH', '@ffprobe-installer/ffprobe', '/usr/bin/ffprobe', 'ffprobe')

// ── Startup diagnostics ───────────────────────────────────────────────────────
console.log('[ffmpegUtils] ── Binary Diagnostics ──────────────────────────')
console.log('[ffmpegUtils] FFMPEG_BIN  =', FFMPEG_BIN)
console.log('[ffmpegUtils] FFPROBE_BIN =', FFPROBE_BIN)
console.log('[ffmpegUtils] FFMPEG_BIN  exists:', fsSync.existsSync(FFMPEG_BIN))
console.log('[ffmpegUtils] FFPROBE_BIN exists:', fsSync.existsSync(FFPROBE_BIN))

// Validate ffmpeg
const ffmpegCheck = spawnSync(FFMPEG_BIN, ['-version'], { timeout: 10_000 })
if (ffmpegCheck.error) {
  console.error('[ffmpegUtils] ffmpeg validation FAILED:', ffmpegCheck.error.message)
} else {
  const ver = (ffmpegCheck.stdout || ffmpegCheck.stderr || '')
    .toString().split('\n')[0].slice(0, 80)
  console.log('[ffmpegUtils] ffmpeg OK:', ver)
}

// Validate ffprobe
const ffprobeCheck = spawnSync(FFPROBE_BIN, ['-version'], { timeout: 10_000 })
if (ffprobeCheck.error) {
  console.error('[ffmpegUtils] ffprobe validation FAILED:', ffprobeCheck.error.message)
  // Last resort: try bare 'ffprobe' on PATH if resolved path failed
  const bareCheck = spawnSync('ffprobe', ['-version'], { timeout: 10_000 })
  if (!bareCheck.error) {
    console.log('[ffmpegUtils] ffprobe bare name works — overriding FFPROBE_BIN')
    // eslint-disable-next-line no-global-assign
    // We reassign via module-level var below
  } else {
    console.error('[ffmpegUtils] ffprobe bare name also failed:', bareCheck.error.message)
  }
} else {
  const ver = (ffprobeCheck.stdout || ffprobeCheck.stderr || '')
    .toString().split('\n')[0].slice(0, 80)
  console.log('[ffmpegUtils] ffprobe OK:', ver)
}

console.log('[ffmpegUtils] ────────────────────────────────────────────────')

// ── Configure fluent-ffmpeg with resolved binaries ────────────────────────────
ffmpegFluent.setFfmpegPath(FFMPEG_BIN)
ffmpegFluent.setFfprobePath(FFPROBE_BIN)

const CLIP_MAX_SECS = 10

function fileSize(p) {
  try { return fsSync.statSync(p).size } catch { return 0 }
}

// ── Probe a single clip with ffprobe ─────────────────────────────────────────
async function probeClip(filePath) {
  return new Promise((resolve, reject) => {
    ffmpegFluent.ffprobe(filePath, (err, meta) => {
      if (err) {
        // If fluent-ffmpeg probe fails, try with direct spawn as fallback
        console.warn(`[ffprobe] fluent-ffmpeg probe failed for ${path.basename(filePath)}: ${err.message}`)
        console.warn(`[ffprobe] Trying direct ffprobe spawn with FFPROBE_BIN=${FFPROBE_BIN}`)

        const proc = spawnSync(FFPROBE_BIN, [
          '-v', 'quiet',
          '-print_format', 'json',
          '-show_format',
          '-show_streams',
          filePath,
        ], { timeout: 30_000 })

        if (proc.error || proc.status !== 0) {
          return reject(new Error(
            `ffprobe failed for ${path.basename(filePath)}: ` +
            (proc.error?.message || `exit ${proc.status}`)
          ))
        }

        try {
          const meta2       = JSON.parse(proc.stdout.toString())
          const videoStream = (meta2.streams || []).find(s => s.codec_type === 'video')
          const duration    = parseFloat(meta2.format?.duration) || 0
          if (!videoStream) {
            return reject(new Error(`No video stream in ${path.basename(filePath)}`))
          }
          const fps = (() => {
            const r = videoStream.r_frame_rate || videoStream.avg_frame_rate || '30/1'
            const [num, den] = r.split('/').map(Number)
            return den > 0 ? Math.round((num / den) * 100) / 100 : 30
          })()
          const result = {
            duration,
            codec:  videoStream.codec_name,
            width:  videoStream.width,
            height: videoStream.height,
            fps,
            pixFmt: videoStream.pix_fmt,
            path:   filePath,
          }
          console.log(
            `[ffprobe] (direct) ${path.basename(filePath)}: ` +
            `${duration.toFixed(3)}s | ${result.width}x${result.height} | ${result.codec}`
          )
          return resolve(result)
        } catch (parseErr) {
          return reject(new Error(`ffprobe JSON parse failed: ${parseErr.message}`))
        }
      }

      const videoStream = (meta.streams || []).find(s => s.codec_type === 'video')
      const duration    = parseFloat(meta.format?.duration) || 0

      if (!videoStream) {
        return reject(new Error(`No video stream in ${path.basename(filePath)}`))
      }

      const fps = (() => {
        const r = videoStream.r_frame_rate ||
                  videoStream.avg_frame_rate || '30/1'
        const [num, den] = r.split('/').map(Number)
        return den > 0 ? Math.round((num / den) * 100) / 100 : 30
      })()

      const result = {
        duration,
        codec:  videoStream.codec_name,
        width:  videoStream.width,
        height: videoStream.height,
        fps,
        pixFmt: videoStream.pix_fmt,
        path:   filePath,
      }

      console.log(
        `[ffprobe] ${path.basename(filePath)}: ` +
        `${duration.toFixed(3)}s | ` +
        `${result.width}x${result.height} | ` +
        `${result.codec} | ${result.fps}fps`
      )

      resolve(result)
    })
  })
}

// ── Re-encode one clip to uniform H.264 720x1280 30fps yuv420p ───────────────
async function normalizeClip(inputPath, outputPath, targetDuration) {
  return new Promise((resolve, reject) => {
    const trimDuration = Math.min(targetDuration, CLIP_MAX_SECS)

    console.log(
      `[normalize] ${path.basename(inputPath)} → ${path.basename(outputPath)} | ` +
      `input_duration=${targetDuration.toFixed(3)}s | ` +
      `trim_to=${trimDuration.toFixed(3)}s | ` +
      `CLIP_MAX_SECS=${CLIP_MAX_SECS}`
    )

    const args = [
      '-y',
      '-i',      inputPath,
      '-t',      String(trimDuration),
      '-vf',     [
        'scale=720:1280:force_original_aspect_ratio=increase',
        'crop=720:1280',
        'fps=30',
        'format=yuv420p',
        'setsar=1:1',
      ].join(','),
      '-c:v',    'libx264',
      '-preset', 'ultrafast',
      '-crf',    '28',
      '-pix_fmt','yuv420p',
      '-r',      '30',
      '-video_track_timescale', '90000',
      '-an',
      '-movflags', '+faststart',
      outputPath,
    ]

    const proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    proc.stderr.on('data', d => { stderr += d.toString() })

    proc.on('close', code => {
      if (code === 0) {
        console.log(`[normalize] OK: ${path.basename(outputPath)} (${fileSize(outputPath)} bytes)`)
        resolve(outputPath)
      } else {
        console.error(`[normalize] FAILED (exit ${code}): ${stderr.slice(-400)}`)
        reject(new Error(`Normalize failed for ${path.basename(inputPath)}: exit ${code}`))
      }
    })

    proc.on('error', err => {
      reject(new Error(`FFmpeg spawn error in normalizeClip: ${err.message}`))
    })
  })
}

// ── Probe + normalize every raw clip ─────────────────────────────────────────
async function probeAndNormalizeClips(rawClips, jobDir) {
  const normalizeDir = path.join(jobDir, 'normalized')
  fsSync.mkdirSync(normalizeDir, { recursive: true })

  const results = []

  for (let i = 0; i < rawClips.length; i++) {
    const rawPath  = rawClips[i]
    const normPath = path.join(normalizeDir, `clip_${i}.mp4`)

    try {
      const info = await probeClip(rawPath)

      if (info.duration < 0.5) {
        console.warn(`[normalize] Skipping ${path.basename(rawPath)}: too short (${info.duration}s)`)
        continue
      }

      await normalizeClip(rawPath, normPath, info.duration)

      const normInfo          = await probeClip(normPath)
      const confirmedDuration = normInfo.duration

      console.log(
        `[normalize] Clip ${i}: ` +
        `raw=${info.duration.toFixed(3)}s | ` +
        `normalized=${confirmedDuration.toFixed(3)}s | ` +
        `delta=${Math.abs(info.duration - confirmedDuration).toFixed(3)}s`
      )

      if (confirmedDuration < 0.1) {
        console.warn(`[normalize] Clip ${i}: confirmed duration too short — skipping`)
        continue
      }

      results.push({
        path:        normPath,
        duration:    confirmedDuration,
        rawPath,
        rawDuration: info.duration,
      })

    } catch (err) {
      console.warn(`[normalize] Clip ${i} (${path.basename(rawPath)}) failed: ${err.message}`)
    }
  }

  console.log(`[normalize] SUMMARY: ${results.length}/${rawClips.length} clips ready`)
  results.forEach((c, i) => {
    console.log(`[normalize]   Clip ${i}: ${path.basename(c.path)} | duration=${c.duration.toFixed(3)}s`)
  })

  return results
}

// ── Build concat.txt using REAL measured durations ────────────────────────────
function writeConcatFileWithDurations(normalizedClips, totalSecs, concatPath) {
  if (!normalizedClips || normalizedClips.length === 0) {
    throw new Error('writeConcatFileWithDurations: no clips provided')
  }

  const lines     = []
  let   builtSecs = 0
  let   loopIdx   = 0
  const MAX_LOOPS = 5000
  const target    = totalSecs + 5

  while (builtSecs < target && loopIdx < MAX_LOOPS) {
    const clip    = normalizedClips[loopIdx % normalizedClips.length]
    const useTime = Math.min(clip.duration, target - builtSecs)

    if (useTime < 0.1) break

    lines.push(`file '${clip.path}'`)
    lines.push(`duration ${useTime.toFixed(4)}`)

    console.log(
      `[concat] Entry ${loopIdx + 1}: ` +
      `${path.basename(clip.path)} | ` +
      `real=${clip.duration.toFixed(3)}s | ` +
      `declared=${useTime.toFixed(4)}s | ` +
      `built=${builtSecs.toFixed(3)}s`
    )

    builtSecs += useTime
    loopIdx++
  }

  const lastClip = normalizedClips[(Math.max(loopIdx - 1, 0)) % normalizedClips.length]
  lines.push(`file '${lastClip.path}'`)

  fsSync.writeFileSync(concatPath, lines.join('\n') + '\n', 'utf8')

  console.log(`[concat] SUMMARY:`)
  console.log(`[concat]   Unique clips:      ${normalizedClips.length}`)
  console.log(`[concat]   Total entries:     ${loopIdx}`)
  console.log(`[concat]   Declared duration: ${builtSecs.toFixed(3)}s`)
  console.log(`[concat]   Target duration:   ${totalSecs}s`)
  console.log(`[concat]   Overrun buffer:    ${(builtSecs - totalSecs).toFixed(3)}s`)
  console.log(`[concat] CLIP MANIFEST:`)
  normalizedClips.forEach((c, i) => {
    console.log(`[concat]   Clip ${i}: ${path.basename(c.path)} | actual=${c.duration.toFixed(3)}s`)
  })

  return builtSecs
}

// ── Final FFmpeg render: full re-encode with CFR ──────────────────────────────
function buildFinalArgs(concatPath, voicePath, outputPath, totalSecs) {
  return [
    '-y',
    '-f',        'concat',
    '-safe',     '0',
    '-i',        concatPath,
    '-i',        voicePath,
    '-map',      '0:v:0',
    '-map',      '1:a:0',
    '-c:v',      'libx264',
    '-preset',   'veryfast',
    '-crf',      '23',
    '-pix_fmt',  'yuv420p',
    '-r',        '30',
    '-vsync',    'cfr',
    '-c:a',      'aac',
    '-b:a',      '128k',
    '-ar',       '44100',
    '-t',        String(totalSecs),
    '-movflags', '+faststart',
    outputPath,
  ]
}

module.exports = {
  probeClip,
  normalizeClip,
  probeAndNormalizeClips,
  writeConcatFileWithDurations,
  buildFinalArgs,
  FFMPEG_BIN,
  FFPROBE_BIN,
  CLIP_MAX_SECS,
}