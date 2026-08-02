/**
 * adapter.ts
 *
 * The dashboard's real, live integration points. Two of them:
 *
 * 1. fetchProductionStatus/adaptStatusResponse — GET
 *    /api/movie/status/[productionId], built directly on
 *    MovieProductionService.getProgress(). AI-pipeline stages only; no
 *    retry count, no credits, no workflow-level status (PAUSED, etc).
 * 2. fetchWorkflowStatus/adaptWorkflowStatusResponse — GET
 *    /api/workflow/status/[workflowId], built on WorkflowEngine's
 *    getWorkflow()/getMetrics(). The full picture: Task 6's Live progress,
 *    Current Stage, Elapsed, ETA, Retry Count, and Status, plus reserved/
 *    consumed/refunded credits. This is the one the Production Dashboard
 *    page actually polls today — see page.tsx.
 *
 * No new backend endpoint was invented to make either of these work; both
 * routes already exist (services/infrastructure/MovieProductionFactory.ts
 * + services/workflow/WorkflowEngine.ts). Everything neither API exposes
 * yet (movie title, user, poster, scene counters, activity log) is filled
 * from caller-supplied placeholder metadata rather than fabricated, so
 * swapping in a real source later is a matter of replacing that metadata
 * argument.
 */

import { ProductionStatus } from '@/services/ai/orchestration/MovieProductionContracts'
import { STAGE_ORDER, STAGE_META } from './stageMeta'
import type { DashboardProduction, StageTimelineEntry } from './types'

/** Matches the JSON body returned by GET /api/movie/status/[productionId]. */
export interface ProductionStatusApiResponse {
  success: boolean
  productionId: string
  status: string
  currentStage: string | null
  progress: number
  completedStages: string[]
  remainingStages: string[]
}

/** Matches the JSON body returned by GET /api/workflow/status/[workflowId]. */
export interface WorkflowStatusApiResponse {
  success: boolean
  workflowId: string
  status: string
  currentStage: string | null
  elapsedSeconds: number
  estimatedTimeRemainingSeconds: number | null
  retryCount: number
  sceneProgress: { completed: number; total: number } | null
  creditsReserved: number
  creditsConsumed: number
  creditsRefunded: number
  resumable: boolean
  stages: { stage: string; status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'; retryCount: number; error?: string }[]
  artifactCount: number
  errors: string[]
}

export interface DashboardProductionPlaceholderMeta {
  movieTitle: string
  userEmail: string
  startedAt: string
  creditsUsed?: number
}

/** Human-readable labels for WorkflowStage values — see services/workflow/WorkflowState.ts. */
const WORKFLOW_STAGE_LABELS: Record<string, string> = {
  VALIDATE_REQUEST: 'Validating Request',
  RESERVE_CREDITS: 'Reserving Credits',
  CREATE_WORKFLOW: 'Creating Workflow',
  CREATE_QUEUE_JOB: 'Queuing Production',
  STORY_PLANNING: 'Story Planning',
  CHARACTER_PLANNING: 'Character Planning',
  ENVIRONMENT_PLANNING: 'Environment Planning',
  CAMERA_PLANNING: 'Camera Planning',
  SCENE_PLANNING: 'Scene Planning',
  REFERENCE_IMAGES: 'Reference Images',
  VIDEO_GENERATION: 'Video Generation',
  RENDERING: 'Rendering',
  STORE_ASSETS: 'Storing Assets',
  COMPLETE: 'Finalizing',
  RELEASE_CREDITS: 'Releasing Credits',
}

/** Maps a WorkflowStageRecord's status to the ProductionStatus values ProductionTimeline.tsx already knows how to render. */
function toStageStatus(status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'): ProductionStatus {
  switch (status) {
    case 'RUNNING':
      return ProductionStatus.InProgress
    case 'COMPLETED':
      return ProductionStatus.Completed
    case 'FAILED':
      return ProductionStatus.Failed
    default:
      return ProductionStatus.Queued
  }
}

/** Calls the AI-pipeline-only status route. Throws on a non-2xx response. */
export async function fetchProductionStatus(productionId: string): Promise<ProductionStatusApiResponse> {
  const res = await fetch(`/api/movie/status/${productionId}`)
  const json = await res.json()

  if (!res.ok) {
    throw new Error(json.error ?? 'Failed to fetch production status.')
  }

  return json as ProductionStatusApiResponse
}

/** Calls the full workflow-status route. Throws on a non-2xx response. */
export async function fetchWorkflowStatus(workflowId: string): Promise<WorkflowStatusApiResponse> {
  const res = await fetch(`/api/workflow/status/${workflowId}`)
  const json = await res.json()

  if (!res.ok) {
    throw new Error(json.error ?? 'Failed to fetch workflow status.')
  }

  return json as WorkflowStatusApiResponse
}

/**
 * Maps a real status-route response onto DashboardProduction. Stage
 * statuses are derived from completedStages/remainingStages/currentStage —
 * the same fields MovieStudio's page already renders.
 */
export function adaptStatusResponse(
  response: ProductionStatusApiResponse,
  meta: DashboardProductionPlaceholderMeta
): DashboardProduction {
  const stages: StageTimelineEntry[] = STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_META[stage].label,
    status: response.completedStages.includes(stage)
      ? ProductionStatus.Completed
      : stage === response.currentStage
      ? ProductionStatus.InProgress
      : ProductionStatus.Queued,
  }))

  const updatedAt = new Date().toISOString()
  const startedAtMs = new Date(meta.startedAt).getTime()
  const elapsedSeconds = Number.isNaN(startedAtMs)
    ? 0
    : Math.max(0, Math.round((Date.now() - startedAtMs) / 1000))

  return {
    productionId: response.productionId,
    movieTitle: meta.movieTitle,
    userEmail: meta.userEmail,
    status: response.status,
    currentStage: response.currentStage,
    progressPercent: response.progress,
    stages,
    startedAt: meta.startedAt,
    updatedAt,
    elapsedSeconds,
    // Not exposed by this route — left null rather than fabricated.
    etaSeconds: null,
    creditsUsed: meta.creditsUsed ?? 0,
    currentSceneNumber: null,
    totalScenes: null,
    posterUrl: null,
    downloadUrl: null,
    activity: [],
    isLive: true,
  }
}

