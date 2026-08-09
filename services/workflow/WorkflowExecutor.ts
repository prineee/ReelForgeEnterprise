/**
 * WorkflowExecutor.ts
 *
 * Does the actual work behind each workflow stage — the only file in this
 * module that calls into MovieProductionService, QueueManager,
 * BillingEngine, and (optionally) AIOrchestrator. WorkflowCoordinator
 * decides *when* to call these methods and what to do with failures;
 * this file only knows how to perform one stage's work and report back
 * plain data, never mutating a WorkflowContext itself (WorkflowCoordinator
 * applies the returned data via WorkflowContext.ts's `with*` updaters).
 *
 * Nothing here modifies MovieProductionService, QueueManager,
 * BillingEngine, or AIOrchestrator — every one of them is constructor-
 * injected and used strictly through its existing public API.
 *
 * --- Bridging the AI pipeline ---
 * MovieProductionService.startProduction() is atomic from the outside: it
 * runs Story Analysis through Movie Assembly (5 real stages, covering 10
 * of its 11 ProductionStage values — see IMPLEMENTED_STAGES in that file)
 * in one call and returns one ProductionResult. There's no per-stage
 * method to call individually, and no way to resume mid-pipeline, so
 * runAiPipeline() below makes exactly one startProduction() call and, for
 * observability, polls the *same* productionId's getProgress() output
 * concurrently — using the completedStages/currentStage fields that
 * method already returns — to emit a StageCompleted event each time a
 * real ProductionStage finishes, without needing MovieProductionService
 * to expose anything new.
 *
 * MovieProductionService never implements ProductionStage.FinalRendering
 * (its own IMPLEMENTED_STAGES list excludes it, and its `startProduction()`
 * warnings say so explicitly). This workflow's "Rendering" stage is
 * therefore satisfied by ProductionStage.MovieAssembly, the last stage
 * MovieProductionService actually runs — see
 * PRODUCTION_STAGE_TO_WORKFLOW_STAGE below. True Rendering-only retry
 * (skipping already-completed story/character/scene work) isn't possible
 * without MovieProductionService supporting real resumability, which is
 * out of scope for this sprint — see WorkflowRecovery.ts and
 * WorkflowCoordinator.ts's resume() for how "Rendering failed, keep
 * assets, allow resume" is honored within that real constraint.
 */

import type { MovieProductionService } from '../ai/orchestration/MovieProductionService'
import type { ProductionRequest, ProductionResult } from '../ai/orchestration/MovieProductionContracts'
import { ProductionStage, ProductionStatus } from '../ai/orchestration/MovieProductionContracts'

import type { QueueManager } from '../queue/QueueManager'
import type { Job } from '../queue/QueueTypes'
import { JobPriorityLevel, JobStatus } from '../queue/QueueTypes'

import type { BillingEngine } from '../billing/BillingEngine'
import type { CreditReservation } from '../billing/BillingTypes'
import { UsageCategory } from '../billing/BillingTypes'

import type { AIOrchestrator } from '../orchestrator/AIOrchestrator'

import type { WorkflowContext, WorkflowReservation } from './WorkflowContext'
import { WorkflowStage } from './WorkflowState'
import type { WorkflowEventBus } from './WorkflowEvents'
import { WorkflowEventType } from './WorkflowEvents'

export class WorkflowExecutorError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'WorkflowExecutorError'
  }
}

const MOVIE_PRODUCTION_JOB_TYPE = 'workflow.movie-production'

