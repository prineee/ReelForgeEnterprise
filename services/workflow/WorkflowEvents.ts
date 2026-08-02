/**
 * WorkflowEvents.ts
 *
 * The event types WorkflowCoordinator emits as a workflow progresses, plus
 * a small in-memory pub/sub bus. No network calls — this is a plain
 * listener registry, not a message queue. Every event carries the full
 * WorkflowContext as it stood the moment the event fired, which is what
 * lets WorkflowEngine keep its workflow registry live (see
 * WorkflowEngine.syncFromEvent()) and lets any other subscriber (a
 * dashboard, a log line) observe real progress without polling internals.
 */

import type { WorkflowStage } from './WorkflowState'
import type { WorkflowContext } from './WorkflowContext'

export enum WorkflowEventType {
  WorkflowStarted = 'WORKFLOW_STARTED',
  StageStarted = 'STAGE_STARTED',
  StageCompleted = 'STAGE_COMPLETED',
  StageFailed = 'STAGE_FAILED',
  RetryStarted = 'RETRY_STARTED',
  RetryFinished = 'RETRY_FINISHED',
  CreditsReserved = 'CREDITS_RESERVED',
  CreditsConsumed = 'CREDITS_CONSUMED',
  CreditsRefunded = 'CREDITS_REFUNDED',
  /** Fires exactly once per workflow, on the matching terminal outcome. */
  Completed = 'COMPLETED',
  Cancelled = 'CANCELLED',
  Failed = 'FAILED',
}

export interface WorkflowEvent {
  type: WorkflowEventType
  workflowId: string
  stage?: WorkflowStage
  message: string
  /** The full context as it stood when this event fired — the source of truth for any listener tracking live progress. */
  context: WorkflowContext
  data?: Record<string, unknown>
  occurredAt: string
}

export type NewWorkflowEvent = Omit<WorkflowEvent, 'occurredAt'>
export type WorkflowEventListener = (event: WorkflowEvent) => void

/** In-memory pub/sub. Listener errors are caught and swallowed so one bad subscriber can't break the workflow run. */
export class WorkflowEventBus {
  private readonly listenersByType = new Map<WorkflowEventType, Set<WorkflowEventListener>>()
  private readonly listenersForAll = new Set<WorkflowEventListener>()

  on(type: WorkflowEventType, listener: WorkflowEventListener): () => void {
    const set = this.listenersByType.get(type) ?? new Set()
    set.add(listener)
    this.listenersByType.set(type, set)
    return () => set.delete(listener)
  }

  onAny(listener: WorkflowEventListener): () => void {
    this.listenersForAll.add(listener)
    return () => this.listenersForAll.delete(listener)
  }

  emit(event: NewWorkflowEvent): WorkflowEvent {
    const full: WorkflowEvent = { ...event, occurredAt: new Date().toISOString() }

    for (const listener of this.listenersByType.get(full.type) ?? []) {
      this.safeNotify(listener, full)
    }
    for (const listener of this.listenersForAll) {
      this.safeNotify(listener, full)
    }

    return full
  }

  private safeNotify(listener: WorkflowEventListener, event: WorkflowEvent): void {
    try {
      listener(event)
    } catch {
      // A subscriber threw — that's the subscriber's bug, not the workflow's; ignored so the run continues.
    }
  }
}
