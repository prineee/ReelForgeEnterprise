export type PlanKey = 'starter' | 'pro' | 'agency' | 'Pro'
export type DbPlan  = 'free' | 'starter' | 'pro' | 'enterprise'

export interface Plan {
  key:        PlanKey
  dbPlan:     DbPlan
  name:       string
  priceINR:   number
  priceUSD:   number
  credits:    number
  highlight?: boolean
  features:   string[]
}

export const PLANS: Plan[] = [
  {
    key: 'starter',
    dbPlan: 'starter',
    name: 'Starter',
    priceINR: 499,
    priceUSD: 6,
    credits: 100,
    features: [
      '100 credits / month',
      'AI thumbnail generator',
      'Caption writer',
      'Script writer',
      '1080p exports',
      'Email support',
    ],
  },
  {
    key: 'pro',
    dbPlan: 'pro',
    name: 'Pro',
    priceINR: 1499,
    priceUSD: 18,
    credits: 500,
    highlight: true,
    features: [
      '500 credits / month',
      'Everything in Starter',
      'Reel generator',
      '4K exports',
      'Priority processing',
      'Priority support',
    ],
  },
  {
    key: 'agency',
    dbPlan: 'enterprise',
    name: 'Agency',
    priceINR: 4999,
    priceUSD: 60,
    credits: 2000,
    features: [
      '2000 credits / month',
      'Everything in Pro',
      'API access',
      'Unlimited team members',
      'Custom branding',
      'Dedicated support',
    ],
  },
]

// Separate Pro deal — Razorpay only, maps to Pro plan in the DB
export const LIFETIME_DEAL: Plan = {
  key: 'Pro',
  dbPlan: 'pro',
  name: 'Pro Pro',
  priceINR: 2999,
  priceUSD: 36,   // used for affiliate commission calculation only
  credits: 500,
  features: [
    '500 credits · one-time',
    'Everything in Pro',
    'No recurring charges',
    'Pro access',
    'All future Pro updates',
    'Priority support forever',
  ],
}

export const PLAN_BY_KEY = Object.fromEntries(
  [...PLANS, LIFETIME_DEAL].map(p => [p.key, p])
) as Record<PlanKey, Plan>

export const PLAN_BY_DB = Object.fromEntries(
  PLANS.map(p => [p.dbPlan, p])
) as Partial<Record<DbPlan, Plan>>

export const PLAN_CREDITS: Record<DbPlan, number> = {
  free:       10,
  starter:    100,
  pro:        500,
  enterprise: 2000,
}
