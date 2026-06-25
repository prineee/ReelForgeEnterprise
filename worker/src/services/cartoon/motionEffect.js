// FILE: worker/src/services/cartoon/motionEffect.js
// Phase 2 — FFmpeg motion effects: converts static cartoon images to video clips

'use strict'

const { spawn } = require('child_process')
const path      = require('path')
const fs        = require('fs')

function resolveBin(envKey, systemPath, bareName) {
  if (process.env[envKey]) return process.env[envKey]
  if (fs.existsSync(systemPath)) return systemPath
  return bareName
}

const FFMPEG_BIN = resolveBin('FFMPEG_PATH', '/usr/bin/ffmpeg', 'ffmpeg')

function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(FFMPEG_BIN, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr  = ''
    proc.stderr.on('data', d => { stderr += d.toString() })
    proc.on('close', code => {
      if (code === 0) resolve()
      else reject(new Error(`FFmpeg exit ${code}: ${stderr.slice(-400)}`))
    })
    proc.on('error', err => reject(new Error(`FFmpeg spawn: ${err.message}`)))
  })
}

// ── Motion effect builders ────────────────────────────────────────────────────
// All zoompan filters assume the image has been pre-scaled to 8000px wide,
// giving ~14 222px height for a 9:16 source. With z=1.3 this gives a y range
// of 0..~3 282px — so per-frame pan deltas of 8-12px travel ~40-50% of the
// frame in a 5-second (150-frame) clip, which reads as smooth, purposeful motion.

function getZoompanFilter(motionEffect, durationSecs) {
  const frames = Math.round(durationSecs * 30)
  const d      = frames

  switch (motionEffect) {

    // ── Original effects (preserved) ─────────────────────────────────────────
    case 'zoom_in':
      return `zoompan=z='min(zoom+0.0008,1.3)':d=${d}:s=720x1280:fps=30`

    case 'zoom_out':
      return `zoompan=z='if(lte(on,1),1.3,max(1.001,zoom-0.0008))':d=${d}:s=720x1280:fps=30`

    case 'pan_left':
      return `zoompan=z=1.2:x='if(lte(on,1),iw/4,x-1.5)':y='ih/2-(ih/zoom/2)':d=${d}:s=720x1280:fps=30`

    case 'pan_right':
      // Tracking shot: smooth left-to-right travel at constant speed
      return `zoompan=z=1.2:x='if(lte(on,1),0,min(iw*(1-1/zoom),x+10))':y='ih/2-(ih/zoom/2)':d=${d}:s=720x1280:fps=30`

    case 'ken_burns':
      return `zoompan=z='min(zoom+0.0012,1.5)':x='iw/2-(iw/zoom/2)+sin(on/30)*20':d=${d}:s=720x1280:fps=30`

    // ── Camera Director effects ───────────────────────────────────────────────

    case 'slow_zoom_in':
      // ESTABLISHING WIDE: barely perceptible inward pull — world breathes, eye settles
      return `zoompan=z='min(1.0+on*0.0006,1.18)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=720x1280:fps=30`

    case 'pan_up':
      // LOW ANGLE HERO: start low in frame, crane upward to reveal full height of scene
      return `zoompan=z=1.3:x='iw/2-(iw/zoom/2)':y='if(lte(on,1),ih*(1-1/1.3),max(0,y-11))':d=${d}:s=720x1280:fps=30`

    case 'pan_down':
      // HIGH ANGLE: start at top, descend into the scene
      return `zoompan=z=1.3:x='iw/2-(iw/zoom/2)':y='if(lte(on,1),0,min(ih*(1-1/1.3),y+11))':d=${d}:s=720x1280:fps=30`

    case 'push_drift':
      // OVER SHOULDER: gentle push in + subtle sinusoidal horizontal float
      return `zoompan=z='min(1.0+on*0.0012,1.28)':x='iw/2-(iw/zoom/2)+sin(on/25)*80':y='ih/2-(ih/zoom/2)':d=${d}:s=720x1280:fps=30`

    case 'shake_pan':
      // ACTION: rightward drift with organic sinusoidal shake on both axes
      return `zoompan=z=1.25:x='iw/2-(iw/zoom/2)+on*2+sin(on/1.8)*120':y='ih/2-(ih/zoom/2)+cos(on/2.2)*80':d=${d}:s=720x1280:fps=30`

    case 'cinematic_push':
      // EMOTIONAL: barely visible slow push — subconscious intimacy, no jitter
      return `zoompan=z='min(1.0+on*0.0004,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${d}:s=720x1280:fps=30`

    // crane_parallax is handled by convertWithParallax() — return null as signal
    case 'crane_parallax':
      return null

    case 'static':
    default:
      return null
  }
}