/** Maps a real AI-pipeline stage onto the nearest workflow-level stage — see file header. */
const PRODUCTION_STAGE_TO_WORKFLOW_STAGE: Partial<Record<ProductionStage, WorkflowStage>> = {
  [ProductionStage.StoryAnalysis]: WorkflowStage.StoryPlanning,
  [ProductionStage.CharacterDevelopment]: WorkflowStage.CharacterPlanning,
  [ProductionStage.EnvironmentDesign]: WorkflowStage.EnvironmentPlanning,
  [ProductionStage.CameraPlanning]: WorkflowStage.CameraPlanning,
  // EmotionPlanning has no dedicated bucket in this workflow's diagram; folded into Camera Planning's window.
  [ProductionStage.EmotionPlanning]: WorkflowStage.CameraPlanning,
  [ProductionStage.ScenePlanning]: WorkflowStage.ScenePlanning,
  [ProductionStage.ReferenceImageGeneration]: WorkflowStage.ReferenceImages,
  // Prompt composition is bundled into the Reference Images window — no dedicated workflow stage names it.
  [ProductionStage.PromptComposition]: WorkflowStage.ReferenceImages,
  [ProductionStage.VideoGeneration]: WorkflowStage.VideoGeneration,
  [ProductionStage.MovieAssembly]: WorkflowStage.Rendering,
}

export interface ReserveCreditsResult {
  reservations: WorkflowReservation[]
  estimatedRuntimeSeconds: number | null
}

export interface RunAiPipelineResult {
  result: ProductionResult
  observedStages: WorkflowStage[]
}

export class WorkflowExecutor {
  private queueHandlerRegistered = false
  private readonly pipelineRunners = new Map<string, () => Promise<ProductionResult>>()

  constructor(
    private readonly movieProductionService: MovieProductionService,
    private readonly queueManager: QueueManager,
    private readonly billingEngine: BillingEngine,
    private readonly events: WorkflowEventBus,
    private readonly aiOrchestrator?: AIOrchestrator
  ) {}

  validateRequest(context: WorkflowContext): void {
    const { request } = context
    if (!request.userId?.trim()) {
      throw new WorkflowExecutorError('WorkflowRequest.userId is required.')
    }
    if (!request.userIdea?.trim() || request.userIdea.trim().length < 10) {
      throw new WorkflowExecutorError('WorkflowRequest.userIdea must be at least 10 characters.')
    }
  }

  /**
   * Reserves credits for the request: one reservation per usage category
   * (story/images/video/voice/rendering) via
   * BillingEngine.reserveForProduction(), because CreditManager only
   * allows a single consume() per reservation — settling categories
   * independently later (see settleReservationsOnSuccess()) needs
   * independent holds.
   *
   * There's deliberately no "reserve exactly N credits" escape hatch:
   * BillingEngine.reserveForProduction() always prices its own amount via
   * CreditCalculator from a CreditCalculationInput — it has no way to
   * reserve an arbitrary caller-supplied number instead, so recording a
   * different number on WorkflowContext than what CreditManager actually
   * holds would make the two silently disagree. If a caller needs a
   * different total, the honest lever is the scene/character estimates
   * below, which do feed the real calculation.
   */
  async reserveCredits(context: WorkflowContext): Promise<ReserveCreditsResult> {
    const { request } = context
    const sceneCount = request.estimatedSceneCount ?? 8
    const characterCount = request.estimatedCharacterCount ?? 3

    const reservations = await this.reservePerCategory(context, sceneCount, characterCount)
    return { reservations, estimatedRuntimeSeconds: this.estimateRuntimeSeconds(sceneCount, characterCount) }
  }

