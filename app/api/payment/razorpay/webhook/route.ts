import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'
import { PLAN_BY_KEY, PLAN_CREDITS, type PlanKey } from '@/lib/plans'

// Razorpay sends raw JSON; read as text to verify HMAC before parsing
export async function POST(request: Request) {
  const body = await request.text()
  const signature = request.headers.get('x-razorpay-signature')

  const secret = process.env.RAZORPAY_WEBHOOK_SECRET
  if (!secret) {
    console.error('[razorpay/webhook] RAZORPAY_WEBHOOK_SECRET is not set — rejecting webhook')
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  if (!signature) {
    console.error('[razorpay/webhook] Missing x-razorpay-signature header')
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex')

  if (expectedSignature !== signature) {
    console.error('[razorpay/webhook] Signature mismatch — possible fraud attempt')
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  // Only parse body AFTER signature is verified
  let event: {
    event: string
    payload: { payment: { entity: { id: string; order_id: string; amount: number; notes: Record<string, string> } } }
  }
  try {
    event = JSON.parse(body)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (event.event !== 'payment.captured') {
    return NextResponse.json({ received: true }) // Acknowledge non-handled events
  }

  const payment = event.payload.payment.entity
  const planKey = payment.notes?.plan as PlanKey
  const userId  = payment.notes?.user_id
  const planData = PLAN_BY_KEY[planKey]

  if (!planData || !userId) {
    console.warn('[razorpay/webhook] Missing plan or user_id in payment notes')
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

  console.log(`[razorpay/webhook] Credits: ${currentCredits} + ${addedCredits} = ${credits}`)

  // Step 2: update with accumulated total
  await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from('users') as any)
      .update({ plan: planData.dbPlan, credits })
      .eq('id', userId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from('payments') as any).insert({
      user_id: userId,
      amount: Math.round(payment.amount / 100), // paise → rupees
      gateway: 'razorpay',
      status: 'completed',
      subscription_id: payment.id,
    }),
  ])

  // Credit 30% affiliate commission if this user was referred
  try {
    const amountUSD = planData.priceUSD
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.rpc as any)('credit_affiliate_commission', {
      p_user_id:        userId,
      p_payment_amount: amountUSD,
    })
  } catch {
    // Non-fatal
  }

  console.log(`[razorpay/webhook] payment.captured → user ${userId} upgraded to ${planData.dbPlan}`)
  return NextResponse.json({ received: true })
}
