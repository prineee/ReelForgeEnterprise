"use client";

import Link from "next/link";

export default function AdminSidebar() {
  return (
    <div className="w-64 min-h-screen border-r border-slate-800 bg-slate-950 p-6">
      <h2 className="text-2xl font-bold mb-8 text-white">
        Admin Panel
      </h2>

      <nav className="space-y-4">
        <Link
          href="/admin"
          className="block text-gray-300 hover:text-white"
        >
          Dashboard
        </Link>

        <Link
          href="/admin/users"
          className="block text-gray-300 hover:text-white"
        >
          Users
        </Link>

        <Link
          href="/admin/affiliate-payouts"
          className="block text-gray-300 hover:text-white"
        >
          Affiliate Payouts
        </Link>

        <Link
          href="/admin/affiliate-leaderboard"
          className="block text-gray-300 hover:text-white"
        >
          Affiliate Leaderboard
        </Link>
        <Link href="/affiliate/commissions">
  Commission History
</Link>

        <Link
          href="/admin/affiliate-analytics"
          className="block text-gray-300 hover:text-white"
        >
          Affiliate Analytics
        </Link>
      </nav>
    </div>
  );
}