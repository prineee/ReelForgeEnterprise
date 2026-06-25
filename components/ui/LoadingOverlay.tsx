import { cn } from "@/lib/utils";

export interface LoadingOverlayProps {
  /** When false the overlay renders nothing. Default: true. */
  show?: boolean;
  message?: string;
  /** Cover the whole viewport instead of the nearest positioned parent. */
  fullscreen?: boolean;
  className?: string;
}

/** Accessible blocking loader with the brand orange spinner. */
export function LoadingOverlay({
  show = true,
  message,
  fullscreen = false,
  className,
}: LoadingOverlayProps) {
  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "z-50 flex flex-col items-center justify-center gap-4 bg-black/70 backdrop-blur-md",
        fullscreen ? "fixed inset-0" : "absolute inset-0 rounded-[inherit]",
        className,
      )}
    >
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-white/15 border-t-orange-500" />
      {message && <p className="text-sm font-medium text-zinc-300">{message}</p>}
      <span className="sr-only">Loading</span>
    </div>
  );
}

export default LoadingOverlay;
