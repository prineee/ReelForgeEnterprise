"use client";

import Link from "next/link";

export default function AdminSidebar() {
  return (
    <div className="w-64 min-h-screen border-r border-slate-800 p-6">
      <h2 className="text-2xl font-bold mb-8">
        Admin Panel
      </h2>

      <nav className="space-y-4">
        <Link
          href="/admin/stats"
          className="block hover:text-purple-400"
        >
          Dashboard
        </Link>

        <Link
          href="/admin/users"
          className="block hover:text-purple-400"
        >
          Users
        </Link>

        <Link
          href="/admin/affiliate-payouts"
          className="block hover:text-purple-400"
        >
          Affiliate Payouts
        </Link>

        <Link
          href="/admin/affiliate-leaderboard"
          className="block hover:text-purple-400"
        >
          Affiliate Leaderboard
        </Link>

        <Link
          href="/admin/affiliate-analytics"
          className="block hover:text-purple-400"
        >
          Affiliate Analytics
        </Link>
      </nav>
    </div>
  );
}