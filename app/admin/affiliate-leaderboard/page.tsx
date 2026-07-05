"use client";

import { useEffect, useState } from "react";

interface Affiliate {
  referral_code: string;
  earnings: number;
}

export default function AffiliateLeaderboardPage() {
  const [affiliates, setAffiliates] =
    useState<Affiliate[]>([]);

  const [loading, setLoading] =
    useState(true);

  async function loadLeaderboard() {
    try {
      const res = await fetch(
        "/api/admin/affiliate-leaderboard"
      );

      const data =
        await res.json();

      setAffiliates(data || []);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadLeaderboard();
  }, []);

  return (
    <div className="p-8">
      <h1 className="mb-8 text-4xl font-bold">
        Affiliate Leaderboard
      </h1>

      {loading ? (
        <p>Loading...</p>
      ) : affiliates.length === 0 ? (
        <p>No affiliates found.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full">
            <thead className="bg-zinc-900">
              <tr>
                <th className="p-4 text-left">
                  Rank
                </th>

                <th className="p-4 text-left">
                  Referral Code
                </th>

                <th className="p-4 text-left">
                  Earnings
                </th>
              </tr>
            </thead>

            <tbody>
              {affiliates.map(
                (a, index) => (
                  <tr
                    key={a.referral_code}
                    className="border-t border-zinc-800"
                  >
                    <td className="p-4">
                      #{index + 1}
                    </td>

                    <td className="p-4 font-mono">
                      {a.referral_code}
                    </td>

                    <td className="p-4 font-bold text-green-500">
                      ₹{a.earnings}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}