// ── Two-layer parallax composite (FINALE EPIC) ────────────────────────────────
// Splits the image into two layers moving at different rates to simulate depth:
//   BG layer — zooms 1.1→1.5, pans up 10px/frame (faster = apparent background)
//   FG layer — zooms 1.35→1.65, pans up 4px/frame (slower = apparent foreground)
//              with a radial alpha mask so only the edges contribute, creating
//              the impression of a closer plane framing the shot.
// Result: center (BG, fast) moves relative to edges (FG, slow) → parallax depth.
async function convertWithParallax(imagePath, outputPath, durationSecs) {
  const dur    = Math.max(Number(durationSecs) || 5, 2)
  const frames = Math.round(dur * 30)

  // BG: fast upward crane + expanding zoom
  const bgZoom = `z='min(1.1+on*0.0022,1.55)'`
  const bgY    = `y='if(lte(on,1),ih*(1-1/1.1),max(0,y-10))'`
  const bgPan  = `zoompan=${bgZoom}:x='iw/2-(iw/zoom/2)':${bgY}:d=${frames}:s=720x1280:fps=30`

  // FG: slower upward drift + tighter zoom
  const fgZoom = `z='min(1.35+on*0.0010,1.65)'`
  const fgY    = `y='if(lte(on,1),ih*(1-1/1.35),max(0,y-4))'`
  const fgPan  = `zoompan=${fgZoom}:x='iw/2-(iw/zoom/2)':${fgY}:d=${frames}:s=720x1280:fps=30`

  // Radial edge-only alpha mask: transparent center, opaque at edges.
  // Uses pow() instead of hypot() for broad FFmpeg compat.
  // Threshold = 35% of shorter dimension; falloff = 20% of shorter dimension.
  const maskExpr = [
    `clip(`,
    `255*(sqrt(pow(X-W/2\\,2)+pow(Y-H/2\\,2))-min(W\\,H)*0.35)`,
    `/(min(W\\,H)*0.20)`,
    `\\,0\\,255)`,
  ].join('')
  const geqFg = `geq=r='r(X\\,Y)':g='g(X\\,Y)':b='b(X\\,Y)':a='${maskExpr}'`

  const filterComplex = [
    `[0:v]split=2[bg_in][fg_in]`,
    `[bg_in]scale=8000:-1,${bgPan},format=yuv420p[bg]`,
    `[fg_in]scale=8000:-1,${fgPan},format=yuva420p,${geqFg}[fg]`,
    `[bg][fg]overlay=format=yuv420p[out]`,
  ].join(';')

  console.log(`[motion/parallax] filter_complex length=${filterComplex.length}`)

  await runFFmpeg([
    '-y',
    '-loop',  '1',
    '-i',     imagePath,
    '-t',     String(dur),
    '-filter_complex', filterComplex,
    '-map',   '[out]',
    '-c:v',   'libx264',
    '-preset', 'ultrafast',
    '-crf',   '26',
    '-pix_fmt', 'yuv420p',
    '-r',     '30',
    '-video_track_timescale', '90000',
    '-an',
    '-movflags', '+faststart',
    outputPath,
  ])
}

