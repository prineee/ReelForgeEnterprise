import { AlertOctagon, Cpu } from "lucide-react";
import type { JobDetail } from "@/services/infrastructure/RenderCenterFactory";

export interface FailureAnalysisPanelProps {
  detail: JobDetail;
}

/**
 * Module 8 — "Do not invent diagnostics. Only display real error
 * metadata." RenderJob.error (services/rendering/types/RenderJob.ts) is
 * a raw message string — there is no structured error-type taxonomy
 * anywhere in the render pipeline, so "Error Type" is disclosed as
 * unavailable rather than guessed from the message text (pattern-
 * matching "timeout"/"quota" out of a free-form string would be
 * fabricating a diagnosis this module explicitly forbids). Retry
 * Recommendation is derived only from real, observable job-chain data
 * (JobDetail.wasAutoRetried, from RenderJobManager's actual
 * retriedFromJobId linkage) — never a guessed root cause.
 */
export function FailureAnalysisPanel({ detail }: FailureAnalysisPanelProps) {
  if (detail.job.status !== "FAILED") return null;

  return (
    <div className="space-y-3 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-xs">
      <p className="inline-flex items-center gap-1.5 font-semibold text-red-300">
        <AlertOctagon className="h-3.5 w-3.5" /> Failure Analysis
      </p>

      <Row label="Error Type" value="Not available — RenderJob.error is a raw message, not a categorized error type." muted />
      <Row label="Error Message" value={detail.job.error ?? "No error message was recorded."} />
      <Row label="Provider" value={detail.job.providerId ?? "—"} icon={<Cpu className="h-3 w-3" />} />

      <Row
        label="Retry Recommendation"
        value={
          detail.wasAutoRetried
            ? "This failure was already automatically retried by the system (RenderJobManager's own retry policy)."
            : "This job was not automatically retried."
        }
      />

      <Row
        label="Suggested Action"
        value={
          detail.wasAutoRetried
            ? "A later job already retried this attempt — check that job's outcome before retrying again."
            : "You can manually retry this job below, which resubmits its original request as a new job."
        }
      />
    </div>
  );
}

function Row({ label, value, icon, muted }: { label: string; value: string; icon?: React.ReactNode; muted?: boolean }) {
  return (
    <div>
      <p className="mb-0.5 inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500">
        {icon}
        {label}
      </p>
      <p className={muted ? "text-zinc-500" : "text-zinc-300"}>{value}</p>
    </div>
  );
}

export default FailureAnalysisPanel;
