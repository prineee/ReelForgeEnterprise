/**
 * RenderLedger.ts
 *
 * Permanent (per this module's lifetime — see NO DATABASE note below)
 * render history: one RenderLedgerEntry per render attempt, covering
 * identity (who/what/where), provider/model, requested vs. actual
 * duration/resolution, timing, cost/profit, and outcome. This is the
 * system of record cost/CostIntelligence.ts's reporting methods
 * (providerStatistics/dailySummary/monthlySummary/yearlySummary) read
 * from, and what a future billing reconciliation job would replay.
 *
 * In-memory only for now — NO DATABASE, per this sprint's scope. A
 * persistent store can replace the private array below later without
 * changing this class's public shape.
 */

import type { ProviderId } from "../interfaces/RenderProvider";
import type { RenderJobStatus, ExecutionTarget } from "../types/RenderJob";

export interface RenderLedgerEntry {
  renderId: string;
  jobId: string;
  userId?: string;
  projectId?: string;
  sceneId?: string;

  provider: ProviderId;
  model?: string;

  requestedDurationSeconds?: number;
  actualDurationSeconds?: number;

  requestedResolution?: string;
  actualResolution?: string;

  renderStartTime: string;
  renderEndTime?: string;
  /** Milliseconds. renderEndTime - renderStartTime, when both are known. */
  generationTimeMs?: number;

  estimatedCost?: number;
  actualCost?: number;
  creditsCharged?: number;
  estimatedProfit?: number;

  status: RenderJobStatus;
  retryCount: number;

  /** "Cloud / GPU" per the Sprint 3 spec. */
  executionTarget: ExecutionTarget;

  errorMessage?: string;
  timestamp: string;
}

export class RenderLedger {
  private readonly entries: RenderLedgerEntry[] = [];

  record(entry: RenderLedgerEntry): void {
    this.entries.push(entry);
  }

  getAll(): readonly RenderLedgerEntry[] {
    return this.entries;
  }

  getByRenderId(renderId: string): RenderLedgerEntry | undefined {
    return this.entries.find((entry) => entry.renderId === renderId);
  }

  getByJobId(jobId: string): readonly RenderLedgerEntry[] {
    return this.entries.filter((entry) => entry.jobId === jobId);
  }

  getByUser(userId: string): readonly RenderLedgerEntry[] {
    return this.entries.filter((entry) => entry.userId === userId);
  }

  getByProject(projectId: string): readonly RenderLedgerEntry[] {
    return this.entries.filter((entry) => entry.projectId === projectId);
  }

  getByProvider(provider: ProviderId): readonly RenderLedgerEntry[] {
    return this.entries.filter((entry) => entry.provider === provider);
  }

  getByStatus(status: RenderJobStatus): readonly RenderLedgerEntry[] {
    return this.entries.filter((entry) => entry.status === status);
  }

  /** Entries whose timestamp falls within [startIso, endIso) — the primitive cost/CostIntelligence.ts's period summaries are built on. */
  getByDateRange(startIso: string, endIso: string): readonly RenderLedgerEntry[] {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();
    return this.entries.filter((entry) => {
      const at = new Date(entry.timestamp).getTime();
      return at >= start && at < end;
    });
  }
}
