'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CreditCard, Wallet, CheckCircle2, AlertCircle } from 'lucide-react'
import { PLANS, type Plan, type DbPlan } from '@/lib/plans'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any
  }
}

interface Props {
  currentPlan: DbPlan
  userEmail:   string
}

async function loadRazorpayScript() {
  if (window.Razorpay) return
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload  = () => resolve()
    s.onerror = () => reject(new Error('Razorpay script failed to load'))
    document.head.appendChild(s)
  })
}

export default function BillingClient({ currentPlan, userEmail }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [toast, setToast]     = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('stripe') === 'success') {
      setToast({ type: 'success', msg: 'Payment successful — your plan has been upgraded!' })
      window.history.replaceState({}, '', '/billing')
      router.refresh()
    } else if (params.get('stripe') === 'cancelled') {
      setToast({ type: 'error', msg: 'Payment cancelled.' })
      window.history.replaceState({}, '', '/billing')
    }
  }, [router])

  const handleStripe = useCallback(async (plan: Plan) => {
    setLoading(`${plan.key}-stripe`)
    setToast(null)
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
      setToast({ type: 'error', msg: err instanceof Error ? err.message : 'Payment failed' })
      setLoading(null)
    }
  }, [])

  const handleRazorpay = useCallback(async (plan: Plan) => {
    setLoading(`${plan.key}-rzp`)
    setToast(null)
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
          key:         order.keyId,  // RAZORPAY_KEY_ID from server env
          amount:      order.amount,
          currency:    order.currency,
          name:        'AI ReelForge',
          description: `${order.planName} Plan`,
          order_id: order.orderId,
          prefill:  { email: userEmail },
          theme:    { color: '#6366f1' },
          modal:    { ondismiss: () => reject(new Error('dismissed')) },
          config: {
            display: {
              blocks: {
                upi: {
                  name: 'Pay via UPI',
                  instruments: [{ method: 'upi' }],
                },
                gpay: {
                  name: 'Google Pay',
                  instruments: [{ method: 'upi', flows: ['intent'], apps: ['google_pay'] }],
                },
                paytm: {
                  name: 'Paytm',
                  instruments: [{ method: 'upi', flows: ['intent'], apps: ['paytm'] }],
                },
                phonpe: {
                  name: 'PhonePe',
                  instruments: [{ method: 'upi', flows: ['intent'], apps: ['phonepe'] }],
                },
                cards: {
                  name: 'Cards',
                  instruments: [{ method: 'card' }],
                },
                netbanking: {
                  name: 'Net Banking',
                  instruments: [{ method: 'netbanking' }],
                },
              },
              sequence: [
                'block.upi',
                'block.gpay',
                'block.paytm',
                'block.phonpe',
                'block.cards',
                'block.netbanking',
              ],
              preferences: { show_default_blocks: false },
            },
          },
          handler:  async (response: {
            razorpay_payment_id: string
            razorpay_order_id: string
            razorpay_signature: string
          }) => {
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

      setToast({ type: 'success', msg: `Upgraded to ${plan.name}! Credits added to your account.` })
      router.refresh()
    } catch (err) {
      if (err instanceof Error && err.message !== 'dismissed') {
        setToast({ type: 'error', msg: err.message })
      }
    } finally {
      setLoading(null)
    }
  }, [router, userEmail])

  const anyLoading = !!loading

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm border ${
          toast.type === 'success'
            ? 'bg-green-950/40 border-green-800 text-green-300'
            : 'bg-red-950/40 border-red-800 text-red-300'
        }`}>
          {toast.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertCircle  className="w-4 h-4 shrink-0" />}
          {toast.msg}
        </div>
      )}

      {/* ── Monthly Plans ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {PLANS.map(plan => {
          const isActive        = currentPlan === plan.dbPlan
          const isRzpLoading    = loading === `${plan.key}-rzp`
          const isStripeLoading = loading === `${plan.key}-stripe`

          return (
            <div
              key={plan.key}
              className={`flex flex-col rounded-xl border p-5 relative bg-surface-card ${
                isActive
                  ? 'border-green-700 ring-1 ring-green-700'
                  : plan.highlight
                  ? 'border-brand-600 ring-1 ring-brand-600'
                  : 'border-surface-border'
              }`}
            >
              {isActive && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-semibold bg-green-700 text-white px-2.5 py-0.5 rounded-full whitespace-nowrap">
                  Current Plan
                </span>
              )}
              {!isActive && plan.highlight && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-xs font-semibold bg-brand-600 text-white px-2.5 py-0.5 rounded-full">
                  Popular
                </span>
              )}

              <p className="font-semibold text-base mt-1">{plan.name}</p>

              <div className="mt-1 mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-extrabold">${plan.priceUSD}</span>
                  <span className="text-gray-500 text-xs">{plan.billing === 'monthly' ? '/mo' : ' one-time'}</span>
                </div>
                {plan.priceINR !== undefined && (
                  <span className="text-xs text-gray-500">₹{plan.priceINR} via Razorpay</span>
                )}
              </div>

              <ul className="space-y-1.5 mb-5 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-1.5 text-xs text-gray-300">
                    <span className="text-brand-400 shrink-0 mt-0.5">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              {isActive ? (
                <div className="w-full py-2 rounded-lg text-sm font-medium text-center bg-green-950 border border-green-800 text-green-400">
                  Active
                </div>
              ) : (
                <div className="space-y-2">
                  {plan.priceINR !== undefined && (
                    <button
                      onClick={() => handleRazorpay(plan)}
                      disabled={anyLoading}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white transition-colors disabled:opacity-50"
                    >
                      {isRzpLoading
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Wallet  className="w-3.5 h-3.5" />}
                      {isRzpLoading ? 'Processing…' : `Pay ₹${plan.priceINR}`}
                    </button>
                  )}

                  <button
                    onClick={() => handleStripe(plan)}
                    disabled={anyLoading}
                    className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium bg-surface border border-surface-border hover:border-brand-700 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                  >
                    {isStripeLoading
                      ? <Loader2   className="w-3.5 h-3.5 animate-spin" />
                      : <CreditCard className="w-3.5 h-3.5" />}
                    {isStripeLoading ? 'Redirecting…' : `Pay $${plan.priceUSD} USD`}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-600 text-center">
        Indian users: pay in ₹ via Razorpay (UPI · Cards · Net banking)
        &nbsp;·&nbsp;
        International: pay in $ via Stripe
      </p>
    </div>
  )
}