// ── Convert image to video clip with motion effect ────────────────────────────
async function convertImageToVideoClip(imagePath, outputPath, durationSecs, motionEffect) {
  const dur    = Math.max(Number(durationSecs) || 5, 2)
  const effect = motionEffect || 'ken_burns'

  console.log(`[motion] ${path.basename(imagePath)} → ${path.basename(outputPath)} | effect=${effect} dur=${dur}s`)

  // Finale parallax uses its own filter_complex pipeline
  if (effect === 'crane_parallax') {
    try {
      await convertWithParallax(imagePath, outputPath, dur)
    } catch (err) {
      console.warn(`[motion] crane_parallax failed (${err.message}), falling back to slow_zoom_in`)
      // Fall back to a reliable single-layer effect rather than crashing the clip
      const fallbackFilter = getZoompanFilter('slow_zoom_in', dur)
      await runWithZoompan(imagePath, outputPath, dur, fallbackFilter)
    }
    const size = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0
    if (size === 0) throw new Error(`crane_parallax produced empty file: ${outputPath}`)
    console.log(`[motion] Done: ${path.basename(outputPath)} (${size} bytes)`)
    return outputPath
  }

  const zoompanFilter = getZoompanFilter(effect, dur)
  await runWithZoompan(imagePath, outputPath, dur, zoompanFilter)

  const size = fs.existsSync(outputPath) ? fs.statSync(outputPath).size : 0
  if (size === 0) throw new Error(`Motion effect produced empty file: ${outputPath}`)

  console.log(`[motion] Done: ${path.basename(outputPath)} (${size} bytes)`)
  return outputPath
}

// ── Single-layer zoompan render (used by all non-parallax effects) ─────────────
async function runWithZoompan(imagePath, outputPath, dur, zoompanFilter) {
  if (zoompanFilter) {
    const vfWithZoom = [
      'scale=8000:-1',
      zoompanFilter,
      'scale=720:1280',
      'format=yuv420p',
      'setsar=1:1',
    ].join(',')

    await runFFmpeg([
      '-y',
      '-loop',  '1',
      '-i',     imagePath,
      '-t',     String(dur),
      '-vf',    vfWithZoom,
      '-c:v',   'libx264',
      '-preset','ultrafast',
      '-crf',   '28',
      '-pix_fmt','yuv420p',
      '-r',     '30',
      '-video_track_timescale', '90000',
      '-an',
      '-movflags', '+faststart',
      outputPath,
    ])
  } else {
    // Static — simple scale/crop
    await runFFmpeg([
      '-y',
      '-loop',  '1',
      '-i',     imagePath,
      '-t',     String(dur),
      '-vf',    'scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,format=yuv420p,setsar=1:1',
      '-c:v',   'libx264',
      '-preset','ultrafast',
      '-crf',   '28',
      '-pix_fmt','yuv420p',
      '-r',     '30',
      '-video_track_timescale', '90000',
      '-an',
      '-movflags', '+faststart',
      outputPath,
    ])
  }
}

// ── Generate solid color placeholder video ────────────────────────────────────
async function generateColorClip(outputPath, durationSecs, color) {
  const dur = Math.max(Number(durationSecs) || 5, 2)
  const col = (color || '#1a1a2e').replace('#', '0x')

  await runFFmpeg([
    '-y',
    '-f',    'lavfi',
    '-i',    `color=c=${col}:s=720x1280:r=30`,
    '-t',    String(dur),
    '-c:v',  'libx264',
    '-preset','ultrafast',
    '-crf',  '28',
    '-pix_fmt','yuv420p',
    '-r',    '30',
    '-an',
    '-movflags', '+faststart',
    outputPath,
  ])

  console.log(`[motion] Color clip: ${path.basename(outputPath)} (${dur}s color=${color})`)
  return outputPath
}

module.exports = { convertImageToVideoClip, generateColorClip }
