import { cn } from "@/lib/utils";
import { TestimonialCard } from "@/components/ui";
import type { FunnelTestimonial } from "./types";

export interface TestimonialWallProps {
  testimonials: FunnelTestimonial[];
  columns?: 2 | 3;
  className?: string;
}

/** Grid of customer testimonials, reusing the design-system TestimonialCard. */
export function TestimonialWall({ testimonials, columns = 3, className }: TestimonialWallProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6",
        columns === 3 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2",
        className,
      )}
    >
      {testimonials.map((t, i) => (
        <TestimonialCard
          key={i}
          quote={t.quote}
          author={t.author}
          role={t.role}
          company={t.company}
          avatarUrl={t.avatarUrl}
          rating={t.rating}
        />
      ))}
    </div>
  );
}

export default TestimonialWall;
