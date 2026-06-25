'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X, Zap, Check, Loader2, CreditCard, Wallet } from 'lucide-react'
import { PLANS, type Plan } from '@/lib/plans'

interface Props {
  isOpen: boolean
  onClose: () => void
  /** If provided, shown as context (e.g. "Thumbnail generation costs 1 credit") */
  reason?: string
  creditsRemaining?: number
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any
  }
}

async function loadRazorpayScript() {
  if (window.Razorpay) return
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Failed to load Razorpay script'))
    document.head.appendChild(s)
  })
}

export default function UpgradeModal({ isOpen, onClose, reason, creditsRemaining }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null) // '<planKey>-rzp' | '<planKey>-stripe'
  const [error, setError] = useState<string | null>(null)

  const handleRazorpay = useCallback(async (plan: Plan) => {
    const key = `${plan.key}-rzp`
    setLoading(key)
    setError(null)
    try {
      await loadRazorpayScript()

      const res = await fetch('/api/payment/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.key }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Order creation failed')
      const order = await res.json()

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: 'AI ReelForge',
          description: `${order.planName} Plan`,
          order_id: order.orderId,
          prefill: { email: order.userEmail },
          theme: { color: '#6366f1' },
          modal: { ondismiss: () => reject(new Error('dismissed')) },
          handler: async (response: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
            const vRes = await fetch('/api/payment/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response),
            })
            if (!vRes.ok) reject(new Error((await vRes.json()).error ?? 'Verification failed'))
            else resolve()
          },
        })
        rzp.open()
      })

      router.refresh()
      onClose()
    } catch (err) {
      if (err instanceof Error && err.message !== 'dismissed') {
        setError(err.message)
      }
    } finally {
      setLoading(null)
    }
  }, [router, onClose])

  const handleStripe = useCallback(async (plan: Plan) => {
    const key = `${plan.key}-stripe`
    setLoading(key)
    setError(null)
    try {
      const res = await fetch('/api/payment/stripe/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.key }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Session creation failed')
      const { url } = await res.json()
      window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed')
      setLoading(null)
    }
  }, [])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-3xl bg-[#0f1117] border border-surface-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-surface-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-950 border border-brand-800 flex items-center justify-center">
              <Zap className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Upgrade Your Plan</h2>
              {reason && <p className="text-sm text-gray-400 mt-0.5">{reason}</p>}
              {typeof creditsRemaining === 'number' && (
                <p className="text-xs text-amber-400 mt-0.5">
                  You have {creditsRemaining} credit{creditsRemaining !== 1 ? 's' : ''} remaining
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Plans */}
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLANS.map(plan => {
            const isRzpLoading    = loading === `${plan.key}-rzp`
            const isStripeLoading = loading === `${plan.key}-stripe`
            const anyLoading      = !!loading

            return (
              <div
                key={plan.key}
                className={`flex flex-col rounded-xl border p-5 ${
                  plan.highlight
                    ? 'border-brand-600 ring-1 ring-brand-600'
                    : 'border-surface-border'
                }`}
              >
                {plan.highlight && (
                  <span className="self-start text-xs font-semibold bg-brand-600 text-white px-2 py-0.5 rounded-full mb-3">
                    Most Popular
                  </span>
                )}

                <p className="font-semibold text-base">{plan.name}</p>

                <div className="flex items-baseline gap-1 mt-1 mb-4">
                  <span className="text-xl font-extrabold">₹{plan.priceINR}</span>
                  <span className="text-gray-500 text-xs">/ ${plan.priceUSD} · /mo</span>
                </div>

                <ul className="space-y-1.5 mb-5 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-1.5 text-xs text-gray-300">
                      <Check className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>

                {/* Razorpay — INR */}
                <button
                  onClick={() => handleRazorpay(plan)}
                  disabled={anyLoading}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-2"
                >
                  {isRzpLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wallet className="w-3.5 h-3.5" />
                  )}
                  Pay ₹{plan.priceINR}
                </button>

                {/* Stripe — USD */}
                <button
                  onClick={() => handleStripe(plan)}
                  disabled={anyLoading}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium bg-surface border border-surface-border hover:border-brand-700 text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isStripeLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CreditCard className="w-3.5 h-3.5" />
                  )}
                  Pay ${plan.priceUSD} USD
                </button>
              </div>
            )
          })}
        </div>

        {error && (
          <p className="text-center text-sm text-red-400 px-6 pb-4">{error}</p>
        )}

        <p className="text-center text-xs text-gray-600 pb-5">
          Secured by Razorpay · Stripe · Cancel anytime
        </p>
      </div>
    </div>
  )
}
