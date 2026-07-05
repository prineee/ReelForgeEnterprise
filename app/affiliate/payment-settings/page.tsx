"use client";

import { useEffect, useState } from "react";

export default function PaymentSettingsPage() {
  const [form, setForm] = useState<any>({
    payout_method: "upi",
    paypal_email: "",
    payoneer_email: "",
    wise_email: "",
    upi_id: "",
    bank_name: "",
    account_holder: "",
    account_number: "",
    ifsc_code: "",
  });

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const res = await fetch(
      "/api/affiliate/payment-settings"
    );

    const data = await res.json();

    setForm((prev: any) => ({
      ...prev,
      ...data,
    }));
  }

  function update(
    key: string,
    value: string
  ) {
    setForm((prev: any) => ({
      ...prev,
      [key]: value,
    }));
  }

  async function save() {
    const res = await fetch(
      "/api/affiliate/payment-settings",
      {
        method: "POST",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify(form),
      }
    );

    const data = await res.json();

    if (data.error) {
      alert(data.error);
      return;
    }

    alert("Saved successfully.");
  }

  return (
    <div className="max-w-4xl p-8">
      <h1 className="text-4xl font-bold mb-8">
        Payment Settings
      </h1>

      <div className="space-y-6">

        <div>
          <label>Payout Method</label>

          <select
            className="w-full border p-3 rounded text-black"
            value={form.payout_method}
            onChange={(e) =>
              update(
                "payout_method",
                e.target.value
              )
            }
          >
            <option value="upi">
              UPI
            </option>

            <option value="paypal">
              PayPal
            </option>

            <option value="payoneer">
              Payoneer
            </option>

            <option value="wise">
              Wise
            </option>

            <option value="bank">
              Bank Transfer
            </option>
          </select>
        </div>

        <div>
          <label>UPI ID</label>

          <input
            className="w-full border p-3 rounded text-black"
            value={form.upi_id}
            onChange={(e) =>
              update(
                "upi_id",
                e.target.value
              )
            }
          />
        </div>

        <div>
          <label>PayPal Email</label>

          <input
            className="w-full border p-3 rounded text-black"
            value={form.paypal_email}
            onChange={(e) =>
              update(
                "paypal_email",
                e.target.value
              )
            }
          />
        </div>

        <div>
          <label>Payoneer Email</label>

          <input
            className="w-full border p-3 rounded text-black"
            value={
              form.payoneer_email
            }
            onChange={(e) =>
              update(
                "payoneer_email",
                e.target.value
              )
            }
          />
        </div>

        <div>
          <label>Wise Email</label>

          <input
            className="w-full border p-3 rounded text-black"
            value={form.wise_email}
            onChange={(e) =>
              update(
                "wise_email",
                e.target.value
              )
            }
          />
        </div>

        <div>
          <label>Bank Name</label>

          <input
            className="w-full border p-3 rounded text-black"
            value={form.bank_name}
            onChange={(e) =>
              update(
                "bank_name",
                e.target.value
              )
            }
          />
        </div>

        <div>
          <label>Account Holder</label>

          <input
            className="w-full border p-3 rounded text-black"
            value={
              form.account_holder
            }
            onChange={(e) =>
              update(
                "account_holder",
                e.target.value
              )
            }
          />
        </div>

        <div>
          <label>Account Number</label>

          <input
            className="w-full border p-3 rounded text-black"
            value={
              form.account_number
            }
            onChange={(e) =>
              update(
                "account_number",
                e.target.value
              )
            }
          />
        </div>

        <div>
          <label>IFSC Code</label>

          <input
            className="w-full border p-3 rounded text-black"
            value={form.ifsc_code}
            onChange={(e) =>
              update(
                "ifsc_code",
                e.target.value
              )
            }
          />
        </div>

        <button
          onClick={save}
          className="bg-purple-600 px-6 py-3 rounded"
        >
          Save Settings
        </button>
      </div>
    </div>
  );
}