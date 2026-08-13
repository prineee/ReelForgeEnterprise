'use strict'

/**
 * veoSmokeTestWorker.js
 *
 * BullMQ Worker for the "veo-smoke-test" queue (see queue.js's
 * addVeoSmokeTestJob()) — the Railway side of the internal Veo smoke-test
 * harness's Vercel -> Railway hand-off (see
 * app/api/internal/veo-smoke-test/route.ts and
 * services/internal/VeoSmokeTestHarness.ts). Vercel has already reserved
 * credits and created the ProductionContext before a job ever reaches this
 * worker; this file's only job is to construct the real
 * RenderOrchestrator/BillingEngine/ProductionContextRepository/Cloudinary
 * dependencies and hand them to executeVeoSmokeTest(), which performs the
 * one Veo generation, uploads it, and settles/releases the reservation.
 *
 * This runs on Railway specifically because it has no execution-time
 * ceiling — a real Veo generation (submit, poll, download) routinely takes
 * several minutes, which Vercel's Hobby-plan 60-second hard cap cannot
 * accommodate regardless of `maxDuration`.
 */

let veoSmokeTestWorker = null

try {
  if (process.env.REDIS_URL) {
    const { Worker } = require('bullmq')
    const { RenderOrchestrator } = require('../../dist/shared/services/rendering/RenderOrchestrator')
    const { createDefaultProviderRegistry } = require('../../dist/shared/services/rendering/ProviderRegistry')
    const { ProviderSelector } = require('../../dist/shared/services/rendering/ProviderSelector')
    const { createDefaultBillingEngine } = require('../../dist/shared/services/billing/BillingEngine')
    const {
      getSharedProductionContextRepository,
      CloudinaryStorageClient,
    } = require('../../dist/shared/services/infrastructure/MovieProductionFactory')
    const { executeVeoSmokeTest } = require('../../dist/shared/services/internal/VeoSmokeTestHarness')

    /**
     * This harness's whole reason for existing is to test the real Veo
     * integration specifically, regardless of whatever VIDEO_PROVIDER is
     * configured for real user traffic. The base ProviderSelector reads
     * that env var; this override always returns GOOGLE, so this worker
     * can never silently exercise a different provider instead of Veo,
     * and never falls back to one on failure (nothing here catches a
     * GOOGLE failure and re-selects).
     */
    class ForceGoogleProviderSelector extends ProviderSelector {
      select() {
        return 'GOOGLE'
      }
    }

    const processVeoSmokeTestJob = async (job) => {
      const { productionId, userId, reservationId, provider, prompt, aspectRatio, durationSeconds } = job.data
      console.log(`[veoSmokeTestWorker] Job ${job.id}: starting smoke test "${productionId}" for user "${userId}"`)

      const cloudinaryCloudName = process.env.CLOUDINARY_CLOUD_NAME
      const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY
      const cloudinaryApiSecret = process.env.CLOUDINARY_API_SECRET
      if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
        throw new Error('Cloudinary credentials are not configured.')
      }

      const registry = createDefaultProviderRegistry()
      const orchestrator = new RenderOrchestrator(registry, new ForceGoogleProviderSelector())
      const cloudinaryClient = new CloudinaryStorageClient(cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret)

      const result = await executeVeoSmokeTest(
        { productionId, userId, reservationId, provider, prompt, aspectRatio, durationSeconds },
        {
          billingEngine: createDefaultBillingEngine(),
          contextRepository: getSharedProductionContextRepository(),
          orchestrator,
          uploadVideo: async (sourceUrl, publicId) => {
            const uploaded = await cloudinaryClient.upload({
              sourceUrl,
              resourceType: 'video',
              folder: 'reelforge/internal-veo-smoke-test',
              fileName: publicId,
              overwrite: false,
            })
            return { secureUrl: uploaded.secureUrl ?? uploaded.url }
          },
        }
      )

      console.log(`[veoSmokeTestWorker] Job ${job.id}: finished with status ${result.status}`)

      if (result.status === 'RECOVERY_REQUIRED') {
        // Deliberately distinct from a normal FAILED: executeVeoSmokeTest()
        // has NOT released the reservation here — the external
        // generation's true outcome could not be confirmed (see
        // services/internal/VeoSmokeTestHarness.ts's header). This needs a
        // human to check the Veo/Cloud console against
        // ProductionContext.veoGeneration.operationId and manually settle
        // or release reservationId — surfaced loudly, not silently
        // swallowed as an ordinary failure.
        console.error(
          `[veoSmokeTestWorker] Job ${job.id}: RECOVERY_REQUIRED for production "${productionId}" — ` +
            `reservation "${reservationId}" is neither settled nor released. Manual review required. Reason: ${result.error}`
        )
        throw new Error(`RECOVERY_REQUIRED: ${result.error ?? 'Veo generation outcome could not be confirmed.'}`)
      }

      if (result.status !== 'COMPLETED') {
        // Release/failure recording already happened inside
        // executeVeoSmokeTest() — throwing here only marks the BullMQ job
        // itself failed, for queue observability. attempts:1 (see
        // queue.js) means this does not trigger an automatic,
        // credit-spending retry, and the idempotency guard at the top of
        // executeVeoSmokeTest() means even a stalled-job redelivery of
        // this same productionId cannot invoke Veo a second time.
        throw new Error(result.error ?? `Smoke test ended with status ${result.status}, not COMPLETED.`)
      }

      return result
    }

    veoSmokeTestWorker = new Worker('veo-smoke-test', processVeoSmokeTestJob, {
      connection: { url: process.env.REDIS_URL },
      concurrency: 1,
      // A real Veo generation (submit, poll, download) can run for several
      // minutes — BullMQ's default lock (30s) would let the stalled-job
      // checker consider this job abandoned and redeliver it to another
      // worker mid-run. lockDuration is the ceiling on one processing
      // attempt before BullMQ considers the lock stale; the idempotency
      // guard inside executeVeoSmokeTest() is the actual backstop against
      // a second paid Veo call if that ever happens anyway.
      lockDuration: 20 * 60 * 1000,
    })

    veoSmokeTestWorker.on('completed', (job, result) => {
      console.log(`[veoSmokeTestWorker] Job ${job.id} completed:`, JSON.stringify(result))
    })
    veoSmokeTestWorker.on('failed', (job, err) => {
      console.error(`[veoSmokeTestWorker] Job ${job?.id} failed:`, err.message)
    })

    console.log('[veoSmokeTestWorker] Veo smoke-test worker started')
  }
} catch (err) {
  console.error('[veoSmokeTestWorker] Worker start failed (non-fatal):', err.message)
}

module.exports = { veoSmokeTestWorker }
