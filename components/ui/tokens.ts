/**
 * ReelForge Enterprise — Centralized Design Tokens
 *
 * Single source of truth for the ReelForge visual identity:
 * black background · orange primary · purple glow · blue highlights ·
 * glass morphism · premium shadows · large typography.
 *
 * Tokens are expressed as Tailwind utility-class strings (and raw values
 * where useful) so every component stays 100% Tailwind-driven.
 */

export const brandColors = {
  background: "#000000",
  surface: "rgba(255,255,255,0.05)",
  border: "rgba(255,255,255,0.10)",
  primary: "#f97316", // orange-500
  primarySoft: "#fb923c", // orange-400
  purple: "#7c3aed", // purple-600
  blue: "#3b82f6", // blue-500
  danger: "#dc2626", // red-600
  success: "#10b981", // emerald-500
  warning: "#f59e0b", // amber-500
  textPrimary: "#ffffff",
  textMuted: "#a1a1aa", // zinc-400
} as const;

export const gradients = {
  primary: "bg-gradient-to-r from-orange-500 via-orange-400 to-purple-600",
  primaryDiagonal:
    "bg-gradient-to-br from-orange-500 via-orange-400 to-purple-600",
  purple: "bg-gradient-to-r from-purple-600 to-indigo-600",
  blue: "bg-gradient-to-r from-blue-500 to-cyan-500",
  text: "bg-gradient-to-r from-orange-400 via-orange-300 to-purple-400 bg-clip-text text-transparent",
  surface: "bg-gradient-to-b from-white/[0.07] to-white/[0.02]",
} as const;

export const radius = {
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-3xl",
  full: "rounded-full",
} as const;

export const shadows = {
  glowOrange: "shadow-[0_0_30px_rgba(255,120,0,0.35)]",
  glowPurple: "shadow-[0_0_60px_rgba(124,58,237,0.20)]",
  glowBlue: "shadow-[0_0_40px_rgba(59,130,246,0.25)]",
  card: "shadow-[0_10px_40px_-12px_rgba(0,0,0,0.6)]",
  soft: "shadow-lg shadow-black/20",
} as const;

export const typography = {
  hero: "text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight",
  h1: "text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight",
  h2: "text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight",
  h3: "text-xl sm:text-2xl font-bold",
  body: "text-base leading-relaxed text-zinc-300",
  muted: "text-sm text-zinc-400",
  eyebrow: "text-xs font-semibold uppercase tracking-[0.2em] text-orange-400",
} as const;

export const containerWidth = {
  narrow: "max-w-3xl",
  default: "max-w-7xl",
  wide: "max-w-[90rem]",
  full: "max-w-none",
} as const;

export const buttonSizes = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-5 py-2.5 text-sm",
  lg: "px-7 py-4 text-base",
} as const;

export const durations = {
  fast: "duration-150",
  base: "duration-300",
  slow: "duration-500",
} as const;

export const spacing = {
  section: "py-16 sm:py-20 lg:py-28",
  sectionTight: "py-10 sm:py-14",
  gutter: "px-4 sm:px-6 lg:px-8",
  stack: "space-y-6",
} as const;

/** Shared, accessible focus ring used by every interactive element. */
export const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

/** Canonical glass-morphism surface. */
export const glass = "border border-white/10 bg-white/5 backdrop-blur-xl";

export const tokens = {
  brandColors,
  gradients,
  radius,
  shadows,
  typography,
  containerWidth,
  buttonSizes,
  durations,
  spacing,
  focusRing,
  glass,
} as const;

export type DesignTokens = typeof tokens;

export default tokens;
