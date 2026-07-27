"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CharacterStudioTab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

/** Tab shell local to Character Studio — same generic pattern as components/movie-workspace/WorkspaceTabs.tsx, kept as its own small component rather than a cross-feature import since that file documents itself as deliberately scoped to components/movie-workspace/. */
export function CharacterStudioTabs({ tabs, defaultTabId }: { tabs: CharacterStudioTab[]; defaultTabId?: string }) {
  const [activeId, setActiveId] = useState(defaultTabId ?? tabs[0]?.id);
  const active = tabs.find((tab) => tab.id === activeId) ?? tabs[0];

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap gap-1 border-b border-white/10">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveId(tab.id)}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-xs font-semibold transition-colors",
              tab.id === active?.id ? "border-brand-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>
      <div className="py-4">{active?.content}</div>
    </div>
  );
}

export default CharacterStudioTabs;
