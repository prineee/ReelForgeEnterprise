"use client";

import { useEffect, useState } from "react";

interface Sale {
  id: string;
  commission_amount: number;
  created_at: string;
  status?: string;
  plan_name?: string;
  customer_email?: string;
}

export default function AffiliateSalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSales();
  }, []);

  async function loadSales() {
    try {
      const res = await fetch("/api/affiliate/sales");
      const data = await res.json();

      if (Array.isArray(data)) {
        setSales(data);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        Loading sales...
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Affiliate Sales
        </h1>

        <p className="mt-2 text-zinc-500">
          View your referrals and commission
          earnings.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full">
          <thead className="bg-zinc-50 border-b">
            <tr>
              <th className="p-4 text-left text-sm font-semibold">
                Date
              </th>

              <th className="p-4 text-left text-sm font-semibold">
                Plan
              </th>

              <th className="p-4 text-left text-sm font-semibold">
                Customer
              </th>

              <th className="p-4 text-left text-sm font-semibold">
                Commission
              </th>

              <th className="p-4 text-left text-sm font-semibold">
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {sales.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="p-8 text-center text-zinc-500"
                >
                  No affiliate sales found.
                </td>
              </tr>
            ) : (
              sales.map((sale) => (
                <tr
                  key={sale.id}
                  className="border-b"
                >
                  <td className="p-4">
                    {new Date(
                      sale.created_at
                    ).toLocaleString()}
                  </td>

                  <td className="p-4">
                    {sale.plan_name ??
                      "Subscription"}
                  </td>

                  <td className="p-4">
                    {sale.customer_email ??
                      "-"}
                  </td>

                  <td className="p-4 font-semibold">
                    ₹
                    {Number(
                      sale.commission_amount ?? 0
                    ).toFixed(2)}
                  </td>

                  <td className="p-4">
                    <span className="rounded-full bg-green-100 px-3 py-1 text-sm text-green-700">
                      {sale.status ??
                        "Completed"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}