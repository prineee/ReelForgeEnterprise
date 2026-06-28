"use client";

import { useEffect, useState } from "react";

export default function PaymentSettingsPage() {
  const [form, setForm] = useState({
    payout_method: "",
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
    loadData();
  }, []);

  async function loadData() {
    try {
      const res = await fetch(
        "/api/affiliate/payment-settings"
      );

      if (!res.ok) return;

      const data = await res.json();

      if (data) {
        setForm((prev) => ({
          ...prev,
          ...data,
        }));
      }
    } catch (error) {
      console.error(error);
    }
  }

  async function save() {
    const res = await fetch(
      "/api/affiliate/payment-settings",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      }
    );

    if (res.ok) {
      alert("Payment settings saved successfully.");
    } else {
      alert("Failed to save payment settings.");
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">
        Payment Settings
      </h1>

      <select
        className="w-full p-3 rounded bg-zinc-900 mb-4"
        value={form.payout_method}
        onChange={(e) =>
          setForm({
            ...form,
            payout_method: e.target.value,
          })
        }
      >
        <option value="">Select Method</option>
        <option value="paypal">PayPal</option>
        <option value="payoneer">Payoneer</option>
        <option value="wise">Wise</option>
        <option value="upi">UPI</option>
        <option value="bank">Bank Transfer</option>
      </select>

      {form.payout_method === "paypal" && (
        <input
          className="w-full p-3 rounded bg-zinc-900 mb-4"
          placeholder="PayPal Email"
          value={form.paypal_email}
          onChange={(e) =>
            setForm({
              ...form,
              paypal_email: e.target.value,
            })
          }
        />
      )}

      {form.payout_method === "payoneer" && (
        <input
          className="w-full p-3 rounded bg-zinc-900 mb-4"
          placeholder="Payoneer Email"
          value={form.payoneer_email}
          onChange={(e) =>
            setForm({
              ...form,
              payoneer_email: e.target.value,
            })
          }
        />
      )}

      {form.payout_method === "wise" && (
        <input
          className="w-full p-3 rounded bg-zinc-900 mb-4"
          placeholder="Wise Email"
          value={form.wise_email}
          onChange={(e) =>
            setForm({
              ...form,
              wise_email: e.target.value,
            })
          }
        />
      )}

      {form.payout_method === "upi" && (
        <input
          className="w-full p-3 rounded bg-zinc-900 mb-4"
          placeholder="UPI ID"
          value={form.upi_id}
          onChange={(e) =>
            setForm({
              ...form,
              upi_id: e.target.value,
            })
          }
        />
      )}

      {form.payout_method === "bank" && (
        <>
          <input
            className="w-full p-3 rounded bg-zinc-900 mb-4"
            placeholder="Account Holder"
            value={form.account_holder}
            onChange={(e) =>
              setForm({
                ...form,
                account_holder: e.target.value,
              })
            }
          />

          <input
            className="w-full p-3 rounded bg-zinc-900 mb-4"
            placeholder="Bank Name"
            value={form.bank_name}
            onChange={(e) =>
              setForm({
                ...form,
                bank_name: e.target.value,
              })
            }
          />

          <input
            className="w-full p-3 rounded bg-zinc-900 mb-4"
            placeholder="Account Number"
            value={form.account_number}
            onChange={(e) =>
              setForm({
                ...form,
                account_number: e.target.value,
              })
            }
          />

          <input
            className="w-full p-3 rounded bg-zinc-900 mb-4"
            placeholder="IFSC Code"
            value={form.ifsc_code}
            onChange={(e) =>
              setForm({
                ...form,
                ifsc_code: e.target.value,
              })
            }
          />
        </>
      )}

      <button
        onClick={save}
        className="bg-purple-600 px-6 py-3 rounded text-white"
      >
        Save Settings
      </button>
    </div>
  );
}