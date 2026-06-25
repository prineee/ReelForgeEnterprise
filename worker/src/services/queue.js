'use strict'

let videoQueue = null
let sceneQueue = null
let videoQueueEvents = null

try {
  const { Queue, QueueEvents } = require('bullmq')
  const REDIS_URL = process.env.REDIS_URL

  if (REDIS_URL) {
    const connection = { url: REDIS_URL }
    videoQueue = new Queue('video-generation', { connection })
    sceneQueue = new Queue('scene-generation', { connection })
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

async function getJobStatus(jobId, queueName = 'video-generation') {
  const q = queueName === 'scene-generation' ? sceneQueue : videoQueue
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
  videoQueue, sceneQueue, videoQueueEvents,
  addVideoJob, addSceneJob, getJobStatus, getQueueStats,
}
