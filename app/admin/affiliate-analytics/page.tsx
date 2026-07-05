"use client";

import {
  useEffect,
  useState,
} from "react";

export default function AffiliateAnalyticsPage() {
  const [stats, setStats] =
    useState<any[]>([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res = await fetch(
      "/api/admin/affiliate-analytics"
    );

    const data =
      await res.json();

    setStats(
      data.stats || []
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-8">
        Affiliate Analytics
      </h1>

      <div className="grid gap-6">
        {stats.map((s) => (
          <div
            key={
              s.affiliate_id
            }
            className="rounded-xl border p-6"
          >
            <div>
              Referral Code:
              {" "}
              {
                s.affiliates
                  ?.referral_code
              }
            </div>

            <div>
              Clicks:
              {" "}
              {s.total_clicks}
            </div>

            <div>
              Referrals:
              {" "}
              {s.total_referrals}
            </div>

            <div>
              Earnings:
              {" "}
              ₹
              {
                s.total_earnings
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}