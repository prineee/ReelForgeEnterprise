'use strict'

/**
 * movieProductionWorker.js
 *
 * BullMQ Worker for the "movie-production" queue (see queue.js's
 * addMovieProductionJob()) — the Railway side of the Vercel -> Railway
 * hand-off. Runs the existing, unmodified WorkflowEngine/WorkflowCoordinator/
 * MovieProductionService pipeline (compiled into worker/dist/shared/ by
 * tsconfig.worker.json — see that file's header) exactly as it already ran
 * in-process on Vercel, just with no 60-second ceiling. The only new
 * behavior added here: after a successful run, hand the resulting
 * RenderPlan to movieProductionRenderer.renderFinalMovie() (the real
 * FFmpeg/Cloudinary step MovieProductionService never implements) and
 * persist the result onto the same ProductionContext.
 *
 * Credit reservation, settlement, and failure-recovery are NOT
 * reimplemented here — engine.startWorkflow() already runs
 * WorkflowCoordinator's full reserveCredits -> runAiPipeline ->
 * settleCredits/WorkflowRecovery.apply() sequence internally, against the
 * exact same Supabase RPCs/tables Vercel's in-process path uses today.
 */

let movieProductionWorker = null

try {
  if (process.env.REDIS_URL) {
    const { Worker } = require('bullmq')
    const {
      createMovieWorkflowEngine,
      getSharedProductionContextRepository,
    } = require('../../dist/shared/services/infrastructure/MovieProductionFactory')
    const { renderFinalMovie } = require('./movieProductionRenderer')

    const processMovieProductionJob = async (job) => {
      const { productionId, userId, userIdea } = job.data
      console.log(`[movieProductionWorker] Job ${job.id}: starting production "${productionId}" for user "${userId}"`)

      const engine = createMovieWorkflowEngine()
      const finished = await engine.startWorkflow({ userId, userIdea }, productionId)

      console.log(`[movieProductionWorker] Job ${job.id}: workflow "${finished.id}" ended with status ${finished.status}`)

      if (finished.status !== 'COMPLETED') {
        // Credit release + context.failure recording already happened
        // inside engine.startWorkflow() (WorkflowRecovery.apply(), and
        // MovieProductionFactory's recordWorkflowFailureOnProductionContext
        // listener) — throwing here only marks the BullMQ job itself
        // failed, for queue observability. attempts:1 (see queue.js) means
        // this does not trigger an automatic, credit-spending retry.
        throw new Error(`Workflow ended with status ${finished.status}, not COMPLETED.`)
      }

      const repository = getSharedProductionContextRepository()
      const context = await repository.getPersisted(productionId)

      if (!context?.finalRenderPlan) {
        console.error(`[movieProductionWorker] Job ${job.id}: workflow COMPLETED but no finalRenderPlan on context "${productionId}" — skipping real render.`)
        return { status: finished.status, workflowId: finished.id, rendered: false }
      }

      console.log(`[movieProductionWorker] Job ${job.id}: running real FFmpeg merge + Cloudinary upload`)
      const { finalVideoUrl, finalVideoMetadata } = await renderFinalMovie(context.finalRenderPlan)

      context.finalVideoUrl = finalVideoUrl
      context.finalVideoMetadata = finalVideoMetadata
      await repository.save(context)

      console.log(`[movieProductionWorker] Job ${job.id}: done — ${finalVideoUrl}`)
      return { status: finished.status, workflowId: finished.id, rendered: true, finalVideoUrl }
    }

    movieProductionWorker = new Worker('movie-production', processMovieProductionJob, {
      connection: { url: process.env.REDIS_URL },
      concurrency: 1,
      // A real production can run for many minutes (Gemini blueprint +
      // Imagen + VEO per scene + FFmpeg merge + Cloudinary upload) — BullMQ's
      // default lock (30s) would let another worker pick up the same job
      // mid-run. lockDuration is the ceiling on one processing attempt
      // before BullMQ considers the lock stale.
      lockDuration: 30 * 60 * 1000,
    })

    movieProductionWorker.on('completed', (job, result) => {
      console.log(`[movieProductionWorker] Job ${job.id} completed:`, JSON.stringify(result))
    })
    movieProductionWorker.on('failed', (job, err) => {
      console.error(`[movieProductionWorker] Job ${job?.id} failed:`, err.message)
    })

    console.log('[movieProductionWorker] Movie production worker started')
  }
} catch (err) {
  console.error('[movieProductionWorker] Worker start failed (non-fatal):', err.message)
}

module.exports = { movieProductionWorker }
