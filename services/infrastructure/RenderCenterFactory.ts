/**
 * RenderCenterFactory.ts
 *
 * Composition root for the Render Center, following the exact pattern
 * MovieWorkspaceFactory.ts / MovieProducerFactory.ts / CharacterStudioFactory.ts /
 * SceneStudioFactory.ts already establish: pure read-composition over
 * already-existing, already-public services. No new queue, no new
 * scheduler, no provider modifications — every job/provider fact comes
 * straight off RenderJobManager (the one real queue), and every
 * production fact comes off MovieProducer/ProductionPlanner/QualityAnalyzer
 * (Sprint 10), never recomputed.
 *
 * Unlike Character/Scene Studio, this file needs no "known movies" bridge
 * through CharacterLibrary/LocationLibrary — every RenderJob already
 * self-carries a real projectId (set at submit() time), so the set of
 * "movies with render activity" is derived directly from
 * RenderJobManager.list(), which is itself already global/unfiltered.
 *
 * No AI model calls, no rendering triggered by any function in this file
 * — mutations (cancel/retry) are intentionally NOT here; they live in
 * app/api/render-center/ routes that call RenderJobManager's own real
 * cancel()/submit() methods directly, never bypassing it.
 */

import { getSharedProductionContextRepository } from "./MovieProductionFactory";
import { getSharedRenderJobManager } from "./MovieWorkspaceFactory";
import { buildMovieProductionPlan } from "./MovieProducerFactory";
import { DIRECTOR_PROFILE_PRESETS } from "../ai/director-engine/AIDirectorEngine";
import { createDefaultProviderRegistry } from "../rendering/ProviderRegistry";
import { GPUManager } from "../rendering/gpu/GPUManager";
import type { RenderJob, RenderJobStatus } from "../rendering/types/RenderJob";
import type { RenderJobProgress } from "../rendering/types/RenderJobProgress";
import type { ProviderId } from "../rendering/interfaces/RenderProvider";
import type { ProviderStatistics } from "../rendering/types/ProviderStatistics";
import type { RenderLedgerEntry } from "../rendering/ledger/RenderLedger";
import type { GPUHealth, GPUMemoryUsage } from "../rendering/types/GPUStatus";
import type { QualityIssue } from "../ai/movie-producer/QualityAnalyzer";
import type { EntityId } from "../ai/director/OutputSchema";

const ACTIVE_STATUSES: readonly RenderJobStatus[] = ["QUEUED", "WAITING", "ASSIGNED", "RENDERING", "DOWNLOADING", "VERIFYING"];
const QUEUE_STATUSES: readonly RenderJobStatus[] = ["QUEUED", "WAITING"];

function jobManager() {
  return getSharedRenderJobManager();
}

function resolveMovieTitle(projectId: string | undefined): string | undefined {
  if (!projectId) return undefined;
  return getSharedProductionContextRepository().get(projectId)?.movieBlueprint?.movie.title;
}

/** Every distinct projectId that has ever submitted a render job — the only real, non-fabricated way to discover "known movies" for this feature (RenderJob.projectId is set at submit() time; there is no separate movie-enumeration service anywhere in this codebase). */
function knownProjectIds(jobs: readonly RenderJob[]): string[] {
  return Array.from(new Set(jobs.map((job) => job.projectId).filter((id): id is string => Boolean(id))));
}

// ── Module 1 — Render Dashboard ─────────────────────────────────────────

export interface RenderJobSummary {
  jobId: string;
  projectId?: string;
  movieTitle?: string;
  sceneId?: string;
  status: RenderJobStatus;
  providerId?: ProviderId;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  progress: RenderJobProgress;
}

export function listRenderJobSummaries(): RenderJobSummary[] {
  const manager = jobManager();
  return manager.list().map((job) => ({
    jobId: job.jobId,
    projectId: job.projectId,
    movieTitle: resolveMovieTitle(job.projectId),
    sceneId: job.sceneId,
    status: job.status,
    providerId: job.providerId,
    retryCount: job.retryCount,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    progress: manager.getProgress(job.jobId),
  }));
}

// ── Module 2 / 8 / 10 — Job Details, Failure Analysis, Navigation ──────

export interface JobDetail {
  job: RenderJob;
  movieTitle?: string;
  sceneTitle?: string;
  progress: RenderJobProgress;
  /** True when a later job's retriedFromJobId points back at this one — i.e. RenderJobManager's own retry policy already retried this failure automatically. Derived from real, observable job-chain data, never guessed. */
  wasAutoRetried: boolean;
  /** This job's own retriedFromJobId, when this job IS a retry attempt of an earlier one. */
  retryOfJobId?: string;
  characterLinks: { characterId: EntityId; name: string }[];
}

