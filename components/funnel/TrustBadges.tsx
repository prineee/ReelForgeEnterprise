import type { ReactNode } from "react";
import { Lock, ShieldCheck, BadgeCheck, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TrustBadgeItem {
  label: string;
  icon?: ReactNode;
}

export interface TrustBadgesProps {
  badges?: TrustBadgeItem[];
  className?: string;
}

const DEFAULT_BADGES: TrustBadgeItem[] = [
  { label: "Secure checkout", icon: <Lock className="h-4 w-4" /> },
  { label: "SSL encrypted", icon: <ShieldCheck className="h-4 w-4" /> },
  { label: "Money-back guarantee", icon: <BadgeCheck className="h-4 w-4" /> },
  { label: "Instant access", icon: <Zap className="h-4 w-4" /> },
];

/** Row of reassurance/trust indicators. */
export function TrustBadges({ badges = DEFAULT_BADGES, className }: TrustBadgesProps) {
  return (
    <ul
      className={cn(
        "flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-sm text-zinc-400",
        className,
      )}
    >
      {badges.map((badge) => (
        <li key={badge.label} className="inline-flex items-center gap-2">
          <span className="text-orange-400" aria-hidden>
            {badge.icon}
          </span>
          {badge.label}
        </li>
      ))}
    </ul>
  );
}

export default TrustBadges;
