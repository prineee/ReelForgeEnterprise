'use strict'

const { spawn } = require('child_process')
const fsSync     = require('fs')
const { FFPROBE_BIN } = require('./ffmpegUtils')

// ── Run ffprobe and return parsed JSON (full format + streams) ──
function ffprobeJson(videoPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'error',
      '-show_format',
      '-show_streams',
      '-of', 'json',
      videoPath,
    ]

    let proc
    try {
      proc = spawn(FFPROBE_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (err) {
      return reject(new Error(`[clipAnalyzer] ffprobe failed to spawn for ${videoPath}: ${err.message}`))
    }

    let stdout = ''
    let stderr = ''
    proc.stdout.on('data', d => { stdout += d.toString() })
    proc.stderr.on('data', d => { stderr += d.toString() })

    proc.on('error', err => {
      reject(new Error(`[clipAnalyzer] ffprobe process error for ${videoPath}: ${err.message}`))
    })

    proc.on('close', code => {
      if (code !== 0) {
        return reject(new Error(
          `[clipAnalyzer] ffprobe exited ${code} for ${videoPath}\n--- stderr ---\n${stderr.slice(-1000)}`
        ))
      }
      try {
        resolve(JSON.parse(stdout))
      } catch (err) {
        reject(new Error(`[clipAnalyzer] failed to parse ffprobe JSON for ${videoPath}: ${err.message}\nraw: ${stdout.slice(0, 500)}`))
      }
    })
  })
}

// ── Rotation can show up as a stream tag (older ffmpeg) or a Display Matrix ──
// side_data entry (newer ffmpeg, e.g. iPhone footage shot in portrait).
function extractRotation(videoStream) {
  const tagRotate = videoStream.tags && videoStream.tags.rotate
  if (tagRotate !== undefined) {
    const n = parseInt(tagRotate, 10)
    if (isFinite(n)) return n
  }

  const sideData = (videoStream.side_data_list || [])
    .find(sd => sd.side_data_type === 'Display Matrix' && sd.rotation !== undefined)
  if (sideData) {
    const n = Math.round(Number(sideData.rotation))
    if (isFinite(n)) return ((n % 360) + 360) % 360
  }

  return 0
}

function parseFps(videoStream) {
  const raw = videoStream.avg_frame_rate && videoStream.avg_frame_rate !== '0/0'
    ? videoStream.avg_frame_rate
    : videoStream.r_frame_rate
  const [num, den] = String(raw || '0/1').split('/').map(Number)
  return den > 0 ? num / den : 0
}

/**
 * Analyze a video file with ffprobe.
 * Returns { duration, width, height, fps, codec, bitrate, hasAudio, rotation }.
 * Throws if the file is missing, unreadable, or has no video stream.
 */
async function analyzeClip(videoPath) {
  if (!fsSync.existsSync(videoPath)) {
    throw new Error(`[clipAnalyzer] analyzeClip: file does not exist: ${videoPath}`)
  }

  const data = await ffprobeJson(videoPath)

  const streams = data.streams || []
  const videoStream = streams.find(s => s.codec_type === 'video')
  const audioStream = streams.find(s => s.codec_type === 'audio')

  if (!videoStream) {
    throw new Error(`[clipAnalyzer] analyzeClip: no video stream found in ${videoPath}`)
  }

  const format = data.format || {}
  const duration = parseFloat(format.duration) || parseFloat(videoStream.duration) || 0
  if (!isFinite(duration) || duration <= 0) {
    throw new Error(`[clipAnalyzer] analyzeClip: could not determine a valid duration for ${videoPath}`)
  }

  const bitrate = parseInt(format.bit_rate, 10) || parseInt(videoStream.bit_rate, 10) || 0

  return {
    duration,
    width:    videoStream.width || 0,
    height:   videoStream.height || 0,
    fps:      parseFps(videoStream),
    codec:    videoStream.codec_name || 'unknown',
    bitrate,
    hasAudio: !!audioStream,
    rotation: extractRotation(videoStream),
  }
}

module.exports = {
  analyzeClip,
}
