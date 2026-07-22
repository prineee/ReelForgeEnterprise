/**
 * MovieProductionFactory.ts
 *
 * The composition root for MovieProductionService: constructs every real
 * provider client that is actually available in this project (Gemini,
 * Imagen, Veo — all via the already-installed @google/genai SDK; Cloudinary
 * via the already-installed cloudinary SDK), wraps each with its existing
 * provider service (GeminiService, ImagenService, VeoService,
 * CloudinaryService), wires the director layer and production layer, and
 * returns a fully constructed MovieProductionService.
 *
 * ElevenLabs has no SDK installed anywhere in this project. Rather than
 * leaving MovieProductionService unconstructable, ElevenLabsService is
 * wired with NotConfiguredAudioClient — a documented temporary no-op that
 * satisfies the AudioClient interface but throws a clear "provider not
 * configured" error if actually called. No currently-implemented
 * MovieProductionService stage calls elevenLabsService, so this is inert
 * until a future text-to-speech stage is built and a real ElevenLabs SDK
 * is added — at which point NotConfiguredAudioClient should be replaced
 * here, not worked around elsewhere.
 *
 * This file creates no API routes, and does not modify
 * MovieProductionService, any provider file, or any contract file — it
 * only imports and composes them.
 *
 * Developer Mode: when AI_MODE=development, ProviderFactory
 * (../ai/providers/ProviderFactory.ts) returns a mock GeminiService/
 * ImagenService/VeoService/ElevenLabsService (../ai/devmode/) instead of
 * the real one constructed below — no Gemini, Imagen, Veo, or ElevenLabs
 * API call happens. This only changes which concrete service instance
 * gets constructed here; every other line in this file (DI wiring,
 * director/production layer composition) is unchanged and mode-agnostic.
 */

// @ts-ignore - @google/genai ships a d.ts that TS module resolution flags as "not a module"
import { GoogleGenAI, GenerateVideosOperation } from "@google/genai";
import { v2 as cloudinary } from "cloudinary";

import { StoryAnalyzer } from "../ai/director/StoryAnalyzer";
import type { LanguageModelProvider } from "../ai/director/StoryAnalyzer";
import { CharacterDirector } from "../ai/director/CharacterDirector";
import { EnvironmentDirector } from "../ai/director/EnvironmentDirector";
import { CameraDirector } from "../ai/director/CameraDirector";
import { EmotionDirector } from "../ai/director/EmotionDirector";
import { ScenePlanner } from "../ai/director/ScenePlanner";
import { DirectorEngine } from "../ai/director/DirectorEngine";

import { PromptComposer } from "../ai/production/PromptComposer";
import { CharacterConsistencyEngine } from "../ai/production/CharacterConsistencyEngine";
import { ReferenceImageGenerator } from "../ai/production/ReferenceImageGenerator";
import { ScenePromptBuilder } from "../ai/production/ScenePromptBuilder";
import { VeoGenerator } from "../ai/production/VeoGenerator";
import { RenderQueue } from "../ai/production/RenderQueue";
import { MovieAssembler } from "../ai/production/MovieAssembler";
import { FinalMovieRenderer } from "../ai/production/FinalMovieRenderer";

import { GeminiService } from "../ai/providers/google/GeminiService";
import type { GeminiClient, GeminiRequest, GeminiResponse } from "../ai/providers/google/GeminiService";
import { ImagenService } from "../ai/providers/google/ImagenService";
import type {
  ImagenClient,
  ImagenRequest,
  ImagenResponse,
  GeneratedImage,
} from "../ai/providers/google/ImagenService";
import { VeoService } from "../ai/providers/google/VeoService";
import type {
  VeoClient,
  VeoRequest,
  VeoResponse,
  GeneratedVideo,
} from "../ai/providers/google/VeoService";
import { ElevenLabsService } from "../ai/providers/audio/ElevenLabsService";
import type {
  AudioClient,
  SpeechRequest,
  SpeechResult,
  VoiceProfile,
} from "../ai/providers/audio/ElevenLabsService";
import { CloudinaryService } from "../ai/providers/storage/CloudinaryService";
import type {
  StorageClient,
  UploadRequest,
  UploadResult,
  AssetMetadata,
} from "../ai/providers/storage/CloudinaryService";
import { VeoProvider } from "../ai/providers/video/VeoProvider";
import type {
  GoogleVideoClient,
  GoogleVideoGenerateRequest,
  GoogleVideoOperation,
  GoogleVideoDownloadResult,
} from "../ai/providers/video/VeoProvider";

