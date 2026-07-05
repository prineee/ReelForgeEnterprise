"use client";

import { useEffect, useState } from "react";

interface Sale {
  id: string;
  customer_email: string;
  plan_name: string;
  sale_amount: number;
  commission_amount: number;
  currency: string;
  status: string;
  created_at: string;
}

export default function AffiliateSalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSales();
  }, []);

  async function loadSales() {
    try {
      const res = await fetch(
        "/api/affiliate/sales"
      );

      const data = await res.json();

      setSales(data.sales || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        Loading sales...
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-8">
        Affiliate Sales
      </h1>

      {sales.length === 0 ? (
        <div className="text-zinc-400">
          No sales yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-800">
          <table className="w-full">
            <thead className="bg-zinc-900">
              <tr>
                <th className="p-4 text-left">
                  Customer
                </th>

                <th className="p-4 text-left">
                  Plan
                </th>

                <th className="p-4 text-left">
                  Sale
                </th>

                <th className="p-4 text-left">
                  Commission
                </th>

                <th className="p-4 text-left">
                  Status
                </th>

                <th className="p-4 text-left">
                  Date
                </th>
              </tr>
            </thead>

            <tbody>
              {sales.map((sale) => (
                <tr
                  key={sale.id}
                  className="border-t border-zinc-800"
                >
                  <td className="p-4">
                    {sale.customer_email}
                  </td>

                  <td className="p-4 capitalize">
                    {sale.plan_name}
                  </td>

                  <td className="p-4">
                    ₹{sale.sale_amount}
                  </td>

                  <td className="p-4 text-green-400 font-bold">
                    ₹{sale.commission_amount}
                  </td>

                  <td className="p-4 capitalize">
                    {sale.status}
                  </td>

                  <td className="p-4">
                    {new Date(
                      sale.created_at
                    ).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}