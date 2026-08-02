import type { ReactNode } from "react";

export interface TimelineTrackProps {
  label: string;
  icon?: ReactNode;
  widthPixels: number;
  children: ReactNode;
}

export function TimelineTrack({ label, icon, widthPixels, children }: TimelineTrackProps) {
  return (
    <div className="flex border-b border-white/5">
      <div className="flex w-32 shrink-0 items-center gap-2 border-r border-white/10 bg-white/[0.02] px-3 py-3 text-xs font-semibold text-zinc-400">
        {icon}
        {label}
      </div>
      <div className="relative h-12 flex-1" style={{ minWidth: widthPixels }}>
        {children}
      </div>
    </div>
  );
}

export default TimelineTrack;
