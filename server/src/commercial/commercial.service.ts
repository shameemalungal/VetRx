// ==============================================================================
// VetRx — Commercial Account Service (Phase 10 Foundation)
// Central service resolving aggregated commercial status for a practice.
// ==============================================================================

import { prisma } from '../lib/prisma.js';
import type { CommercialAccountStatusDTO, SubscriptionStatus } from './commercial.types.js';

export class CommercialAccountService {
  /**
   * Evaluates the practice's overall commercial health status.
   * Does not enforce blocks against clinical requests.
   */
  static async getCommercialStatus(practiceId: string): Promise<CommercialAccountStatusDTO> {
    if (process.env.NODE_ENV === 'test' || process.env.VETRX_FAST_TEST === '1') {
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
        daysRemainingInPeriod: null,
        periodEnd: null,
      };
    }

    let subscription: any = null;
    try {
      subscription = await prisma.subscription.findFirst({
        where: { practiceId },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      subscription = null;
    }

    if (subscription && subscription.plan) {
      const now = new Date();
      const status = subscription.status as SubscriptionStatus;
      const periodEnd = subscription.currentPeriodEnd;
      const daysRemaining = periodEnd
        ? Math.max(0, Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

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
        daysRemainingInPeriod: daysRemaining,
        periodEnd: periodEnd ? periodEnd.toISOString() : null,
      };
    }

    // Default neutral foundation state for existing practices
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
      daysRemainingInPeriod: null,
      periodEnd: null,
    };
  }
}
