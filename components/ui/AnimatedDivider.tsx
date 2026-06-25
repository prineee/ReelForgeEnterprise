import { cn } from "@/lib/utils";

export interface AnimatedDividerProps {
  className?: string;
}

/** Subtle gradient separator with a gentle pulse — purely decorative. */
export function AnimatedDivider({ className }: AnimatedDividerProps) {
  return (
    <div className={cn("relative h-px w-full overflow-hidden", className)} aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/60 to-transparent" />
      <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
    </div>
  );
}

export default AnimatedDivider;
