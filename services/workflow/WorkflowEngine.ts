/**
 * WorkflowEngine.ts
 *
 * The Workflow module's single public entry point: submit a movie request,
 * track it, cancel or resume it, read its metrics, subscribe to its
 * events. Holds the in-memory registry of every WorkflowContext (no
 * database) and delegates actual sequencing to WorkflowCoordinator.
 *
 * This is the top of the stack this whole sprint sequence has been
 * building toward: it depends on MovieProductionService (the AI
 * pipeline), QueueManager (services/queue), BillingEngine
 * (services/billing), and optionally AIOrchestrator (services/orchestrator)
 * — every one of them constructor-injected and used only through its
 * existing public API. None of those files are modified by this one.
 */

import type { MovieProductionService } from '../ai/orchestration/MovieProductionService'
import { QueueManager } from '../queue/QueueManager'
import { createDefaultBillingEngine, BillingEngine } from '../billing/BillingEngine'
import type { AIOrchestrator } from '../orchestrator/AIOrchestrator'

import type { WorkflowContext, WorkflowRequest } from './WorkflowContext'
import { createWorkflowContext } from './WorkflowContext'
import { WorkflowCoordinator } from './WorkflowCoordinator'
import { WorkflowExecutor } from './WorkflowExecutor'
import { WorkflowRecovery } from './WorkflowRecovery'
import type { WorkflowRecoveryOptions } from './WorkflowRecovery'
import { WorkflowEventBus, WorkflowEventType } from './WorkflowEvents'
import type { WorkflowEvent, WorkflowEventListener } from './WorkflowEvents'
import { WorkflowMetrics } from './WorkflowMetrics'
import type { WorkflowMetricsSnapshot } from './WorkflowMetrics'

export class WorkflowEngineError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkflowEngineError'
  }
}

export class WorkflowEngine {
  private readonly workflows = new Map<string, WorkflowContext>()
  private readonly coordinator: WorkflowCoordinator
  private readonly metrics = new WorkflowMetrics()

  constructor(private readonly events: WorkflowEventBus, executor: WorkflowExecutor, recovery: WorkflowRecovery) {
    this.coordinator = new WorkflowCoordinator(executor, recovery, events)
    // Every workflow's context is kept in sync with whatever the
    // coordinator emits, so getWorkflow() reflects live progress even
    // while run() is still in flight (it doesn't resolve until the whole
    // workflow reaches a terminal or paused state).
    this.events.onAny((event) => this.syncFromEvent(event))
  }

  /**
   * Creates a workflow and starts it. Resolves once the workflow reaches
   * Completed, Failed, Cancelled, or Paused. `id`, if supplied, becomes
   * this workflow's id instead of a freshly generated one — see
   * createWorkflowContext()'s doc comment for why a caller would need that.
   */
  async startWorkflow(request: WorkflowRequest, id?: string): Promise<WorkflowContext> {
    const context = createWorkflowContext(request, id)
    this.workflows.set(context.id, context)

    const finished = await this.coordinator.run(context)
    this.workflows.set(finished.id, finished)
    return finished
  }

  /**
   * Creates a workflow and starts it in the background, returning its id
   * immediately instead of waiting for the whole run to finish — for
   * callers that can't hold a request open for a multi-minute movie
   * generation (an HTTP route, in particular; this is what
   * app/api/movie/create/route.ts uses). Progress is available via
   * getWorkflow()/getMetrics() while it's in flight, kept live by
   * syncFromEvent() below. Errors that somehow escape
   * WorkflowCoordinator.run() (which normally only ever resolves — see
   * its wrapRun()) are logged rather than thrown, since there's no caller
   * left to receive them.
   *
   * Also returns `completion`: the same run, as a promise the caller can
   * hand to Next.js's after() (next/server). An HTTP route handler that
   * only chains .then()/.catch() here without keeping a reference has no
   * way to tell the platform this work must keep running once the
   * response has been sent — after() is what makes that guarantee, and it
   * needs the actual promise, not just a fire-and-forget chain internal to
   * this method.
   */
  startWorkflowInBackground(request: WorkflowRequest): { workflowId: string; completion: Promise<void> } {
    console.log('[VERIFY] 2. startWorkflowInBackground entered') // TEMPORARY — remove after verification
    const context = createWorkflowContext(request)
    this.workflows.set(context.id, context)

    const completion = this.coordinator
      .run(context)
      .then((finished) => {
        this.workflows.set(finished.id, finished)
      })
      .catch((error) => {
        console.error(`[WorkflowEngine] Workflow "${context.id}" ended unexpectedly:`, error)
      })

    return { workflowId: context.id, completion }
  }

