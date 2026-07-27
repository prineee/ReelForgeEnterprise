"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface WorkspaceTab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

/**
 * No shared Tabs primitive exists in components/ui/ (confirmed before
 * building this) — this is a small, workspace-scoped tab container rather
 * than an addition to the shared kit, so it stays contained to
 * components/movie-workspace/ per this sprint's file organization.
 */
export function WorkspaceTabs({ tabs, defaultTabId, className }: { tabs: WorkspaceTab[]; defaultTabId?: string; className?: string }) {
  const [activeId, setActiveId] = useState(defaultTabId ?? tabs[0]?.id);
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <div className={cn("flex h-full flex-col", className)}>
      <div className="flex shrink-0 gap-1 border-b border-white/10 px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveId(tab.id)}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors",
              tab.id === active?.id
                ? "border-brand-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{active?.content}</div>
    </div>
  );
}

export default WorkspaceTabs;
