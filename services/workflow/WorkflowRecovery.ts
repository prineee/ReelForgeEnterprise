/**
 * WorkflowRecovery.ts
 *
 * The mission's failure-handling rules, made concrete:
 *   - Story Planning fails      -> refund reserved credits, mark Failed.
 *   - Reference Images fail     -> retry up to a limit, then refund the
 *                                  remainder and cancel.
 *   - Rendering fails           -> keep whatever assets were generated,
 *                                  mark the workflow Paused/resumable
 *                                  instead of refunding.
 *   - Anything else fails       -> refund and fail (no stage-specific
 *                                  policy defined for it).
 *
 * Injected with BillingEngine so it can actually release unsettled
 * reservations as part of "refund" — WorkflowCoordinator calls decide()
 * then apply(), rather than performing credit operations itself.
 */

import type { BillingEngine } from '../billing/BillingEngine'
import type { WorkflowContext } from './WorkflowContext'
import { withReservationSettled } from './WorkflowContext'
import { WorkflowStage } from './WorkflowState'

export type RecoveryAction = 'REFUND_AND_FAIL' | 'RETRY' | 'REFUND_AND_CANCEL' | 'PAUSE_FOR_RESUME'

export interface RecoveryDecision {
  action: RecoveryAction
  reason: string
}

export interface WorkflowRecoveryOptions {
  maxImageRetries: number
}

export const DEFAULT_RECOVERY_OPTIONS: WorkflowRecoveryOptions = {
  maxImageRetries: 3,
}

export class WorkflowRecovery {
  constructor(
    private readonly billing: BillingEngine,
    private readonly options: WorkflowRecoveryOptions = DEFAULT_RECOVERY_OPTIONS
  ) {}

  /** Decides what should happen for a stage that just failed. Doesn't touch credits or context itself — see apply(). */
  decide(context: WorkflowContext, failedStage: WorkflowStage): RecoveryDecision {
    if (failedStage === WorkflowStage.StoryPlanning) {
      return {
        action: 'REFUND_AND_FAIL',
        reason: 'Story planning failed — refunding reserved credits and failing the workflow.',
      }
    }

    if (failedStage === WorkflowStage.ReferenceImages) {
      const record = context.stages.find((s) => s.stage === failedStage)
      const retryCount = record?.retryCount ?? 0

      if (retryCount < this.options.maxImageRetries) {
        return {
          action: 'RETRY',
          reason: `Reference image generation failed (attempt ${retryCount + 1} of ${this.options.maxImageRetries}) — retrying.`,
        }
      }

      return {
        action: 'REFUND_AND_CANCEL',
        reason: `Reference image generation failed after ${this.options.maxImageRetries} attempts — refunding remaining credits and cancelling.`,
      }
    }

    if (failedStage === WorkflowStage.Rendering) {
      return {
        action: 'PAUSE_FOR_RESUME',
        reason: 'Rendering failed — generated assets are kept; workflow paused for resume rather than refunded.',
      }
    }

    return {
      action: 'REFUND_AND_FAIL',
      reason: `${failedStage} failed with no stage-specific recovery policy — refunding reserved credits and failing.`,
    }
  }

  /**
   * Executes a decision's credit-side effect. REFUND_AND_FAIL/REFUND_AND_CANCEL
   * release every reservation that hasn't already been settled (consumed or
   * released); RETRY and PAUSE_FOR_RESUME leave reservations untouched.
   */
  async apply(context: WorkflowContext, decision: RecoveryDecision): Promise<WorkflowContext> {
    if (decision.action !== 'REFUND_AND_FAIL' && decision.action !== 'REFUND_AND_CANCEL') {
      return context
    }

    let next = context
    for (const reservation of context.reservations) {
      if (reservation.settled) continue

      try {
        const record = await this.billing.releaseReservation(reservation.reservationId, decision.reason)
        next = withReservationSettled(next, reservation.reservationId, { consumed: 0, released: record.amount })
      } catch {
        // Already consumed elsewhere between the failure and this call — nothing further to release.
        next = withReservationSettled(next, reservation.reservationId, { consumed: 0, released: 0 })
      }
    }

    return next
  }
}
