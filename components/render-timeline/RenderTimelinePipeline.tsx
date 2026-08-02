import { Check, X } from "lucide-react";
import type { RenderJobProgress } from "@/services/rendering/types/RenderJobProgress";
import type { RenderJobStatus } from "@/services/rendering/types/RenderJob";
import { cn } from "@/lib/utils";

export interface RenderTimelinePipelineProps {
  progress: RenderJobProgress;
}

/**
 * Module 6 — the sprint brief's requested pipeline
 * (Queued→Preparing→Rendering→Encoding→Uploading→Completed) does not
 * match the real backend: RenderJobProgress.currentStage is literally
 * RenderJobStatus (services/rendering/types/RenderJob.ts) — there is no
 * "Encoding" or "Uploading" stage anywhere in RenderQueue's state
 * machine. This uses the real 9-state pipeline instead, collapsed onto
 * 5 visible steps using the exact same relabeling
 * components/render-dashboard/RenderJobStatusBadge.tsx already
 * establishes (WAITING/ASSIGNED → "Preparing", DOWNLOADING/VERIFYING →
 * "Downloading") — no fabricated stage names.
 */
const PIPELINE_STEPS: { label: string; statuses: readonly RenderJobStatus[] }[] = [
  { label: "Queued", statuses: ["QUEUED"] },
  { label: "Preparing", statuses: ["WAITING", "ASSIGNED"] },
  { label: "Rendering", statuses: ["RENDERING"] },
  { label: "Downloading", statuses: ["DOWNLOADING", "VERIFYING"] },
  { label: "Completed", statuses: ["COMPLETED"] },
];

export function RenderTimelinePipeline({ progress }: RenderTimelinePipelineProps) {
  const currentIndex = PIPELINE_STEPS.findIndex((step) => step.statuses.includes(progress.currentStage));
  const isTerminalFailure = progress.currentStage === "FAILED" || progress.currentStage === "CANCELLED";

  return (
    <div className="space-y-2">
      <div className="flex items-center">
        {PIPELINE_STEPS.map((step, index) => {
          const isPast = !isTerminalFailure && index < currentIndex;
          const isCurrent = !isTerminalFailure && index === currentIndex;
          return (
            <div key={step.label} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                    isCurrent && "border-brand-500 bg-brand-500/20 text-brand-300",
                    isPast && "border-emerald-500/60 bg-emerald-500/10 text-emerald-400",
                    !isCurrent && !isPast && "border-white/10 text-zinc-600"
                  )}
                >
                  {isPast ? <Check className="h-3 w-3" /> : index + 1}
                </div>
                <span className={cn("text-center text-[9px]", isCurrent ? "text-white" : "text-zinc-500")}>{step.label}</span>
              </div>
              {index < PIPELINE_STEPS.length - 1 && <div className={cn("mx-1 h-px flex-1", isPast ? "bg-emerald-500/40" : "bg-white/10")} />}
            </div>
          );
        })}
      </div>

      {isTerminalFailure && (
        <div className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1.5 text-[10px] text-red-300">
          <X className="h-3 w-3" /> This job {progress.currentStage === "FAILED" ? "failed" : "was cancelled"} — the linear pipeline above no longer applies.
        </div>
      )}
    </div>
  );
}

export default RenderTimelinePipeline;
