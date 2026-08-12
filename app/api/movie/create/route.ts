import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  createMovieWorkflowEngine,
  getSharedProductionContextRepository,
} from '@/services/infrastructure/MovieProductionFactory'

const MIN_IDEA_LENGTH = 10
const MAX_IDEA_LENGTH = 5000

// after(completion) below keeps this invocation alive to run the background
// pipeline to completion, but it is still bounded by this route's own
// maxDuration — Vercel's platform default (10-15s) is far shorter than a
// real Story Planning -> Rendering run (minutes), so without this the
// function was killed mid-pipeline before a failure could ever be recorded
// on the ProductionContext, leaving status polling stuck at QUEUED forever.
export const maxDuration = 300

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
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

    // Create the initial ProductionContext right here, in the same request
    // that generated productionId — not inside the async pipeline
    // (runStoryPlanningStage(), which only runs once the Queue ticks the
    // job in the background). Awaited so the durable row actually exists
    // (see SupabaseProductionContextRepository) before this response goes
    // out — GET /api/movie/status/[workflowId] can land on a different
    // serverless instance immediately after, so it must find this via a
    // real read, not a same-process cache that instance never populated.
    // getOrCreate() is idempotent on the same shared repository
    // runStoryPlanningStage() already uses, so when that stage later calls
    // getOrCreate(request.productionId) it retrieves this exact object
    // rather than creating a second one — no new repository, no duplicate
    // state, no Story Planning/Gemini work triggered here.
    await getSharedProductionContextRepository().getOrCreate(workflowId)

    const context = engine.getWorkflow(workflowId)

    return NextResponse.json({
      success: true,
      productionId: workflowId,
      workflowId,
      status: context?.status ?? 'CREATED',
      currentStage: null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start workflow.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