import { ProviderFactory } from "../ai/providers/ProviderFactory";
import { isDeveloperMode } from "../ai/devmode/isDeveloperMode";

import { MovieProductionService } from "../ai/orchestration/MovieProductionService";
import { InMemoryProductionContextRepository } from "./ProductionContextRepository";
import type { ProductionContextRepository } from "./ProductionContextRepository";

import { createWorkflowEngine } from "../workflow/WorkflowEngine";
import type { WorkflowEngine } from "../workflow/WorkflowEngine";
import { QueueManager } from "../queue/QueueManager";
import { createDefaultBillingEngine } from "../billing/BillingEngine";
import type { BillingEngine } from "../billing/BillingEngine";
import { createDefaultAIOrchestrator } from "../orchestrator/AIOrchestrator";
import type { AIOrchestrator } from "../orchestrator/AIOrchestrator";

// "gemini-2.5-flash" still appears in ListModels for this API key (ListModels
// does not filter out models that have been sunset for new users), but
// generateContent for it 404s with "This model models/gemini-2.5-flash is no
// longer available to new users." "gemini-2.5-pro" and "gemini-2.0-flash" are
// both callable but this key/project has a free-tier quota of 0 for them
// (429 RESOURCE_EXHAUSTED on every call). "gemini-3.5-flash" is the model
// actually verified to succeed on this key and is used here instead.
const GEMINI_MODEL = "gemini-3.5-flash";
const IMAGEN_MODEL = "imagen-4.0-generate-001";

/**
 * Optional overrides for credentials that otherwise fall back to
 * process.env. Useful for tests or alternate deployments; every field is
 * optional and defaults to the corresponding environment variable.
 */
export interface MovieProductionFactoryConfig {
  geminiApiKey?: string;
  cloudinaryCloudName?: string;
  cloudinaryApiKey?: string;
  cloudinaryApiSecret?: string;
}

/**
 * Thrown when required credentials are missing and MovieProductionService
 * cannot be constructed.
 */
export class MovieProductionFactoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MovieProductionFactoryError";
  }
}

// ── Real Gemini/Imagen/Veo clients (backed by @google/genai) ──────────────

const GEMINI_TIMEOUT_MS = 30000;

/**
 * Real GeminiClient backed directly on @google/genai's non-streaming
 * models.generateContent() call (never generateContentStream() — no
 * streaming API is used anywhere in this class). Every call is raced
 * against a fixed timeout so a Gemini request that never resolves or
 * rejects on its own cannot hang the caller forever.
 */
class GoogleGenAIGeminiClient implements GeminiClient {
  constructor(private readonly ai: GoogleGenAI) {}

