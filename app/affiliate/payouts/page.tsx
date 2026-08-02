"use client";

import { useEffect, useState } from "react";

interface Payout {
  id: string;
  amount: number;
  status: string;
  created_at?: string;
}

export default function AffiliatePayoutsPage() {
  const [payouts, setPayouts] =
    useState<Payout[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [requesting, setRequesting] =
    useState(false);

  async function loadPayouts() {
    try {
      const res = await fetch(
        "/api/affiliate/payout"
      );

      const data =
        await res.json();

      setPayouts(data || []);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  }

  async function requestPayout() {
    setRequesting(true);

    try {
      const res = await fetch(
        "/api/affiliate/request-payout",
        {
          method: "POST",
        }
      );

      const data =
        await res.json();

      if (!res.ok) {
        alert(
          data.error ||
            "Request failed"
        );
      } else {
        alert(
          "Payout request submitted."
        );

        loadPayouts();
      }
    } catch {
      alert(
        "Something went wrong."
      );
    }

    setRequesting(false);
  }

  useEffect(() => {
    loadPayouts();
  }, []);

  return (
    <div className="p-6">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-4xl font-bold">
          Affiliate Payouts
        </h1>

 <button

  onClick={() => {

    requestPayout();

  }}

  disabled={requesting}

  className="rounded-lg bg-purple-600 px-5 py-3 text-white"

>

  {requesting

    ? "Requesting..."

    : "Request Payout"}

</button>      </div>

      {loading ? (
        <p>Loading...</p>
      ) : payouts.length === 0 ? (
        <p className="text-zinc-400">
          No payout requests yet.
        </p>
      ) : (
        <table className="w-full">
          <thead>
            <tr>
              <th className="py-3 text-left">
                Amount
              </th>

              <th className="py-3 text-left">
                Status
              </th>

              <th className="py-3 text-left">
                Date
              </th>
            </tr>
          </thead>

          <tbody>
            {payouts.map(
              (payout) => (
                <tr
                  key={payout.id}
                >
                  <td className="py-3">
                    ₹{payout.amount}
                  </td>

                  <td className="py-3">
                    {payout.status}
                  </td>

                  <td className="py-3">
                    {payout.created_at
                      ? new Date(
                          payout.created_at
                        ).toLocaleString()
                      : "-"}
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}