export function getJobDetail(jobId: string): JobDetail | undefined {
  const manager = jobManager();
  const job = manager.getJob(jobId);
  if (!job) return undefined;

  const allJobs = manager.list();
  const wasAutoRetried = allJobs.some((other) => other.retriedFromJobId === jobId);

  let sceneTitle: string | undefined;
  let characterLinks: { characterId: EntityId; name: string }[] = [];
  if (job.projectId && job.sceneId) {
    const movie = getSharedProductionContextRepository().get(job.projectId)?.movieBlueprint;
    const scene = movie?.scenes.find((s) => s.id === job.sceneId);
    sceneTitle = scene?.title;
    if (movie && scene) {
      characterLinks = scene.characterIds.map((id) => ({
        characterId: id,
        name: movie.characters.find((c) => c.id === id)?.name ?? id,
      }));
    }
  }

  return {
    job,
    movieTitle: resolveMovieTitle(job.projectId),
    sceneTitle,
    progress: manager.getProgress(jobId),
    wasAutoRetried,
    retryOfJobId: job.retriedFromJobId,
    characterLinks,
  };
}

// ── Module 4 — Provider Monitor ─────────────────────────────────────────

export interface ProviderMonitorEntry {
  providerId: ProviderId;
  isImplemented: boolean;
  activeJobCount: number;
  statistics?: ProviderStatistics;
  gpu?: { health: GPUHealth; memoryUsage: GPUMemoryUsage; queueDepth: number };
}

const IMPLEMENTED_PROVIDERS: ReadonlySet<ProviderId> = new Set(["LTX", "GOOGLE", "LOCAL_GPU"]);

/**
 * Reuses ProviderRegistry.list() for the real registered roster and
 * RenderJobManager.getHealthStatistics() (the read-only accessor added
 * this sprint) for real, observation-based success/failure/retry rate
 * and average render time — never a live probe of any provider. Local
 * GPU health additionally reuses GPUManager as-is; with no shared worker
 * wired to LocalGPUProvider's own internal one (a real, pre-existing gap
 * — see this class's own docstring), it honestly reports unavailable
 * rather than fabricating a status.
 */
export function getProviderMonitor(): ProviderMonitorEntry[] {
  const manager = jobManager();
  const registry = createDefaultProviderRegistry();
  const statsByProvider = new Map(manager.getHealthStatistics().map((stat) => [stat.provider, stat]));
  const activeJobs = manager.list().filter((job) => ACTIVE_STATUSES.includes(job.status));
  const gpuManager = new GPUManager();

  return registry.list().map((providerId): ProviderMonitorEntry => {
    const entry: ProviderMonitorEntry = {
      providerId,
      isImplemented: IMPLEMENTED_PROVIDERS.has(providerId),
      activeJobCount: activeJobs.filter((job) => job.providerId === providerId).length,
      statistics: statsByProvider.get(providerId),
    };
    if (providerId === "LOCAL_GPU") {
      entry.gpu = {
        health: gpuManager.getGPUHealth(),
        memoryUsage: gpuManager.getMemoryUsage(),
        queueDepth: gpuManager.getQueueDepth(),
      };
    }
    return entry;
  });
}

// ── Module 5 — Production Overview ──────────────────────────────────────

export interface MovieProgressEntry {
  movieId: string;
  movieTitle: string;
  totalScenes?: number;
  completedSceneJobs: number;
  activeSceneJobs: number;
}

export interface ProductionOverviewData {
  moviesInProgress: MovieProgressEntry[];
  queueLength: number;
  averageRenderDurationSeconds?: number;
}

/** "Movies in progress" / queue length come straight from RenderJobManager.list() — the one real queue. Per-movie scene totals reuse ProductionPlanner's already-computed ProductionSchedule (via MovieProducerFactory.buildMovieProductionPlan()), never recomputed. Average render duration reuses the real ledger's generationTimeMs. */
export function getProductionOverview(): ProductionOverviewData {
  const manager = jobManager();
  const jobs = manager.list();
  const projectIds = knownProjectIds(jobs);

  const moviesInProgress: MovieProgressEntry[] = projectIds
    .map((projectId): MovieProgressEntry | undefined => {
      const context = getSharedProductionContextRepository().get(projectId);
      const movie = context?.movieBlueprint;
      if (!context || !movie) return undefined;

      const projectJobs = jobs.filter((job) => job.projectId === projectId);
      const activeSceneJobs = projectJobs.filter((job) => ACTIVE_STATUSES.includes(job.status)).length;
      if (activeSceneJobs === 0) return undefined; // "in progress" means something is actually queued/rendering right now

      const productionPlan = buildMovieProductionPlan(context, DIRECTOR_PROFILE_PRESETS.CINEMATIC_DRAMA);

      return {
        movieId: projectId,
        movieTitle: movie.movie.title,
        totalScenes: productionPlan?.schedule.totalScenes,
        completedSceneJobs: projectJobs.filter((job) => job.status === "COMPLETED").length,
        activeSceneJobs,
      };
    })
    .filter((entry): entry is MovieProgressEntry => entry !== undefined);

  const ledger = manager.getLedger();
  const completedDurations = ledger.filter((entry) => entry.status === "COMPLETED" && entry.generationTimeMs !== undefined).map((entry) => entry.generationTimeMs!);
  const averageRenderDurationSeconds = completedDurations.length > 0 ? completedDurations.reduce((a, b) => a + b, 0) / completedDurations.length / 1000 : undefined;

  return {
    moviesInProgress,
    queueLength: jobs.filter((job) => QUEUE_STATUSES.includes(job.status)).length,
    averageRenderDurationSeconds,
  };
}

