import { Badge } from "@/components/ui/badge";

/** Mirrors services/workflow/WorkflowState.ts's real WorkflowStatus values — string literals here (not an enum import) since this badge only needs to render, not branch on workflow-internal logic. */
export type WorkflowStatusLabel =
  | "CREATED"
  | "VALIDATING"
  | "QUEUED"
  | "RUNNING"
  | "PAUSED"
  | "RETRYING"
  | "CANCELLED"
  | "COMPLETED"
  | "FAILED";

const VARIANT: Record<WorkflowStatusLabel, "info" | "success" | "warning" | "danger" | "secondary"> = {
  CREATED: "secondary",
  VALIDATING: "info",
  QUEUED: "info",
  RUNNING: "warning",
  PAUSED: "secondary",
  RETRYING: "warning",
  CANCELLED: "secondary",
  COMPLETED: "success",
  FAILED: "danger",
};

export function MovieStatusBadge({ status }: { status: string }) {
  const normalized = (status in VARIANT ? status : "CREATED") as WorkflowStatusLabel;
  return <Badge variant={VARIANT[normalized]}>{normalized.charAt(0) + normalized.slice(1).toLowerCase()}</Badge>;
}

export default MovieStatusBadge;
