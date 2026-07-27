import { BarChart3 } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { PerformanceAnalyticsData } from "@/services/infrastructure/RenderCenterFactory";
import type { ProviderId } from "@/services/rendering/interfaces/RenderProvider";

export interface PerformanceAnalyticsChartsProps {
  analytics: PerformanceAnalyticsData;
}

/** Fixed categorical order (never cycled/reassigned per filter) — same color identifies the same provider across every chart on this page. */
const PROVIDER_COLOR: Record<ProviderId, string> = {
  LTX: "#3987e5",
  GOOGLE: "#d95926",
  LOCAL_GPU: "#199e70",
  GPU_CLUSTER: "#c98500",
  WAN: "#d55181",
  HUNYUAN: "#9085e9",
  COGVIDEO: "#e66767",
};

const SEQUENTIAL_BLUE = "#3987e5";

/**
 * Module 9 — every number reads RenderCenterFactory.getPerformanceAnalytics(),
 * itself sourced entirely from RenderJobManager.getLedger() (the real,
 * already-recorded render history, read-only accessor added this
 * sprint). "Not enough render history yet" when the ledger is empty,
 * per this module's explicit instruction — never simulated data.
 */
export function PerformanceAnalyticsCharts({ analytics }: PerformanceAnalyticsChartsProps) {
  if (!analytics.hasEnoughHistory) {
    return (
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Performance Analytics</h2>
        <Card className="flex flex-col items-center justify-center gap-2 p-8 text-center">
          <BarChart3 className="h-7 w-7 text-white/20" />
          <p className="text-sm text-zinc-400">Not enough render history yet</p>
          <p className="text-xs text-zinc-600">Charts appear here once at least one render job has completed or failed.</p>
        </Card>
      </div>
    );
  }

  const { jobsPerDay, providerUsage, averageRenderTimeMsByProvider, failureRate, totalRenders } = analytics;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white">Performance Analytics</h2>
        <p className="text-[10px] text-zinc-500">{totalRenders} recorded render{totalRenders === 1 ? "" : "s"}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarChartCard title="Jobs Per Day" bars={jobsPerDay.map((d) => ({ label: d.date, value: d.count, color: SEQUENTIAL_BLUE }))} formatValue={(v) => v.toString()} />
        <BarChartCard
          title="Provider Usage"
          bars={providerUsage.map((p) => ({ label: p.providerId, value: p.count, color: PROVIDER_COLOR[p.providerId] }))}
          formatValue={(v) => v.toString()}
        />
        <BarChartCard
          title="Average Render Time"
          bars={averageRenderTimeMsByProvider.map((p) => ({ label: p.providerId, value: p.averageMs, color: PROVIDER_COLOR[p.providerId] }))}
          formatValue={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}s` : `${Math.round(v)}ms`)}
        />

        <Card className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Failure Rate</p>
          <div className="flex items-end gap-2">
            <p className={`text-3xl font-bold ${failureRate > 0.3 ? "text-red-400" : failureRate > 0.1 ? "text-amber-400" : "text-emerald-400"}`}>
              {Math.round(failureRate * 100)}%
            </p>
            <p className="mb-1 text-xs text-zinc-500">of {totalRenders} recorded renders</p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function BarChartCard({
  title,
  bars,
  formatValue,
}: {
  title: string;
  bars: { label: string; value: number; color: string }[];
  formatValue: (value: number) => string;
}) {
  const maxValue = Math.max(...bars.map((b) => b.value), 1);

  return (
    <Card className="p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">{title}</p>
      {bars.length === 0 ? (
        <p className="text-xs text-zinc-600">No data.</p>
      ) : (
        <div className="space-y-2">
          {bars.map((bar) => (
            <div key={bar.label} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 truncate text-zinc-400">{bar.label}</span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-white/5">
                <div
                  className="h-full rounded transition-all"
                  style={{ width: `${(bar.value / maxValue) * 100}%`, backgroundColor: bar.color }}
                />
              </div>
              <span className="w-14 shrink-0 text-right text-zinc-300">{formatValue(bar.value)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default PerformanceAnalyticsCharts;