// ── Module 7 — Quality Panel ─────────────────────────────────────────────

export interface QualityPanelData {
  movieId: string;
  movieTitle: string;
  productionQualityScore: number;
  /** Derived: the same 100-minus-penalty model QualityAnalyzer applies to its full issue list, applied only to CONTINUITY-type issues — a real sub-score, not a separately-stored field (QualityReport has no native continuity score). */
  continuityScore: number;
  continuityIssueCount: number;
  estimatedMovieQuality: string;
}

const SCORE_PENALTY: Record<QualityIssue["severity"], number> = { ERROR: 15, WARNING: 5 };

export function listQualityPanels(): QualityPanelData[] {
  const jobs = jobManager().list();
  const projectIds = knownProjectIds(jobs);

  return projectIds
    .map((projectId): QualityPanelData | undefined => {
      const context = getSharedProductionContextRepository().get(projectId);
      const movie = context?.movieBlueprint;
      if (!context || !movie) return undefined;

      const productionPlan = buildMovieProductionPlan(context, DIRECTOR_PROFILE_PRESETS.CINEMATIC_DRAMA);
      if (!productionPlan) return undefined;

      const continuityIssues = productionPlan.quality.issues.filter((issue) => issue.type === "CONTINUITY");
      const continuityScore = Math.max(0, 100 - continuityIssues.reduce((total, issue) => total + SCORE_PENALTY[issue.severity], 0));

      return {
        movieId: projectId,
        movieTitle: movie.movie.title,
        productionQualityScore: productionPlan.quality.score,
        continuityScore,
        continuityIssueCount: continuityIssues.length,
        estimatedMovieQuality: productionPlan.review.verdict,
      };
    })
    .filter((entry): entry is QualityPanelData => entry !== undefined);
}

// ── Module 9 — Performance Analytics ────────────────────────────────────

export interface PerformanceAnalyticsData {
  hasEnoughHistory: boolean;
  totalRenders: number;
  jobsPerDay: { date: string; count: number }[];
  providerUsage: { providerId: ProviderId; count: number }[];
  averageRenderTimeMsByProvider: { providerId: ProviderId; averageMs: number }[];
  failureRate: number;
}

/** Every number here reads RenderJobManager.getLedger() (the read-only accessor added this sprint) — real recorded render attempts, never simulated. */
export function getPerformanceAnalytics(): PerformanceAnalyticsData {
  const ledger: readonly RenderLedgerEntry[] = jobManager().getLedger();

  if (ledger.length === 0) {
    return { hasEnoughHistory: false, totalRenders: 0, jobsPerDay: [], providerUsage: [], averageRenderTimeMsByProvider: [], failureRate: 0 };
  }

  const jobsPerDayMap = new Map<string, number>();
  const providerCountMap = new Map<ProviderId, number>();
  const providerTimeMap = new Map<ProviderId, number[]>();
  let failureCount = 0;

  for (const entry of ledger) {
    const date = entry.timestamp.slice(0, 10);
    jobsPerDayMap.set(date, (jobsPerDayMap.get(date) ?? 0) + 1);
    providerCountMap.set(entry.provider, (providerCountMap.get(entry.provider) ?? 0) + 1);
    if (entry.generationTimeMs !== undefined) {
      providerTimeMap.set(entry.provider, [...(providerTimeMap.get(entry.provider) ?? []), entry.generationTimeMs]);
    }
    if (entry.status === "FAILED") failureCount += 1;
  }

  return {
    hasEnoughHistory: true,
    totalRenders: ledger.length,
    jobsPerDay: Array.from(jobsPerDayMap, ([date, count]) => ({ date, count })).sort((a, b) => a.date.localeCompare(b.date)),
    providerUsage: Array.from(providerCountMap, ([providerId, count]) => ({ providerId, count })),
    averageRenderTimeMsByProvider: Array.from(providerTimeMap, ([providerId, times]) => ({
      providerId,
      averageMs: times.reduce((a, b) => a + b, 0) / times.length,
    })),
    failureRate: failureCount / ledger.length,
  };
}
