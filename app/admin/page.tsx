"use client";

import { useEffect, useState } from "react";

interface AdminStats {
  totalUsers: number;
  totalMovies: number;
  publishJobs: number;
  estimatedMRR: number;
  paidUsers: number;
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setStats(data.stats);
        }
      })
      .catch(() => setError("Failed to load admin stats."));
  }, []);

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-6">
        Admin Dashboard
      </h1>

      {error ? (
        <div className="rounded-xl border border-white/10 p-6 bg-zinc-900 text-zinc-400 mb-6">
          {error}
        </div>
      ) : (
        <div className="grid md:grid-cols-4 gap-6 mb-10">
          <div className="rounded-xl border border-white/10 p-6 bg-zinc-900">
            <div className="text-zinc-400">Total Users</div>
            <div className="text-4xl font-bold mt-3">
              {stats ? stats.totalUsers : "—"}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 p-6 bg-zinc-900">
            <div className="text-zinc-400">Total Movies</div>
            <div className="text-4xl font-bold mt-3">
              {stats ? stats.totalMovies : "—"}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 p-6 bg-zinc-900">
            <div className="text-zinc-400">Paid Users</div>
            <div className="text-4xl font-bold mt-3">
              {stats ? stats.paidUsers : "—"}
            </div>
          </div>

          <div className="rounded-xl border border-white/10 p-6 bg-zinc-900">
            <div className="text-zinc-400">Estimated MRR</div>
            <div className="text-4xl font-bold mt-3">
              {stats ? `$${stats.estimatedMRR}` : "—"}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <a
          href="/admin/affiliate-payouts"
          className="rounded-xl border p-6 hover:bg-slate-900"
        >
          <h2 className="text-xl font-semibold">
            Affiliate Payouts
          </h2>
        </a>

        <a
          href="/admin/affiliate-leaderboard"
          className="rounded-xl border p-6 hover:bg-slate-900"
        >
          <h2 className="text-xl font-semibold">
            Affiliate Leaderboard
          </h2>
        </a>

        <a
          href="/admin/affiliate-analytics"
          className="rounded-xl border p-6 hover:bg-slate-900"
        >
          <h2 className="text-xl font-semibold">
            Affiliate Analytics
          </h2>
        </a>
      </div>
    </div>
  );
}