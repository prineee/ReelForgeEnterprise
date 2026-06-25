import type { ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { glass, radius } from "@/components/ui";

export interface FAQAccordionItem {
  q: string;
  a: ReactNode;
}

export interface FAQAccordionProps {
  items: FAQAccordionItem[];
  className?: string;
}

/** Accessible FAQ accordion built on native <details> — zero client JS. */
export function FAQAccordion({ items, className }: FAQAccordionProps) {
  return (
    <div className={cn("mx-auto max-w-3xl space-y-3", className)}>
      {items.map((item, i) => (
        <details key={i} className={cn("group overflow-hidden", glass, radius.lg)}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 font-semibold text-white outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-orange-500/60">
            <span className="text-sm sm:text-base">{item.q}</span>
            <Plus className="h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-45" />
          </summary>
          <div className="px-6 pb-5 text-sm leading-relaxed text-zinc-400">{item.a}</div>
        </details>
      ))}
    </div>
  );
}

export default FAQAccordion;
