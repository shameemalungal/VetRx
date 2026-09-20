// ==============================================================================
// VetRx — Subscription Service (Phase 12 Operational Engine)
// Manages practice-bound subscription lifecycle, trial activation, upgrades,
// downgrades with limit validation, cancellation, and deterministic expiry.
// ==============================================================================

import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuditService } from '../lib/audit.service.js';
import { AUTHORITATIVE_PLANS, TRIAL_LIMITS } from './plan.config.js';
import { EntitlementService } from './entitlement.service.js';
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
   * Evaluates deterministic subscription status based on current time.
   */
  static evaluateDeterministicStatus(sub: {
    status: string;
    trialEndsAt: Date | null;
    currentPeriodEnd: Date;
    gracePeriodEndsAt: Date | null;
  }): SubscriptionStatus {
    const now = new Date();
    let status = sub.status as SubscriptionStatus;

    if (status === 'TRIAL' && sub.trialEndsAt && now > sub.trialEndsAt) {
      return 'EXPIRED';
    }

    if (status === 'ACTIVE' && now > sub.currentPeriodEnd) {
      if (sub.gracePeriodEndsAt && now < sub.gracePeriodEndsAt) {
        return 'GRACE_PERIOD';
      }
      return 'EXPIRED';
    }

    return status;
  }

  /**
   * Checks trial eligibility to prevent duplicate trial abuse.
   * BD-10: One trial per practice/user combination.
   */
  static async checkTrialEligibility(normalizedEmail: string, phone?: string): Promise<boolean> {
    if (process.env.VETRX_FAST_TEST === '1') return true;
    try {
      // Find users with this email
      const user = await prisma.user.findUnique({
        where: { normalizedEmail },
        include: {
          ownedPractices: {
            include: {
              subscriptions: true,
            },
          },
        },
      });

      if (!user) return true;

      // Check if any owned practice has consumed a trial
      const hasConsumedTrial = user.ownedPractices.some((p) =>
        p.subscriptions.some((s) => s.trialStartsAt !== null)
      );

      if (hasConsumedTrial) {
        return false;
      }

      // Check by phone if provided
      if (phone && phone.trim()) {
        const normalizedPhone = phone.trim();
        const settings = await prisma.practiceSettings.findFirst({
          where: { phone: normalizedPhone },
          include: {
            practice: {
              include: { subscriptions: true },
            },
          },
        });

        if (settings?.practice.subscriptions.some((s) => s.trialStartsAt !== null)) {
          return false;
        }
      }

      return true;
    } catch {
      return true; // Failsafe allows onboarding
    }
  }

  /**
   * Initializes 14-day trial state for a new practice.
   * BD-01: Separates ACCOUNT CREATED from TRIAL ACTIVATED.
   */
  static async initializePracticeTrial(
    practiceId: string,
    options?: { autoActivate?: boolean; tx?: any }
  ): Promise<SubscriptionDTO> {
    const client = options?.tx || prisma;
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + TRIAL_LIMITS.DURATION_DAYS * 24 * 60 * 60 * 1000);

    // Find or create TRIAL plan
    let trialPlan = await client.subscriptionPlan.findUnique({
      where: { code: 'TRIAL' },
    });

    if (!trialPlan) {
      trialPlan = await client.subscriptionPlan.create({
        data: {
          code: 'TRIAL',
          name: '14-Day Free Trial',
          description: 'Full-featured 14-day evaluation with introductory practice limits.',
          interval: 'MONTHLY',
          intervalCount: 1,
          pricePaisa: 0,
          currency: 'INR',
          trialPeriodDays: 14,
          maxUserSeats: 1,
          featuresJson: {
            maxPatients: 10,
            maxRecordsPerPatient: 5,
            maxPackages: 5,
            maxCustomMedicines: 10,
          },
          sortOrder: 0,
        },
      });
    }

    const isActivated = options?.autoActivate ?? false;

    const sub = await client.subscription.create({
      data: {
        practiceId,
        planId: trialPlan.id,
        status: 'TRIAL',
        trialStartsAt: now,
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        cancelAtPeriodEnd: false,
        metadata: {
          paymentMethodStatus: isActivated ? 'CONFIGURED' : 'PENDING',
          trialActivated: isActivated,
          trialDurationDays: TRIAL_LIMITS.DURATION_DAYS,
        },
      },
      include: { plan: true },
    });

    void AuditService.record({
      practiceId,
      action: 'TRIAL_STARTED',
      resource: 'Subscription',
      resourceId: sub.id,
      details: {
        trialStartsAt: now.toISOString(),
        trialEndsAt: trialEndsAt.toISOString(),
        paymentMethodStatus: isActivated ? 'CONFIGURED' : 'PENDING',
      },
    });

    return this.mapToDTO(sub);
  }

  /**
   * Activates the 14-day trial (e.g. upon payment method confirmation or controlled test mode).
   */
  static async activateTrial(practiceId: string): Promise<SubscriptionDTO> {
    const existing = await prisma.subscription.findFirst({
      where: { practiceId, status: 'TRIAL' },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Active trial subscription not found for this practice.');
    }

    const meta = (existing.metadata as Record<string, unknown>) || {};
    const updatedMeta = {
      ...meta,
      paymentMethodStatus: 'CONFIGURED',
      trialActivated: true,
      activatedAt: new Date().toISOString(),
    };

    const updated = await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        metadata: updatedMeta as any,
      },
      include: { plan: true },
    });

    void AuditService.record({
      practiceId,
      action: 'TRIAL_ACTIVATED',
      resource: 'Subscription',
      resourceId: updated.id,
      details: { activatedAt: new Date().toISOString() },
    });

    return this.mapToDTO(updated);
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

    const evaluatedStatus = this.evaluateDeterministicStatus(sub);

    return {
      ...this.mapToDTO(sub),
      status: evaluatedStatus,
    };
  }

  /**
   * Retrieves the full subscription history for an authenticated practice.
   */
  static async getSubscriptionHistory(practiceId: string): Promise<SubscriptionDTO[]> {
    const records = await prisma.subscription.findMany({
      where: { practiceId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    return records.map((sub) => this.mapToDTO(sub));
  }

  /**
   * Immediate Upgrade (BD-16).
   * Takes effect immediately at the subscription level.
   */
  static async upgradePlan(practiceId: string, targetPlanCode: string): Promise<SubscriptionDTO> {
    const planConfig = AUTHORITATIVE_PLANS[targetPlanCode];
    if (!planConfig) {
      throw new AppError(400, 'INVALID_PLAN', `Plan code ${targetPlanCode} is not recognized.`);
    }

    // Ensure plan exists in DB
    let targetPlan = await prisma.subscriptionPlan.findUnique({
      where: { code: targetPlanCode },
    });

    if (!targetPlan) {
      targetPlan = await prisma.subscriptionPlan.create({
        data: {
          code: planConfig.code,
          name: planConfig.name,
          description: planConfig.description,
          interval: planConfig.interval,
          intervalCount: planConfig.intervalCount,
          pricePaisa: planConfig.pricePaisa,
          currency: planConfig.currency,
          trialPeriodDays: 0,
          maxUserSeats: planConfig.maxVeterinarianSeats,
          featuresJson: planConfig.features as any,
          sortOrder: planConfig.sortOrder,
        },
      });
    }

    const existing = await prisma.subscription.findFirst({
      where: { practiceId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const durationDays = planConfig.interval === 'ANNUAL' ? 365 : 30;
    const currentPeriodEnd = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

    let updated: any;

    if (existing) {
      updated = await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          planId: targetPlan.id,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          metadata: {
            ...((existing.metadata as Record<string, unknown>) || {}),
            paymentMethodStatus: 'CONFIGURED',
            upgradedAt: now.toISOString(),
            previousPlanCode: existing.plan.code,
          } as any,
        },
        include: { plan: true },
      });
    } else {
      updated = await prisma.subscription.create({
        data: {
          practiceId,
          planId: targetPlan.id,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
          metadata: {
            paymentMethodStatus: 'CONFIGURED',
            upgradedAt: now.toISOString(),
          },
        },
        include: { plan: true },
      });
    }

    void AuditService.record({
      practiceId,
      action: 'SUBSCRIPTION_UPGRADED',
      resource: 'Subscription',
      resourceId: updated.id,
      details: {
        targetPlanCode,
        periodEnd: currentPeriodEnd.toISOString(),
      },
    });

    return this.mapToDTO(updated);
  }

  /**
   * Scheduled Downgrade (BD-17).
   * Takes effect at the END of the current billing period.
   * Validates destination plan limits before allowing downgrade.
   */
  static async scheduleDowngrade(
    practiceId: string,
    targetPlanCode: string
  ): Promise<{ message: string; effectiveAt: string; subscription: SubscriptionDTO }> {
    const targetConfig = AUTHORITATIVE_PLANS[targetPlanCode];
    if (!targetConfig) {
      throw new AppError(400, 'INVALID_PLAN', `Plan code ${targetPlanCode} is not recognized.`);
    }

    const currentSub = await prisma.subscription.findFirst({
      where: { practiceId, status: { in: ['ACTIVE', 'TRIAL'] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!currentSub) {
      throw new AppError(404, 'NOT_FOUND', 'Active subscription required to schedule a downgrade.');
    }

    // BD-17: Verify destination plan limits are satisfied
    const currentUsage = await EntitlementService.getPracticeUsage(practiceId);

    if (currentUsage.veterinarianSeatsCount > targetConfig.maxVeterinarianSeats) {
      throw new AppError(
        400,
        'DOWNGRADE_LIMITS_EXCEEDED',
        `Destination plan (${targetConfig.name}) allows maximum ${targetConfig.maxVeterinarianSeats} veterinarian seat(s). Your practice currently has ${currentUsage.veterinarianSeatsCount} active veterinarians. Please reduce active veterinarians before scheduling this downgrade.`
      );
    }

    const meta = (currentSub.metadata as Record<string, unknown>) || {};
    const effectiveAt = currentSub.currentPeriodEnd.toISOString();

    const updated = await prisma.subscription.update({
      where: { id: currentSub.id },
      data: {
        metadata: {
          ...meta,
          pendingDowngradePlanCode: targetPlanCode,
          downgradeEffectiveAt: effectiveAt,
        } as any,
      },
      include: { plan: true },
    });

    void AuditService.record({
      practiceId,
      action: 'SUBSCRIPTION_DOWNGRADE_SCHEDULED',
      resource: 'Subscription',
      resourceId: updated.id,
      details: { targetPlanCode, effectiveAt },
    });

    return {
      message: `Downgrade to ${targetConfig.name} scheduled for the end of current billing period (${effectiveAt}).`,
      effectiveAt,
      subscription: this.mapToDTO(updated),
    };
  }

  /**
   * Cancellation (BD-18).
   * Stops renewal. Paid access continues until current billing period ends.
   */
  static async cancelSubscription(practiceId: string): Promise<SubscriptionDTO> {
    const sub = await prisma.subscription.findFirst({
      where: { practiceId, status: { in: ['ACTIVE', 'TRIAL'] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub) {
      throw new AppError(404, 'NOT_FOUND', 'Active subscription not found for this practice.');
    }

    if (sub.cancelAtPeriodEnd) {
      // Idempotent: already cancelled at period end
      return this.mapToDTO(sub);
    }

    const now = new Date();
    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        cancelAtPeriodEnd: true,
        cancelledAt: now,
      },
      include: { plan: true },
    });

    void AuditService.record({
      practiceId,
      action: 'SUBSCRIPTION_CANCELLED',
      resource: 'Subscription',
      resourceId: updated.id,
      details: {
        effectiveUntil: sub.currentPeriodEnd.toISOString(),
      },
    });

    return this.mapToDTO(updated);
  }

  /**
   * Reactivate Subscription.
   * Reverses a pending cancellation before period end.
   */
  static async reactivateSubscription(practiceId: string): Promise<SubscriptionDTO> {
    const sub = await prisma.subscription.findFirst({
      where: { practiceId, cancelAtPeriodEnd: true },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub) {
      throw new AppError(404, 'NOT_FOUND', 'No pending cancelled subscription found to reactivate.');
    }

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      },
      include: { plan: true },
    });

    void AuditService.record({
      practiceId,
      action: 'SUBSCRIPTION_REACTIVATED',
      resource: 'Subscription',
      resourceId: updated.id,
    });

    return this.mapToDTO(updated);
  }

  /**
   * Performs an atomic state transition on an existing practice subscription.
   */
  static async transitionStatus(
    subscriptionId: string,
    practiceId: string,
    targetStatus: SubscriptionStatus,
    metadataUpdates?: Record<string, unknown>
  ): Promise<SubscriptionDTO> {
    const existing = await prisma.subscription.findFirst({
      where: { id: subscriptionId, practiceId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Subscription not found for this practice.');
    }

    const currentStatus = existing.status as SubscriptionStatus;
    if (!this.isValidTransition(currentStatus, targetStatus)) {
      throw new AppError(
        400,
        'INVALID_LIFECYCLE_TRANSITION',
        `Cannot transition subscription from ${currentStatus} to ${targetStatus}.`
      );
    }

    const now = new Date();
    const isPastDueOrGrace = targetStatus === 'PAST_DUE' || targetStatus === 'GRACE_PERIOD';
    const graceEnds = isPastDueOrGrace
      ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // BD-12: 7-day grace period
      : existing.gracePeriodEndsAt;

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: targetStatus as any,
        cancelledAt: targetStatus === 'CANCELLED' ? new Date() : existing.cancelledAt,
        cancelAtPeriodEnd: targetStatus === 'CANCELLED' ? true : existing.cancelAtPeriodEnd,
        gracePeriodEndsAt: graceEnds,
        metadata: metadataUpdates
          ? ({ ...((existing.metadata as Record<string, unknown>) || {}), ...metadataUpdates } as any)
          : existing.metadata === null ? undefined : (existing.metadata as any),
      },
      include: { plan: true },
    });

    void AuditService.record({
      practiceId,
      action: `SUBSCRIPTION_STATUS_${targetStatus}`,
      resource: 'Subscription',
      resourceId: updated.id,
      details: { previousStatus: currentStatus, targetStatus },
    });

    return this.mapToDTO(updated);
  }

  private static mapToDTO(sub: any): SubscriptionDTO {
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
      trialStartsAt: sub.trialStartsAt ? new Date(sub.trialStartsAt).toISOString() : null,
      trialEndsAt: sub.trialEndsAt ? new Date(sub.trialEndsAt).toISOString() : null,
      currentPeriodStart: new Date(sub.currentPeriodStart).toISOString(),
      currentPeriodEnd: new Date(sub.currentPeriodEnd).toISOString(),
      cancelledAt: sub.cancelledAt ? new Date(sub.cancelledAt).toISOString() : null,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      gracePeriodEndsAt: sub.gracePeriodEndsAt ? new Date(sub.gracePeriodEndsAt).toISOString() : null,
      gatewayCustomerId: sub.gatewayCustomerId,
      gatewaySubscriptionId: sub.gatewaySubscriptionId,
      metadata: (sub.metadata as Record<string, unknown>) || null,
      createdAt: new Date(sub.createdAt).toISOString(),
      updatedAt: new Date(sub.updatedAt).toISOString(),
    };
  }
}
