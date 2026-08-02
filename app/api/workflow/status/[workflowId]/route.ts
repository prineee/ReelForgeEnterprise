import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createMovieWorkflowEngine,
  MovieProductionFactoryError,
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

  // 1. Validate workflowId.
  if (!workflowId || workflowId.trim().length === 0) {
    return NextResponse.json({ error: 'Invalid workflowId.' }, { status: 400 })
  }

  // 1b. Auth — mirrors GET /api/workflow/list's ownership pattern
  // (context.request.userId === user.id) rather than exposing any
  // workflow's full status/credit ledger to any authenticated user.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  if (!context || context.request.userId !== user.id) {
    return NextResponse.json({ error: 'Unknown workflow.' }, { status: 404 })
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
    })
  } catch {
    return NextResponse.json({ error: 'Status retrieval failure.' }, { status: 500 })
  }
}
