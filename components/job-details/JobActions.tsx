"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { JobDetail } from "@/services/infrastructure/RenderCenterFactory";

export interface JobActionsProps {
  detail: JobDetail;
}

/**
 * Module 3 — Cancel/Retry are real actions against RenderJobManager,
 * never bypassing it: Cancel POSTs to app/api/render-center/jobs/[jobId]/cancel
 * (RenderJobManager.cancel()); Retry POSTs to .../retry (RenderJobManager.submit()
 * with the failed job's own real request — there is no manager-level
 * retry(jobId) entry point, so this is a genuine new job, not the
 * automatic internal retry chain). isCancellable/supportsRealCancellation
 * both come from the real CancellationPolicy via JobDetail — this
 * component never guesses which jobs can be cancelled.
 */
export function JobActions({ detail }: JobActionsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<"cancel" | "retry" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(kind: "cancel" | "retry") {
    setPending(kind);
    setError(null);
    try {
      const res = await fetch(`/api/render-center/jobs/${detail.job.jobId}/${kind}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Failed to ${kind} job.`);
        return;
      }
      router.refresh();
    } catch {
      setError(`Failed to ${kind} job — network error.`);
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        {detail.isCancellable && (
          <Button variant="outline" size="sm" onClick={() => handleAction("cancel")} disabled={pending !== null}>
            {pending === "cancel" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Cancel Job</span>
          </Button>
        )}
        {detail.job.status === "FAILED" && (
          <Button variant="outline" size="sm" onClick={() => handleAction("retry")} disabled={pending !== null}>
            {pending === "retry" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
            <span className="ml-1.5">Retry Job</span>
          </Button>
        )}
      </div>

      {detail.isCancellable && !detail.supportsRealCancellation && (
        <p className="flex items-start gap-1.5 text-[10px] text-zinc-500">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          Cancelling stops tracking this job locally — {detail.job.providerId ?? "this provider"} has no cancel capability, so in-flight work may continue.
        </p>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-[10px] text-red-400">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {error}
        </p>
      )}
    </div>
  );
}

export default JobActions;
