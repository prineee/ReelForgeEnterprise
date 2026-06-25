'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, CreditCard, Wallet, CheckCircle2, AlertCircle, Zap, Check, Flame } from 'lucide-react'
import { PLANS, LIFETIME_DEAL, type Plan, type DbPlan } from '@/lib/plans'

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

  // Handle Stripe redirect success / cancel banners
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
          description: plan.key === 'Pro'
            ? 'Pro Pro — one-time'
            : `${order.planName} Plan`,
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

      const successMsg = plan.key === 'Pro'
        ? 'Pro deal activated! You now have Pro access forever.'
        : `Upgraded to ${plan.name}! Credits added to your account.`
      setToast({ type: 'success', msg: successMsg })
      router.refresh()
    } catch (err) {
      if (err instanceof Error && err.message !== 'dismissed') {
        setToast({ type: 'error', msg: err.message })
      }
    } finally {
      setLoading(null)
    }
  }, [router, userEmail])

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
                  <span className="text-2xl font-extrabold">₹{plan.priceINR}</span>
                  <span className="text-gray-500 text-xs">/mo</span>
                </div>
                <span className="text-xs text-gray-500">${plan.priceUSD} USD / month</span>
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

      {/* ── Pro Deal ── */}
      <LifetimeDealCard
        currentPlan={currentPlan}
        loading={loading}
        anyLoading={anyLoading}
        onBuy={() => handleRazorpay(LIFETIME_DEAL)}
      />
    </div>
  )
}

function LifetimeDealCard({
  currentPlan,
  loading,
  anyLoading,
  onBuy,
}: {
  currentPlan: DbPlan
  loading:     string | null
  anyLoading:  boolean
  onBuy:       () => void
}) {
  const isProActive     = currentPlan === 'pro' || currentPlan === 'enterprise'
  const isLifetimeLoading = loading === 'Pro-rzp'

  return (
    <div className="relative rounded-xl border-2 border-orange-600 bg-gradient-to-br from-orange-950/60 to-amber-950/40 p-5 overflow-hidden">
      {/* Background glow */}
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Badge */}
      <div className="absolute -top-2.5 left-5">
        <span className="inline-flex items-center gap-1 bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold px-3 py-0.5 rounded-full">
          <Flame className="w-3 h-3" /> ONE-TIME DEAL
        </span>
      </div>

      <div className="mt-2 flex flex-col sm:flex-row sm:items-center gap-6">
        {/* Left: pricing */}
        <div className="shrink-0">
          <div className="flex items-baseline gap-1.5 mb-0.5">
            <span className="text-3xl font-extrabold text-white">₹2,999</span>
            <span className="text-orange-300/70 text-sm line-through ml-1">₹5,988</span>
          </div>
          <p className="text-xs text-orange-300/80">one-time payment · no subscription</p>
          <div className="flex items-center gap-1.5 mt-2">
            <Zap className="w-3.5 h-3.5 text-orange-400" />
            <span className="text-sm font-bold text-orange-200">Pro Pro</span>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px h-16 bg-orange-800/50" />

        {/* Middle: features */}
        <ul className="flex-1 grid grid-cols-2 gap-1.5">
          {LIFETIME_DEAL.features.map(f => (
            <li key={f} className="flex items-center gap-1.5 text-xs text-orange-100/80">
              <Check className="w-3 h-3 text-orange-400 shrink-0" />
              {f}
            </li>
          ))}
        </ul>

        {/* Right: CTA */}
        <div className="shrink-0">
          {isProActive ? (
            <div className="flex items-center gap-2 bg-orange-950 border border-orange-800 text-orange-400 rounded-lg px-4 py-2.5 text-sm font-medium">
              <Check className="w-4 h-4" /> Already on Pro
            </div>
          ) : (
            <button
              onClick={onBuy}
              disabled={anyLoading}
              className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold px-5 py-2.5 rounded-lg text-sm transition-all disabled:opacity-50 whitespace-nowrap shadow-lg shadow-orange-900/40"
            >
              {isLifetimeLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                : <><Wallet className="w-4 h-4" /> Get Pro — ₹2,999</>}
            </button>
          )}
          <p className="text-xs text-orange-400/60 text-center mt-1.5">Razorpay · UPI / Cards</p>
        </div>
      </div>
    </div>
  )
}
