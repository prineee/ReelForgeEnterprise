import { NextResponse } from 'next/server'
import {
  createMovieWorkflowEngine,
  MovieProductionFactoryError,
  __debugRepositoryState,
} from '@/services/infrastructure/MovieProductionFactory'

/**
 * The Workflow Engine's status route (Task 6 in the integration sprint):
 * unlike GET /api/movie/status/[productionId] (which only ever sees the
 * AI-pipeline's own ProductionProgress), this exposes the full
 * WorkflowContext + WorkflowMetricsSnapshot — status, current stage,
 * elapsed/ETA, retry count, scene progress, and credit reserve/consume/
 * refund totals — for the Production Dashboard to poll. Neither
 * WorkflowEngine nor MovieProductionService is modified to build this;
 * it only reads their existing public getWorkflow()/getMetrics() API.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId } = await params

  // TEMPORARY DIAGNOSTIC — trace only. Note this route's own "known ids"
  // (engine.getWorkflow's Map, WorkflowEngine's `workflows` field) are
  // separate in-memory state from ProductionContextRepository — this call
  // only reports the *repository*'s identity/contents for cross-comparison
  // against POST /api/movie/create and GET /api/movie/status.
  const traceOnEntry = __debugRepositoryState(`GET /api/workflow/status/${workflowId}:entry`)

  // 1. Validate workflowId.
  if (!workflowId || workflowId.trim().length === 0) {
    return NextResponse.json({ error: 'Invalid workflowId.' }, { status: 400 })
  }

  // 2. const engine = createMovieWorkflowEngine();
  let engine: ReturnType<typeof createMovieWorkflowEngine>
  try {
    engine = createMovieWorkflowEngine()
  } catch (error) {
    const message =
      error instanceof MovieProductionFactoryError
        ? error.message
        : error instanceof Error
        ? error.message
        : 'Factory failure.'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // 3. Look up the workflow.
  const context = engine.getWorkflow(workflowId)
  if (!context) {
    return NextResponse.json({ error: 'Unknown workflow.', _trace: traceOnEntry }, { status: 404 })
  }

  // 4. Return HTTP 200 with the full live status.
  try {
    const metrics = engine.getMetrics(workflowId)

    return NextResponse.json({
      success: true,
      workflowId,
      status: context.status,
      currentStage: metrics.currentStage,
      elapsedSeconds: metrics.elapsedSeconds,
      estimatedTimeRemainingSeconds: metrics.estimatedTimeRemainingSeconds,
      retryCount: metrics.retryCount,
      sceneProgress: metrics.sceneProgress,
      creditsReserved: context.creditsReserved,
      creditsConsumed: context.creditsConsumed,
      creditsRefunded: context.creditsRefunded,
      resumable: context.resumable,
      stages: context.stages.map((s) => ({ stage: s.stage, status: s.status, retryCount: s.retryCount, error: s.error })),
      artifactCount: context.artifacts.length,
      errors: context.errors,
      _trace: traceOnEntry,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Status retrieval failure.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
