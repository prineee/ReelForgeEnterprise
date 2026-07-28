import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createMovieProductionService,
  getSharedProductionContextRepository,
  MovieProductionFactoryError,
} from '@/services/infrastructure/MovieProductionFactory'
import { ProductionStatus } from '@/services/ai/orchestration/MovieProductionContracts'
import type { ProductionProgress } from '@/services/ai/orchestration/MovieProductionContracts'

/**
 * ProductionProgress (MovieProductionContracts.ts) has no status/progress/
 * completedStages/remainingStages fields of its own — it has overallStatus,
 * overallPercentComplete, and a per-stage stages[] array. This route is
 * forbidden from modifying contracts or the service, so the requested
 * response shape is derived here rather than changed upstream.
 */
function toResponseBody(progress: ProductionProgress) {
  const completedStages = progress.stages
    .filter((stage) => stage.status === ProductionStatus.Completed)
    .map((stage) => stage.stage)
  const remainingStages = progress.stages
    .filter((stage) => stage.status !== ProductionStatus.Completed)
    .map((stage) => stage.stage)

  return {
    success: true,
    productionId: progress.productionId,
    status: progress.overallStatus,
    currentStage: progress.currentStage,
    progress: progress.overallPercentComplete,
    completedStages,
    remainingStages,
    error: progress.error,
  }
}

/**
 * getProgress() throws a single MovieProductionServiceError for both
 * "unknown production" (404) and any other retrieval failure (500) — it
 * carries no error code to distinguish them. MovieProductionService is
 * off-limits to modify here, so the two cases are told apart by matching
 * the specific message it uses for an unknown productionId.
 */
function isUnknownProductionError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('No production found for productionId')
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ productionId: string }> }
) {
  const { productionId } = await params

  // 1. Validate productionId.
  if (!productionId || productionId.trim().length === 0) {
    return NextResponse.json({ error: 'Invalid productionId.' }, { status: 400 })
  }

  // 1b. Auth + ownership — this production's ProductionContext.userId must
  // match the requesting user, the same field MovieCatalogService's
  // enumeration already scopes by (Sprint 16, Task 3), so a productionId
  // can't be used to poll another user's production status.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const context = getSharedProductionContextRepository().get(productionId)
  if (context && context.userId !== user.id) {
    return NextResponse.json({ error: 'Unknown production.' }, { status: 404 })
  }

  // 2. const service = createMovieProductionService();
  let service: ReturnType<typeof createMovieProductionService>
  try {
    service = createMovieProductionService()
  } catch (error) {
    const message =
      error instanceof MovieProductionFactoryError
        ? error.message
        : error instanceof Error
        ? error.message
        : 'Factory failure.'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // 3. const progress = await service.getProgress(productionId);
  try {
    const progress = await service.getProgress(productionId)

    // 4. Return HTTP 200.
    return NextResponse.json(toResponseBody(progress))
  } catch (error) {
    if (isUnknownProductionError(error)) {
      return NextResponse.json({ error: 'Unknown production.' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Progress retrieval failure.' }, { status: 500 })
  }
}
