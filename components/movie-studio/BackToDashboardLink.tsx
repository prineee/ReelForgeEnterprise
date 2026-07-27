import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/**
 * app/movie-studio/** intentionally renders outside app/(dashboard)'s
 * DashboardShell (full-bleed editor, see WorkspaceShell.tsx) so none of
 * these pages have the main app sidebar. This is the one consistent way
 * back to the rest of the app from that tree's hub/list pages.
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
