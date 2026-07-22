/**
 * SubscriptionPolicy.ts
 *
 * The five subscription tiers and what each one grants: monthly credits,
 * queue priority, queue access tier, concurrent job allowance, and asset
 * storage. Pure data + lookups — no billing math, no ledger access.
 *
 * `priority` reuses services/queue/QueueTypes.ts's JobPriorityLevel
 * (type-only import from a zero-logic contracts file, not a modification)
 * so a plan's priority can be handed straight to QueueManager.submit()
 * without a translation layer — this is the "plug into existing
 * architecture" connection point for subscriptions.
 */

import { JobPriorityLevel } from '../queue/QueueTypes'

export class SubscriptionPolicyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SubscriptionPolicyError'
  }
}

export enum SubscriptionPlanId {
  Starter = 'STARTER',
  Creator = 'CREATOR',
  Pro = 'PRO',
  Studio = 'STUDIO',
  Enterprise = 'ENTERPRISE',
}

export type QueueAccessTier = 'standard' | 'priority' | 'dedicated'

export interface SubscriptionPlan {
  id: SubscriptionPlanId
  displayName: string
  monthlyCredits: number
  priority: JobPriorityLevel
  queueAccess: QueueAccessTier
  concurrentJobs: number
  assetStorageBytes: number
}

const GB = 1024 * 1024 * 1024

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, SubscriptionPlan> = {
  [SubscriptionPlanId.Starter]: {
    id: SubscriptionPlanId.Starter,
    displayName: 'Starter',
    monthlyCredits: 50,
    priority: JobPriorityLevel.Background,
    queueAccess: 'standard',
    concurrentJobs: 1,
    assetStorageBytes: 2 * GB,
  },
  [SubscriptionPlanId.Creator]: {
    id: SubscriptionPlanId.Creator,
    displayName: 'Creator',
    monthlyCredits: 200,
    priority: JobPriorityLevel.Normal,
    queueAccess: 'standard',
    concurrentJobs: 2,
    assetStorageBytes: 10 * GB,
  },
  [SubscriptionPlanId.Pro]: {
    id: SubscriptionPlanId.Pro,
    displayName: 'Pro',
    monthlyCredits: 600,
    priority: JobPriorityLevel.Normal,
    queueAccess: 'priority',
    concurrentJobs: 3,
    assetStorageBytes: 50 * GB,
  },
  [SubscriptionPlanId.Studio]: {
    id: SubscriptionPlanId.Studio,
    displayName: 'Studio',
    monthlyCredits: 2000,
    priority: JobPriorityLevel.Premium,
    queueAccess: 'priority',
    concurrentJobs: 5,
    assetStorageBytes: 250 * GB,
  },
  [SubscriptionPlanId.Enterprise]: {
    id: SubscriptionPlanId.Enterprise,
    displayName: 'Enterprise',
    monthlyCredits: 10_000,
    priority: JobPriorityLevel.Emergency,
    queueAccess: 'dedicated',
    concurrentJobs: 10,
    assetStorageBytes: 1024 * GB,
  },
}

export function getPlan(planId: SubscriptionPlanId): SubscriptionPlan {
  const plan = SUBSCRIPTION_PLANS[planId]
  if (!plan) {
    throw new SubscriptionPolicyError(`No subscription plan found for id "${planId}".`)
  }
  return plan
}

export function listPlans(): SubscriptionPlan[] {
  return Object.values(SUBSCRIPTION_PLANS)
}
