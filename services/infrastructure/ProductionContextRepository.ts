/**
 * ProductionContextRepository.ts
 *
 * Storage for per-production intermediate data (ProductionContext),
 * extracted out of MovieProductionService so it can be shared across
 * every MovieProductionService instance rather than living as private
 * state on one instance. This is what makes cross-request status lookups
 * possible: MovieProductionFactory holds one repository instance as a
 * module-level singleton and injects it into every MovieProductionService
 * it constructs, so a service built for one request can read state a
 * service built for an earlier request wrote — something two separate
 * instances holding their own private Maps could never do.
 *
 * That sharing only works within one Node process, though. On Vercel,
 * app/api/movie/create/route.ts and app/api/movie/status/[productionId]/
 * route.ts are separate serverless functions with independent process
 * memory, so a purely in-memory repository lets POST /api/movie/create
 * "succeed" while every GET /api/movie/status/[productionId] 404s with
 * "Unknown production." the moment it lands on a different instance than
 * the one that created it. SupabaseProductionContextRepository (below)
 * fixes that by durably persisting getOrCreate()/save() writes, while
 * keeping the exact same interface get()/list() already use elsewhere
 * (Character Studio, Scene Studio, Render Center, MovieCatalogService) —
 * those callers are unaffected and keep reading the in-process cache only,
 * same as before (see MovieCatalogService.ts's file header for why that
 * remaining limitation is intentionally out of scope here).
 *
 * getOrCreate()/save() are Promise-returning because a real persistence
 * write is inherently asynchronous; every existing caller of those two
 * methods (MovieProductionService's stage methods and POST /api/movie/
 * create) already runs inside an async function, so this did not require
 * touching any unrelated caller. get()/list() stay synchronous, in-memory
 * only — every one of their existing callers depends on that. getPersisted()
 * is new: an async, database-backed read used only where a cross-instance
 * read is actually required (status polling), so a cold instance can find
 * a production a different instance created.
 *
 * InMemoryProductionContextRepository remains as the base, dependency-free
 * implementation (e.g. for tests) — it does not persist across process
 * restarts and does not share state across multiple server processes/
 * serverless instances.
 */

import { createAdminClient } from "@/lib/supabase/admin";
import type { ProductionId, ProductionStage } from "../ai/orchestration/MovieProductionContracts";
import type { MovieBlueprint } from "../ai/director/DirectorEngine";
import type { SceneGenerationRequest } from "../ai/production/ScenePromptBuilder";
import type { GeneratedVideo } from "../ai/providers/google/VeoService";
import type { MovieAssemblyResult } from "../ai/production/MovieAssembler";
import type { RenderPlan } from "../ai/production/FinalMovieRenderer";

/** Recorded when a stage throws, so getProgress() can report FAILED instead of leaving the dashboard stuck at QUEUED/0% forever. */
export interface ProductionFailure {
  stage: ProductionStage;
  message: string;
}

/**
 * A single character's reference image, generated via ImagenService and
 * uploaded via CloudinaryService. `prompt`/`provider`/`generationTimeMs`
 * are captured so downstream consumers (Asset Manager, Movie Library) can
 * show real generation details instead of guessing/defaulting them.
 */
export interface UploadedReferenceAsset {
  characterId: string;
  characterName: string;
  assetId: string;
  url: string;
  prompt: string;
  provider: string;
  generationTimeMs: number;
  width?: number;
  height?: number;
  mimeType?: string;
}

/**
 * All per-production intermediate data accumulated across stages, keyed by
 * productionId. Fields other than productionId are populated incrementally
 * — each stage owns and writes exactly one field (Stage 1 →
 * movieBlueprint, Stage 2 → uploadedReferenceAssets, Stage 3 →
 * sceneGenerationRequests, Stage 4 → generatedVideos, Stage 5 →
 * movieAssembly, Stage 6 → finalRenderPlan) and reads only the fields
 * produced by earlier stages it depends on. Only fields currently needed
 * by an implemented stage exist here — no speculative future fields.
 */