  getWorkflow(workflowId: string): WorkflowContext | undefined {
    return this.workflows.get(workflowId)
  }

  listWorkflows(): WorkflowContext[] {
    return Array.from(this.workflows.values())
  }

  async cancelWorkflow(workflowId: string, reason?: string): Promise<WorkflowContext> {
    const context = this.requireWorkflow(workflowId)
    const cancelled = await this.coordinator.cancel(context, reason)
    this.workflows.set(cancelled.id, cancelled)
    return cancelled
  }

  /** Resumes a Paused (Rendering-failure) workflow — see WorkflowCoordinator.resume() for what "resume" actually means today. */
  async resumeWorkflow(workflowId: string): Promise<WorkflowContext> {
    const context = this.requireWorkflow(workflowId)
    const resumed = await this.coordinator.resume(context)
    this.workflows.set(resumed.id, resumed)
    return resumed
  }

  getMetrics(workflowId: string): WorkflowMetricsSnapshot {
    const context = this.requireWorkflow(workflowId)
    return this.metrics.snapshot(context)
  }

  on(type: WorkflowEventType, listener: WorkflowEventListener): () => void {
    return this.events.on(type, listener)
  }

  onAny(listener: WorkflowEventListener): () => void {
    return this.events.onAny(listener)
  }

  private requireWorkflow(workflowId: string): WorkflowContext {
    const context = this.workflows.get(workflowId)
    if (!context) {
      throw new WorkflowEngineError(`No workflow found for id "${workflowId}".`)
    }
    return context
  }

  /**
   * Every WorkflowEvent carries the full context as it stood the instant
   * it fired (see WorkflowEvents.ts) — this keeps the registry current in
   * real time, which is what makes getWorkflow()/getMetrics() meaningful
   * to call *while* startWorkflowInBackground()'s run is still in flight,
   * not just after it settles.
   */
  private syncFromEvent(event: WorkflowEvent): void {
    if (this.workflows.has(event.context.id)) {
      this.workflows.set(event.context.id, event.context)
    }
  }
}

/**
 * Wires a WorkflowEngine around a real, already-constructed
 * MovieProductionService (e.g. from createMovieProductionService() in
 * services/infrastructure/MovieProductionFactory.ts) plus a QueueManager
 * and BillingEngine — defaulted to their own zero-config in-memory
 * factories if not supplied, the same way
 * services/orchestrator/AIOrchestrator.ts's createDefaultAIOrchestrator()
 * does. Unlike those, there's no zero-config default for
 * MovieProductionService itself — it requires real provider credentials
 * (see MovieProductionFactory.ts), which this layer must not construct on
 * its own, so callers always supply one.
 */
export function createWorkflowEngine(
  movieProductionService: MovieProductionService,
  options: {
    queueManager?: QueueManager
    billingEngine?: BillingEngine
    aiOrchestrator?: AIOrchestrator
    recoveryOptions?: WorkflowRecoveryOptions
  } = {}
): WorkflowEngine {
  const queueManager = options.queueManager ?? new QueueManager()
  const billingEngine = options.billingEngine ?? createDefaultBillingEngine()

  const events = new WorkflowEventBus()
  const executor = new WorkflowExecutor(movieProductionService, queueManager, billingEngine, events, options.aiOrchestrator)
  const recovery = new WorkflowRecovery(billingEngine, options.recoveryOptions)
  return new WorkflowEngine(events, executor, recovery)
}