/**
 * Maps a real GET /api/workflow/status/[workflowId] response onto
 * DashboardProduction — Task 6's live progress/current stage/elapsed/ETA/
 * retry count/status, all sourced from WorkflowEngine rather than
 * placeholder metadata.
 */
export function adaptWorkflowStatusResponse(
  response: WorkflowStatusApiResponse,
  meta: DashboardProductionPlaceholderMeta
): DashboardProduction {
  const stages: StageTimelineEntry[] = response.stages.map((entry) => ({
    stage: entry.stage,
    label: WORKFLOW_STAGE_LABELS[entry.stage] ?? entry.stage,
    status: toStageStatus(entry.status),
  }))

  const totalStages = stages.length || 1
  const completedStages = stages.filter((s) => s.status === ProductionStatus.Completed).length
  const progressPercent = Math.round((completedStages / totalStages) * 100)

  return {
    productionId: response.workflowId,
    movieTitle: meta.movieTitle,
    userEmail: meta.userEmail,
    status: response.status,
    currentStage: response.currentStage,
    currentStageLabel: response.currentStage ? WORKFLOW_STAGE_LABELS[response.currentStage] ?? response.currentStage : undefined,
    progressPercent,
    stages,
    startedAt: meta.startedAt,
    updatedAt: new Date().toISOString(),
    elapsedSeconds: response.elapsedSeconds,
    etaSeconds: response.estimatedTimeRemainingSeconds,
    creditsUsed: response.creditsConsumed || response.creditsReserved,
    retryCount: response.retryCount,
    currentSceneNumber: response.sceneProgress?.completed ?? null,
    totalScenes: response.sceneProgress?.total ?? null,
    posterUrl: null,
    downloadUrl: null,
    activity: [],
    isLive: true,
  }
}
