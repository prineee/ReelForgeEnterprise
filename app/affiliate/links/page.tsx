"use client";

import { useEffect, useState } from "react";

export default function AffiliateLinksPage() {
  const [link, setLink] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLink();
  }, []);

  async function loadLink() {
    try {
      const res = await fetch(
        "/api/affiliate/stats"
      );

      const data = await res.json();

      if (data.referralLink) {
        setLink(data.referralLink);
      }
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  }

  async function copyLink() {
    await navigator.clipboard.writeText(
      link
    );

    alert("Referral link copied.");
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-8">
        Affiliate Links
      </h1>

      {loading ? (
        <p>Loading...</p>
      ) : !link ? (
        <div>
          <p className="mb-6 text-zinc-400">
            You are not an affiliate yet.
          </p>

          <a
            href="/affiliate"
            className="rounded bg-purple-600 px-5 py-3 text-white"
          >
            Join Affiliate Program
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded border border-zinc-700 bg-zinc-900 p-4 break-all">
            {link}
          </div>

          <button
            onClick={copyLink}
            className="rounded bg-purple-600 px-5 py-3 text-white"
          >
            Copy Referral Link
          </button>
        </div>
      )}
    </div>
  );
}