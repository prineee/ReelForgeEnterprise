'use strict'

require('dotenv').config()

const express       = require('express')
const reelRoutes            = require('./routes/reelRoutes')
const cartoonRoutes         = require('./routes/cartoonRoutes')
const cartoonDialogueRoutes = require('./routes/cartoonDialogueRoutes')
const lipSyncRoutes         = require('./routes/lipSyncRoutes')
const { handleTTSSynthesize } = require('./services/tts')

const app = express()
const PORT = process.env.PORT || 3001

// ── CORS ──────────────────────────────────────────────────────────────────────
// Allow the Next.js frontend (Vercel or localhost) to call this worker.
app.use((req, res, next) => {
  const origin = process.env.ALLOWED_ORIGIN || '*'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  if (req.method === 'OPTIONS') return res.status(200).end()
  next()
})

// ── Body parsing ──────────────────────────────────────────────────────────────
// 20 mb limit to accommodate base64-encoded WAV audio in the request body.
app.use(express.json({ limit: '20mb' }))

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  const wav2lipPath    = process.env.WAV2LIP_PATH || '/app/Wav2Lip'
  const checkpointPath = require('path').join(wav2lipPath, 'checkpoints', 'wav2lip.pth')
  const require_fs     = require('fs')

  res.json({
    status:          'ok',
    ts:              new Date().toISOString(),
    lipsync_engine:  process.env.LIPSYNC_ENGINE || 'wav2lip',
    wav2lip_ready:   require_fs.existsSync(checkpointPath),
    checkpoint_path: checkpointPath,
    tts:             process.env.PIPER_TTS_URL ? 'piper+google' : 'google',
    tts_endpoint:    '/api/tts/synthesize — Google TTS via Railway',
    stock_video:     process.env.PIXABAY_API_KEY ? 'pixabay' : process.env.PEXELS_API_KEY ? 'pexels' : 'none',
    node_version:    process.version,
  })
})

// ── TTS endpoint (called by Vercel — Railway can reach Google TTS, Vercel cannot) ─
app.post('/api/tts/synthesize', handleTTSSynthesize)

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/', reelRoutes)
app.use('/', cartoonRoutes)
app.use('/', cartoonDialogueRoutes)
app.use('/', lipSyncRoutes)

// ── 404 / error fallbacks ─────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }))

app.use((err, _req, res, _next) => {
  console.error('[express]', err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`\nReelForge worker listening on :${PORT}`)
  console.log(`  POST /api/generate-video         — SSE video generation`)
  console.log(`  POST /api/generate-movie-scenes  — SSE scene generation`)
  console.log(`  GET  /api/queue/status           — queue stats`)
  console.log(`  GET  /health                     — health check\n`)

  try {
    if (process.env.REDIS_URL) {
      require('./services/sceneWorker')
      console.log('[queue] Scene generation worker started')
    } else {
      console.warn('[queue] REDIS_URL not set — running in direct mode (no queue)')
    }
  } catch (err) {
    console.error('[queue] Worker init failed (non-fatal):', err.message)
  }
})
