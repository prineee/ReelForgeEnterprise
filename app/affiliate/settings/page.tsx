"use client";

import { useEffect, useState } from "react";

export default function AffiliateSettingsPage() {
  const [affiliate, setAffiliate] =
    useState<any>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const res = await fetch(
      "/api/affiliate/stats"
    );

    const data = await res.json();

    setAffiliate(data);
  }

  if (!affiliate) {
    return (
      <div className="p-8">
        Loading...
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">
        Affiliate Settings
      </h1>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 space-y-6">
        <div>
          <p className="text-zinc-400 text-sm">
            Referral Code
          </p>

          <p className="text-xl font-bold">
            {affiliate.referralCode}
          </p>
        </div>

        <div>
          <p className="text-zinc-400 text-sm">
            Referral Link
          </p>

          <input
            value={
              affiliate.referralLink
            }
            readOnly
            className="mt-2 w-full rounded-lg bg-black border border-zinc-700 p-3"
          />
        </div>

        <div>
          <p className="text-zinc-400 text-sm">
            Total Earnings
          </p>

          <p className="text-3xl font-bold text-green-400">
            ₹{affiliate.earnings}
          </p>
        </div>

        <div>
          <p className="text-zinc-400 text-sm">
            Total Referrals
          </p>

          <p className="text-2xl font-bold">
            {affiliate.referrals}
          </p>
        </div>
      </div>
    </div>
  );
}