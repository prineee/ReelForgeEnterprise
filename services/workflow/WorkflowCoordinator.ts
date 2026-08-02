/**
 * WorkflowCoordinator.ts
 *
 * Walks a WorkflowContext through the full stage sequence from the
 * mission's diagram, calling WorkflowExecutor for each stage's actual
 * work, WorkflowRecovery when a stage fails, and WorkflowEventBus to make
 * every transition observable. This is the only file that decides *order*
 * and *what happens on failure*; WorkflowExecutor only knows how to do
 * one stage's work when asked.
 *
 * The AI-pipeline portion (Story Planning through Rendering) is handled
 * as one phase rather than eight separate runStage() calls, because
 * MovieProductionService.startProduction() is a single atomic call from
 * the outside — see WorkflowExecutor.ts's file header for why, and for
 * how per-real-stage StageCompleted events still get emitted during that
 * one call via concurrent progress polling.
 *
 * Every emitted event carries the full context as it stood at that
 * instant — see WorkflowEvents.ts. That's what lets WorkflowEngine keep a
 * live view of every in-flight workflow without polling this class.
 */

import type { ProductionResult } from '../ai/orchestration/MovieProductionContracts'
import { JobStatus } from '../queue/QueueTypes'

import type { WorkflowExecutor, ReserveCreditsResult } from './WorkflowExecutor'
import type { RecoveryDecision } from './WorkflowRecovery'
import type { WorkflowRecovery } from './WorkflowRecovery'
import type { WorkflowEventBus } from './WorkflowEvents'
import { WorkflowEventType } from './WorkflowEvents'
import { WorkflowStage, WorkflowStateMachine, WorkflowStatus } from './WorkflowState'
import type { WorkflowContext } from './WorkflowContext'
import {
  withArtifacts,
  withError,
  withEstimatedRuntime,
  withProductionId,
  withQueueJobId,
  withReservation,
  withReservationSettled,
  withResumable,
  withStageUpdate,
  withStatus,
} from './WorkflowContext'

export class WorkflowCoordinatorError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message)
    this.name = 'WorkflowCoordinatorError'
  }
}

/** Internal control-flow signal: a stage's recovery decision ended the run — not a real error. */
class WorkflowHalt {
  constructor(public readonly context: WorkflowContext) {}
}

const AI_PIPELINE_STAGES: WorkflowStage[] = [
  WorkflowStage.StoryPlanning,
  WorkflowStage.CharacterPlanning,
  WorkflowStage.EnvironmentPlanning,
  WorkflowStage.CameraPlanning,
  WorkflowStage.ScenePlanning,
  WorkflowStage.ReferenceImages,
  WorkflowStage.VideoGeneration,
  WorkflowStage.Rendering,
]

export class WorkflowCoordinator {
  private readonly stateMachine = new WorkflowStateMachine()

  constructor(
    private readonly executor: WorkflowExecutor,
    private readonly recovery: WorkflowRecovery,
    private readonly events: WorkflowEventBus
  ) {}

  async run(initialContext: WorkflowContext): Promise<WorkflowContext> {
    this.events.emit({
      type: WorkflowEventType.WorkflowStarted,
      workflowId: initialContext.id,
      message: 'Workflow started.',
      context: initialContext,
    })

    return this.wrapRun(async () => {
      let context = this.transition(initialContext, WorkflowStatus.Validating)

      context = await this.runStage(context, WorkflowStage.ValidateRequest, async (ctx) => {
        this.executor.validateRequest(ctx)
        return ctx
      })

      context = await this.runStage(context, WorkflowStage.ReserveCredits, async (ctx) => this.reserveCredits(ctx))
      context = await this.runStage(context, WorkflowStage.CreateWorkflow, async (ctx) => withProductionId(ctx, ctx.id))

      context = this.transition(context, WorkflowStatus.Queued)
      // Transition to Running BEFORE CreateQueueJob's work runs, not after
      // — createQueueJob()'s runner closure captures `ctx` by reference for
      // the whole AI-pipeline duration (WorkflowExecutor.runAiPipeline()'s
      // progress-poll events carry that exact context), so if the
      // transition happened afterward, every live-progress event during
      // the entire AI pipeline would report the workflow as still QUEUED.
      context = this.transition(context, WorkflowStatus.Running)

      let queueJobId = ''
      context = await this.runStage(context, WorkflowStage.CreateQueueJob, async (ctx) => {
        queueJobId = this.executor.createQueueJob(ctx, async () => (await this.executor.runAiPipeline(ctx)).result)
        return withQueueJobId(ctx, queueJobId)
      })

      return this.finishFromAiPipeline(context, queueJobId)
    })
  }

