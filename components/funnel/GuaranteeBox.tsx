import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "@/components/ui";
import { resolveAccents, type FunnelGuarantee, type FunnelThemeAccents } from "./types";

export interface GuaranteeBoxProps {
  guarantee: FunnelGuarantee;
  accents?: FunnelThemeAccents;
  className?: string;
}

/** Full-width reassurance box describing the satisfaction guarantee. */
export function GuaranteeBox({ guarantee, accents, className }: GuaranteeBoxProps) {
  const a = resolveAccents(accents);

  return (
    <GlassCard hover={false} className={cn("flex flex-col items-center gap-5 text-center sm:flex-row sm:text-left", className)}>
      <span
        className={cn(
          "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-white",
          a.gradient,
        )}
        aria-hidden
      >
        <ShieldCheck className="h-8 w-8" />
      </span>
      <div>
        <h3 className="text-lg font-bold text-white">
          {guarantee.title}
          {guarantee.days ? ` · ${guarantee.days}-day` : ""}
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{guarantee.description}</p>
      </div>
    </GlassCard>
  );
}

export default GuaranteeBox;
