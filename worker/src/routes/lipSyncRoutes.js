'use strict'

const express   = require('express')
const router    = express.Router()
const { v4: uuidv4 } = require('uuid')
const path      = require('path')
const os        = require('os')
const fs        = require('fs-extra')
const fsSync    = require('fs')
const axios     = require('axios')
const { spawn } = require('child_process')

const jobs = new Map()

function resolveBin(envKey, defaultBin) {
  return process.env[envKey] || defaultBin
}

async function downloadFile(url, dest) {
  const res = await axios({ method: 'get', url, responseType: 'stream', timeout: 120_000 })
  await new Promise((resolve, reject) => {
    const w = fsSync.createWriteStream(dest)
    res.data.pipe(w)
    w.on('finish', resolve)
    w.on('error', reject)
  })
}

// ── RunPod Serverless ─────────────────────────────────────────────────────────
// Submits a job to a RunPod serverless endpoint and polls until completion.
// Returns the output object from the handler: { video_url } or { video_b64 }.
async function runWithRunPod(input) {
  const apiKey     = process.env.RUNPOD_API_KEY
  const endpointId = process.env.RUNPOD_ENDPOINT_ID
  const base       = `https://api.runpod.ai/v2/${endpointId}`
  const headers    = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }

  // Submit
  const submit = await axios.post(`${base}/run`, { input }, { headers, timeout: 30_000 })
  const runpodJobId = submit.data.id
  if (!runpodJobId) throw new Error('RunPod returned no job id')
  console.log('[runpod] job submitted:', runpodJobId)

  // Poll — RunPod GPU jobs typically finish in 30–120 s
  const deadline = Date.now() + 10 * 60 * 1000 // 10-min cap
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 5_000))
    const statusRes = await axios.get(`${base}/status/${runpodJobId}`, { headers, timeout: 15_000 })
    const { status, output, error } = statusRes.data
    console.log('[runpod] poll status:', status)

    if (status === 'COMPLETED') {
      if (output?.error) throw new Error(`RunPod handler error: ${output.error}`)
      return output
    }
    if (status === 'FAILED') {
      throw new Error(`RunPod job failed: ${error ?? 'unknown'}`)
    }
    // IN_QUEUE | IN_PROGRESS — keep polling
  }
  throw new Error('RunPod job timed out after 10 minutes')
}

// ── Cloudinary upload from a local file path ──────────────────────────────────
async function uploadToCloudinary(filePath, userId) {
  const cloudinary = require('cloudinary').v2
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key:    process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
  const uploaded = await cloudinary.uploader.upload(filePath, {
    resource_type: 'video',
    folder:        'reelforge/avatar-videos',
    public_id:     `lipsync_${userId ?? 'u'}_${Date.now()}`,
  })
  return uploaded.secure_url
}

// ── GET /api/lipsync/health ───────────────────────────────────────────────────
router.get('/api/lipsync/health', (req, res) => {
  const wav2lipPath    = process.env.WAV2LIP_PATH || '/app/Wav2Lip'
  const pythonBin      = process.env.PYTHON_BIN   || '/opt/venv/bin/python3'
  const checkpointPath = path.join(wav2lipPath, 'checkpoints', 'wav2lip.pth')
  const faceModelPath  = path.join(wav2lipPath, 'face_detection', 'detection', 'sfd', 's3fd.pth')
  const runpodMode     = !!(process.env.RUNPOD_API_KEY && process.env.RUNPOD_ENDPOINT_ID)

  res.json({
    mode:               runpodMode ? 'runpod' : 'local',
    engine:             process.env.LIPSYNC_ENGINE || 'wav2lip',
    runpod_endpoint_id: process.env.RUNPOD_ENDPOINT_ID ?? null,
    wav2lip_path:       wav2lipPath,
    python_bin:         pythonBin,
    wav2lip_dir_exists: fsSync.existsSync(wav2lipPath),
    checkpoint_exists:  fsSync.existsSync(checkpointPath),
    face_model_exists:  fsSync.existsSync(faceModelPath),
    checkpoint_path:    checkpointPath,
    face_model_path:    faceModelPath,
  })
})

