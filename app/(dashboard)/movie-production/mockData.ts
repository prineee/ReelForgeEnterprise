/**
 * mockData.ts
 *
 * computeMetrics() is real, reusable aggregation logic — works over
 * whatever DashboardProduction[] the page actually has (currently just the
 * single live row from a ?productionId= poll; see adapter.ts). The demo
 * dataset this file used to also export was removed once the page stopped
 * seeding itself with placeholder productions.
 */

import { ProductionStatus } from '@/services/ai/orchestration/MovieProductionContracts'
import type { DashboardMetrics, DashboardProduction } from './types'

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
