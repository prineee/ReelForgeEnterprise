"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { resolveAccents, type FunnelThemeAccents } from "./types";

export interface CountdownBannerProps {
  /** Fixed deadline as an ISO date string. Takes priority over durationMinutes. */
  deadline?: string;
  /** Countdown length from first render, in minutes (urgency fallback). */
  durationMinutes?: number;
  label?: string;
  accents?: FunnelThemeAccents;
  className?: string;
}

interface Remaining {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

function computeRemaining(target: number): Remaining {
  const diff = Math.max(0, target - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}

const pad = (n: number) => n.toString().padStart(2, "0");

/** Live countdown timer banner. Renders after mount to avoid hydration drift. */
export function CountdownBanner({
  deadline,
  durationMinutes = 15,
  label = "This offer expires in",
  accents,
  className,
}: CountdownBannerProps) {
  const a = resolveAccents(accents);
  const [remaining, setRemaining] = useState<Remaining | null>(null);

  useEffect(() => {
    const target = deadline
      ? new Date(deadline).getTime()
      : Date.now() + durationMinutes * 60 * 1000;

    setRemaining(computeRemaining(target));
    const id = setInterval(() => setRemaining(computeRemaining(target)), 1000);
    return () => clearInterval(id);
  }, [deadline, durationMinutes]);

  const units: { label: string; value: number }[] = [
    { label: "Days", value: remaining?.days ?? 0 },
    { label: "Hours", value: remaining?.hours ?? 0 },
    { label: "Mins", value: remaining?.minutes ?? 0 },
    { label: "Secs", value: remaining?.seconds ?? 0 },
  ];

  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 backdrop-blur-xl sm:flex-row sm:justify-center sm:gap-5",
        className,
      )}
      aria-live="polite"
    >
      <span className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-300">
        <Clock className="h-4 w-4 text-orange-400" aria-hidden />
        {label}
      </span>
      <div className="flex items-center gap-2">
        {units.map((u) => (
          <div key={u.label} className="flex flex-col items-center">
            <span
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl text-xl font-black tabular-nums text-white",
                a.gradient,
              )}
            >
              {remaining ? pad(u.value) : "--"}
            </span>
            <span className="mt-1 text-[10px] uppercase tracking-wide text-zinc-500">
              {u.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default CountdownBanner;
