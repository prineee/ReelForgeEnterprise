"use client";

import { useEffect, useState } from "react";

interface Payout {
  id: string;
  amount: number;
  status: string;
  transaction_id?: string;
}

export default function AffiliatePayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);

  useEffect(() => {
    loadPayouts();
  }, []);

  async function loadPayouts() {
  try {
    const res = await fetch(
      "/api/admin/affiliate-payouts"
    );

    const data =
      await res.json();

    setPayouts(data || []);
  } catch (err) {
    console.error(err);
  }
}

  async function markPaid(id: string) {
    const transactionId = prompt(
      "Enter Transaction ID"
    );

    if (!transactionId) return;

    await fetch(
      "/api/admin/affiliate-payouts/pay",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          payoutId: id,
          transactionId,
        }),
      }
    );

    loadPayouts();
  }

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-8">
        Affiliate Payouts
      </h1>

      {payouts.length === 0 ? (
        <div>No payout requests.</div>
      ) : (
        <div className="space-y-4">
          {payouts.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border p-6"
            >
              <div>
                Amount: ₹{p.amount}
              </div>

              <div>
                Status: {p.status}
              </div>

              {p.transaction_id && (
                <div>
                  Transaction:
                  {" "}
                  {p.transaction_id}
                </div>
              )}

              {p.status !== "paid" && (
                <button
                  onClick={() =>
                    markPaid(p.id)
                  }
                  className="mt-4 rounded bg-green-600 px-4 py-2 text-white"
                >
                  Mark Paid
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}