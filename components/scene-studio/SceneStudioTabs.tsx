"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SceneStudioTab {
  id: string;
  label: string;
  icon?: ReactNode;
  content: ReactNode;
}

/** Tab shell local to Scene Studio — same small generic pattern as components/character-studio/CharacterStudioTabs.tsx, kept as its own component rather than a cross-feature import per that established precedent. */
export function SceneStudioTabs({ tabs, defaultTabId }: { tabs: SceneStudioTab[]; defaultTabId?: string }) {
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

export default SceneStudioTabs;