  async generate(request: GeminiRequest): Promise<GeminiResponse> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let response: any;
    try {
      response = await Promise.race([
        this.ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: request.prompt,
          config: {
            temperature: request.temperature,
            maxOutputTokens: request.maxOutputTokens,
            responseMimeType: request.responseFormat === "json" ? "application/json" : undefined,
          },
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Gemini timeout")), GEMINI_TIMEOUT_MS)
        ),
      ]);
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }

    const usageMetadata = response.usageMetadata;

    return {
      text: response.text ?? "",
      usage: {
        promptTokens: usageMetadata?.promptTokenCount ?? 0,
        completionTokens: usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: usageMetadata?.totalTokenCount ?? 0,
      },
      finishReason: response.candidates?.[0]?.finishReason ?? "UNKNOWN",
    };
  }

  async countTokens(text: string): Promise<number> {
    const result = await Promise.race([
      this.ai.models.countTokens({
        model: GEMINI_MODEL,
        contents: text,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Gemini timeout")), GEMINI_TIMEOUT_MS)
      ),
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (result as any).totalTokens ?? 0;
  }
}

/**
 * Real ImagenClient backed by @google/genai's models.generateImages(), the
 * same call already used in services/ai/gemini.ts. Imagen returns
 * base64-encoded image bytes rather than a hosted URL, so each image's
 * `url` is a data: URI — Cloudinary's upload API accepts data URIs
 * directly as an upload source, so this composes cleanly with
 * CloudinaryService without any intermediate file.
 */
class GoogleGenAIImagenClient implements ImagenClient {
  constructor(private readonly ai: GoogleGenAI) {}

  async generate(request: ImagenRequest): Promise<ImagenResponse> {
    const response = await this.ai.models.generateImages({
      model: IMAGEN_MODEL,
      prompt: request.prompt,
      config: {
        numberOfImages: request.numberOfImages ?? 1,
        aspectRatio: request.aspectRatio,
      },
    });

    const images: GeneratedImage[] = (response.generatedImages ?? []).map((generated) => {
      const imageBytes = generated.image?.imageBytes ?? "";
      const mimeType = generated.image?.mimeType ?? "image/png";
      return {
        url: `data:${mimeType};base64,${imageBytes}`,
        mimeType,
      };
    });

    return {
      images,
      usage: { imagesGenerated: images.length },
    };
  }
}

/**
 * Real VeoClient backed by @google/genai's models.generateVideos() and
 * operations.getVideosOperation() — the same operation-based flow already
 * used in services/ai/gemini.ts. Feeds VeoService directly (Stage 4 of
 * MovieProductionService).
 */
class GoogleGenAIVeoClient implements VeoClient {
  // getVideosOperation() calls operation._fromAPIResponse(...) internally on
  // whatever operation object is passed in, so it requires a real
  // GenerateVideosOperation instance, not a bare { name } object literal —
  // this caches the real instance generate() got back so checkStatus()/
  // download() can pass it back in, per the SDK's documented usage
  // (ai.operations.getVideosOperation({ operation: operation })).
  private readonly operations = new Map<string, GenerateVideosOperation>();

  constructor(private readonly ai: GoogleGenAI) {}

  async generate(request: VeoRequest): Promise<VeoResponse> {
    const operation = await this.ai.models.generateVideos({
      model: "veo-3.1-generate-preview",
      prompt: request.prompt,
      config: {
        aspectRatio: request.aspectRatio ?? "9:16",
        durationSeconds: request.durationSeconds ?? 8,
        resolution: "720p",
        numberOfVideos: 1,
      },
    });
    if (operation.name) this.operations.set(operation.name, operation);

    return {
      operationId: operation.name ?? "",
      status: operation.done ? "COMPLETED" : "PENDING",
    };
  }

  async checkStatus(operationId: string): Promise<VeoResponse> {
    const operation = await this.ai.operations.getVideosOperation({
      operation: this.requireOperation(operationId),
    });
    this.operations.set(operationId, operation);

    return {
      operationId,
      status: !operation.done ? "PROCESSING" : operation.error ? "FAILED" : "COMPLETED",
    };
  }

  async download(operationId: string): Promise<GeneratedVideo> {
    const operation = await this.ai.operations.getVideosOperation({
      operation: this.requireOperation(operationId),
    });
    this.operations.set(operationId, operation);

    // The SDK's operation.response shape for video generation isn't
    // strongly typed; same `as any` narrowing already used for this exact
    // call in services/ai/gemini.ts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = operation.response as any;
    const videoUri: string = response?.generatedVideos?.[0]?.video?.uri ?? "";

    return { url: videoUri };
  }

  /** Returns the cached operation for this id, or synthesizes a real GenerateVideosOperation if none was cached yet (e.g. a fresh process instance polling an id it didn't create). */
  private requireOperation(operationId: string): GenerateVideosOperation {
    return this.operations.get(operationId) ?? Object.assign(new GenerateVideosOperation(), { name: operationId });
  }
}

/**
 * Real GoogleVideoClient backed by the same @google/genai calls as
 * GoogleGenAIVeoClient, translated to VeoProvider's shape instead of
 * VeoService's. Feeds VeoProvider → VeoGenerator → RenderQueue (the
 * production layer's batch path, distinct from VeoService's direct path).
 */
class GoogleGenAIVideoClient implements GoogleVideoClient {
  // See GoogleGenAIVeoClient's identical cache above: getVideosOperation()
  // requires a real GenerateVideosOperation instance, not a bare { name }
  // object literal.
  private readonly operations = new Map<string, GenerateVideosOperation>();

  constructor(private readonly ai: GoogleGenAI) {}

  async generate(request: GoogleVideoGenerateRequest): Promise<GoogleVideoOperation> {
    const operation = await this.ai.models.generateVideos({
      model: request.model,
      prompt: request.prompt,
      config: {
        aspectRatio: request.aspectRatio,
        durationSeconds: request.durationSeconds,
        resolution: "720p",
        numberOfVideos: 1,
      },
    });
    if (operation.name) this.operations.set(operation.name, operation);

    return {
      name: operation.name ?? "",
      done: operation.done ?? false,
    };
  }

  async check(operationName: string): Promise<GoogleVideoOperation> {
    const operation = await this.ai.operations.getVideosOperation({
      operation: this.requireOperation(operationName),
    });
    this.operations.set(operationName, operation);

    return {
      name: operationName,
      done: operation.done ?? false,
      error: operation.error ? { message: String(operation.error.message ?? operation.error) } : undefined,
    };
  }

  async download(operationName: string): Promise<GoogleVideoDownloadResult> {
    const operation = await this.ai.operations.getVideosOperation({
      operation: this.requireOperation(operationName),
    });
    this.operations.set(operationName, operation);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = operation.response as any;
    const videoUri: string = response?.generatedVideos?.[0]?.video?.uri ?? "";

    return { videoUri };
  }

  /** Returns the cached operation for this id, or synthesizes a real GenerateVideosOperation if none was cached yet. */
  private requireOperation(operationName: string): GenerateVideosOperation {
    return this.operations.get(operationName) ?? Object.assign(new GenerateVideosOperation(), { name: operationName });
  }
}

// ── Real Cloudinary client ─────────────────────────────────────────────────

/**
 * Real StorageClient backed by the cloudinary SDK, using the same
 * cloudinary.config()/uploader.upload() pattern already used in
 * app/api/cinema/generate/route.ts.
 */
class CloudinaryStorageClient implements StorageClient {
  constructor(cloudName: string, apiKey: string, apiSecret: string) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
    });
  }

  async upload(request: UploadRequest): Promise<UploadResult> {
    const result = await cloudinary.uploader.upload(request.sourceUrl, {
      resource_type: request.resourceType ?? "auto",
      folder: request.folder,
      public_id: request.fileName,
      overwrite: request.overwrite,
    });

    return {
      assetId: result.public_id,
      url: result.url,
      secureUrl: result.secure_url,
    };
  }

  async delete(assetId: string): Promise<void> {
    await cloudinary.uploader.destroy(assetId);
  }

  async getMetadata(assetId: string): Promise<AssetMetadata> {
    const resource = await cloudinary.api.resource(assetId);

    return {
      assetId: resource.public_id,
      url: resource.secure_url ?? resource.url,
      format: resource.format,
      width: resource.width,
      height: resource.height,
      durationSeconds: resource.duration,
      bytes: resource.bytes,
      createdAt: resource.created_at,
    };
  }
}

