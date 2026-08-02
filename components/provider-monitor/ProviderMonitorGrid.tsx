import { Cpu, HardDrive, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ProviderMonitorEntry } from "@/services/infrastructure/RenderCenterFactory";

export interface ProviderMonitorGridProps {
  providers: ProviderMonitorEntry[];
}

type DerivedStatus = "BUSY" | "IDLE" | "NO_JOBS_YET" | "NOT_IMPLEMENTED";

const STATUS_LABEL: Record<DerivedStatus, string> = {
  BUSY: "Busy",
  IDLE: "Idle",
  NO_JOBS_YET: "No jobs yet",
  NOT_IMPLEMENTED: "Not implemented",
};

const STATUS_VARIANT: Record<DerivedStatus, "success" | "warning" | "secondary"> = {
  BUSY: "warning",
  IDLE: "success",
  NO_JOBS_YET: "secondary",
  NOT_IMPLEMENTED: "secondary",
};

/**
 * Module 4 — no provider anywhere in this codebase exposes a live ping/
 * health-check endpoint (confirmed by inspection of VeoService.ts,
 * LTXVideoClient.ts, and ProviderRegistry.ts — none track online/offline
 * state). This never probes a provider directly; status is derived
 * entirely from real, already-recorded data: active job count
 * (RenderJobManager.list()) for "Busy," and RenderJobManager.getHealthStatistics()
 * (the real ProviderHealthMonitor, populated by every real job outcome)
 * for average render time and success rate. Providers ProviderRegistry
 * only registers as placeholders (GPU_CLUSTER/WAN/HUNYUAN/COGVIDEO) are
 * shown as "Not implemented," not fabricated as available.
 */
export function ProviderMonitorGrid({ providers }: ProviderMonitorGridProps) {
  return (
    <div id="provider-monitor" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Provider Monitor</h2>
        <p className="inline-flex items-center gap-1.5 text-[10px] text-zinc-500">
          <Info className="h-3 w-3" /> Status is derived from job history — no provider is probed directly.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {providers.map((provider) => {
          const status = deriveStatus(provider);
          return (
            <Card key={provider.providerId} className="space-y-2 p-3 text-xs">
              <div className="flex items-center justify-between">
                <p className="inline-flex items-center gap-1.5 font-semibold text-white">
                  <Cpu className="h-3.5 w-3.5" /> {provider.providerId}
                </p>
                <Badge variant={STATUS_VARIANT[status]} className="!px-2 !py-0.5 text-[10px]">
                  {STATUS_LABEL[status]}
                </Badge>
              </div>

              {provider.activeJobCount > 0 && <p className="text-zinc-400">{provider.activeJobCount} active job{provider.activeJobCount === 1 ? "" : "s"}</p>}

              <Row label="Avg. Render Time" value={provider.statistics ? formatMs(provider.statistics.averageRenderTimeMs) : "Not enough render history yet"} />
              <Row label="Success Rate" value={provider.statistics ? `${Math.round(provider.statistics.successRate * 100)}%` : "Not enough render history yet"} />

              {provider.gpu && (
                <div className="mt-1 space-y-1 border-t border-white/5 pt-1.5">
                  <Row icon={<HardDrive className="h-3 w-3" />} label="GPU Health" value={provider.gpu.health.message ?? (provider.gpu.health.available ? "Available" : "Unavailable")} />
                  <Row label="VRAM" value={provider.gpu.memoryUsage.totalMB !== undefined ? `${provider.gpu.memoryUsage.totalMB} MB` : "Not available yet"} />
                  <Row label="Queue Depth" value={provider.gpu.queueDepth.toString()} />
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function deriveStatus(provider: ProviderMonitorEntry): DerivedStatus {
  if (!provider.isImplemented) return "NOT_IMPLEMENTED";
  if (provider.activeJobCount > 0) return "BUSY";
  if (provider.statistics && provider.statistics.jobsCompleted + provider.statistics.jobsFailed > 0) return "IDLE";
  return "NO_JOBS_YET";
}

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function Row({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-zinc-400">
      <span className="inline-flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span className="text-right text-zinc-300">{value}</span>
    </div>
  );
}

export default ProviderMonitorGrid;
