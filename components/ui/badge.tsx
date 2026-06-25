import { ReactNode } from "react";

type BadgeColor = "purple" | "orange" | "blue";
type BadgeVariant =
  | "default"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "primary"
  | "secondary";

interface BadgeProps {
  children: ReactNode;
  color?: BadgeColor;
  variant?: BadgeVariant;
  className?: string;
}

const colorStyles: Record<BadgeColor, string> = {
  purple: "bg-purple-600/20 text-purple-300 border border-purple-500/30",
  orange: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  blue: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
};

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-purple-600/20 text-purple-300 border border-purple-500/30",
  info: "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  success: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  warning: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  danger: "bg-red-500/20 text-red-300 border border-red-500/30",
  primary: "bg-purple-600/20 text-purple-300 border border-purple-500/30",
  secondary: "bg-white/10 text-zinc-300 border border-white/20",
};

export function Badge({
  children,
  color,
  variant,
  className = "",
}: BadgeProps) {
  // `variant` (dashboard usage) takes precedence; otherwise fall back to `color` (marketing usage).
  const styles = variant
    ? variantStyles[variant]
    : colorStyles[color ?? "purple"];

  return (
    <span
      className={`
      inline-flex
      items-center
      rounded-full
      px-4
      py-2
      text-sm
      font-semibold
      backdrop-blur-md
      ${styles}
      ${className}
      `}
    >
      {children}
    </span>
  );
}

export default Badge;
