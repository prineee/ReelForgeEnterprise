import type { ReactNode } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassCard } from "./GlassCard";

export interface TestimonialCardProps {
  quote: ReactNode;
  author: string;
  role?: string;
  /** Optional company / brand shown beneath the author. */
  company?: string;
  avatarUrl?: string;
  /** Optional 0–5 star rating rendered above the quote. */
  rating?: number;
  className?: string;
}

/** Social-proof card — quote with author identity, optional rating + company. */
export function TestimonialCard({
  quote,
  author,
  role,
  company,
  avatarUrl,
  rating,
  className,
}: TestimonialCardProps) {
  return (
    <GlassCard className={cn("flex h-full flex-col", className)}>
      {typeof rating === "number" && (
        <div className="mb-4 flex items-center gap-1" aria-label={`${rating} out of 5 stars`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={cn(
                "h-4 w-4",
                i < rating ? "fill-orange-400 text-orange-400" : "text-zinc-600",
              )}
              aria-hidden
            />
          ))}
        </div>
      )}
      <p className="flex-1 text-lg leading-relaxed text-zinc-200">&ldquo;{quote}&rdquo;</p>
      <div className="mt-6 flex items-center gap-3">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatarUrl}
            alt={author}
            className="h-11 w-11 rounded-full object-cover ring-1 ring-white/15"
          />
        ) : (
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-purple-600 font-bold text-white">
            {author.charAt(0)}
          </div>
        )}
        <div>
          <p className="font-semibold text-white">{author}</p>
          {(role || company) && (
            <p className="text-sm text-zinc-400">
              {role}
              {role && company ? " · " : ""}
              {company && <span className="text-zinc-300">{company}</span>}
            </p>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

export default TestimonialCard;
