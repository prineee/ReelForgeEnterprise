import type { ReactNode } from "react";
import Link from "next/link";
import { Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { gradients } from "@/components/ui";

export interface AuthLayoutProps {
  children: ReactNode;
}

/**
 * Minimal authentication shell: a clean logo-only nav, a centered container
 * for the auth form, and no marketing footer. Sits on the global dark background.
 */
export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <Link href="/" className="inline-flex items-center gap-2">
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg text-white",
              gradients.primary,
            )}
          >
            <Video className="h-4 w-4" />
          </span>
          <span className="text-lg font-black tracking-tight text-white">ReelForge</span>
        </Link>
        <Link
          href="/"
          className="text-sm text-zinc-400 outline-none transition-colors hover:text-white focus-visible:ring-2 focus-visible:ring-orange-500/60"
        >
          ← Back to site
        </Link>
      </header>

      {/* Centered authentication container (page controls its own width). */}
      <main className="flex flex-1 items-center justify-center px-4 py-10">{children}</main>
    </div>
  );
}

export default AuthLayout;
