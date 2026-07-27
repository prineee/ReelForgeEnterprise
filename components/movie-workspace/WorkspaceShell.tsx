"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp, PanelLeft, PanelRight, X } from "lucide-react";
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
/**
 * Module 8 — below `lg`/`xl` the left/right asides disappear entirely with
 * no way to reach them, so this adds slide-over drawers on small/medium
 * screens that render the exact same leftSidebar/rightSidebar content
 * passed in (no separate mobile-only component, nothing recomputed).
 */
export function WorkspaceShell({ topBar, leftSidebar, centerPanel, rightSidebar, bottomPanel }: WorkspaceShellProps) {
  const [bottomCollapsed, setBottomCollapsed] = useState(false);
  const [leftDrawerOpen, setLeftDrawerOpen] = useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-surface text-white">
      <div className="flex shrink-0 items-center border-b border-white/10">
        <button
          type="button"
          onClick={() => setLeftDrawerOpen(true)}
          className="p-3 text-zinc-400 hover:text-white lg:hidden"
          aria-label="Open assets panel"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">{topBar}</div>
        <button
          type="button"
          onClick={() => setRightDrawerOpen(true)}
          className="p-3 text-zinc-400 hover:text-white xl:hidden"
          aria-label="Open scene properties panel"
        >
          <PanelRight className="h-4 w-4" />
        </button>
      </div>

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

      {leftDrawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setLeftDrawerOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-white/10 bg-surface-card">
            <button
              type="button"
              onClick={() => setLeftDrawerOpen(false)}
              className="flex w-full items-center justify-end p-2 text-zinc-400 hover:text-white"
              aria-label="Close assets panel"
            >
              <X className="h-4 w-4" />
            </button>
            {leftSidebar}
          </div>
        </div>
      )}

      {rightDrawerOpen && (
        <div className="fixed inset-0 z-40 xl:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setRightDrawerOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-80 max-w-[85vw] overflow-y-auto border-l border-white/10 bg-surface-card">
            <button
              type="button"
              onClick={() => setRightDrawerOpen(false)}
              className="flex w-full items-center justify-start p-2 text-zinc-400 hover:text-white"
              aria-label="Close scene properties panel"
            >
              <X className="h-4 w-4" />
            </button>
            {rightSidebar}
          </div>
        </div>
      )}
    </div>
  );
}

export default WorkspaceShell;