  /**
   * Re-enters a Paused (Rendering-failure, resumable) workflow. There's no
   * cheaper resume point than re-running the AI pipeline from scratch —
   * MovieProductionService.startProduction() has no partial-resume
   * capability to call into (see WorkflowExecutor.ts's file header) — so
   * this creates a fresh queue job and picks the sequence back up from
   * there. Everything already recorded on the context (validation,
   * reservations, prior stage history) is preserved.
   */
  async resume(context: WorkflowContext): Promise<WorkflowContext> {
    if (context.status !== WorkflowStatus.Paused || !context.resumable) {
      throw new WorkflowCoordinatorError(`Workflow "${context.id}" is not paused/resumable (status: ${context.status}).`)
    }

    return this.wrapRun(async () => {
      let ctx = this.transition(withResumable(context, false), WorkflowStatus.Running)
      const queueJobId = this.executor.createQueueJob(ctx, async () => (await this.executor.runAiPipeline(ctx)).result)
      ctx = withQueueJobId(ctx, queueJobId)
      return this.finishFromAiPipeline(ctx, queueJobId)
    })
  }

  /** Cancels a workflow: cancels its queue job if one exists, releases unsettled reservations, transitions to Cancelled. */
  async cancel(context: WorkflowContext, reason = 'Cancelled by request'): Promise<WorkflowContext> {
    if (this.stateMachine.isTerminal(context.status)) {
      return context
    }

    let next = context
    if (next.queueJobId) {
      try {
        this.executor.cancelQueueJob(next.queueJobId)
      } catch {
        // Already terminal on the queue side — nothing further to cancel.
      }
    }

    const decision: RecoveryDecision = { action: 'REFUND_AND_CANCEL', reason }
    next = await this.recovery.apply(next, decision)
    next = this.transition(next, WorkflowStatus.Cancelled)

    this.events.emit({ type: WorkflowEventType.Cancelled, workflowId: next.id, message: reason, context: next })
    return next
  }

  // ── Shared success/halt wrapper ──────────────────────────────────────

  /** Runs `fn`, emitting exactly one terminal event (Completed/Cancelled/Failed) whether it finishes normally or halts via a recovery decision. */
  private async wrapRun(fn: () => Promise<WorkflowContext>): Promise<WorkflowContext> {
    try {
      const context = await fn()
      this.events.emit({
        type: WorkflowEventType.Completed,
        workflowId: context.id,
        message: 'Workflow completed successfully.',
        context,
      })
      return context
    } catch (error) {
      if (error instanceof WorkflowHalt) {
        const finalContext = error.context
        const type = finalContext.status === WorkflowStatus.Cancelled ? WorkflowEventType.Cancelled : WorkflowEventType.Failed
        this.events.emit({
          type,
          workflowId: finalContext.id,
          message: `Workflow ended with status ${finalContext.status}.`,
          context: finalContext,
        })
        return finalContext
      }
      throw error
    }
  }

  // ── Post-queue-job sequence (shared by run() and resume()) ───────────

  private async finishFromAiPipeline(context: WorkflowContext, queueJobId: string): Promise<WorkflowContext> {
    const { context: afterPipeline, result } = await this.runAiPipelinePhase(context, queueJobId)
    let ctx = afterPipeline

    ctx = await this.runStage(ctx, WorkflowStage.StoreAssets, async (c) => withArtifacts(c, this.executor.storeAssets(result)))
    ctx = await this.runStage(ctx, WorkflowStage.Complete, async (c) => c)
    ctx = await this.runStage(ctx, WorkflowStage.ReleaseCredits, async (c) => this.settleCredits(c, result))

    return this.transition(ctx, WorkflowStatus.Completed)
  }

  // ── Stage bodies ─────────────────────────────────────────────────────

