import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createMovieWorkflowEngine,
  MovieProductionFactoryError,
} from '@/services/infrastructure/MovieProductionFactory'

/**
 * Lists every workflow WorkflowEngine currently knows about, scoped to
 * the authenticated user (Tasks 7 & 8 in the integration sprint): Movie
 * Library and Asset Manager poll this to merge real, in-flight/completed
 * productions into their existing placeholder catalogs — "workflow
 * completion automatically creates a Movie entry" and "automatically
 * publishes generated assets" both mean reading WorkflowEngine's live
 * registry here, not a new store. No database — WorkflowEngine's registry
 * is in-memory and resets on server restart, same as every other module
 * built this sprint sequence.
 */
export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  const workflows = engine
    .listWorkflows()
    .filter((context) => context.request.userId === user.id)
    .map((context) => ({
      workflowId: context.id,
      userIdea: context.request.userIdea,
      status: context.status,
      creditsReserved: context.creditsReserved,
      creditsConsumed: context.creditsConsumed,
      artifacts: context.artifacts,
      errors: context.errors,
      createdAt: context.createdAt,
      updatedAt: context.updatedAt,
      completedAt: context.completedAt,
    }))

  return NextResponse.json({ success: true, workflows })
}
