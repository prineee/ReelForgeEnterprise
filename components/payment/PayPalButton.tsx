"use client";

interface Props {
  plan: string;
}

/**
 * PayPal checkout is disabled server-side (Sprint 16, Task 5.6 — the old
 * create-order/capture-order routes granted credits with no verification
 * against PayPal's Orders API, a free-credits exploit). Both routes now
 * return 503 unconditionally. Rendering the live PayPal SDK button here
 * would let a user click through into a checkout flow that can never
 * succeed; this notice replaces it until a real PayPal Orders API
 * create+capture flow (PAYPAL_CLIENT_SECRET, server-side status
 * verification) is implemented — see api/payment/paypal/create-order's
 * header for exactly what remains.
 */
export default function PayPalButton({ plan: _plan }: Props) {
  return (
    <div className="w-full rounded-lg border border-surface-border bg-surface px-4 py-3 text-center text-sm text-gray-400">
      PayPal is temporarily unavailable. Please use Stripe or Razorpay above.
    </div>
  );
}