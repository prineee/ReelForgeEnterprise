"use client";

export default function AffiliatePage() {
  async function handleJoin() {
    const res = await fetch("/api/affiliate/join", {
      method: "POST",
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error);
      return;
    }

    alert(`Your referral link:\n${data.referralLink}`);
  }

  return (
    <div className="p-6">
      <h1 className="text-4xl font-bold">
        ReelForge Affiliate Program
      </h1>

      <button
        onClick={handleJoin}
        className="mt-6 rounded bg-purple-600 px-6 py-3 text-white"
      >
        Join Affiliate Program
      </button>
    </div>
  );
}