// ── Temporary no-op ElevenLabs client ──────────────────────────────────────

/**
 * Temporary no-op AudioClient: no ElevenLabs SDK is installed in this
 * project. Satisfies the AudioClient interface so ElevenLabsService (and
 * therefore MovieProductionService) can be constructed, but throws a
 * clear, actionable "provider not configured" error if actually called.
 * Replace with a real client once an ElevenLabs SDK is added as a
 * dependency.
 */
class NotConfiguredAudioClient implements AudioClient {
  async generateSpeech(_request: SpeechRequest): Promise<SpeechResult> {
    throw new Error(
      "ElevenLabsService is not configured: no ElevenLabs SDK is installed in this project. " +
        "Add the SDK and replace NotConfiguredAudioClient in services/infrastructure/MovieProductionFactory.ts " +
        "with a real AudioClient before using text-to-speech."
    );
  }

  async listVoices(): Promise<VoiceProfile[]> {
    throw new Error(
      "ElevenLabsService is not configured: no ElevenLabs SDK is installed in this project. " +
        "Add the SDK and replace NotConfiguredAudioClient in services/infrastructure/MovieProductionFactory.ts " +
        "with a real AudioClient before listing voices."
    );
  }
}

// ── LanguageModelProvider adapter for the director layer ──────────────────

