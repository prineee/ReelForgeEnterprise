import { Plus } from "lucide-react";
import { MarketingSection } from "@/components/shared";
import { SectionTitle, glass, radius } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface FaqItem {
  q: string;
  a: string;
}

export interface FAQProps {
  items: FaqItem[];
}

/**
 * FAQ accordion built on native <details> — fully accessible and zero client JS.
 */
export function FAQ({ items }: FAQProps) {
  return (
    <MarketingSection id="faq" width="narrow">
      <SectionTitle
        eyebrow="FAQ"
        title="Frequently asked questions"
        subtitle="Everything you need to know about ReelForge."
      />
      <div className="mt-12 space-y-3">
        {items.map((item, i) => (
          <details
            key={i}
            className={cn("group overflow-hidden", glass, radius.lg)}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-4 font-semibold text-white outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-orange-500/60">
              <span className="text-sm sm:text-base">{item.q}</span>
              <Plus className="h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-200 group-open:rotate-45" />
            </summary>
            <p className="px-6 pb-5 text-sm leading-relaxed text-zinc-400">{item.a}</p>
          </details>
        ))}
      </div>
    </MarketingSection>
  );
}

export default FAQ;
