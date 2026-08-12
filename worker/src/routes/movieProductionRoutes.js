'use strict'

const express = require('express')
const router = express.Router()

const { addMovieProductionJob } = require('../services/queue')

/**
 * POST /api/movie/enqueue
 *
 * The Railway side of the Vercel -> Railway hand-off (see
 * app/api/movie/create/route.ts's MOVIE_EXECUTION_MODE=railway branch).
 * Vercel has already created productionId's initial ProductionContext row
 * before calling this — this route only enqueues the BullMQ job that
 * movieProductionWorker.js will pick up and run to completion.
 *
 * jobId = productionId inside addMovieProductionJob() makes this endpoint
 * itself idempotent: a retried call for the same productionId is a no-op
 * add, not a second job.
 */
router.post('/api/movie/enqueue', async (req, res) => {
  try {
    const { productionId, userId, userIdea } = req.body ?? {}

    if (!productionId || !userId || !userIdea) {
      return res.status(400).json({ success: false, error: 'productionId, userId, and userIdea are required.' })
    }

    const jobId = await addMovieProductionJob({ productionId, userId, userIdea })
    console.log(`[movieProductionRoutes] Enqueued production "${productionId}" as job "${jobId}"`)

    return res.json({ success: true, productionId, jobId })
  } catch (err) {
    console.error('[movieProductionRoutes] Enqueue failed:', err.message)
    return res.status(500).json({ success: false, error: err.message })
  }
})

module.exports = router
