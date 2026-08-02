"use client";

import { useState } from "react";
import { AlertTriangle, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Module 3 — "Pause Queue (UI state only unless supported)." Confirmed
 * by inspection: no pause/resume capability exists anywhere in
 * RenderQueue.ts or RenderJobManager.ts (grep across the whole
 * services/rendering/ tree returns zero matches for "pause"). Adding
 * real pause/resume would mean changing how tryStartNext()/WorkerPool
 * schedule work — a real scheduler change, explicitly out of scope
 * ("No duplicate scheduler," "No rendering changes"). This toggle is
 * therefore local display state only, clearly labeled as such, and does
 * not call any API — new jobs keep processing normally regardless of
 * its state.
 */
export function QueuePauseToggle() {
  const [paused, setPaused] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" onClick={() => setPaused((v) => !v)}>
        {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        <span className="ml-1.5">{paused ? "Resume Queue" : "Pause Queue"}</span>
      </Button>
      {paused && (
        <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-400">
          <AlertTriangle className="h-3 w-3" /> Display only — RenderJobManager has no pause capability; jobs keep processing.
        </span>
      )}
    </div>
  );
}

export default QueuePauseToggle;
