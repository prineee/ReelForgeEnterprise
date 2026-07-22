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
 * InMemoryProductionContextRepository is an initial, in-memory-only
 * implementation. It does not persist across process restarts and does
 * not share state across multiple server processes/serverless instances —
 * a real (e.g. database-backed) implementation of ProductionContextRepository
 * can replace it later without changing MovieProductionService, since it
 * only depends on the interface.
 */

import type { ProductionId, ProductionStage } from "../ai/orchestration/MovieProductionContracts";
import type { MovieBlueprint } from "../ai/director/DirectorEngine";
import type { SceneGenerationRequest } from "../ai/production/ScenePromptBuilder";
import type { GeneratedVideo } from "../ai/providers/google/VeoService";
import type { MovieAssemblyResult } from "../ai/production/MovieAssembler";

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
 * movieAssembly) and reads only the fields produced by earlier stages it
 * depends on. Only fields currently needed by an implemented stage exist
 * here — no speculative future fields.
 */
export interface ProductionContext {
  productionId: ProductionId;
  movieBlueprint?: MovieBlueprint;
  uploadedReferenceAssets?: UploadedReferenceAsset[];
  sceneGenerationRequests?: SceneGenerationRequest[];
  generatedVideos?: GeneratedVideo[];
  movieAssembly?: MovieAssemblyResult;
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
   * a new empty one if none exists yet.
   */
  getOrCreate(productionId: ProductionId): ProductionContext;

  /**
   * Returns the existing context for a productionId, or undefined if none
   * exists.
   */
  get(productionId: ProductionId): ProductionContext | undefined;

  /**
   * Persists a context. Callers pass the full context object (typically
   * one previously obtained from getOrCreate/get and then mutated) after
   * updating the field(s) they own.
   */
  save(context: ProductionContext): void;
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

  getOrCreate(productionId: ProductionId): ProductionContext {
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

  save(context: ProductionContext): void {
    this.contexts.set(context.productionId, context);
  }
}
