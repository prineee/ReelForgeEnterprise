'use strict'

const os   = require('os')
const path = require('path')
const fs   = require('fs-extra')
const { spawn } = require('child_process')

const DELAY_BETWEEN_SCENES_MS = 2000

function resolveBin(envKey, defaultBin) {
  return process.env[envKey] || defaultBin
}

function runFFmpeg(args) {
  const bin = resolveBin('FFMPEG_PATH', 'ffmpeg')
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    proc.stderr.on('data', d => { stderr += d; console.log('[ffmpeg]', d.toString().slice(0, 100).trimEnd()) })
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg exited ${code}: ${stderr.slice(-300)}`)))
    proc.on('error', reject)
  })
}

async function processSceneJob(job) {
  const { scenes, movie_id } = job.data

  const { downloadOneClip, sceneToKeyword } = require('./stockVideo')

  const cloudinary = require('cloudinary').v2
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })

  const completedScenes = []
  const errors = []

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]

    await job.updateProgress({
      pct: Math.round((i / scenes.length) * 85),
      scene_number: scene.scene_number,
      message: `Processing scene ${scene.scene_number}/${scenes.length}...`,
      completed: completedScenes.length,
      errors: errors.length,
    })

    const keyword  = sceneToKeyword(scene)
    const duration = Math.min(Math.max(scene.duration_seconds ?? 5, 2), 30)
    const jobDir   = path.join(os.tmpdir(), `scene_${scene.scene_number}_${Date.now()}`)
    await fs.ensureDir(jobDir)

    try {
      console.log(`[worker] Scene ${scene.scene_number}: keyword="${keyword}" duration=${duration}s`)

      const rawPath    = path.join(jobDir, 'raw.mp4')
      const outputPath = path.join(jobDir, 'output.mp4')

      // Download stock clip
      await downloadOneClip(keyword, rawPath, true)

      // FFmpeg: scale to 720x1280, vignette, trim to target duration
      await runFFmpeg([
        '-y', '-i', rawPath,
        '-vf', `scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,vignette=PI/4`,
        '-t', String(duration),
        '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28',
        '-pix_fmt', 'yuv420p', '-an',
        '-movflags', '+faststart',
        outputPath,
      ])

      const uploaded = await cloudinary.uploader.upload(outputPath, {
        resource_type: 'video',
        folder:        'reelforge/movie-scenes',
        public_id:     `movie_${movie_id ?? 'x'}_scene_${scene.scene_number}_${Date.now()}`,
      })

      completedScenes.push({
        scene_number: scene.scene_number,
        title:        scene.title,
        video_url:    uploaded.secure_url,
      })

      console.log(`[worker] Scene ${scene.scene_number} done: ${uploaded.secure_url.slice(0, 60)}`)
    } catch (err) {
      console.error(`[worker] Scene ${scene.scene_number} failed:`, err.message)
      errors.push({ scene_number: scene.scene_number, error: err.message })
    } finally {
      await fs.remove(jobDir).catch(() => {})
    }

    if (i < scenes.length - 1) {
      await new Promise(r => setTimeout(r, DELAY_BETWEEN_SCENES_MS))
    }
  }

  return { completedScenes, errors, total: scenes.length }
}

let sceneWorker = null
try {
  if (process.env.REDIS_URL) {
    const { Worker } = require('bullmq')
    sceneWorker = new Worker('scene-generation', processSceneJob, {
      connection: { url: process.env.REDIS_URL },
      concurrency: 1,
      limiter: { max: 1, duration: 60000 },
    })

    sceneWorker.on('completed', (job, result) => {
      console.log(`[queue] Job ${job.id} completed: ${result.completedScenes.length} scenes`)
    })
    sceneWorker.on('failed', (job, err) => {
      console.error(`[queue] Job ${job.id} failed:`, err.message)
    })
    sceneWorker.on('progress', (job, progress) => {
      console.log(`[queue] Job ${job.id} progress:`, JSON.stringify(progress))
    })

    console.log('[queue] Scene worker started')
  }
} catch (err) {
  console.error('[queue] Worker start failed (non-fatal):', err.message)
}

module.exports = { sceneWorker }
