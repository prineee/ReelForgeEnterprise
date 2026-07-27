import { Badge } from "@/components/ui/badge";
import type { RenderJobStatus } from "@/services/rendering/types/RenderJob";

export type SceneStatus = "DRAFTED" | RenderJobStatus;

const STATUS_LABEL: Record<SceneStatus, string> = {
  DRAFTED: "Drafted",
  QUEUED: "Queued",
  WAITING: "Waiting",
  ASSIGNED: "Assigned",
  RENDERING: "Rendering",
  DOWNLOADING: "Downloading",
  VERIFYING: "Verifying",
  COMPLETED: "Rendered",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const STATUS_VARIANT: Record<SceneStatus, "default" | "info" | "success" | "warning" | "danger" | "secondary"> = {
  DRAFTED: "secondary",
  QUEUED: "info",
  WAITING: "info",
  ASSIGNED: "info",
  RENDERING: "warning",
  DOWNLOADING: "warning",
  VERIFYING: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  CANCELLED: "secondary",
};

/** Real render-job status when this scene has a RenderJob (services/rendering/jobs/RenderJobManager.ts); "Drafted" when it hasn't been rendered yet — never a fabricated state. */
export function SceneStatusBadge({ status }: { status: SceneStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

export default SceneStatusBadge;
