"use client";

import { useEffect, useState } from "react";

export default function AffiliateAnalyticsPage() {
  const [data, setData] =
    useState<any>(null);

  useEffect(() => {
    fetch(
      "/api/admin/affiliate-analytics"
    )
      .then((r) => r.json())
      .then(setData);
  }, []);

  if (!data) {
    return (
      <div className="p-10 text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="p-10 text-white">

      <h1 className="text-4xl font-bold mb-10">
        Affiliate Analytics
      </h1>

      <div className="grid md:grid-cols-4 gap-6">

        <div className="rounded-xl border border-white/10 p-6 bg-zinc-900">
          <div className="text-zinc-400">
            Total Clicks
          </div>

          <div className="text-4xl font-bold mt-3">
            {data.totalClicks}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 p-6 bg-zinc-900">
          <div className="text-zinc-400">
            Total Referrals
          </div>

          <div className="text-4xl font-bold mt-3">
            {data.totalReferrals}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 p-6 bg-zinc-900">
          <div className="text-zinc-400">
            Total Commissions
          </div>

          <div className="text-4xl font-bold mt-3">
            ₹{data.totalCommissions}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 p-6 bg-zinc-900">
          <div className="text-zinc-400">
            Total Paid
          </div>

          <div className="text-4xl font-bold mt-3">
            ₹{data.totalPayouts}
          </div>
        </div>

      </div>

      <div className="mt-12 rounded-xl border border-white/10 p-8 bg-zinc-900">

        <h2 className="text-2xl font-bold mb-6">
          Affiliate Statistics
        </h2>

        <table className="w-full">

          <thead>
            <tr className="text-left border-b border-white/10">
              <th className="pb-4">
                Affiliate ID
              </th>

              <th>
                Clicks
              </th>

              <th>
                Referrals
              </th>

              <th>
                Earnings
              </th>
            </tr>
          </thead>

          <tbody>
            {data.stats.map(
              (s: any) => (
                <tr
                  key={
                    s.affiliate_id
                  }
                  className="border-b border-white/5"
                >
                  <td className="py-4">
                    {s.affiliate_id}
                  </td>

                  <td>
                    {s.total_clicks}
                  </td>

                  <td>
                    {s.total_referrals}
                  </td>

                  <td>
                    ₹
                    {s.total_earnings}
                  </td>
                </tr>
              )
            )}
          </tbody>

        </table>

      </div>
    </div>
  );
}