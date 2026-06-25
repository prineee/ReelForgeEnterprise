import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Stripe from 'stripe'
import { PLAN_BY_KEY, PLAN_CREDITS, type PlanKey } from '@/lib/plans'

// App Router: read raw body with request.text() for Stripe signature verification
export async function POST(request: Request) {
  const rawBody = await request.text()
  const signature = request.headers.get('stripe-signature') ?? ''

  const stripeKey    = process.env.STRIPE_SECRET_KEY!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe keys not configured' }, { status: 500 })
  }

  const stripe = new Stripe(stripeKey)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Signature verification failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return NextResponse.json({ received: true }) // Acknowledge unhandled events
  }

  const session = event.data.object as Stripe.Checkout.Session
  const planKey = session.metadata?.plan as PlanKey
  const userId  = session.metadata?.user_id

  if (!planKey || !userId) {
    console.warn('[stripe/webhook] Missing plan or user_id in session metadata')
    return NextResponse.json({ received: true })
  }

  const planData = PLAN_BY_KEY[planKey]
  if (!planData) {
    console.warn('[stripe/webhook] Unknown plan key:', planKey)
    return NextResponse.json({ received: true })
  }

  const admin = createAdminClient()

  // Step 1: get current credits
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentUser } = await (admin.from('users') as any)
    .select('credits')
    .eq('id', userId)
    .single() as { data: { credits: number } | null }

  const currentCredits = currentUser?.credits ?? 0
  const addedCredits   = PLAN_CREDITS[planData.dbPlan] ?? 0
  const credits        = currentCredits + addedCredits

  console.log(`[stripe/webhook] Credits: ${currentCredits} + ${addedCredits} = ${credits}`)

  // Step 2: update with accumulated total
  const amountUSD = (session.amount_total ?? planData.priceUSD * 100) / 100

  const [planUpdate, paymentInsert] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from('users') as any)
      .update({ plan: planData.dbPlan, credits })
      .eq('id', userId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from('payments') as any).insert({
      user_id: userId,
      amount: amountUSD,
      gateway: 'stripe',
      status: 'completed',
      subscription_id: session.id,
    }),
  ])

  if (planUpdate.error || paymentInsert.error) {
    console.error('[stripe/webhook] Supabase error:', planUpdate.error ?? paymentInsert.error)
    return NextResponse.json({ error: 'DB update failed' }, { status: 500 })
  }

  // Credit 30% affiliate commission if this user was referred
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.rpc as any)('credit_affiliate_commission', {
      p_user_id:        userId,
      p_payment_amount: amountUSD,
    })
  } catch {
    // Non-fatal: commission failure should not block the webhook response
  }

  console.log(`[stripe/webhook] checkout.session.completed → user ${userId} upgraded to ${planData.dbPlan}`)
  return NextResponse.json({ received: true })
}
