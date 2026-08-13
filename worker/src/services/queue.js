'use strict'

let videoQueue = null
let sceneQueue = null
let movieProductionQueue = null
let veoSmokeTestQueue = null
let videoQueueEvents = null

try {
  const { Queue, QueueEvents } = require('bullmq')
  const REDIS_URL = process.env.REDIS_URL

  if (REDIS_URL) {
    const connection = { url: REDIS_URL }
    videoQueue = new Queue('video-generation', { connection })
    sceneQueue = new Queue('scene-generation', { connection })
    movieProductionQueue = new Queue('movie-production', { connection })
    veoSmokeTestQueue = new Queue('veo-smoke-test', { connection })
    videoQueueEvents = new QueueEvents('video-generation', { connection })
    console.log('[queue] Redis connected successfully')
  } else {
    console.warn('[queue] No REDIS_URL - running without queue')
  }
} catch (err) {
  console.error('[queue] Redis connection failed (non-fatal):', err.message)
}

async function addVideoJob(jobData) {
  if (!videoQueue) throw new Error('Queue not available (no Redis)')
  const job = await videoQueue.add('generate', jobData, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 30000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  })
  return job.id
}

async function addSceneJob(jobData) {
  if (!sceneQueue) throw new Error('Queue not available (no Redis)')
  const job = await sceneQueue.add('generate-scenes', jobData, {
    attempts: 2,
    backoff: { type: 'exponential', delay: 30000 },
    removeOnComplete: { age: 3600 },
    removeOnFail: { age: 86400 },
  })
  return job.id
}

/**
 * jobId is explicitly set to productionId (not left to BullMQ's default
 * auto-generated id) — a duplicate add() for the same productionId is a
 * no-op rather than a second job, which combined with reserve_credits'
 * own (production_id, category) idempotency is what makes a retried
 * POST /api/movie/create -> enqueue call safe to repeat.
 *
 * attempts: 1, unlike the queues above — a movie production that fails
 * partway through has already made real, paid Gemini/Imagen/VEO calls; an
 * automatic BullMQ retry would re-run MovieProductionService.startProduction()
 * from scratch (it has no "resume from where it left off" for these
 * stages) and make those calls again, which is exactly the "no additional
 * credits through repeated retries" the workflow rules for this project
 * forbid. A failed production surfaces as FAILED via WorkflowRecovery's
 * existing credit-release path instead of being silently retried here.
 */
async function addMovieProductionJob(jobData) {
  if (!movieProductionQueue) throw new Error('Queue not available (no Redis)')
  const job = await movieProductionQueue.add('produce-movie', jobData, {
    jobId: jobData.productionId,
    attempts: 1,
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 86400 },
  })
  return job.id
}

/**
 * jobId = productionId, same reasoning as addMovieProductionJob() above —
 * a duplicate enqueue for the same productionId is a no-op add, not a
 * second job.
 *
 * attempts: 1 — a Veo smoke test that fails partway through has already
 * potentially made a real, paid Veo call; an automatic BullMQ retry would
 * invoke executeVeoSmokeTest() again from scratch. The idempotency guard
 * at the top of executeVeoSmokeTest() (services/internal/VeoSmokeTestHarness.ts)
 * is what actually prevents a second Veo call on stalled-job redelivery
 * (a mechanism independent of `attempts` — see lockDuration on the Worker
 * in veoSmokeTestWorker.js); attempts:1 just keeps BullMQ's own
 * throw-triggered retry out of the picture too.
 */
async function addVeoSmokeTestJob(jobData) {
  if (!veoSmokeTestQueue) throw new Error('Queue not available (no Redis)')
  const job = await veoSmokeTestQueue.add('run-smoke-test', jobData, {
    jobId: jobData.productionId,
    attempts: 1,
    removeOnComplete: { age: 86400 },
    removeOnFail: { age: 86400 },
  })
  return job.id
}

async function getJobStatus(jobId, queueName = 'video-generation') {
  const q =
    queueName === 'scene-generation' ? sceneQueue :
    queueName === 'movie-production' ? movieProductionQueue :
    queueName === 'veo-smoke-test' ? veoSmokeTestQueue :
    videoQueue
  if (!q) return null
  const job = await q.getJob(jobId)
  if (!job) return null
  const state = await job.getState()
  return {
    id: job.id,
    state,
    progress: job.progress,
    data: job.data,
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
    timestamp: job.timestamp,
  }
}

async function getQueueStats() {
  if (!videoQueue) return { waiting: 0, active: 0, completed: 0, failed: 0, redis: false }
  const [waiting, active, completed, failed] = await Promise.all([
    videoQueue.getWaitingCount(),
    videoQueue.getActiveCount(),
    videoQueue.getCompletedCount(),
    videoQueue.getFailedCount(),
  ])
  return { waiting, active, completed, failed, redis: true }
}

module.exports = {
  videoQueue, sceneQueue, movieProductionQueue, veoSmokeTestQueue, videoQueueEvents,
  addVideoJob, addSceneJob, addMovieProductionJob, addVeoSmokeTestJob, getJobStatus, getQueueStats,
}