/**
 * Adapts the already-constructed GeminiService into the director layer's
 * LanguageModelProvider shape, so StoryAnalyzer/CharacterDirector/
 * EnvironmentDirector/CameraDirector/EmotionDirector/ScenePlanner all share
 * one Gemini-backed provider instance without any of them knowing Gemini
 * exists.
 */
class GeminiLanguageModelProvider implements LanguageModelProvider {
  constructor(private readonly geminiService: GeminiService) {}

  async generate(prompt: string): Promise<string> {
    const response = await this.geminiService.generateText(prompt);
    return response.text;
  }
}

// ── Shared production context repository ──────────────────────────────────

/**
 * A single ProductionContextRepository instance, created once when this
 * module is first loaded and shared by every MovieProductionService this
 * factory constructs afterward. This is what lets a MovieProductionService
 * built for one request (e.g. POST /api/movie/create) and a different
 * MovieProductionService instance built for a later request (e.g. a future
 * GET /api/movie/status) see the same production state — createMovieProductionService()
 * is called fresh per request, but this repository is not.
 */
const sharedContextRepository: ProductionContextRepository = new InMemoryProductionContextRepository();

/**
 * Exposes the same sharedContextRepository singleton used by every
 * MovieProductionService this factory constructs, without constructing a
 * full service (which needs real Gemini/Cloudinary credentials and builds
 * the entire director/production dependency graph). This is what lets
 * POST /api/movie/create register a production's initial ProductionContext
 * immediately — before the async pipeline reaches Story Planning — while
 * still writing into the exact same repository instance
 * runStoryPlanningStage() later reads/writes via getOrCreate()'s existing
 * idempotent behavior (returns the existing context instead of creating a
 * second one). No new repository, no new storage mechanism — just a getter
 * for the one that already exists.
 */
export function getSharedProductionContextRepository(): ProductionContextRepository {
  return sharedContextRepository;
}

// ── TEMPORARY DIAGNOSTIC INSTRUMENTATION — trace only, not a fix ───────────
// Tags sharedContextRepository with a random id the instant this module is
// first evaluated, so every subsequent read of that id proves (or
// disproves) "this is the same module instance" across requests. If this
// module gets re-evaluated for any reason (hot reload invalidation, a
// second module graph, a separate process), REPO_TRACE_ID changes and the
// Map starts back at size 0 — that's the exact signal this investigation
// is looking for.
const REPO_TRACE_ID = `repo-${Math.random().toString(36).slice(2, 10)}-pid${process.pid}`;
console.log(`[TRACE] MovieProductionFactory module evaluated. REPO_TRACE_ID=${REPO_TRACE_ID}`);