// ── POST /api/lipsync/generate ────────────────────────────────────────────────
router.post('/api/lipsync/generate', async (req, res) => {
  return res.status(503).json({
    error: 'Avatar generation coming soon',
    message: 'Avatar Studio will be available in the next update. Stock clips are being used instead.',
  })

  const { avatar_image_url, voice_url, title, background_url, background_type, background_color, user_id } = req.body

  if (!avatar_image_url || !voice_url) {
    return res.status(400).json({ error: 'avatar_image_url and voice_url are required' })
  }

  const jobId  = uuidv4()
  const jobDir = path.join(os.tmpdir(), `lipsync_${jobId.slice(0, 8)}`)

  jobs.set(jobId, { status: 'processing', pct: 0, startedAt: new Date().toISOString() })
  res.json({ job_id: jobId, status: 'processing' })

  // Background async job
  ;(async () => {
    await fs.ensureDir(jobDir)
    try {

      // ── RunPod GPU mode ───────────────────────────────────────────────────────
      // Active when RUNPOD_API_KEY + RUNPOD_ENDPOINT_ID are both set in env.
      // The RunPod handler downloads assets, runs inference on GPU, and
      // uploads directly to Cloudinary — returning a video_url or video_b64.
      if (process.env.RUNPOD_API_KEY && process.env.RUNPOD_ENDPOINT_ID) {
        jobs.set(jobId, { status: 'processing', pct: 15, message: 'Submitting to RunPod GPU…' })

        const output = await runWithRunPod({ avatar_image_url, voice_url, user_id })

        // Handler uploaded to Cloudinary itself — use URL directly
        if (output.video_url) {
          jobs.set(jobId, { status: 'completed', pct: 100, video_url: output.video_url })
          console.log('[runpod] done:', output.video_url.slice(0, 80))
          await fs.remove(jobDir).catch(() => {})
          return
        }

        // Handler returned base64 — decode and upload to Cloudinary from here
        if (output.video_b64) {
          jobs.set(jobId, { status: 'processing', pct: 85, message: 'Uploading RunPod result…' })
          const videoBuffer  = Buffer.from(output.video_b64, 'base64')
          const tmpVideoPath = path.join(jobDir, 'runpod_result.mp4')
          fsSync.writeFileSync(tmpVideoPath, videoBuffer)
          const videoUrl = await uploadToCloudinary(tmpVideoPath, user_id)
          jobs.set(jobId, { status: 'completed', pct: 100, video_url: videoUrl })
          console.log('[runpod] done (via b64):', videoUrl.slice(0, 80))
          await fs.remove(jobDir).catch(() => {})
          return
        }

        throw new Error('RunPod handler returned neither video_url nor video_b64')
      }

      // ── Local Wav2Lip mode (Railway CPU) ─────────────────────────────────────
      // Step 1: Download inputs
      jobs.set(jobId, { status: 'processing', pct: 10, message: 'Downloading assets...' })
      const avatarPath = path.join(jobDir, 'avatar.jpg')
      const audioPath  = path.join(jobDir, 'audio.wav')
      await downloadFile(avatar_image_url, avatarPath)
      await downloadFile(voice_url, audioPath)

      // Step 2: Verify checkpoint
      const wav2lipPath    = process.env.WAV2LIP_PATH || '/app/Wav2Lip'
      const pythonBin      = process.env.PYTHON_BIN   || '/opt/venv/bin/python3'
      const engine         = process.env.LIPSYNC_ENGINE || 'wav2lip'
      const checkpointPath = path.join(wav2lipPath, 'checkpoints', 'wav2lip.pth')

      if (!fsSync.existsSync(checkpointPath)) {
        console.error('[lipsync] Checkpoint not found at:', checkpointPath)
        console.error('[lipsync] WAV2LIP_PATH:', wav2lipPath)
        console.error('[lipsync] Directory contents:',
          fsSync.existsSync(wav2lipPath)
            ? fsSync.readdirSync(wav2lipPath).join(', ')
            : 'DIRECTORY DOES NOT EXIST'
        )
        jobs.set(jobId, {
          status: 'failed',
          error: `Wav2Lip checkpoint not found at ${checkpointPath}. Set RUNPOD_API_KEY + RUNPOD_ENDPOINT_ID to use GPU, or ensure WAV2LIP_PATH is correct for local mode.`,
        })
        await fs.remove(jobDir).catch(() => {})
        return
      }

      // Step 3: Run lipsync engine
      jobs.set(jobId, { status: 'processing', pct: 30, message: 'Running lipsync engine...' })
      let resultPath

      if (engine === 'sadtalker') {
        const sadPath = process.env.SADTALKER_PATH
        const outDir  = path.join(jobDir, 'out')
        await fs.ensureDir(outDir)
        const python  = resolveBin('PYTHON_BIN', 'python3')
        await new Promise((resolve, reject) => {
          const proc = spawn(python, [
            'inference.py',
            '--driven_audio', audioPath,
            '--source_image', avatarPath,
            '--result_dir',   outDir,
            '--still',
            '--preprocess', 'full',
          ], { cwd: sadPath, stdio: ['ignore', 'pipe', 'pipe'] })
          proc.stdout.on('data', d => console.log('[sadtalker]', d.toString().trimEnd()))
          proc.stderr.on('data', d => console.log('[sadtalker stderr]', d.toString().trimEnd()))
          proc.on('close', code => code === 0 ? resolve() : reject(new Error(`SadTalker exited ${code}`)))
          proc.on('error', reject)
        })
        const files = (await fs.readdir(outDir)).filter(f => f.endsWith('.mp4'))
        if (!files.length) throw new Error('SadTalker produced no output .mp4')
        resultPath = path.join(outDir, files[0])
      } else {
        // wav2lip (default)
        const lipSyncVideoPath = path.join(jobDir, 'lipsync.mp4')

        const wav2lipArgs = [
          path.join(wav2lipPath, 'inference.py'),
          '--checkpoint_path', checkpointPath,
          '--face',            avatarPath,
          '--audio',           audioPath,
          '--outfile',         lipSyncVideoPath,
          '--resize_factor',   '2',
          '--nosmooth',
        ]

        console.log('[lipsync] Running Wav2Lip:', pythonBin, wav2lipArgs.join(' '))

        const proc = spawn(pythonBin, wav2lipArgs, {
          cwd: wav2lipPath,
          stdio: ['ignore', 'pipe', 'pipe'],
          env: {
            ...process.env,
            PATH: `/opt/venv/bin:${process.env.PATH}`,
            PYTHONPATH: wav2lipPath,
          },
        })

        let stderr = ''
        proc.stdout.on('data', d => console.log('[wav2lip]', d.toString().slice(0, 200).trimEnd()))
        proc.stderr.on('data', d => { stderr += d; console.log('[wav2lip stderr]', d.toString().slice(0, 200).trimEnd()) })

        await new Promise((resolve, reject) => {
          proc.on('close', code => {
            if (code === 0) resolve()
            else reject(new Error(`Wav2Lip exited ${code}. stderr: ${stderr.slice(-500)}`))
          })
          proc.on('error', err => reject(new Error(`Failed to spawn Wav2Lip: ${err.message}`)))
        })

        resultPath = lipSyncVideoPath
      }

      // Step 4: Upload to Cloudinary
      jobs.set(jobId, { status: 'processing', pct: 85, message: 'Uploading result...' })
      const videoUrl = await uploadToCloudinary(resultPath, user_id)
      jobs.set(jobId, { status: 'completed', pct: 100, video_url: videoUrl })
      console.log('[lipsync] Done:', videoUrl.slice(0, 80))

    } catch (err) {
      console.error('[lipsync] Job failed:', err.message)
      jobs.set(jobId, { status: 'failed', error: err.message })
    } finally {
      await fs.remove(jobDir).catch(() => {})
    }
  })()
})

// ── GET /api/lipsync/status/:jobId ────────────────────────────────────────────
router.get('/api/lipsync/status/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId)
  if (!job) return res.status(404).json({ error: 'Job not found' })
  res.json(job)
})

module.exports = router
