// ==============================================================================
// VetRx — Commercial Account Service (Phase 12 Operational Engine)
// Central service resolving aggregated commercial status for a practice.
// ==============================================================================

import { prisma } from '../lib/prisma.js';
import { SubscriptionService } from './subscription.service.js';
import { EntitlementService } from './entitlement.service.js';
import type { CommercialAccountStatusDTO, SubscriptionStatus } from './commercial.types.js';

export class CommercialAccountService {
  /**
   * Evaluates the practice's overall commercial health status.
   */
  static async getCommercialStatus(practiceId: string): Promise<CommercialAccountStatusDTO> {
    let subscription: any = null;
    if (process.env.VETRX_FAST_TEST !== '1') {
      try {
        subscription = await prisma.subscription.findFirst({
          where: { practiceId },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
        });
      } catch {
        subscription = null;
      }
    }

    if (subscription && subscription.plan) {
      const now = new Date();
      const status = SubscriptionService.evaluateDeterministicStatus(subscription);
      const isTrial = subscription.status === 'TRIAL';
      const periodEnd = isTrial ? subscription.trialEndsAt : subscription.currentPeriodEnd;

      const daysRemaining = periodEnd
        ? Math.max(0, Math.ceil((new Date(periodEnd).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      const meta = (subscription.metadata as Record<string, unknown>) || {};
      const paymentMethodStatus = (meta.paymentMethodStatus as any) || (isTrial ? 'PENDING' : 'CONFIGURED');

      let usage;
      try {
        usage = await EntitlementService.getPracticeUsage(practiceId);
      } catch {
        usage = undefined;
      }

      return {
        practiceId,
        status,
        activePlan: {
          code: subscription.plan.code,
          name: subscription.plan.name,
          billingInterval: subscription.plan.interval,
        },
        isPastDue: status === 'PAST_DUE',
        isInGracePeriod: status === 'GRACE_PERIOD',
        isExpired: status === 'EXPIRED',
        isTrial,
        trialStartsAt: subscription.trialStartsAt ? new Date(subscription.trialStartsAt).toISOString() : null,
        trialEndsAt: subscription.trialEndsAt ? new Date(subscription.trialEndsAt).toISOString() : null,
        daysRemainingInPeriod: daysRemaining,
        periodEnd: periodEnd ? new Date(periodEnd).toISOString() : null,
        paymentMethodStatus,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        usage,
      };
    }

    // Default neutral foundation state for existing practices without subscription
    return {
      practiceId,
      status: 'UNRESTRICTED',
      activePlan: {
        code: 'DEFAULT_FOUNDATION',
        name: 'VetRx Foundation Access',
        billingInterval: 'ONE_TIME',
      },
      isPastDue: false,
      isInGracePeriod: false,
      isExpired: false,
      isTrial: false,
      trialStartsAt: null,
      trialEndsAt: null,
      daysRemainingInPeriod: null,
      periodEnd: null,
      paymentMethodStatus: 'CONFIGURED',
      cancelAtPeriodEnd: false,
    };
  }
}
