import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Stripe from 'stripe'
import { PLAN_BY_KEY, type PlanKey } from '@/lib/plans'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const plan = body.plan as PlanKey
  const planData = PLAN_BY_KEY[plan]
  if (!planData) return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })

  const stripeKey = process.env.STRIPE_SECRET_KEY
  if (!stripeKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 })

  const stripe = new Stripe(stripeKey)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: planData.priceUSD * 100, // cents
          product_data: {
            name: `AI ReelForge — ${planData.name} Plan`,
            description: `${planData.credits} credits/month`,
          },
        },
        quantity: 1,
      },
    ],
    // Embed plan + user in metadata so the webhook can act without looking up the session
    metadata: { plan, user_id: user.id },
    customer_email: user.email ?? undefined,
    success_url: `${siteUrl}/billing?stripe=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${siteUrl}/billing?stripe=cancelled`,
  })

  return NextResponse.json({ url: session.url })
}
