/**
 * WorkflowContext.ts
 *
 * The per-workflow record that flows through execution: the original
 * request, current status, per-stage progress, credit reservations,
 * collected assets, and errors. Plus a factory and a set of pure updater
 * functions (each returns a new context rather than mutating one) that
 * WorkflowCoordinator uses to advance it — the same immutable-update style
 * MovieProductionService.ts uses for its own ProductionContext.
 *
 * `artifacts` reuses ProductionArtifact from
 * services/ai/orchestration/MovieProductionContracts.ts (type-only import)
 * rather than inventing a parallel asset shape, since that's exactly what
 * MovieProductionService.startProduction() already returns.
 */

import { randomUUID } from 'crypto'
import type { ProductionArtifact } from '../ai/orchestration/MovieProductionContracts'
import type { JobPriorityLevel } from '../queue/QueueTypes'
import type { StageExecutionStatus } from './WorkflowState'
import { WORKFLOW_STAGE_ORDER, WorkflowStage, WorkflowStatus } from './WorkflowState'

export interface WorkflowRequest {
  userId: string
  userIdea: string
  priority?: JobPriorityLevel
  estimatedSceneCount?: number
  estimatedCharacterCount?: number
}

export interface WorkflowStageRecord {
  stage: WorkflowStage
  status: StageExecutionStatus
  startedAt?: string
  completedAt?: string
  error?: string
  retryCount: number
}

/** One credit hold taken out for this workflow — see WorkflowExecutor.reserveCredits() for why there can be several. */
export interface WorkflowReservation {
  label: string
  providerId: string
  reservationId: string
  amount: number
  settled: boolean
}

export interface WorkflowContext {
  id: string
  request: WorkflowRequest
  status: WorkflowStatus
  stages: WorkflowStageRecord[]
  productionId?: string
  queueJobId?: string
  reservations: WorkflowReservation[]
  creditsReserved: number
  creditsConsumed: number
  creditsRefunded: number
  estimatedRuntimeSeconds: number | null
  artifacts: ProductionArtifact[]
  errors: string[]
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  /** Set by WorkflowRecovery when a Rendering-stage failure leaves generated assets intact. */
  resumable: boolean
}

export function createWorkflowContext(request: WorkflowRequest): WorkflowContext {
  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    request,
    status: WorkflowStatus.Created,
    stages: WORKFLOW_STAGE_ORDER.map((stage) => ({ stage, status: 'PENDING' as StageExecutionStatus, retryCount: 0 })),
    reservations: [],
    creditsReserved: 0,
    creditsConsumed: 0,
    creditsRefunded: 0,
    estimatedRuntimeSeconds: null,
    artifacts: [],
    errors: [],
    createdAt: now,
    updatedAt: now,
    resumable: false,
  }
}

function touch(): string {
  return new Date().toISOString()
}

export function withStatus(context: WorkflowContext, status: WorkflowStatus): WorkflowContext {
  const now = touch()
  return {
    ...context,
    status,
    updatedAt: now,
    startedAt: context.startedAt ?? (status === WorkflowStatus.Running ? now : context.startedAt),
    completedAt:
      status === WorkflowStatus.Completed || status === WorkflowStatus.Failed || status === WorkflowStatus.Cancelled
        ? now
        : context.completedAt,
  }
}

export function withStageUpdate(context: WorkflowContext, stage: WorkflowStage, patch: Partial<WorkflowStageRecord>): WorkflowContext {
  return {
    ...context,
    stages: context.stages.map((record) => (record.stage === stage ? { ...record, ...patch } : record)),
    updatedAt: touch(),
  }
}

export function withProductionId(context: WorkflowContext, productionId: string): WorkflowContext {
  return { ...context, productionId, updatedAt: touch() }
}

export function withQueueJobId(context: WorkflowContext, queueJobId: string): WorkflowContext {
  return { ...context, queueJobId, updatedAt: touch() }
}

export function withReservation(context: WorkflowContext, reservation: WorkflowReservation): WorkflowContext {
  return {
    ...context,
    reservations: [...context.reservations, reservation],
    creditsReserved: context.creditsReserved + reservation.amount,
    updatedAt: touch(),
  }
}

export function withReservationSettled(
  context: WorkflowContext,
  reservationId: string,
  outcome: { consumed: number; released: number }
): WorkflowContext {
  return {
    ...context,
    reservations: context.reservations.map((r) => (r.reservationId === reservationId ? { ...r, settled: true } : r)),
    creditsConsumed: context.creditsConsumed + outcome.consumed,
    creditsRefunded: context.creditsRefunded + outcome.released,
    updatedAt: touch(),
  }
}

export function withArtifacts(context: WorkflowContext, artifacts: ProductionArtifact[]): WorkflowContext {
  return { ...context, artifacts: [...context.artifacts, ...artifacts], updatedAt: touch() }
}

export function withError(context: WorkflowContext, message: string): WorkflowContext {
  return { ...context, errors: [...context.errors, message], updatedAt: touch() }
}

export function withEstimatedRuntime(context: WorkflowContext, estimatedRuntimeSeconds: number | null): WorkflowContext {
  return { ...context, estimatedRuntimeSeconds, updatedAt: touch() }
}

export function withResumable(context: WorkflowContext, resumable: boolean): WorkflowContext {
  return { ...context, resumable, updatedAt: touch() }
}
