import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Razorpay from 'razorpay'
import { PLAN_BY_KEY, type PlanKey } from '@/lib/plans'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const plan = body.plan as PlanKey
  const planData = PLAN_BY_KEY[plan]
  if (!planData) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const keyId = process.env.RAZORPAY_KEY_ID
  const keySecret = process.env.RAZORPAY_SECRET
  if (!keyId || !keySecret) {
    return NextResponse.json({ error: 'Razorpay keys not configured' }, { status: 500 })
  }

  const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret })

  const order = await rzp.orders.create({
    amount: planData.priceINR * 100, // paise
    currency: 'INR',
    receipt: `rcpt_${Date.now()}`,
    // Notes are set server-side so they cannot be tampered by the client
    notes: { plan, user_id: user.id },
  })

  return NextResponse.json({
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    keyId,
    userEmail: user.email ?? '',
    planName: planData.name,
  })
}
