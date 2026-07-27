"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const EarningsChart = dynamic(() => import("@/components/affiliate/EarningsChart"), { ssr: false });

export default function AnalyticsPage() {
  const [stats, setStats] =
    useState<any>(null);

  const [chartData, setChartData] =
    useState<any[]>([]);

  const [referrals, setReferrals] =
    useState<any[]>([]);

  const [commissions, setCommissions] =
    useState<any[]>([]);

  useEffect(() => {
    fetch("/api/affiliate/dashboard")
      .then((r) => r.json())
      .then(setStats);

    fetch("/api/affiliate/chart-data")
      .then((r) => r.json())
      .then(setChartData);

    fetch("/api/affiliate/recent-referrals")
      .then((r) => r.json())
      .then(setReferrals);

    fetch("/api/affiliate/recent-commissions")
      .then((r) => r.json())
      .then(setCommissions);
  }, []);

  if (!stats) {
    return (
      <div className="p-8">
        Loading...
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="mb-8 text-4xl font-bold">
        Analytics
      </h1>

      {/* Statistics */}
      <div className="grid gap-6 md:grid-cols-4">
        <div className="rounded-xl border p-6">
          <h3 className="text-gray-500">
            Total Clicks
          </h3>

          <p className="text-3xl font-bold mt-2">
            {stats.totalClicks}
          </p>
        </div>

        <div className="rounded-xl border p-6">
          <h3 className="text-gray-500">
            Referrals
          </h3>

          <p className="text-3xl font-bold mt-2">
            {stats.totalReferrals}
          </p>
        </div>

        <div className="rounded-xl border p-6">
          <h3 className="text-gray-500">
            Sales
          </h3>

          <p className="text-3xl font-bold mt-2">
            ₹{stats.totalSales}
          </p>
        </div>

        <div className="rounded-xl border p-6">
          <h3 className="text-gray-500">
            Conversion
          </h3>

          <p className="text-3xl font-bold mt-2">
            {stats.conversionRate}%
          </p>
        </div>
      </div>

      {/* Earnings Chart */}
      <div className="mt-10">
        <EarningsChart
          data={chartData}
        />
      </div>

      {/* Recent Referrals */}
      <div className="mt-10 rounded-xl border p-6">
        <h2 className="text-2xl font-bold mb-6">
          Recent Referrals
        </h2>

        {referrals.length === 0 ? (
          <p className="text-gray-500">
            No referrals yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="py-3 text-left">
                    User ID
                  </th>

                  <th className="py-3 text-left">
                    Date
                  </th>
                </tr>
              </thead>

              <tbody>
                {referrals.map((r) => (
                  <tr
                    key={r.user_id}
                    className="border-b"
                  >
                    <td className="py-4">
                      {r.user_id}
                    </td>

                    <td className="py-4">
                      {new Date(
                        r.created_at
                      ).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent Commissions */}
      <div className="mt-10 rounded-xl border p-6">
        <h2 className="text-2xl font-bold mb-6">
          Recent Commissions
        </h2>

        {commissions.length === 0 ? (
          <p className="text-gray-500">
            No commissions yet.
          </p>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="py-3 text-left">
                  Amount
                </th>

                <th className="text-left">
                  Status
                </th>

                <th className="text-left">
                  Date
                </th>
              </tr>
            </thead>

            <tbody>
              {commissions.map((c) => (
                <tr
                  key={c.id}
                  className="border-b"
                >
                  <td className="py-4">
                    ₹{c.amount}
                  </td>

                  <td>
                    {c.status}
                  </td>

                  <td>
                    {new Date(
                      c.created_at
                    ).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}