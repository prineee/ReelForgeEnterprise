"use client";

import {
  useEffect,
  useState,
} from "react";

interface Commission {
  id: string;
  amount: number;
  status: string;
  created_at: string;
}

export default function CommissionsPage() {
  const [
    commissions,
    setCommissions,
  ] = useState<
    Commission[]
  >([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const res =
      await fetch(
        "/api/affiliate/commissions"
      );

    const data =
      await res.json();

    setCommissions(
      data.commissions || []
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold mb-8">
        Commission History
      </h1>

      <div className="space-y-4">
        {commissions.map(
          (c) => (
            <div
              key={c.id}
              className="rounded-xl border p-6"
            >
              <div>
                Amount:
                {" "}
                ₹
                {c.amount}
              </div>

              <div>
                Status:
                {" "}
                {c.status}
              </div>

              <div>
                Date:
                {" "}
                {new Date(
                  c.created_at
                ).toLocaleString()}
              </div>
            </div>
          )
        )}

        {commissions.length ===
          0 && (
          <div>
            No commissions yet.
          </div>
        )}
      </div>
    </div>
  );
}