  /**
   * Reserves each category sequentially (not Promise.all) — five
   * reservations for the same production, each its own atomic
   * reserve_credits() call (see CreditTransaction.ts). Sequential keeps
   * the resulting WorkflowReservation[] order deterministic and avoids
   * five concurrent calls contending for the same user row's lock
   * needlessly; correctness doesn't depend on the ordering either way,
   * since each call is independently atomic.
   */
  private async reservePerCategory(context: WorkflowContext, sceneCount: number, characterCount: number): Promise<WorkflowReservation[]> {
    const plan: { label: string; category: UsageCategory; providerId: string; extra?: Record<string, number> }[] = [
      { label: 'Story Generation', category: UsageCategory.StoryGeneration, providerId: 'GEMINI' },
      { label: 'Images', category: UsageCategory.Images, providerId: 'IMAGEN', extra: { imageCount: characterCount } },
      { label: 'Videos', category: UsageCategory.Videos, providerId: 'VEO', extra: { sceneCount } },
      { label: 'Voice', category: UsageCategory.Voice, providerId: 'ELEVENLABS', extra: { sceneCount } },
      { label: 'Rendering', category: UsageCategory.Rendering, providerId: 'CLOUDINARY' },
    ]

    const reservations: WorkflowReservation[] = []
    for (const entry of plan) {
      const reservation = await this.billingEngine.reserveForProduction(context.request.userId, context.id, [
        { category: entry.category, providerId: entry.providerId, ...entry.extra },
      ])
      reservations.push(this.toWorkflowReservation(entry.label, entry.providerId, reservation))
    }
    return reservations
  }

  private toWorkflowReservation(label: string, providerId: string, reservation: CreditReservation): WorkflowReservation {
    return { label, providerId, reservationId: reservation.id, amount: reservation.amount, settled: false }
  }

  private estimateRuntimeSeconds(sceneCount: number, characterCount: number): number | null {
    if (!this.aiOrchestrator) return null
    try {
      const plan = this.aiOrchestrator.planProduction({
        estimatedSceneCount: sceneCount,
        estimatedCharacterCount: characterCount,
        targetDurationSecondsPerScene: 8,
        qualityTier: 'standard',
        priority: 'normal',
        currentQueueDepth: this.queueManager.getSnapshot().waitingCount,
      })
      return plan.generation.totalRuntimeSeconds
    } catch {
      // AIOrchestrator's estimate is best-effort metrics context, not required for the reservation above to succeed.
      return null
    }
  }

  /**
   * Settles every open reservation on success: re-prices each category
   * with CreditCalculator (via chargeUsage) using the same provider the
   * reservation used, and re-derives its units from the real result
   * capped at the estimate that priced the reservation. Capping (rather
   * than using the real count outright) guarantees the re-priced charge
   * never exceeds what's held — CreditManager.consume() allows at most
   * one settle per reservation and throws on over-spend, so this is what
   * keeps that always safe even when actual usage runs ahead of the
   * estimate; any usage beyond the original estimate isn't billed
   * further by this workflow layer today. chargeUsage() auto-releases
   * whatever surplus remains unspent on each reservation.
   */
  async settleReservationsOnSuccess(
    context: WorkflowContext,
    realSceneCount: number,
    realCharacterCount?: number
  ): Promise<{ reservationId: string; consumed: number; released: number }[]> {
    const estimatedSceneCount = context.request.estimatedSceneCount ?? 8
    const estimatedCharacterCount = context.request.estimatedCharacterCount ?? 3
    const cappedSceneCount = Math.min(realSceneCount, estimatedSceneCount)
    const cappedCharacterCount = Math.min(realCharacterCount ?? estimatedCharacterCount, estimatedCharacterCount)

    const settlements: { reservationId: string; consumed: number; released: number }[] = []
    for (const reservation of context.reservations.filter((r) => !r.settled)) {
      const category = this.categoryForReservation(reservation)
      // Must mirror reservePerCategory()'s extra fields exactly per
      // category — CreditCalculator defaults an omitted sceneCount to 1
      // unit, so passing it where the reservation didn't (e.g. Rendering,
      // Story) would re-price a different, larger unit count than what
      // was actually held and make consume() throw on over-spend.
      const extra: { sceneCount?: number; imageCount?: number } = {}
      if (category === UsageCategory.Videos || category === UsageCategory.Voice) {
        extra.sceneCount = cappedSceneCount
      }
      if (category === UsageCategory.Images) {
        extra.imageCount = cappedCharacterCount
      }

      const record = await this.billingEngine.chargeUsage(reservation.reservationId, context.request.userId, context.id, {
        category,
        providerId: reservation.providerId,
        ...extra,
      })
      const released = Math.max(0, reservation.amount - record.amount)
      settlements.push({ reservationId: reservation.reservationId, consumed: record.amount, released })
    }
    return settlements
  }

