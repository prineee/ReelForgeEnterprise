import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Razorpay from 'razorpay'
import crypto from 'crypto'
import { PLAN_BY_KEY, PLAN_CREDITS, type PlanKey } from '@/lib/plans'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = body as {
    razorpay_payment_id: string
    razorpay_order_id: string
    razorpay_signature: string
  }

  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    return NextResponse.json({ error: 'Missing payment fields' }, { status: 400 })
  }

  // Verify HMAC-SHA256 signature
  const keySecret = process.env.RAZORPAY_SECRET!
  const expectedSig = crypto
    .createHmac('sha256', keySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex')

  if (expectedSig !== razorpay_signature) {
    return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
  }

  // Fetch the order from Razorpay to read the server-set plan notes
  const rzp = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID!,
    key_secret: keySecret,
  })

  const order = await rzp.orders.fetch(razorpay_order_id)
  const planKey = (order.notes as Record<string, string>)?.plan as PlanKey
  const userId  = (order.notes as Record<string, string>)?.user_id

  const planData = PLAN_BY_KEY[planKey]
  if (!planData || userId !== user.id) {
    return NextResponse.json({ error: 'Order plan mismatch' }, { status: 400 })
  }

  // Update user plan + credits and record payment (service-role bypasses RLS)
  const admin = createAdminClient()

  // Step 1: get current credits
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: currentUser } = await (admin.from('users') as any)
    .select('credits')
    .eq('id', user.id)
    .single() as { data: { credits: number } | null }

  const currentCredits = currentUser?.credits ?? 0
  const addedCredits   = PLAN_CREDITS[planData.dbPlan] ?? 0
  const credits        = currentCredits + addedCredits

  console.log(`[razorpay/verify] Credits: ${currentCredits} + ${addedCredits} = ${credits}`)

  // Step 2: update with accumulated total
  const [planUpdate, paymentInsert] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from('users') as any)
      .update({ plan: planData.dbPlan, credits })
      .eq('id', user.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (admin.from('payments') as any).insert({
      user_id: user.id,
      amount: planData.priceINR,
      gateway: 'razorpay',
      status: 'completed',
      subscription_id: razorpay_payment_id,
    }),
  ])

  if (planUpdate.error || paymentInsert.error) {
    console.error('[razorpay/verify] Supabase error:', planUpdate.error ?? paymentInsert.error)
    return NextResponse.json({ error: 'Database update failed' }, { status: 500 })
  }

  // Credit 30% affiliate commission if this user was referred
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin.rpc as any)('credit_affiliate_commission', {
      p_user_id:        user.id,
      p_payment_amount: planData.priceUSD,
    })
  } catch {
    // Non-fatal
  }

  return NextResponse.json({ success: true, plan: planData.dbPlan, credits })
}
