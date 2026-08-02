"use client";

import PayPalButton from "@/components/payment/PayPalButton";
import { PLAN_BY_KEY } from "@/lib/plans";

const starter = PLAN_BY_KEY.starter;
const pro = PLAN_BY_KEY.pro;
const agency = PLAN_BY_KEY.agency;

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
            {starter.name}
          </h3>

          <div className="mt-6 text-5xl font-bold">
            ${starter.priceUSD}
          </div>

          <ul className="mt-8 space-y-3 text-gray-300">
            <li>✓ {starter.credits} Credits</li>
            <li>✓ AI Video Generator</li>
            <li>✓ Script Generator</li>
            <li>✓ Thumbnail Generator</li>
          </ul>

          <div className="mt-8">
            <PayPalButton
              plan={starter.key}
            />
          </div>
        </div>

        {/* Pro */}
        <div className="rounded-3xl border-2 border-purple-600 p-8 bg-zinc-900">
          <div className="text-sm text-purple-400 font-semibold">
            MOST POPULAR
          </div>

          <h3 className="text-2xl font-bold mt-2">
            {pro.name}
          </h3>

          <div className="mt-6 text-5xl font-bold">
            ${pro.priceUSD}
          </div>

          <ul className="mt-8 space-y-3 text-gray-300">
            <li>✓ {pro.credits} Credits</li>
            <li>✓ AI Movie Studio</li>
            <li>✓ Cartoon Studio</li>
            <li>✓ Marketing Studio</li>
          </ul>

          <div className="mt-8">
            <PayPalButton
              plan={pro.key}
            />
          </div>
        </div>

        {/* Agency */}
        <div className="rounded-3xl border p-8 bg-zinc-900">
          <h3 className="text-2xl font-bold">
            {agency.name}
          </h3>

          <div className="mt-6 text-5xl font-bold">
            ${agency.priceUSD}
          </div>

          <ul className="mt-8 space-y-3 text-gray-300">
            <li>✓ {agency.credits} Credits</li>
            <li>✓ Team Access</li>
            <li>✓ Priority Support</li>
            <li>✓ Commercial Rights</li>
          </ul>

          <div className="mt-8">
            <PayPalButton
              plan={agency.key}
            />
          </div>
        </div>
      </div>
    </section>
  );
}