  private reserveCredits(context: WorkflowContext): WorkflowContext {
    // TEMPORARY DIAGNOSTIC — trace only, scoped to this file. This is the
    // only call WorkflowCoordinator makes into ReserveCredits
    // (WorkflowExecutor.reserveCredits(), which itself calls
    // BillingEngine.reserveForProduction() -> CreditManager.reserve()).
    // executor.reserveCredits()'s declared return type is ReserveCreditsResult
    // — never `false` or any other failure sentinel — so from this file's
    // vantage point the only possible failure signal is a thrown exception;
    // wrapping the call below is what proves that rather than assuming it.
    let reserveResult: ReserveCreditsResult
    try {
      reserveResult = this.executor.reserveCredits(context)
    } catch (error) {
      console.error(`[TRACE][ReserveCredits] THREW for workflow "${context.id}" (userId=${context.request.userId}).`)
      console.error(`[TRACE][ReserveCredits] returned false: NO — this call path has no boolean-return failure mode, only throw.`)
      console.error(`[TRACE][ReserveCredits] exception.name =`, error instanceof Error ? error.name : typeof error)
      console.error(`[TRACE][ReserveCredits] exception.message =`, error instanceof Error ? error.message : String(error))
      console.error(
        `[TRACE][ReserveCredits] exception own-properties =`,
        error && typeof error === 'object' ? { ...error } : error
      )
      console.error(`[TRACE][ReserveCredits] exception.stack =`, error instanceof Error ? error.stack : undefined)
      console.error(
        `[TRACE][ReserveCredits] NOTE: WorkflowCoordinator.ts has no direct reference to BillingEngine/CreditManager, ` +
          `so the user's actual credit balance and the exact credits requested cannot be printed from this file alone ` +
          `— only what this caught exception itself exposes (see "exception own-properties" above). Re-throwing unchanged; no fix applied.`
      )
      throw error
    }
    const { reservations, estimatedRuntimeSeconds } = reserveResult
    let next = context
    for (const reservation of reservations) {
      next = withReservation(next, reservation)
      this.events.emit({
        type: WorkflowEventType.CreditsReserved,
        workflowId: next.id,
        stage: WorkflowStage.ReserveCredits,
        message: `Reserved ${reservation.amount} credits for ${reservation.label}.`,
        data: { reservationId: reservation.reservationId, amount: reservation.amount },
        context: next,
      })
    }
    return withEstimatedRuntime(next, estimatedRuntimeSeconds)
  }

  private settleCredits(context: WorkflowContext, result: ProductionResult): WorkflowContext {
    const realSceneCount = result.artifacts.filter((a) => a.type === 'VIDEO').length || context.request.estimatedSceneCount || 8
    const settlements = this.executor.settleReservationsOnSuccess(context, realSceneCount)

    let next = context
    for (const settlement of settlements) {
      next = withReservationSettled(next, settlement.reservationId, {
        consumed: settlement.consumed,
        released: settlement.released,
      })
      this.events.emit({
        type: WorkflowEventType.CreditsConsumed,
        workflowId: next.id,
        stage: WorkflowStage.ReleaseCredits,
        message: `Consumed ${settlement.consumed} credits.`,
        data: { reservationId: settlement.reservationId },
        context: next,
      })
      if (settlement.released > 0) {
        this.events.emit({
          type: WorkflowEventType.CreditsRefunded,
          workflowId: next.id,
          stage: WorkflowStage.ReleaseCredits,
          message: `Released ${settlement.released} unused reserved credits.`,
          data: { reservationId: settlement.reservationId },
          context: next,
        })
      }
    }
    return next
  }

  // ── AI pipeline phase ────────────────────────────────────────────────

  private async runAiPipelinePhase(
    context: WorkflowContext,
    queueJobId: string
  ): Promise<{ context: WorkflowContext; result: ProductionResult }> {
    let ctx = context

    for (;;) {
      const observed = new Set<WorkflowStage>()
      const unsubscribe = this.events.on(WorkflowEventType.StageCompleted, (event) => {
        if (event.workflowId === ctx.id && event.stage && AI_PIPELINE_STAGES.includes(event.stage)) {
          observed.add(event.stage)
        }
      })

      let job
      try {
        job = await this.executor.awaitQueueJob(queueJobId)
      } finally {
        unsubscribe()
      }

      for (const stage of observed) {
        ctx = withStageUpdate(ctx, stage, { status: 'COMPLETED', completedAt: new Date().toISOString() })
      }

      if (job.status === JobStatus.Completed) {
        const now = new Date().toISOString()
        const wasRetried = ctx.stages.find((s) => s.stage === WorkflowStage.ReferenceImages)?.retryCount ?? 0
        for (const stage of AI_PIPELINE_STAGES) {
          ctx = withStageUpdate(ctx, stage, {
            status: 'COMPLETED',
            completedAt: ctx.stages.find((s) => s.stage === stage)?.completedAt ?? now,
          })
        }
        if (wasRetried > 0) {
          this.events.emit({
            type: WorkflowEventType.RetryFinished,
            workflowId: ctx.id,
            stage: WorkflowStage.ReferenceImages,
            message: `AI pipeline succeeded after ${wasRetried} retr${wasRetried === 1 ? 'y' : 'ies'}.`,
            context: ctx,
          })
        }
        return { context: ctx, result: job.result as ProductionResult }
      }

      const failedStage =
        AI_PIPELINE_STAGES.find((stage) => ctx.stages.find((s) => s.stage === stage)?.status !== 'COMPLETED') ??
        WorkflowStage.StoryPlanning
      const message =
        job.status === JobStatus.Cancelled
          ? 'AI pipeline job was cancelled.'
          : job.errors[job.errors.length - 1]?.message ?? 'AI pipeline failed.'

      const outcome = await this.handleFailure(ctx, failedStage, message)
      if (outcome.retry) {
        ctx = outcome.context
        queueJobId = this.executor.createQueueJob(ctx, async () => (await this.executor.runAiPipeline(ctx)).result)
        ctx = withQueueJobId(ctx, queueJobId)
        continue
      }
      throw new WorkflowHalt(outcome.context)
    }
  }

