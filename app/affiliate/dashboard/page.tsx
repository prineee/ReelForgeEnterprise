"use client";

import { useEffect, useState } from "react";

interface DashboardStats {
  totalClicks: number;
  totalReferrals: number;
  totalSales: number;
  totalEarnings: number;
  pendingPayout: number;
  paidPayout: number;
  conversionRate: number;
}

export default function AffiliateDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const res = await fetch("/api/affiliate/dashboard");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function requestPayout() {
    try {
      const res = await fetch(
        "/api/affiliate/request-payout",
        {
          method: "POST",
        }
      );

      const data = await res.json();

      if (data.error) {
        alert(data.error);
        return;
      }

      alert("Payout request submitted.");

      loadDashboard();
    } catch (err) {
      console.error(err);
      alert("Failed to request payout.");
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        Loading Dashboard...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8">
        Failed to load dashboard.
      </div>
    );
  }

  const cards = [
    {
      title: "Total Clicks",
      value: stats.totalClicks,
    },
    {
      title: "Referrals",
      value: stats.totalReferrals,
    },
    {
      title: "Sales",
      value: stats.totalSales,
    },
    {
      title: "Earnings",
      value: `₹${stats.totalEarnings}`,
    },
    {
      title: "Pending Payout",
      value: `₹${stats.pendingPayout}`,
    },
    {
      title: "Paid Payout",
      value: `₹${stats.paidPayout}`,
    },
    {
      title: "Conversion Rate",
      value: `${stats.conversionRate}%`,
    },
  ];

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-8">
        Affiliate Dashboard
      </h1>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className="rounded-xl border bg-white p-6 shadow"
          >
            <p className="text-gray-500 text-sm">
              {card.title}
            </p>

            <h2 className="text-3xl font-bold mt-2">
              {card.value}
            </h2>
          </div>
        ))}
      </div>

      <div className="mt-10">
        <button
          onClick={requestPayout}
          className="rounded-lg bg-black px-6 py-3 text-white"
        >
          Request Payout
        </button>
      </div>
    </div>
  );
}