export function __debugRepositoryState(label: string): { repoTraceId: string; pid: number; size: number; ids: string[] } {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contexts = (sharedContextRepository as any).contexts as Map<string, unknown>;
  const ids = Array.from(contexts.keys());
  const state = { repoTraceId: REPO_TRACE_ID, pid: process.pid, size: contexts.size, ids };
  console.log(`[TRACE][${label}]`, state);
  return state;
}
// ── END TEMPORARY DIAGNOSTIC INSTRUMENTATION ────────────────────────────────

// ── Factory ─────────────────────────────────────────────────────────────

/**
 * Constructs a fully wired MovieProductionService: real Gemini/Imagen/Veo
 * clients via @google/genai, a real Cloudinary client, a documented no-op
 * ElevenLabs client, and the complete director + production layer
 * dependency graph — or, when AI_MODE=development, mock services in place
 * of Gemini/Imagen/Veo/ElevenLabs (see ../ai/providers/ProviderFactory.ts
 * and ../ai/devmode/) so no paid AI API call happens.
 *
 * Throws MovieProductionFactoryError if required credentials are missing
 * from both `config` and process.env: GEMINI_API_KEY (skipped in Developer
 * Mode, since nothing calls the real Gemini API then) and
 * CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET (required in both modes —
 * Cloudinary storage is unaffected by AI_MODE).
 */
export function createMovieProductionService(config?: MovieProductionFactoryConfig): MovieProductionService {
  const devMode = isDeveloperMode();

  const geminiApiKey = config?.geminiApiKey ?? process.env.GEMINI_API_KEY;
  if (!devMode && !geminiApiKey) {
    throw new MovieProductionFactoryError(
      "GEMINI_API_KEY is not configured (checked config.geminiApiKey and process.env.GEMINI_API_KEY)."
    );
  }

  const cloudinaryCloudName = config?.cloudinaryCloudName ?? process.env.CLOUDINARY_CLOUD_NAME;
  const cloudinaryApiKey = config?.cloudinaryApiKey ?? process.env.CLOUDINARY_API_KEY;
  const cloudinaryApiSecret = config?.cloudinaryApiSecret ?? process.env.CLOUDINARY_API_SECRET;
  if (!cloudinaryCloudName || !cloudinaryApiKey || !cloudinaryApiSecret) {
    throw new MovieProductionFactoryError(
      "Cloudinary credentials are not fully configured (need cloudinaryCloudName/cloudinaryApiKey/cloudinaryApiSecret " +
        "via config or CLOUDINARY_CLOUD_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET via process.env)."
    );
  }

  // In Developer Mode, geminiApiKey may be unset — no real GoogleGenAI call
  // is ever made through it below (every real client construction below is
  // a lazy thunk that ProviderFactory only invokes outside Developer Mode),
  // so the placeholder key is never used.
  const ai = new GoogleGenAI({ apiKey: geminiApiKey ?? "" });

  // ── Provider services (ProviderFactory returns a mock in Developer Mode) ──
  const geminiService = ProviderFactory.createGemini(() => new GeminiService(new GoogleGenAIGeminiClient(ai)));
  const imagenService = ProviderFactory.createImagen(() => new ImagenService(new GoogleGenAIImagenClient(ai)));
  const veoService = ProviderFactory.createVeo(() => new VeoService(new GoogleGenAIVeoClient(ai)));
  const elevenLabsService = ProviderFactory.createElevenLabs(
    () => new ElevenLabsService(new NotConfiguredAudioClient())
  );
  const cloudinaryService = new CloudinaryService(
    new CloudinaryStorageClient(cloudinaryCloudName, cloudinaryApiKey, cloudinaryApiSecret)
  );

  // ── Director layer ──
  const languageModelProvider = new GeminiLanguageModelProvider(geminiService);
  const storyAnalyzer = new StoryAnalyzer(languageModelProvider);
  const characterDirector = new CharacterDirector(languageModelProvider);
  const environmentDirector = new EnvironmentDirector(languageModelProvider);
  const cameraDirector = new CameraDirector(languageModelProvider);
  const emotionDirector = new EmotionDirector(languageModelProvider);
  const scenePlanner = new ScenePlanner(languageModelProvider);
  const directorEngine = new DirectorEngine(
    storyAnalyzer,
    characterDirector,
    environmentDirector,
    cameraDirector,
    emotionDirector,
    scenePlanner
  );

  // ── Production layer ──
  const promptComposer = new PromptComposer();
  const characterConsistencyEngine = new CharacterConsistencyEngine();
  const referenceImageGenerator = new ReferenceImageGenerator();
  const scenePromptBuilder = new ScenePromptBuilder(promptComposer);

  const veoProvider = new VeoProvider(new GoogleGenAIVideoClient(ai));
  const veoGenerator = new VeoGenerator(veoProvider);
  const renderQueue = new RenderQueue(veoGenerator);

  const movieAssembler = new MovieAssembler();
  const finalMovieRenderer = new FinalMovieRenderer();

  const service = new MovieProductionService(
    directorEngine,
    promptComposer,
    characterConsistencyEngine,
    referenceImageGenerator,
    scenePromptBuilder,
    geminiService,
    imagenService,
    veoService,
    elevenLabsService,
    cloudinaryService,
    renderQueue,
    movieAssembler,
    finalMovieRenderer,
    sharedContextRepository
  );

  // TEMPORARY DIAGNOSTIC — trace only.
  __debugRepositoryState('createMovieProductionService:return');

  return service;
}

