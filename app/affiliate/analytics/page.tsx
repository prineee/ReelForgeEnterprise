"use client";

import { useEffect, useState } from "react";

export default function AnalyticsPage() {
  const [stats, setStats] =
    useState<any>(null);

  useEffect(() => {
    fetch(
      "/api/affiliate/dashboard"
    )
      .then((r) => r.json())
      .then(setStats);
  }, []);

  if (!stats) {
    return <p>Loading...</p>;
  }

  return (
    <div className="p-8">
      <h1 className="mb-8 text-4xl font-bold">
        Analytics
      </h1>

      <div className="grid gap-6 md:grid-cols-4">
        <div className="rounded-xl border p-6">
          <h3>Total Clicks</h3>
          <p className="text-3xl font-bold">
            {stats.totalClicks}
          </p>
        </div>

        <div className="rounded-xl border p-6">
          <h3>Referrals</h3>
          <p className="text-3xl font-bold">
            {stats.totalReferrals}
          </p>
        </div>

        <div className="rounded-xl border p-6">
          <h3>Sales</h3>
          <p className="text-3xl font-bold">
            {stats.totalSales}
          </p>
        </div>

        <div className="rounded-xl border p-6">
          <h3>Conversion</h3>
          <p className="text-3xl font-bold">
            {stats.conversionRate}%
          </p>
        </div>
      </div>
    </div>
  );
}