export interface ProductionContext {
  productionId: ProductionId;
  /** The user who started this production (ProductionRequest.userId, captured at creation time). Undefined only for contexts created before this field existed. The one ownership signal the Movie Catalog scopes enumeration by — see MovieCatalogService.ts. */
  userId?: string;
  movieBlueprint?: MovieBlueprint;
  uploadedReferenceAssets?: UploadedReferenceAsset[];
  sceneGenerationRequests?: SceneGenerationRequest[];
  generatedVideos?: GeneratedVideo[];
  movieAssembly?: MovieAssemblyResult;
  finalRenderPlan?: RenderPlan;
  /** Set when a stage throws — see ProductionFailure. Undefined means no failure has occurred. */
  failure?: ProductionFailure;
}

/**
 * Storage contract for ProductionContext. MovieProductionService depends
 * only on this interface, not on any particular storage implementation.
 */
export interface ProductionContextRepository {
  /**
   * Returns the existing context for a productionId, or creates and stores
   * a new empty one if none exists yet. Async so a database-backed
   * implementation can durably persist the new context before this
   * resolves — callers that need the id to be immediately visible to a
   * different process (e.g. POST /api/movie/create, before it hands
   * productionId back to the client) must await it.
   */
  getOrCreate(productionId: ProductionId): Promise<ProductionContext>;

  /**
   * Returns the existing context for a productionId from the in-process
   * cache only, or undefined if this process hasn't seen it. Stays
   * synchronous because every existing caller (Character Studio, Scene
   * Studio, Render Center, MovieCatalogService) depends on that — use
   * getPersisted() instead where a cross-instance read is required.
   */
  get(productionId: ProductionId): ProductionContext | undefined;

  /**
   * Persists a context. Callers pass the full context object (typically
   * one previously obtained from getOrCreate/get and then mutated) after
   * updating the field(s) they own. Async so a database-backed
   * implementation's write can be awaited before the caller proceeds
   * (e.g. before a stage moves on, or before a request handler responds).
   */
  save(context: ProductionContext): Promise<void>;

  /**
   * Every stored context — the canonical enumeration this repository was
   * previously missing (see file header). Consumed by MovieCatalogService,
   * not by individual features directly, so every feature enumerates
   * movies through one shared filter (ownership, presence of a
   * movieBlueprint) instead of each re-deriving its own notion of "which
   * movies exist." In-process cache only, same scope as get() — see
   * MovieCatalogService.ts's file header.
   */
  list(): ProductionContext[];

  /**
   * Returns the context for a productionId, falling back to durable
   * storage (if the implementation has any) when the in-process cache
   * doesn't have it — the read that makes cross-instance status polling
   * work. Implementations with no durable backing (e.g.
   * InMemoryProductionContextRepository) simply return the same result as
   * get(). A hit here also warms the in-process cache, so a subsequent
   * synchronous get() on the same (now-warm) instance succeeds too.
   */
  getPersisted(productionId: ProductionId): Promise<ProductionContext | undefined>;
}

declare global {
  // eslint-disable-next-line no-var
  var __productionContexts: Map<ProductionId, ProductionContext> | undefined;
}

/**
 * In-memory ProductionContextRepository. See file header for its scope and
 * limitations.
 */
export class InMemoryProductionContextRepository implements ProductionContextRepository {
  private readonly contexts: Map<ProductionId, ProductionContext>;

  constructor() {
    // Next.js dev mode (Fast Refresh/Turbopack) can re-evaluate this module
    // mid-session without the Node process restarting. A plain instance
    // field would silently reset to an empty Map when that happens,
    // turning a real, in-flight production into "Unknown production" the
    // moment the dev server recompiles anything unrelated. Anchoring the
    // Map on `globalThis` (same idiom used for e.g. a singleton Prisma
    // client in Next.js) means a later `new
    // InMemoryProductionContextRepository()` reconnects to the same
    // storage instead of starting empty. A genuine process restart still
    // clears it, same as before — this only protects against in-process
    // module reloads.
    if (!globalThis.__productionContexts) {
      globalThis.__productionContexts = new Map<ProductionId, ProductionContext>();
    }
    this.contexts = globalThis.__productionContexts;
  }

