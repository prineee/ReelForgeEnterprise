/**
 * ProviderHealth.ts
 *
 * Tracks each provider's last-known operational status. This sprint makes
 * no network calls — nothing here polls a provider automatically. Status is
 * only ever set by an explicit report() call, which a future health-check
 * job (or a webhook, or a failed-call handler elsewhere) can call without
 * this module needing to change.
 *
 * A provider that has never been reported on is ProviderHealthStatus.Unknown
 * rather than assumed healthy or unhealthy — ProviderSelector treats
 * Unknown as usable (optimistic default) but Offline/RateLimited/Maintenance
 * as not.
 */

import type { ProviderId } from './OrchestratorTypes'
import { ProviderHealthStatus } from './OrchestratorTypes'

export interface ProviderHealthReport {
  providerId: ProviderId
  status: ProviderHealthStatus
  reportedAt: string
  message?: string
}

export interface ProviderHealthMonitor {
  report(providerId: ProviderId, status: ProviderHealthStatus, message?: string): void
  getStatus(providerId: ProviderId): ProviderHealthStatus
  getReport(providerId: ProviderId): ProviderHealthReport | undefined
  /** True for Online or Unknown; false for Offline, RateLimited, or Maintenance. */
  isUsable(providerId: ProviderId): boolean
  listReports(): ProviderHealthReport[]
}

const UNUSABLE_STATUSES = new Set<ProviderHealthStatus>([
  ProviderHealthStatus.Offline,
  ProviderHealthStatus.RateLimited,
  ProviderHealthStatus.Maintenance,
])

/** In-memory health tracker, keyed by provider id. */
export class InMemoryProviderHealthMonitor implements ProviderHealthMonitor {
  private readonly reports = new Map<ProviderId, ProviderHealthReport>()

  report(providerId: ProviderId, status: ProviderHealthStatus, message?: string): void {
    this.reports.set(providerId, { providerId, status, reportedAt: new Date().toISOString(), message })
  }

  getStatus(providerId: ProviderId): ProviderHealthStatus {
    return this.reports.get(providerId)?.status ?? ProviderHealthStatus.Unknown
  }

  getReport(providerId: ProviderId): ProviderHealthReport | undefined {
    return this.reports.get(providerId)
  }

  isUsable(providerId: ProviderId): boolean {
    return !UNUSABLE_STATUSES.has(this.getStatus(providerId))
  }

  listReports(): ProviderHealthReport[] {
    return Array.from(this.reports.values())
  }
}