  private categoryForReservation(reservation: WorkflowReservation): UsageCategory {
    switch (reservation.label) {
      case 'Story Generation':
        return UsageCategory.StoryGeneration
      case 'Images':
        return UsageCategory.Images
      case 'Videos':
        return UsageCategory.Videos
      case 'Voice':
        return UsageCategory.Voice
      default:
        return UsageCategory.Rendering
    }
  }

  /**
   * Submits a queue job that, when the Queue actually runs it, executes
   * the AI pipeline via `runner`. maxAttempts is pinned to 1: retrying a
   * failed AI-pipeline attempt is WorkflowRecovery's decision, not the
   * Queue's own — JobRetryPolicy defaults to 3 automatic retries with
   * backoff for any job that throws, which would silently re-invoke this
   * handler after `runner` (and its one-shot pipelineRunners entry) has
   * already been consumed, and outside WorkflowRecovery's stage-aware
   * policy entirely. Each real retry gets a brand-new queue job with a
   * freshly-registered runner instead — see WorkflowCoordinator.ts.
   */
  createQueueJob(context: WorkflowContext, runner: () => Promise<ProductionResult>): string {
    this.ensureQueueHandlerRegistered()
    this.pipelineRunners.set(context.id, runner)

    const job = this.queueManager.submit({
      type: MOVIE_PRODUCTION_JOB_TYPE,
      payload: { workflowId: context.id },
      priority: context.request.priority ?? JobPriorityLevel.Normal,
      maxAttempts: 1,
    })
    return job.id
  }

  private ensureQueueHandlerRegistered(): void {
    if (this.queueHandlerRegistered) return
    this.queueManager.registerHandler(MOVIE_PRODUCTION_JOB_TYPE, async (payload) => {
      const { workflowId } = payload as { workflowId: string }
      const runner = this.pipelineRunners.get(workflowId)
      if (!runner) {
        throw new WorkflowExecutorError(`No AI pipeline runner registered for workflow "${workflowId}".`)
      }
      try {
        return await runner()
      } finally {
        this.pipelineRunners.delete(workflowId)
      }
    })
    this.queueHandlerRegistered = true
  }

  /** Cancels a queued or running AI-pipeline job — see QueueManager.cancel() for Running-job cooperative-cancellation semantics. */
  cancelQueueJob(jobId: string): Job {
    return this.queueManager.cancel(jobId)
  }

