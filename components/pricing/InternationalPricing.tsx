"use client";

import PayPalButton from "@/components/payment/PayPalButton";

export default function InternationalPricing() {
  return (
    <section className="py-20">
      <h2 className="text-4xl font-bold text-center mb-12">
        🌍 International Pricing
      </h2>

      <div className="grid gap-8 md:grid-cols-3">

        {/* Starter */}
        <div className="rounded-3xl border p-8 bg-zinc-900">
          <h3 className="text-2xl font-bold">
            Starter
          </h3>

          <div className="mt-6 text-5xl font-bold">
            $6
          </div>

          <ul className="mt-8 space-y-3 text-gray-300">
            <li>✓ 100 Credits</li>
            <li>✓ AI Video Generator</li>
            <li>✓ Script Generator</li>
            <li>✓ Thumbnail Generator</li>
          </ul>

          <div className="mt-8">
            <PayPalButton
              amount="6"
              plan="starter"
            />
          </div>
        </div>

        {/* Pro */}
        <div className="rounded-3xl border-2 border-purple-600 p-8 bg-zinc-900">
          <div className="text-sm text-purple-400 font-semibold">
            MOST POPULAR
          </div>

          <h3 className="text-2xl font-bold mt-2">
            Pro
          </h3>

          <div className="mt-6 text-5xl font-bold">
            $18
          </div>

          <ul className="mt-8 space-y-3 text-gray-300">
            <li>✓ 500 Credits</li>
            <li>✓ AI Movie Studio</li>
            <li>✓ Cartoon Studio</li>
            <li>✓ Marketing Studio</li>
          </ul>

          <div className="mt-8">
            <PayPalButton
              amount="18"
              plan="pro"
            />
          </div>
        </div>

        {/* Agency */}
        <div className="rounded-3xl border p-8 bg-zinc-900">
          <h3 className="text-2xl font-bold">
            Agency
          </h3>

          <div className="mt-6 text-5xl font-bold">
            $60
          </div>

          <ul className="mt-8 space-y-3 text-gray-300">
            <li>✓ Unlimited Projects</li>
            <li>✓ Team Access</li>
            <li>✓ Priority Support</li>
            <li>✓ Commercial Rights</li>
          </ul>

          <div className="mt-8">
            <PayPalButton
              amount="60"
              plan="agency"
            />
          </div>
        </div>
      </div>
    </section>
  );
}