  async getOrCreate(productionId: ProductionId): Promise<ProductionContext> {
    let context = this.contexts.get(productionId);
    if (!context) {
      context = { productionId };
      this.contexts.set(productionId, context);
    }
    return context;
  }

  get(productionId: ProductionId): ProductionContext | undefined {
    return this.contexts.get(productionId);
  }

  async save(context: ProductionContext): Promise<void> {
    this.contexts.set(context.productionId, context);
  }

  list(): ProductionContext[] {
    return Array.from(this.contexts.values());
  }

  async getPersisted(productionId: ProductionId): Promise<ProductionContext | undefined> {
    return this.contexts.get(productionId);
  }
}

const PRODUCTION_CONTEXTS_TABLE = "movie_production_contexts";

declare global {
  // eslint-disable-next-line no-var
  var __productionContextsRemoteCache: Map<ProductionId, ProductionContext> | undefined;
}

/**
 * Database-backed ProductionContextRepository (Supabase, service-role
 * client — see lib/supabase/admin.ts). Fixes the cross-serverless-instance
 * "Unknown production." bug described in the file header: getOrCreate()
 * and save() durably upsert into the movie_production_contexts table
 * (supabase/migrations/20260809120000_movie_production_contexts.sql)
 * before resolving, and getPersisted() reads that table when a productionId
 * isn't in this instance's own in-process cache.
 *
 * get()/list() are intentionally unchanged from InMemoryProductionContextRepository
 * — still a synchronous, in-process-only Map — because every existing
 * caller of those two methods requires a synchronous return and only ever
 * reads productions this same instance already touched (see file header).
 * The Map is anchored on globalThis for the same reason
 * InMemoryProductionContextRepository's is: it survives Next.js dev-mode
 * module reloads without losing in-flight state, while still resetting on
 * a genuine process restart (the database is the actual source of truth
 * across restarts/instances, not this cache).
 */
export class SupabaseProductionContextRepository implements ProductionContextRepository {
  private readonly contexts: Map<ProductionId, ProductionContext>;

  constructor() {
    if (!globalThis.__productionContextsRemoteCache) {
      globalThis.__productionContextsRemoteCache = new Map<ProductionId, ProductionContext>();
    }
    this.contexts = globalThis.__productionContextsRemoteCache;
  }

  get(productionId: ProductionId): ProductionContext | undefined {
    return this.contexts.get(productionId);
  }

  list(): ProductionContext[] {
    return Array.from(this.contexts.values());
  }

  async getOrCreate(productionId: ProductionId): Promise<ProductionContext> {
    const existing = this.contexts.get(productionId);
    if (existing) return existing;

    const context: ProductionContext = { productionId };
    this.contexts.set(productionId, context);
    await this.persist(context);
    return context;
  }

  async save(context: ProductionContext): Promise<void> {
    this.contexts.set(context.productionId, context);
    await this.persist(context);
  }

  async getPersisted(productionId: ProductionId): Promise<ProductionContext | undefined> {
    const cached = this.contexts.get(productionId);
    if (cached) return cached;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = (await (createAdminClient() as any)
      .from(PRODUCTION_CONTEXTS_TABLE)
      .select("context")
      .eq("production_id", productionId)
      .maybeSingle()) as { data: { context: ProductionContext } | null; error: { message: string } | null };

    if (error || !data) return undefined;

    this.contexts.set(productionId, data.context);
    return data.context;
  }

  /**
   * Upserts the full context as-is into the `context` JSONB column —
   * postgrest-js serializes the plain object directly, no manual
   * JSON.stringify needed. Throws (rather than swallowing) on failure so a
   * durability problem surfaces as a clear error to the caller (e.g. POST
   * /api/movie/create returning 500) instead of silently reintroducing the
   * cross-instance "Unknown production." bug this class exists to fix.
   */
  private async persist(context: ProductionContext): Promise<void> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (createAdminClient() as any).from(PRODUCTION_CONTEXTS_TABLE).upsert({
      production_id: context.productionId,
      user_id: context.userId ?? null,
      context,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(
        `SupabaseProductionContextRepository: failed to persist production "${context.productionId}": ${error.message}`
      );
    }
  }
}