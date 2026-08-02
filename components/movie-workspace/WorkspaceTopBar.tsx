import Link from "next/link";
import { ArrowLeft, Clapperboard, Coins } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface WorkspaceTopBarProps {
  movieTitle: string;
  statusLabel: string;
  statusVariant: "info" | "success" | "warning" | "danger" | "secondary";
  directorProfileName?: string;
  credits: number;
}

export function WorkspaceTopBar({ movieTitle, statusLabel, statusVariant, directorProfileName, credits }: WorkspaceTopBarProps) {
  return (
    <div className="flex h-14 items-center justify-between px-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/movie-studio/render-center"
          aria-label="Back to Render Center"
          className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-purple-500">
          <Clapperboard className="h-4 w-4 text-white" />
        </div>
        <p className="truncate text-sm font-semibold text-white">{movieTitle}</p>
        <Badge variant={statusVariant} className="!px-2 !py-0.5 text-[10px]">
          {statusLabel}
        </Badge>
        {directorProfileName && <span className="hidden text-xs text-zinc-500 sm:inline">Director: {directorProfileName}</span>}
      </div>
      <div className="flex items-center gap-2 text-sm text-zinc-300">
        <Coins className="h-4 w-4 text-orange-400" />
        {credits.toLocaleString()} credits
      </div>
    </div>
  );
}

export default WorkspaceTopBar;
