// ==============================================================================
// VetRx — Subscription Service (Phase 10 Foundation)
// Manages practice-bound subscription lifecycle states and term history.
// ==============================================================================

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import type { SubscriptionDTO, SubscriptionStatus } from './commercial.types.js';

// Formal lifecycle transition validation matrix
const VALID_TRANSITIONS: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  TRIAL: ['ACTIVE', 'PAST_DUE', 'GRACE_PERIOD', 'CANCELLED', 'EXPIRED'],
  ACTIVE: ['PAST_DUE', 'GRACE_PERIOD', 'CANCELLED', 'EXPIRED'],
  PAST_DUE: ['ACTIVE', 'GRACE_PERIOD', 'EXPIRED', 'CANCELLED'],
  GRACE_PERIOD: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
  CANCELLED: ['ACTIVE', 'EXPIRED'],
  EXPIRED: ['ACTIVE', 'TRIAL'],
  UNRESTRICTED: ['TRIAL', 'ACTIVE'],
};

export class SubscriptionService {
  /**
   * Validates whether a lifecycle transition between two states is allowable.
   */
  static isValidTransition(current: SubscriptionStatus, target: SubscriptionStatus): boolean {
    if (current === target) return true;
    const allowed = VALID_TRANSITIONS[current] || [];
    return allowed.includes(target);
  }

  /**
   * Retrieves the active or latest subscription for a practice.
   * Strictly tenant-scoped by practiceId.
   */
  static async getPracticeSubscription(practiceId: string): Promise<SubscriptionDTO | null> {
    const sub = await prisma.subscription.findFirst({
      where: { practiceId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub) return null;

    return {
      id: sub.id,
      practiceId: sub.practiceId,
      planId: sub.planId,
      plan: sub.plan
        ? {
            id: sub.plan.id,
            code: sub.plan.code,
            name: sub.plan.name,
            description: sub.plan.description,
            interval: sub.plan.interval as any,
            intervalCount: sub.plan.intervalCount,
            pricePaisa: sub.plan.pricePaisa,
            currency: sub.plan.currency,
            trialPeriodDays: sub.plan.trialPeriodDays,
            maxUserSeats: sub.plan.maxUserSeats,
            features: (sub.plan.featuresJson as Record<string, unknown>) || {},
            isActive: sub.plan.isActive,
            sortOrder: sub.plan.sortOrder,
            createdAt: sub.plan.createdAt.toISOString(),
            updatedAt: sub.plan.updatedAt.toISOString(),
          }
        : undefined,
      status: sub.status as SubscriptionStatus,
      trialStartsAt: sub.trialStartsAt?.toISOString() || null,
      trialEndsAt: sub.trialEndsAt?.toISOString() || null,
      currentPeriodStart: sub.currentPeriodStart.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      cancelledAt: sub.cancelledAt?.toISOString() || null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      gracePeriodEndsAt: sub.gracePeriodEndsAt?.toISOString() || null,
      gatewayCustomerId: sub.gatewayCustomerId,
      gatewaySubscriptionId: sub.gatewaySubscriptionId,
      metadata: (sub.metadata as Record<string, unknown>) || null,
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
    };
  }

  /**
   * Retrieves the full subscription history for an authenticated practice.
   * Never overwrites historical records.
   */
  static async getSubscriptionHistory(practiceId: string): Promise<SubscriptionDTO[]> {
    const records = await prisma.subscription.findMany({
      where: { practiceId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((sub) => ({
      id: sub.id,
      practiceId: sub.practiceId,
      planId: sub.planId,
      plan: sub.plan
        ? {
            id: sub.plan.id,
            code: sub.plan.code,
            name: sub.plan.name,
            description: sub.plan.description,
            interval: sub.plan.interval as any,
            intervalCount: sub.plan.intervalCount,
            pricePaisa: sub.plan.pricePaisa,
            currency: sub.plan.currency,
            trialPeriodDays: sub.plan.trialPeriodDays,
            maxUserSeats: sub.plan.maxUserSeats,
            features: (sub.plan.featuresJson as Record<string, unknown>) || {},
            isActive: sub.plan.isActive,
            sortOrder: sub.plan.sortOrder,
            createdAt: sub.plan.createdAt.toISOString(),
            updatedAt: sub.plan.updatedAt.toISOString(),
          }
        : undefined,
      status: sub.status as SubscriptionStatus,
      trialStartsAt: sub.trialStartsAt?.toISOString() || null,
      trialEndsAt: sub.trialEndsAt?.toISOString() || null,
      currentPeriodStart: sub.currentPeriodStart.toISOString(),
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
      cancelledAt: sub.cancelledAt?.toISOString() || null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      gracePeriodEndsAt: sub.gracePeriodEndsAt?.toISOString() || null,
      gatewayCustomerId: sub.gatewayCustomerId,
      gatewaySubscriptionId: sub.gatewaySubscriptionId,
      metadata: (sub.metadata as Record<string, unknown>) || null,
      createdAt: sub.createdAt.toISOString(),
      updatedAt: sub.updatedAt.toISOString(),
    }));
  }

  /**
   * Performs an atomic state transition on an existing practice subscription.
   * Strictly enforces practiceId ownership in the update query.
   */
  static async transitionStatus(
    subscriptionId: string,
    practiceId: string,
    targetStatus: SubscriptionStatus,
    metadataUpdates?: Record<string, unknown>
  ): Promise<SubscriptionDTO> {
    // 1. Fetch current subscription scoped by practiceId
    const existing = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        practiceId,
      },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Subscription not found for this practice.');
    }

    // 2. Validate transition
    const currentStatus = existing.status as SubscriptionStatus;
    if (!this.isValidTransition(currentStatus, targetStatus)) {
      throw new AppError(
        400,
        'INVALID_LIFECYCLE_TRANSITION',
        `Cannot transition subscription from ${currentStatus} to ${targetStatus}.`
      );
    }

    // 3. Perform atomic update
    const updated = await prisma.subscription.update({
      where: {
        id: subscriptionId,
      },
      data: {
        status: targetStatus as any,
        cancelledAt: targetStatus === 'CANCELLED' ? new Date() : existing.cancelledAt,
        cancelAtPeriodEnd: targetStatus === 'CANCELLED' ? true : existing.cancelAtPeriodEnd,
        metadata: metadataUpdates
          ? ({ ...((existing.metadata as Record<string, unknown>) || {}), ...metadataUpdates } as any)
          : existing.metadata === null ? undefined : (existing.metadata as any),
      },
      include: {
        plan: true,
      },
    });

    return {
      id: updated.id,
      practiceId: updated.practiceId,
      planId: updated.planId,
      status: updated.status as SubscriptionStatus,
      trialStartsAt: updated.trialStartsAt?.toISOString() || null,
      trialEndsAt: updated.trialEndsAt?.toISOString() || null,
      currentPeriodStart: updated.currentPeriodStart.toISOString(),
      currentPeriodEnd: updated.currentPeriodEnd.toISOString(),
      cancelledAt: updated.cancelledAt?.toISOString() || null,
      cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
      gracePeriodEndsAt: updated.gracePeriodEndsAt?.toISOString() || null,
      gatewayCustomerId: updated.gatewayCustomerId,
      gatewaySubscriptionId: updated.gatewaySubscriptionId,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
