'use strict'

const express = require('express')
const router = express.Router()

const { addVeoSmokeTestJob } = require('../services/queue')

/**
 * POST /api/internal/veo-smoke-test/enqueue
 *
 * The Railway side of the Vercel -> Railway hand-off for the internal Veo
 * smoke-test harness (see app/api/internal/veo-smoke-test/route.ts). Vercel
 * has already run reserveVeoSmokeTest() — created the ProductionContext and
 * reserved credits — before calling this; the request body is exactly the
 * VeoSmokeTestReservation that call returned. This route only enqueues the
 * BullMQ job that veoSmokeTestWorker.js will pick up and execute.
 *
 * jobId = productionId inside addVeoSmokeTestJob() makes this endpoint
 * itself idempotent: a retried call for the same productionId is a no-op
 * add, not a second job.
 */
router.post('/api/internal/veo-smoke-test/enqueue', async (req, res) => {
  try {
    const { productionId, userId, reservationId, provider, prompt, aspectRatio, durationSeconds } = req.body ?? {}

    if (!productionId || !userId || !reservationId || !provider || !prompt || !aspectRatio || typeof durationSeconds !== 'number') {
      return res.status(400).json({ success: false, error: 'productionId, userId, reservationId, provider, prompt, aspectRatio, and durationSeconds are required.' })
    }

    const jobId = await addVeoSmokeTestJob({ productionId, userId, reservationId, provider, prompt, aspectRatio, durationSeconds })
    console.log(`[veoSmokeTestRoutes] Enqueued smoke test "${productionId}" as job "${jobId}"`)

    return res.json({ success: true, productionId, jobId })
  } catch (err) {
    console.error('[veoSmokeTestRoutes] Enqueue failed:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