  // ── Shared stage runner ──────────────────────────────────────────────

  private async runStage(
    context: WorkflowContext,
    stage: WorkflowStage,
    work: (ctx: WorkflowContext) => Promise<WorkflowContext>
  ): Promise<WorkflowContext> {
    let ctx = withStageUpdate(context, stage, { status: 'RUNNING', startedAt: new Date().toISOString(), error: undefined })
    this.events.emit({ type: WorkflowEventType.StageStarted, workflowId: ctx.id, stage, message: `${stage} started.`, context: ctx })

    try {
      ctx = await work(ctx)
      const retryCountBeforeCompletion = ctx.stages.find((s) => s.stage === stage)?.retryCount ?? 0
      ctx = withStageUpdate(ctx, stage, { status: 'COMPLETED', completedAt: new Date().toISOString() })
      this.events.emit({
        type: WorkflowEventType.StageCompleted,
        workflowId: ctx.id,
        stage,
        message: `${stage} completed.`,
        context: ctx,
      })
      if (retryCountBeforeCompletion > 0) {
        this.events.emit({
          type: WorkflowEventType.RetryFinished,
          workflowId: ctx.id,
          stage,
          message: `${stage} succeeded after ${retryCountBeforeCompletion} retr${retryCountBeforeCompletion === 1 ? 'y' : 'ies'}.`,
          context: ctx,
        })
      }
      return ctx
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const outcome = await this.handleFailure(ctx, stage, message)
      if (outcome.retry) {
        return this.runStage(outcome.context, stage, work)
      }
      throw new WorkflowHalt(outcome.context)
    }
  }

  /** Applies WorkflowRecovery's decision for a stage failure. Returns {retry:true, context} to loop, or {retry:false, context} with a terminal status already set. */
  private async handleFailure(
    context: WorkflowContext,
    stage: WorkflowStage,
    message: string
  ): Promise<{ retry: boolean; context: WorkflowContext }> {
    const retryCount = context.stages.find((s) => s.stage === stage)?.retryCount ?? 0

    // Task 9 — every failure is logged, independent of what recovery decides to do about it.
    console.error(`[WorkflowCoordinator] Workflow "${context.id}" — ${stage} failed (attempt ${retryCount + 1}): ${message}`)

    let ctx = withStageUpdate(context, stage, { status: 'FAILED', error: message })
    ctx = withError(ctx, `${stage}: ${message}`)
    this.events.emit({
      type: WorkflowEventType.StageFailed,
      workflowId: ctx.id,
      stage,
      message: `${stage} failed: ${message}`,
      context: ctx,
    })

    if (retryCount > 0) {
      // This failure is itself the outcome of a previous retry attempt that didn't pan out.
      this.events.emit({
        type: WorkflowEventType.RetryFinished,
        workflowId: ctx.id,
        stage,
        message: `Retry ${retryCount} of ${stage} also failed: ${message}`,
        context: ctx,
      })
    }

    const decision = this.recovery.decide(ctx, stage)
    ctx = await this.recovery.apply(ctx, decision)

    if (decision.action === 'RETRY') {
      ctx = withStageUpdate(ctx, stage, { status: 'PENDING', retryCount: retryCount + 1 })
      ctx = this.transition(ctx, WorkflowStatus.Retrying)
      this.events.emit({
        type: WorkflowEventType.RetryStarted,
        workflowId: ctx.id,
        stage,
        message: `Retrying ${stage} (attempt ${retryCount + 2}): ${decision.reason}`,
        context: ctx,
      })
      ctx = this.transition(ctx, WorkflowStatus.Running)
      return { retry: true, context: ctx }
    }

    if (decision.action === 'PAUSE_FOR_RESUME') {
      ctx = withResumable(ctx, true)
      ctx = this.transition(ctx, WorkflowStatus.Paused)
      return { retry: false, context: ctx }
    }

    const finalStatus = decision.action === 'REFUND_AND_CANCEL' ? WorkflowStatus.Cancelled : WorkflowStatus.Failed
    ctx = this.transition(ctx, finalStatus)
    return { retry: false, context: ctx }
  }

  private transition(context: WorkflowContext, status: WorkflowStatus): WorkflowContext {
    this.stateMachine.assertTransition(context.status, status)
    return withStatus(context, status)
  }
}
