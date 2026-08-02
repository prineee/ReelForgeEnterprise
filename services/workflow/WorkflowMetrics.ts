/**
 * WorkflowMetrics.ts
 *
 * Derives a point-in-time metrics view from a WorkflowContext: current
 * stage, elapsed time, estimated time remaining, credits used, retry
 * count, and scene progress. Pure read — nothing here mutates a context.
 */

import type { WorkflowContext } from './WorkflowContext'
import { WorkflowStage } from './WorkflowState'

export interface SceneProgress {
  completed: number
  total: number
}

export interface WorkflowMetricsSnapshot {
  workflowId: string
  currentStage: WorkflowStage | null
  elapsedSeconds: number
  estimatedTimeRemainingSeconds: number | null
  creditsUsed: number
  retryCount: number
  /** Coarse — MovieProductionService doesn't expose per-scene progress today; see file header note in WorkflowExecutor.ts. */
  sceneProgress: SceneProgress | null
}

export class WorkflowMetrics {
  snapshot(context: WorkflowContext, now: Date = new Date()): WorkflowMetricsSnapshot {
    const runningRecord = context.stages.find((s) => s.status === 'RUNNING')
    const nextPendingRecord = context.stages.find((s) => s.status === 'PENDING')
    const currentStage = runningRecord?.stage ?? nextPendingRecord?.stage ?? null

    const elapsedSeconds = context.startedAt
      ? Math.max(0, Math.round((now.getTime() - new Date(context.startedAt).getTime()) / 1000))
      : 0

    const estimatedTimeRemainingSeconds =
      context.estimatedRuntimeSeconds !== null ? Math.max(0, context.estimatedRuntimeSeconds - elapsedSeconds) : null

    const retryCount = context.stages.reduce((sum, s) => sum + s.retryCount, 0)

    const sceneProgress = this.deriveSceneProgress(context)

    return {
      workflowId: context.id,
      currentStage,
      elapsedSeconds,
      estimatedTimeRemainingSeconds,
      creditsUsed: context.creditsConsumed,
      retryCount,
      sceneProgress,
    }
  }

  /**
   * MovieProductionService's public API (startProduction/getProgress)
   * reports per-STAGE completion, not per-scene — there's no real "6 of 12
   * scenes rendered" signal to read today. This reports 0 before the Video
   * Generation stage starts, the full estimated count once it's marked
   * COMPLETED, and null while it's in flight (honestly unknown, not a
   * fabricated partial count).
   */
  private deriveSceneProgress(context: WorkflowContext): SceneProgress | null {
    const total = context.request.estimatedSceneCount
    if (total === undefined) return null

    const videoStage = context.stages.find((s) => s.stage === WorkflowStage.VideoGeneration)
    if (!videoStage || videoStage.status === 'PENDING') {
      return { completed: 0, total }
    }
    if (videoStage.status === 'COMPLETED') {
      return { completed: total, total }
    }
    return null
  }
}
