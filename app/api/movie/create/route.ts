import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createMovieWorkflowEngine,
  getSharedProductionContextRepository,
  __debugRepositoryState,
} from '@/services/infrastructure/MovieProductionFactory'

const MIN_IDEA_LENGTH = 10
const MAX_IDEA_LENGTH = 5000

/**
 * Movie Studio's entry point into the full pipeline: Workflow Engine now
 * owns this request end to end (validate -> reserve credits -> queue ->
 * AI Orchestrator -> MovieProductionService -> store assets -> release
 * credits), rather than this route calling MovieProductionService
 * directly. startWorkflowInBackground() returns the workflowId
 * immediately — a real generation can run for minutes, far longer than an
 * HTTP request should stay open, which is exactly why the Queue module
 * exists. It also returns `completion`, the same background run as a
 * promise, which is handed to Next.js's after() so the platform keeps it
 * running to completion instead of risking it being abandoned once this
 * handler's response is sent.
 *
 * `productionId` is returned alongside the new `workflowId` field purely
 * for backward compatibility with the existing GET
 * /api/movie/status/[productionId] polling in Movie Studio's page — the
 * two are the same id (WorkflowExecutor.runAiPipeline() reuses the
 * workflow's id as the MovieProductionService productionId), so that
 * route keeps working unchanged.
 */
export async function POST(req: Request) {
  console.log('[VERIFY] 1. POST /api/movie/create entered') // TEMPORARY — remove after verification
  // TEMPORARY DIAGNOSTIC — trace only, fired unconditionally (even on auth
  // failure) so the module/repository identity is observable regardless of
  // whether the rest of the request succeeds.
  const traceOnEntry = __debugRepositoryState('POST /api/movie/create:entry')

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user) {
    // authError was previously discarded, leaving every rejection
    // indistinguishable ("no cookie sent" vs "expired session" vs "invalid
    // token" all just said "Unauthorized"). Surfacing Supabase's own reason
    // doesn't weaken the check itself — getUser() still must return a real
    // user for the request to proceed — it just makes a genuine rejection
    // diagnosable instead of opaque.
    return NextResponse.json(
      { error: 'Unauthorized', reason: authError?.message ?? 'No user for current session.', _trace: traceOnEntry },
      { status: 401 }
    )
  }

  // 1. Parse request.
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // 2. Validate: idea required, trimmed, length between 10 and 5000.
  const rawIdea = (body as { idea?: unknown } | null)?.idea
  if (typeof rawIdea !== 'string') {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const idea = rawIdea.trim()
  if (idea.length < MIN_IDEA_LENGTH || idea.length > MAX_IDEA_LENGTH) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // 3. const engine = createMovieWorkflowEngine();
  let engine: ReturnType<typeof createMovieWorkflowEngine>
  try {
    engine = createMovieWorkflowEngine()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Factory failure.'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // 4. Start the workflow in the background; return its id immediately.
  try {
    const { workflowId, completion } = engine.startWorkflowInBackground({ userId: user.id, userIdea: idea })

    // Next.js does not guarantee that an unawaited promise keeps running
    // once this handler's response has been sent — after() is the
    // platform's explicit mechanism for "run this to completion after the
    // response, regardless of runtime/adapter." Without this, `completion`
    // (the real Story Planning -> ... -> Rendering pipeline) could be
    // abandoned the moment NextResponse.json() below returns, which is why
    // the workflow was never observed advancing past Story Analysis.
    after(completion)

    // Create the initial ProductionContext synchronously, right here, in
    // the same request that generated productionId — not inside the async
    // pipeline (runStoryPlanningStage(), which only runs once the Queue
    // ticks the job in the background). This is what lets an immediate
    // GET /api/movie/status/[workflowId] find a context instead of 404ing.
    // getOrCreate() is idempotent on the same shared repository
    // runStoryPlanningStage() already uses, so when that stage later calls
    // getOrCreate(request.productionId) it retrieves this exact object
    // rather than creating a second one — no new repository, no duplicate
    // state, no Story Planning/Gemini work triggered here.
    getSharedProductionContextRepository().getOrCreate(workflowId)

    const context = engine.getWorkflow(workflowId)

    // TEMPORARY DIAGNOSTIC — trace only, from an earlier debugging pass.
    const traceOnCreate = __debugRepositoryState('POST /api/movie/create:after-startWorkflowInBackground')

    return NextResponse.json({
      success: true,
      productionId: workflowId,
      workflowId,
      status: context?.status ?? 'CREATED',
      currentStage: null,
      _trace: traceOnCreate,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start workflow.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
