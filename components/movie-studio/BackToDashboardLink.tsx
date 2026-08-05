import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * app/movie-studio/** now renders inside app/(dashboard)'s DashboardShell
 * (see app/movie-studio/layout.tsx), so the main app sidebar is present.
 * This link remains as a direct shortcut back to /dashboard from that
 * tree's hub/list pages.
 */
export function BackToDashboardLink() {
  return (
    <Link
      href="/dashboard"
      className="inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to Dashboard
    </Link>
  );
}

export default BackToDashboardLink;
