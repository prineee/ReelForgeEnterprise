import { Badge } from "@/components/ui/badge";
import type { RenderJobStatus } from "@/services/rendering/types/RenderJob";

/** Module 7 asks for a "Preparing" column — mapped from the real WAITING/ASSIGNED RenderJobStatus values (services/rendering/types/RenderJob.ts) rather than inventing a tenth backend state. */
const COLUMN_LABEL: Record<RenderJobStatus, string> = {
  QUEUED: "Queued",
  WAITING: "Preparing",
  ASSIGNED: "Preparing",
  RENDERING: "Rendering",
  DOWNLOADING: "Downloading",
  VERIFYING: "Downloading",
  COMPLETED: "Completed",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const COLUMN_VARIANT: Record<RenderJobStatus, "info" | "warning" | "success" | "danger" | "secondary"> = {
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

export function RenderJobStatusBadge({ status }: { status: RenderJobStatus }) {
  return <Badge variant={COLUMN_VARIANT[status]}>{COLUMN_LABEL[status]}</Badge>;
}

export default RenderJobStatusBadge;