// ── Workflow Engine composition ─────────────────────────────────────────

/**
 * Shared singletons for the Workflow Engine, module-level like
 * sharedContextRepository above — one QueueManager/BillingEngine/
 * AIOrchestrator/WorkflowEngine for the life of this module, so a
 * workflow started by one request (POST /api/movie/create) is still
 * there for a later request (GET /api/workflow/status/[workflowId]) to
 * find. createMovieWorkflowEngine() builds the shared WorkflowEngine
 * lazily, the first time it's called, wrapping a real
 * createMovieProductionService() instance — it does not create a second
 * production pipeline or duplicate anything MovieProductionService
 * already does.
 */
const sharedQueueManager = new QueueManager();
const sharedBillingEngine: BillingEngine = createDefaultBillingEngine();
const sharedAIOrchestrator: AIOrchestrator = createDefaultAIOrchestrator();
let sharedWorkflowEngine: WorkflowEngine | undefined;

/**
 * Returns the shared WorkflowEngine, constructing it on first call around
 * a real MovieProductionService (see createMovieProductionService() above
 * for its credential requirements — the same MovieProductionFactoryError
 * applies here). Every subsequent call returns the same instance, so
 * in-flight workflows stay visible across requests.
 */
export function createMovieWorkflowEngine(config?: MovieProductionFactoryConfig): WorkflowEngine {
  // TEMPORARY DIAGNOSTIC — trace only.
  console.log(`[TRACE] createMovieWorkflowEngine() called. sharedWorkflowEngine already exists: ${!!sharedWorkflowEngine} REPO_TRACE_ID=${REPO_TRACE_ID}`);

  if (!sharedWorkflowEngine) {
    console.log('[TRACE] createMovieWorkflowEngine() constructing a NEW WorkflowEngine (cache was empty).');
    const movieProductionService = createMovieProductionService(config);
    sharedWorkflowEngine = createWorkflowEngine(movieProductionService, {
      queueManager: sharedQueueManager,
      billingEngine: sharedBillingEngine,
      aiOrchestrator: sharedAIOrchestrator,
    });
  }
  return sharedWorkflowEngine;
}