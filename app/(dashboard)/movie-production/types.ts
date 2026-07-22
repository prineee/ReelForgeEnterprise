import type { ProductionStatus } from '@/services/ai/orchestration/MovieProductionContracts'

/**
 * One row in a production's stage timeline. `stage` is a plain string
 * rather than the strict ProductionStage enum because this timeline now
 * also renders Workflow Engine's own WorkflowStage values (see
 * adaptWorkflowStatusResponse in ./adapter.ts) — a different, business-level
 * stage set (services/workflow/WorkflowState.ts) that doesn't share string
 * values with ProductionStage. `status` stays ProductionStatus: both
 * adapters normalize into it so ProductionTimeline.tsx never needs to know
 * which source produced a given entry.
 */
export interface StageTimelineEntry {
  stage: string
  label: string
  status: ProductionStatus
}

export interface ActivityLogEntry {
  id: string
  time: string
  message: string
}

/**
 * The dashboard's display model for a single production. `productionId`,
 * `status`, `currentStage`, `progressPercent`, and `stages` are derivable
 * from either GET /api/movie/status/[productionId] (AI-pipeline-only
 * progress) or GET /api/workflow/status/[workflowId] (full workflow
 * progress, including retry count and credits — see adapter.ts). Everything
 * else (movie title, user, poster, scene counters, activity log) is not
 * exposed by any existing API yet, so it is placeholder/demo data until a
 * real source exists — see mockData.ts and the file header comment there.
 */
export interface DashboardProduction {
  productionId: string
  movieTitle: string
  userEmail: string
  status: string
  currentStage: string | null
  /** Human-readable label for currentStage. Falls back to STAGE_META's ProductionStage lookup when absent. */
  currentStageLabel?: string
  progressPercent: number
  stages: StageTimelineEntry[]
  startedAt: string
  updatedAt: string
  elapsedSeconds: number
  etaSeconds: number | null
  creditsUsed: number
  /** Set when this row came from a workflow-status poll — the number of stage retries the workflow has made so far. */
  retryCount?: number
  currentSceneNumber: number | null
  totalScenes: number | null
  posterUrl: string | null
  downloadUrl: string | null
  activity: ActivityLogEntry[]
  /** True when this row came from a real status poll rather than placeholder demo data. */
  isLive: boolean
}

export interface DashboardMetrics {
  totalProductions: number
  running: number
  completed: number
  failed: number
  averageRenderTimeSeconds: number
  creditsUsedToday: number
}
