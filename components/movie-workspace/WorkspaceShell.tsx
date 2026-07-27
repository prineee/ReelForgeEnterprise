"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WorkspaceShellProps {
  topBar: ReactNode;
  leftSidebar: ReactNode;
  centerPanel: ReactNode;
  rightSidebar: ReactNode;
  bottomPanel: ReactNode;
}

/**
 * Module 2 — the professional four-region layout (left sidebar / center /
 * right sidebar / bottom render queue), full-bleed (this route
 * deliberately does not use app/(dashboard)/_components/dashboard-shell.tsx's
 * max-w-5xl centered column — a workspace this dense needs the full
 * viewport). Purely layout; every region's actual content is composed in
 * app/movie-studio/workspace/[movieId]/page.tsx from the real panel
 * components (storyboard/, timeline/, assets/, render-dashboard/,
 * project-inspector/).
 */
export function WorkspaceShell({ topBar, leftSidebar, centerPanel, rightSidebar, bottomPanel }: WorkspaceShellProps) {
  const [bottomCollapsed, setBottomCollapsed] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-surface text-white">
      <div className="shrink-0 border-b border-white/10">{topBar}</div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 border-r border-white/10 bg-surface-card/60 lg:block">{leftSidebar}</aside>

        <main className="min-w-0 flex-1 overflow-y-auto">{centerPanel}</main>

        <aside className="hidden w-80 shrink-0 border-l border-white/10 bg-surface-card/60 xl:block">{rightSidebar}</aside>
      </div>

      <div className={cn("shrink-0 border-t border-white/10 bg-surface-card/80 transition-all", bottomCollapsed ? "h-10" : "h-72")}>
        <button
          type="button"
          onClick={() => setBottomCollapsed((v) => !v)}
          className="flex h-10 w-full items-center justify-between px-4 text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-white"
        >
          Render Queue
          {bottomCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {!bottomCollapsed && <div className="h-[calc(100%-2.5rem)] overflow-y-auto px-4 pb-4">{bottomPanel}</div>}
      </div>
    </div>
  );
}

export default WorkspaceShell;