  /** Polls the queue until `jobId` reaches a terminal state, ticking the manager itself so this works even if start() was never called. */
  async awaitQueueJob(jobId: string, pollIntervalMs = 200): Promise<Job> {
    for (;;) {
      await this.queueManager.tick()
      const job = this.queueManager.getJob(jobId)
      if (!job) {
        throw new WorkflowExecutorError(`Queue job "${jobId}" disappeared from the queue.`)
      }
      if (job.status === JobStatus.Completed || job.status === JobStatus.Failed || job.status === JobStatus.Cancelled) {
        return job
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    }
  }

  /**
   * Runs the real AI pipeline once. This is the method the Queue actually
   * executes for a movie-production job (see createQueueJob/
   * ensureQueueHandlerRegistered above) — so this is where AIOrchestrator
   * genuinely gets invoked as part of the Queue's real work, not as a
   * side estimate computed elsewhere: it plans which providers to use and
   * what the run should cost/take before MovieProductionService.
   * startProduction() is called to actually do the generation (Director
   * Engine runs inside that call already — nothing here duplicates it).
   * The plan is logged, not enforced: MovieProductionService's own
   * Factory-wired providers are what actually run, so a mismatch between
   * AIOrchestrator's selection and the real providers is visible rather
   * than silently papered over.
   */
  async runAiPipeline(context: WorkflowContext): Promise<RunAiPipelineResult> {
    console.log('[VERIFY] 3. WorkflowExecutor.runAiPipeline entered') // TEMPORARY — remove after verification
    this.planWithOrchestrator(context)

    const productionRequest: ProductionRequest = {
      productionId: context.id,
      userId: context.request.userId,
      userIdea: context.request.userIdea,
      requestedAt: new Date().toISOString(),
    }

    const observed = new Set<WorkflowStage>()
    const pollTimer = setInterval(() => {
      void this.pollProgressOnce(context, productionRequest.productionId, observed)
    }, 500)

    try {
      const result = await this.movieProductionService.startProduction(productionRequest)
      return { result, observedStages: Array.from(observed) }
    } finally {
      clearInterval(pollTimer)
      // Always take one last snapshot, on success AND failure — a
      // pipeline that finishes (or fails) faster than the 500ms interval
      // above would otherwise leave `observed` empty even though real
      // stages did complete first, which would misattribute a later-stage
      // failure back to Story Planning. This is best-effort: it reads
      // whatever ProductionContextRepository last had written before
      // startProduction() settled, same as any other poll.
      await this.pollProgressOnce(context, productionRequest.productionId, observed)
    }
  }

  private async pollProgressOnce(context: WorkflowContext, productionId: string, observed: Set<WorkflowStage>): Promise<void> {
    try {
      const progress = await this.movieProductionService.getProgress(productionId)
      for (const stageProgress of progress.stages) {
        if (stageProgress.status !== ProductionStatus.Completed) continue
        const workflowStage = PRODUCTION_STAGE_TO_WORKFLOW_STAGE[stageProgress.stage]
        if (workflowStage && !observed.has(workflowStage)) {
          observed.add(workflowStage)
          this.events.emit({
            type: WorkflowEventType.StageCompleted,
            workflowId: context.id,
            stage: workflowStage,
            message: `${workflowStage} completed.`,
            data: { productionStage: stageProgress.stage },
            context,
          })
        }
      }
    } catch {
      // getProgress() throws until Story Planning has written the first
      // context entry — expected during the brief window right after
      // startProduction() begins; the next tick succeeds once it has.
    }
  }

  /**
   * Task 3's "Queue Worker executes AI Orchestrator instead of
   * placeholders": calls AIOrchestrator.planProduction() for this
   * request's scene/character estimates and logs the resulting provider
   * selections and cost/time estimate. Best-effort — AIOrchestrator is
   * optional (see constructor), and a planning failure here must never
   * block the real generation that follows.
   */
  private planWithOrchestrator(context: WorkflowContext): void {
    if (!this.aiOrchestrator) return

    try {
      const plan = this.aiOrchestrator.planProduction({
        estimatedSceneCount: context.request.estimatedSceneCount ?? 8,
        estimatedCharacterCount: context.request.estimatedCharacterCount ?? 3,
        targetDurationSecondsPerScene: 8,
        qualityTier: 'standard',
        priority: 'normal',
        currentQueueDepth: this.queueManager.getSnapshot().waitingCount,
      })

      const providers = plan.selections.map((s) => `${s.capability}:${s.providerId}`).join(', ')
      console.info(
        `[WorkflowExecutor] AIOrchestrator plan for workflow "${context.id}" — providers: [${providers}], ` +
          `estimated ${plan.cost.totalCredits} credits, ${plan.generation.totalRuntimeSeconds}s runtime.`
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[WorkflowExecutor] AIOrchestrator planning failed for workflow "${context.id}" (non-fatal): ${message}`)
    }
  }

  /** Whether MovieProductionService actually implemented ProductionStage.FinalRendering for this run (it doesn't yet — see file header). */
  isFinalRenderingImplemented(result: ProductionResult): boolean {
    return !result.warnings.some((w) => w.stage === ProductionStage.FinalRendering)
  }

  /** "Storage" here is in-memory cataloging only (no database) — assets already live wherever the providers uploaded them. */
  storeAssets(result: ProductionResult) {
    return result.artifacts
  }
}
