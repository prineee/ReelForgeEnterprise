/**
 * mockData.ts
 *
 * Placeholder demo data for the Production Dashboard's "queue of every
 * production" view. No endpoint exists yet that lists every production —
 * MovieProductionService.getProgress() only looks up one productionId at a
 * time (see adapter.ts for that real integration) — so this file stands in
 * until a real list source exists. Every field mirrors DashboardProduction
 * exactly, so swapping this out for a real fetch later is a drop-in
 * replacement with no component changes required.
 */

import { ProductionStatus } from '@/services/ai/orchestration/MovieProductionContracts'
import { STAGE_ORDER, STAGE_META } from './stageMeta'
import type { ActivityLogEntry, DashboardMetrics, DashboardProduction, StageTimelineEntry } from './types'

function buildStages(completedCount: number, failedAtIndex?: number): StageTimelineEntry[] {
  return STAGE_ORDER.map((stage, index) => {
    let status: ProductionStatus
    if (failedAtIndex !== undefined && index === failedAtIndex) {
      status = ProductionStatus.Failed
    } else if (index < completedCount) {
      status = ProductionStatus.Completed
    } else if (index === completedCount && failedAtIndex === undefined) {
      status = ProductionStatus.InProgress
    } else {
      status = ProductionStatus.Queued
    }
    return { stage, label: STAGE_META[stage].label, status }
  })
}

function activity(entries: Array<[string, string]>): ActivityLogEntry[] {
  return entries.map(([time, message], i) => ({ id: `${time}-${i}`, time, message }))
}

const now = Date.now()
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString()

export const MOCK_PRODUCTIONS: DashboardProduction[] = [
  {
    productionId: 'a1b2c3d4-e5f6-4a1b-8c2d-000000000001',
    movieTitle: 'The Last Signal',
    userEmail: 'maria@studio.io',
    status: ProductionStatus.InProgress,
    currentStage: STAGE_ORDER[8],
    progressPercent: 73,
    stages: buildStages(8),
    startedAt: minutesAgo(14),
    updatedAt: minutesAgo(0),
    elapsedSeconds: 14 * 60,
    etaSeconds: 5 * 60,
    creditsUsed: 42,
    currentSceneNumber: 9,
    totalScenes: 12,
    posterUrl: null,
    downloadUrl: null,
    activity: activity([
      ['10:22', 'Story Planning Started'],
      ['10:22', 'Gemini Response Received'],
      ['10:23', 'Scene Planner Finished'],
      ['10:23', 'Generating Reference Images'],
      ['10:27', 'Reference Images Uploaded'],
      ['10:29', 'Composing Scene Prompts'],
      ['10:31', 'Video Generation Started'],
      ['10:34', 'Scene 6 of 12 Rendered'],
    ]),
    isLive: false,
  },
  {
    productionId: 'a1b2c3d4-e5f6-4a1b-8c2d-000000000002',
    movieTitle: 'Neon Requiem',
    userEmail: 'devon@fabrica.pro',
    status: ProductionStatus.Completed,
    currentStage: null,
    progressPercent: 100,
    stages: buildStages(STAGE_ORDER.length),
    startedAt: minutesAgo(96),
    updatedAt: minutesAgo(61),
    elapsedSeconds: 35 * 60,
    etaSeconds: 0,
    creditsUsed: 88,
    currentSceneNumber: 18,
    totalScenes: 18,
    posterUrl: null,
    downloadUrl: 'https://res.cloudinary.com/demo/video/upload/neon-requiem-final.mp4',
    activity: activity([
      ['08:40', 'Story Planning Started'],
      ['09:02', 'Movie Assembly Finished'],
      ['09:15', 'Final Rendering Finished'],
    ]),
    isLive: false,
  },
  {
    productionId: 'a1b2c3d4-e5f6-4a1b-8c2d-000000000003',
    movieTitle: 'Echoes of Tomorrow',
    userEmail: 'priya@nightowl.studio',
    status: ProductionStatus.Failed,
    currentStage: STAGE_ORDER[6],
    progressPercent: 55,
    stages: buildStages(6, 6),
    startedAt: minutesAgo(42),
    updatedAt: minutesAgo(38),
    elapsedSeconds: 4 * 60,
    etaSeconds: null,
    creditsUsed: 19,
    currentSceneNumber: null,
    totalScenes: 10,
    posterUrl: null,
    downloadUrl: null,
    activity: activity([
      ['11:02', 'Story Planning Started'],
      ['11:05', 'Scene Planner Finished'],
      ['11:06', 'Generating Reference Images'],
      ['11:10', 'Reference Image Generation Failed — Gemini billing required'],
    ]),
    isLive: false,
  },
  {
    productionId: 'a1b2c3d4-e5f6-4a1b-8c2d-000000000004',
    movieTitle: 'Glass City',
    userEmail: 'tom@reelforge.app',
    status: ProductionStatus.Queued,
    currentStage: STAGE_ORDER[0],
    progressPercent: 5,
    stages: buildStages(0),
    startedAt: minutesAgo(1),
    updatedAt: minutesAgo(0),
    elapsedSeconds: 60,
    etaSeconds: 18 * 60,
    creditsUsed: 2,
    currentSceneNumber: null,
    totalScenes: null,
    posterUrl: null,
    downloadUrl: null,
    activity: activity([['11:41', 'Story Planning Started']]),
    isLive: false,
  },
  {
    productionId: 'a1b2c3d4-e5f6-4a1b-8c2d-000000000005',
    movieTitle: 'Paper Moon',
    userEmail: 'maria@studio.io',
    status: ProductionStatus.Completed,
    currentStage: null,
    progressPercent: 100,
    stages: buildStages(STAGE_ORDER.length),
    startedAt: minutesAgo(240),
    updatedAt: minutesAgo(210),
    elapsedSeconds: 30 * 60,
    etaSeconds: 0,
    creditsUsed: 64,
    currentSceneNumber: 14,
    totalScenes: 14,
    posterUrl: null,
    downloadUrl: 'https://res.cloudinary.com/demo/video/upload/paper-moon-final.mp4',
    activity: activity([
      ['07:10', 'Story Planning Started'],
      ['07:38', 'Final Rendering Finished'],
    ]),
    isLive: false,
  },
]

export function computeMetrics(productions: DashboardProduction[]): DashboardMetrics {
  const running = productions.filter((p) => p.status === ProductionStatus.InProgress || p.status === ProductionStatus.Queued).length
  const completed = productions.filter((p) => p.status === ProductionStatus.Completed).length
  const failed = productions.filter((p) => p.status === ProductionStatus.Failed).length

  const completedDurations = productions
    .filter((p) => p.status === ProductionStatus.Completed)
    .map((p) => p.elapsedSeconds)
  const averageRenderTimeSeconds = completedDurations.length
    ? Math.round(completedDurations.reduce((sum, s) => sum + s, 0) / completedDurations.length)
    : 0

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const creditsUsedToday = productions
    .filter((p) => new Date(p.startedAt).getTime() >= startOfToday.getTime())
    .reduce((sum, p) => sum + p.creditsUsed, 0)

  return {
    totalProductions: productions.length,
    running,
    completed,
    failed,
    averageRenderTimeSeconds,
    creditsUsedToday,
  }
}
