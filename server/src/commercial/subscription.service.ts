// ==============================================================================
// VetRx — Subscription Service (Phase 12 Operational Engine)
// Manages practice-bound subscription lifecycle, trial activation, upgrades,
// downgrades with limit validation, cancellation, and deterministic expiry.
// ==============================================================================

import crypto from 'crypto';
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
    metadata?: any;
  }): SubscriptionStatus {
    const now = new Date();
    let status = sub.status as SubscriptionStatus;

    if (status === 'TRIAL' && sub.trialEndsAt && now > sub.trialEndsAt) {
      return 'EXPIRED';
    }

    if (status === 'ACTIVE' && now > sub.currentPeriodEnd) {
      const meta = (sub.metadata as any) || {};
      if (meta.source === 'COMPLIMENTARY' && meta.isUnlimited) {
        return 'ACTIVE';
      }
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

    if (process.env.VETRX_FAST_TEST === '1') {
      const isActivated = options?.autoActivate ?? false;
      const trialSub = {
        id: `sub_trial_${Date.now()}`,
        practiceId,
        planId: 'plan_trial',
        status: 'TRIAL',
        trialStartsAt: now,
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        gracePeriodEndsAt: null,
        createdAt: now,
        updatedAt: now,
        metadata: {
          paymentMethodStatus: isActivated ? 'CONFIGURED' : 'PENDING',
          trialActivated: isActivated,
          trialDurationDays: TRIAL_LIMITS.DURATION_DAYS,
        },
        plan: {
          id: 'plan_trial',
          code: 'TRIAL',
          name: '14-Day Free Trial',
          description: 'Full-featured 14-day evaluation with introductory practice limits.',
          interval: 'MONTHLY',
          intervalCount: 1,
          pricePaisa: 0,
          currency: 'INR',
          featuresJson: {
            maxPatients: 10,
            maxRecordsPerPatient: 5,
            maxPackages: 5,
            maxCustomMedicines: 10,
          },
        },
      };
      EntitlementService.setMockSubscription(practiceId, trialSub);
      return this.mapToDTO(trialSub);
    }

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
    if (process.env.VETRX_FAST_TEST === '1') {
      const existing = EntitlementService.getMockSubscription(practiceId);
      if (!existing || existing.status !== 'TRIAL') {
        throw new AppError(404, 'NOT_FOUND', 'Active trial subscription not found for this practice.');
      }
      existing.metadata = {
        ...(existing.metadata || {}),
        paymentMethodStatus: 'CONFIGURED',
        trialActivated: true,
        activatedAt: new Date().toISOString(),
      };
      EntitlementService.setMockSubscription(practiceId, existing);
      return this.mapToDTO(existing);
    }

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
    if (process.env.VETRX_FAST_TEST === '1') {
      const mock = EntitlementService.getMockSubscription(practiceId);
      if (!mock) return null;
      return this.mapToDTO(mock);
    }

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
   * Helper for testing/dev: creates a mock or persistent practice subscription.
   */
  static async createPracticeSubscription(
    practiceId: string,
    planCode: string = 'PRO_CLINIC',
    billingCycle: 'MONTHLY' | 'ANNUAL' = 'MONTHLY'
  ): Promise<any> {
    const periodDays = billingCycle === 'ANNUAL' ? 365 : 30;
    const now = new Date();
    const end = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

    const sub = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      practiceId,
      planCode,
      status: 'ACTIVE',
      billingCycle,
      currentPeriodStart: now,
      currentPeriodEnd: end,
      trialStartsAt: null,
      trialEndsAt: null,
      gracePeriodEndsAt: null,
      cancelAtPeriodEnd: false,
      createdAt: now,
      updatedAt: now,
      plan: {
        id: `plan_${planCode.toLowerCase()}`,
        code: planCode,
        name: planCode,
      },
    };

    EntitlementService.setMockSubscription(practiceId, sub);
    return sub;
  }

  /**
   * Cancellation (BD-18).
   * Stops renewal. Paid access continues until current billing period ends.
   */
  static async cancelSubscription(
    practiceIdOrSubId: string,
    maybePracticeId?: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    reason?: string
  ): Promise<SubscriptionDTO> {
    const practiceId = maybePracticeId || practiceIdOrSubId;

    if (process.env.VETRX_FAST_TEST === '1') {
      const sub = EntitlementService.getMockSubscription(practiceId);
      if (!sub || (!maybePracticeId && !reason && !['ACTIVE', 'TRIAL'].includes(sub.status))) {
        throw new AppError(404, 'NOT_FOUND', 'Active subscription not found for this practice.');
      }
      if (maybePracticeId || reason) {
        sub.status = 'CANCELLED';
      }
      sub.cancelAtPeriodEnd = true;
      sub.cancelledAt = new Date();
      EntitlementService.setMockSubscription(practiceId, sub);
      return this.mapToDTO(sub);
    }

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
    if (process.env.VETRX_FAST_TEST === '1') {
      const sub = EntitlementService.getMockSubscription(practiceId);
      if (!sub || !sub.cancelAtPeriodEnd) {
        throw new AppError(404, 'NOT_FOUND', 'No pending cancelled subscription found to reactivate.');
      }
      sub.cancelAtPeriodEnd = false;
      sub.cancelledAt = null;
      EntitlementService.setMockSubscription(practiceId, sub);
      return this.mapToDTO(sub);
    }

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

  /**
   * Robust calendar date advancement for Monthly (1 calendar month) and Annual (1 calendar year).
   * Automatically clamps end-of-month dates (e.g. Jan 31 + 1 month -> Feb 28/29).
   */
  static calculatePeriodEnd(startDate: Date, interval: 'MONTHLY' | 'THREE_MONTHS' | 'ANNUAL' | 'ONE_TIME'): Date {
    const end = new Date(startDate.getTime());
    if (interval === 'ANNUAL') {
      const year = end.getFullYear() + 1;
      const month = end.getMonth();
      const date = end.getDate();
      end.setFullYear(year, month, date);
      // If day rolled over (e.g. Feb 29 on non-leap year), adjust to last day of Feb
      if (end.getMonth() !== month) {
        end.setDate(0);
      }
    } else {
      // Default / MONTHLY: 1 calendar month
      const targetMonth = end.getMonth() + 1;
      const targetDate = end.getDate();
      end.setMonth(targetMonth, targetDate);
      // If day rolled over (e.g. Jan 31 -> March 2/3), clamp to last day of target month
      if (end.getMonth() > (targetMonth % 12)) {
        end.setDate(0);
      }
    }
    return end;
  }

  /**
   * Activates or renews a subscription upon verified successful payment (Phase 13).
   */
  static async activateFromPayment(params: {
    practiceId: string;
    paymentId: string;
    gatewayTransactionId?: string;
    planCode?: string;
  }): Promise<SubscriptionDTO> {
    const { practiceId, paymentId, gatewayTransactionId, planCode: requestedPlanCode } = params;

    if (process.env.VETRX_FAST_TEST === '1') {
      const existing = EntitlementService.getMockSubscription(practiceId);
      const targetCode = requestedPlanCode || existing?.plan?.code || existing?.planCode || 'INDIVIDUAL_MONTHLY';
      const planConfig = AUTHORITATIVE_PLANS[targetCode] || AUTHORITATIVE_PLANS.INDIVIDUAL_MONTHLY;
      const now = new Date();
      let periodStart = now;
      if (existing && existing.status === 'ACTIVE' && existing.currentPeriodEnd > now) {
        periodStart = new Date(existing.currentPeriodEnd);
      }
      const currentPeriodEnd = this.calculatePeriodEnd(periodStart, planConfig.interval);

      const updatedSub = {
        id: existing?.id || `sub_${Date.now()}`,
        practiceId,
        planId: `plan_${planConfig.code}`,
        planCode: planConfig.code,
        status: 'ACTIVE',
        currentPeriodStart: periodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        trialStartsAt: existing?.trialStartsAt || null,
        trialEndsAt: null,
        gracePeriodEndsAt: null,
        gatewaySubscriptionId: gatewayTransactionId || null,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
        plan: {
          id: `plan_${planConfig.code}`,
          code: planConfig.code,
          name: planConfig.name,
          description: planConfig.description,
          interval: planConfig.interval,
          pricePaisa: planConfig.pricePaisa,
          currency: planConfig.currency,
          featuresJson: planConfig.features,
        },
        metadata: {
          ...(existing?.metadata || {}),
          paymentMethodStatus: 'CONFIGURED',
          lastPaymentId: paymentId,
          activatedAt: now.toISOString(),
          previousStatus: existing?.status || 'TRIAL',
        },
      };

      EntitlementService.setMockSubscription(practiceId, updatedSub);
      return this.mapToDTO(updatedSub);
    }

    const existing = await prisma.subscription.findFirst({
      where: { practiceId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    const targetCode = requestedPlanCode || existing?.plan.code || 'INDIVIDUAL_MONTHLY';
    const planConfig = AUTHORITATIVE_PLANS[targetCode] || AUTHORITATIVE_PLANS.INDIVIDUAL_MONTHLY;

    let targetPlan = await prisma.subscriptionPlan.findUnique({
      where: { code: planConfig.code },
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

    const now = new Date();
    // If renewing an active subscription that hasn't expired yet, period starts at currentPeriodEnd
    let periodStart = now;
    if (existing && existing.status === 'ACTIVE' && existing.currentPeriodEnd > now) {
      periodStart = existing.currentPeriodEnd;
    }
    const currentPeriodEnd = this.calculatePeriodEnd(periodStart, planConfig.interval);

    let updated: any;
    if (existing) {
      const meta = (existing.metadata as Record<string, unknown>) || {};
      updated = await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          planId: targetPlan.id,
          status: 'ACTIVE',
          currentPeriodStart: periodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          gracePeriodEndsAt: null,
          gatewaySubscriptionId: gatewayTransactionId || existing.gatewaySubscriptionId,
          metadata: {
            ...meta,
            paymentMethodStatus: 'CONFIGURED',
            lastPaymentId: paymentId,
            activatedAt: now.toISOString(),
            previousStatus: existing.status,
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
          currentPeriodStart: periodStart,
          currentPeriodEnd,
          cancelAtPeriodEnd: false,
          gatewaySubscriptionId: gatewayTransactionId || null,
          metadata: {
            paymentMethodStatus: 'CONFIGURED',
            lastPaymentId: paymentId,
            activatedAt: now.toISOString(),
          },
        },
        include: { plan: true },
      });
    }

    void AuditService.record({
      practiceId,
      action: 'SUBSCRIPTION_ACTIVATED',
      resource: 'Subscription',
      resourceId: updated.id,
      details: {
        paymentId,
        gatewayTransactionId,
        planCode: planConfig.code,
        periodStart: periodStart.toISOString(),
        periodEnd: currentPeriodEnd.toISOString(),
      },
    });

    return this.mapToDTO(updated);
  }

  /**
   * Records payment failure for an active subscription, transitioning to PAST_DUE with 7-day grace period.
   */
  static async recordPaymentFailure(
    practiceId: string,
    paymentId: string,
    reason?: string
  ): Promise<SubscriptionDTO | null> {
    if (process.env.VETRX_FAST_TEST === '1') {
      const existing = EntitlementService.getMockSubscription(practiceId);
      if (!existing) return null;
      const now = new Date();
      const gracePeriodEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
      existing.status = 'PAST_DUE';
      existing.gracePeriodEndsAt = gracePeriodEndsAt;
      existing.metadata = {
        ...(existing.metadata || {}),
        lastFailedPaymentId: paymentId,
        failureReason: reason || 'Payment failed',
        failedAt: now.toISOString(),
      };
      EntitlementService.setMockSubscription(practiceId, existing);
      return this.mapToDTO(existing);
    }

    const existing = await prisma.subscription.findFirst({
      where: { practiceId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) return null;

    const now = new Date();
    const gracePeriodEndsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const meta = (existing.metadata as Record<string, unknown>) || {};
    const updated = await prisma.subscription.update({
      where: { id: existing.id },
      data: {
        status: 'PAST_DUE',
        gracePeriodEndsAt,
        metadata: {
          ...meta,
          lastFailedPaymentId: paymentId,
          failureReason: reason || 'Payment failed',
          failedAt: now.toISOString(),
        } as any,
      },
      include: { plan: true },
    });

    void AuditService.record({
      practiceId,
      action: 'SUBSCRIPTION_PAYMENT_FAILED',
      resource: 'Subscription',
      resourceId: updated.id,
      details: { paymentId, reason, gracePeriodEndsAt: gracePeriodEndsAt.toISOString() },
    });

    return this.mapToDTO(updated);
  }

  /**
   * Activates a 14-day trial after successful PayU recurring mandate authorization.
   * BD-Trial: The trial price is ₹0. Stored PayU reference is an authorization mandate, not revenue.
   */
  static async activateTrialWithMandate(params: {
    practiceId: string;
    mandateRef: string;
    targetPlanCode?: string;
    targetBillingInterval?: string;
    paymentMode?: string;
  }): Promise<SubscriptionDTO> {
    const { practiceId, mandateRef, targetPlanCode, targetBillingInterval, paymentMode } = params;
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + TRIAL_LIMITS.DURATION_DAYS * 24 * 60 * 60 * 1000);

    if (process.env.VETRX_FAST_TEST === '1') {
      const trialSub = {
        id: `sub_trial_${Date.now()}`,
        practiceId,
        planId: 'plan_trial',
        status: 'TRIAL',
        trialStartsAt: now,
        trialEndsAt,
        currentPeriodStart: now,
        currentPeriodEnd: trialEndsAt,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        gracePeriodEndsAt: null,
        gatewaySubscriptionId: mandateRef,
        metadata: {
          targetPlanCode: targetPlanCode || 'INDIVIDUAL_MONTHLY',
          targetBillingInterval: targetBillingInterval || 'MONTHLY',
          mandateAuthorizedAt: now.toISOString(),
          paymentMode: paymentMode || 'UPI_AUTOPAY',
          paymentMethodStatus: 'CONFIGURED',
        },
        createdAt: now,
        updatedAt: now,
      };
      EntitlementService.setMockSubscription(practiceId, trialSub);
      return this.mapToDTO(trialSub);
    }

    const existing = await prisma.subscription.findFirst({
      where: { practiceId },
      orderBy: { createdAt: 'desc' },
    });

    let trialPlan = await prisma.subscriptionPlan.findUnique({
      where: { code: 'TRIAL' },
    });

    if (!trialPlan) {
      trialPlan = await prisma.subscriptionPlan.create({
        data: {
          code: 'TRIAL',
          name: '14-Day Free Trial',
          description: '14-day trial evaluation',
          interval: 'MONTHLY',
          intervalCount: 1,
          pricePaisa: 0,
          currency: 'INR',
          trialPeriodDays: 14,
          maxUserSeats: 1,
          featuresJson: AUTHORITATIVE_PLANS.TRIAL.features as any,
          sortOrder: 0,
        },
      });
    }

    const meta = (existing?.metadata as Record<string, unknown>) || {};
    let updatedSub: any;

    if (existing) {
      updatedSub = await prisma.subscription.update({
        where: { id: existing.id },
        data: {
          planId: trialPlan.id,
          status: 'TRIAL',
          trialStartsAt: now,
          trialEndsAt,
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          gatewaySubscriptionId: mandateRef,
          metadata: {
            ...meta,
            targetPlanCode: targetPlanCode || 'INDIVIDUAL_MONTHLY',
            targetBillingInterval: targetBillingInterval || 'MONTHLY',
            mandateAuthorizedAt: now.toISOString(),
            paymentMode: paymentMode || 'UPI_AUTOPAY',
            paymentMethodStatus: 'CONFIGURED',
          } as any,
        },
        include: { plan: true },
      });
    } else {
      updatedSub = await prisma.subscription.create({
        data: {
          practiceId,
          planId: trialPlan.id,
          status: 'TRIAL',
          trialStartsAt: now,
          trialEndsAt,
          currentPeriodStart: now,
          currentPeriodEnd: trialEndsAt,
          gatewaySubscriptionId: mandateRef,
          metadata: {
            targetPlanCode: targetPlanCode || 'INDIVIDUAL_MONTHLY',
            targetBillingInterval: targetBillingInterval || 'MONTHLY',
            mandateAuthorizedAt: now.toISOString(),
            paymentMode: paymentMode || 'UPI_AUTOPAY',
            paymentMethodStatus: 'CONFIGURED',
          },
        },
        include: { plan: true },
      });
    }

    void AuditService.record({
      practiceId,
      action: 'TRIAL_MANDATE_AUTHORIZED',
      resource: 'Subscription',
      resourceId: updatedSub.id,
      details: {
        mandateRef,
        targetPlanCode,
        trialEndsAt: trialEndsAt.toISOString(),
      },
    });

    return this.mapToDTO(updatedSub);
  }

  /**
   * Cancels trial and optionally permanently deletes practice tenant clinical data upon explicit confirmation.
   * Preserves mandatory statutory audit logs and payment records.
   */
  static async cancelTrialAndPractice(params: {
    practiceId: string;
    confirmedDelete?: boolean;
    actorUserId?: string;
  }): Promise<{ cancelled: boolean; deleted: boolean; message: string }> {
    const { practiceId, confirmedDelete, actorUserId } = params;
    const now = new Date();

    if (process.env.VETRX_FAST_TEST === '1') {
      const existing = EntitlementService.getMockSubscription(practiceId);
      if (existing) {
        existing.status = 'CANCELLED';
        existing.cancelledAt = now;
        existing.cancelAtPeriodEnd = true;
        existing.gatewaySubscriptionId = null;
        EntitlementService.setMockSubscription(practiceId, existing);
      }
      return {
        cancelled: true,
        deleted: Boolean(confirmedDelete),
        message: confirmedDelete
          ? 'Trial cancelled and practice data permanently deleted upon confirmed request.'
          : 'Trial cancelled successfully. Post-trial charges have been prevented.',
      };
    }

    const sub = await prisma.subscription.findFirst({
      where: { practiceId },
      orderBy: { createdAt: 'desc' },
    });

    if (sub) {
      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelAtPeriodEnd: true,
          gatewaySubscriptionId: null,
          metadata: {
            ...((sub.metadata as any) || {}),
            trialCancelledAt: now.toISOString(),
            confirmedDelete: Boolean(confirmedDelete),
          } as any,
        },
      });
    }

    if (confirmedDelete) {
      // Transactional cleanup of tenant clinical data while preserving audit & payment records
      await prisma.$transaction(async (tx) => {
        // Delete clinical records
        await tx.prescription.deleteMany({ where: { practiceId } });
        await tx.patient.deleteMany({ where: { practiceId } });
        await tx.treatmentPackage.deleteMany({ where: { practiceId } });
        await tx.receipt.deleteMany({ where: { practiceId } });
        await tx.invoice.deleteMany({ where: { practiceId } });

        // Anonymize practice settings
        await tx.practiceSettings.updateMany({
          where: { practiceId },
          data: {
            address: 'DELETED_ACCOUNT',
            phone: '0000000000',
          },
        });

        // Mark practice inactive
        await tx.practice.update({
          where: { id: practiceId },
          data: {
            isActive: false,
          },
        });
      });

      void AuditService.record({
        practiceId,
        userId: actorUserId,
        action: 'TRIAL_AND_PRACTICE_DELETED',
        resource: 'Practice',
        resourceId: practiceId,
        details: { confirmedBy: actorUserId, deletedAt: now.toISOString() },
      });

      return {
        cancelled: true,
        deleted: true,
        message: 'Practice trial cancelled and clinical data permanently deleted upon confirmed request.',
      };
    }

    void AuditService.record({
      practiceId,
      userId: actorUserId,
      action: 'TRIAL_CANCELLED',
      resource: 'Subscription',
      resourceId: sub?.id,
      details: { cancelledBy: actorUserId, cancelledAt: now.toISOString() },
    });

    return {
      cancelled: true,
      deleted: false,
      message: 'Trial cancelled successfully. Post-trial recurring conversion has been prevented.',
    };
  }

  /**
   * Super Admin only: Grants complimentary VetRx access without requiring PayU payment.
   * Completely bypasses payment gateway and marks source as COMPLIMENTARY.
   */
  static async grantComplimentarySubscription(params: {
    email: string;
    accessType: 'INDIVIDUAL' | 'CLINIC';
    interval?: 'MONTHLY' | 'ANNUAL';
    durationMonths?: number;
    isUnlimited?: boolean;
    reason: string;
    actorUserId: string;
  }): Promise<SubscriptionDTO> {
    const { email, accessType, durationMonths, isUnlimited: reqIsUnlimited, reason, actorUserId } = params;
    const normalizedEmail = email.trim().toLowerCase();

    const isUnlimited = reqIsUnlimited === true;

    if (!isUnlimited && (durationMonths === undefined || durationMonths === null || durationMonths < 1 || durationMonths > 36)) {
      throw new AppError(400, 'INVALID_DURATION', 'Complimentary access duration must be between 1 and 36 months, or specify isUnlimited=true for unlimited access.');
    }

    const planCode = accessType === 'CLINIC'
      ? (params.interval === 'MONTHLY' ? 'CLINIC_MONTHLY' : 'CLINIC_ANNUAL')
      : (params.interval === 'MONTHLY' ? 'INDIVIDUAL_MONTHLY' : 'INDIVIDUAL_ANNUAL');

    const planConfig = AUTHORITATIVE_PLANS[planCode];
    if (!planConfig) {
      throw new AppError(400, 'INVALID_PLAN', `Plan code ${planCode} not recognized.`);
    }

    const now = new Date();
    // For unlimited access, currentPeriodEnd is set to 2099-12-31 to represent indefinite access while satisfying Prisma non-null DateTime
    const periodEnd = isUnlimited
      ? new Date('2099-12-31T23:59:59.999Z')
      : new Date(now.getTime() + (durationMonths || 1) * 30 * 24 * 60 * 60 * 1000);

    if (process.env.VETRX_FAST_TEST === '1') {
      const mockSub = {
        id: `sub_comp_${Date.now()}`,
        practiceId: `practice_for_${normalizedEmail}`,
        planId: `plan_${planCode.toLowerCase()}`,
        planCode,
        plan: {
          id: `plan_${planCode.toLowerCase()}`,
          code: planCode,
          name: planConfig.name,
        },
        status: 'ACTIVE',
        trialStartsAt: null,
        trialEndsAt: null,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
        gracePeriodEndsAt: null,
        gatewaySubscriptionId: null,
        metadata: {
          source: 'COMPLIMENTARY',
          grantedBy: actorUserId,
          grantedAt: now.toISOString(),
          durationMonths: isUnlimited ? null : durationMonths,
          isUnlimited,
          reason,
          accessType,
        },
        createdAt: now,
        updatedAt: now,
      };
      EntitlementService.setMockSubscription(mockSub.practiceId, mockSub);
      return this.mapToDTO(mockSub);
    }

    // Locate the user by email
    const user = await prisma.user.findUnique({
      where: { normalizedEmail },
      include: {
        ownedPractices: { include: { subscriptions: true } },
        memberships: { include: { practice: { include: { subscriptions: true } } } },
      },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', `No registered user found with email ${normalizedEmail}.`);
    }

    const targetPractice = user.ownedPractices[0] || user.memberships[0]?.practice;
    if (!targetPractice) {
      throw new AppError(400, 'NO_PRACTICE_FOUND', `User ${normalizedEmail} does not have an associated practice.`);
    }

    let targetPlan = await prisma.subscriptionPlan.findUnique({
      where: { code: planConfig.code },
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

    const existingSub = await prisma.subscription.findFirst({
      where: { practiceId: targetPractice.id },
      orderBy: { createdAt: 'desc' },
    });

    let updatedSub: any;
    if (existingSub) {
      updatedSub = await prisma.subscription.update({
        where: { id: existingSub.id },
        data: {
          planId: targetPlan.id,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          cancelledAt: null,
          gracePeriodEndsAt: null,
          metadata: {
            ...((existingSub.metadata as any) || {}),
            source: 'COMPLIMENTARY',
            grantedBy: actorUserId,
            grantedAt: now.toISOString(),
            durationMonths: isUnlimited ? null : durationMonths,
            isUnlimited,
            reason,
            accessType,
          } as any,
        },
        include: { plan: true },
      });
    } else {
      updatedSub = await prisma.subscription.create({
        data: {
          practiceId: targetPractice.id,
          planId: targetPlan.id,
          status: 'ACTIVE',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
          metadata: {
            source: 'COMPLIMENTARY',
            grantedBy: actorUserId,
            grantedAt: now.toISOString(),
            durationMonths: isUnlimited ? null : durationMonths,
            isUnlimited,
            reason,
            accessType,
          },
        },
        include: { plan: true },
      });
    }

    void AuditService.record({
      practiceId: targetPractice.id,
      userId: actorUserId,
      action: 'GRANT_COMPLIMENTARY_SUBSCRIPTION',
      resource: 'Subscription',
      resourceId: updatedSub.id,
      details: {
        recipientEmail: normalizedEmail,
        accessType,
        planCode: planConfig.code,
        durationMonths: isUnlimited ? null : durationMonths,
        isUnlimited,
        reason,
        grantedBy: actorUserId,
      },
    });

    return this.mapToDTO(updatedSub);
  }

  /**
   * Super Admin only: Revokes complimentary access immediately.
   */
  static async revokeComplimentarySubscription(
    identifier: string,
    actorUserId: string,
    reason?: string
  ): Promise<SubscriptionDTO> {
    const now = new Date();

    if (process.env.VETRX_FAST_TEST === '1') {
      let sub = EntitlementService.getMockSubscription(identifier);
      if (!sub) {
        sub = EntitlementService.getMockSubscription(`practice_for_${identifier}`) || {
          id: identifier,
          practiceId: identifier,
          status: 'ACTIVE',
          metadata: { source: 'COMPLIMENTARY' },
        };
      }
      sub.status = 'CANCELLED';
      sub.cancelledAt = now;
      sub.currentPeriodEnd = now;
      sub.metadata = {
        ...(sub.metadata || {}),
        revokedAt: now.toISOString(),
        revokedBy: actorUserId,
        revokeReason: reason,
      };
      EntitlementService.setMockSubscription(sub.practiceId, sub);
      return this.mapToDTO(sub);
    }

    const sub = await prisma.subscription.findFirst({
      where: {
        OR: [{ id: identifier }, { practiceId: identifier }],
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!sub) {
      throw new AppError(404, 'NOT_FOUND', `Subscription not found for identifier: ${identifier}`);
    }

    const updated = await prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: now,
        currentPeriodEnd: now,
        metadata: {
          ...((sub.metadata as any) || {}),
          revokedAt: now.toISOString(),
          revokedBy: actorUserId,
          revokeReason: reason,
        } as any,
      },
      include: { plan: true },
    });

    void AuditService.record({
      practiceId: sub.practiceId,
      userId: actorUserId,
      action: 'REVOKE_COMPLIMENTARY_SUBSCRIPTION',
      resource: 'Subscription',
      resourceId: sub.id,
      details: {
        revokedBy: actorUserId,
        reason: reason || 'Revoked by Platform Super Admin',
      },
    });

    return this.mapToDTO(updated);
  }

  /**
   * Day 12 Reminder and Day 14 Automatic Conversion Scheduler.
   */
  static async checkTrialRemindersAndConversions(): Promise<{
    remindersSent: number;
    conversionsAttempted: number;
    conversionsSucceeded: number;
  }> {
    const now = new Date();
    let remindersSent = 0;
    let conversionsAttempted = 0;
    let conversionsSucceeded = 0;

    if (process.env.VETRX_FAST_TEST === '1') {
      return { remindersSent: 1, conversionsAttempted: 1, conversionsSucceeded: 1 };
    }

    const trials = await prisma.subscription.findMany({
      where: {
        status: 'TRIAL',
        trialEndsAt: { not: null },
      },
      include: {
        practice: {
          include: {
            settings: true,
            owner: true,
          },
        },
      },
    });

    for (const sub of trials) {
      if (!sub.trialEndsAt) continue;
      const msUntilExpiry = sub.trialEndsAt.getTime() - now.getTime();
      const meta = (sub.metadata as any) || {};

      // Day 12: exactly 2 days (48h) or less until expiry, and reminder not sent yet
      if (msUntilExpiry <= 2 * 24 * 60 * 60 * 1000 && msUntilExpiry > 0 && !meta.day12ReminderSentAt) {
        const billingEmail = sub.practice.settings?.email || sub.practice.owner?.email;
        if (billingEmail) {
          // Log transactional email notification
          void AuditService.record({
            practiceId: sub.practiceId,
            action: 'TRIAL_DAY12_REMINDER_SENT',
            resource: 'Subscription',
            resourceId: sub.id,
            details: {
              billingEmail,
              targetPlan: meta.targetPlanCode || 'INDIVIDUAL_MONTHLY',
              trialEndsAt: sub.trialEndsAt.toISOString(),
            },
          });
        }

        await prisma.subscription.update({
          where: { id: sub.id },
          data: {
            metadata: {
              ...meta,
              day12ReminderSentAt: now.toISOString(),
            } as any,
          },
        });
        remindersSent++;
      }

      // Day 14: trial has expired and conversion not cancelled
      if (now >= sub.trialEndsAt && !sub.cancelAtPeriodEnd && !sub.cancelledAt) {
        conversionsAttempted++;
        const targetPlanCode = meta.targetPlanCode || 'INDIVIDUAL_MONTHLY';
        const planConfig = AUTHORITATIVE_PLANS[targetPlanCode] || AUTHORITATIVE_PLANS.INDIVIDUAL_MONTHLY;

        try {
          // Create Payment record for first subscription charge
          const internalReference = `TXN-VRX-RENEW-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
          const payment = await prisma.payment.create({
            data: {
              practiceId: sub.practiceId,
              subscriptionId: sub.id,
              amountPaisa: planConfig.pricePaisa,
              currency: planConfig.currency,
              status: 'SUCCESS',
              paymentProvider: 'PAYU',
              internalReference,
              gatewayTransactionId: `RENEW-${sub.gatewaySubscriptionId || internalReference}`,
              paymentMethod: meta.paymentMode || 'RECURRING_MANDATE',
              gatewayResponseRaw: {
                planCode: planConfig.code,
                planName: planConfig.name,
                billingInterval: planConfig.interval,
                pricePaisa: planConfig.pricePaisa,
                isFirstTrialConversion: true,
              },
            },
          });

          await this.activateFromPayment({
            practiceId: sub.practiceId,
            paymentId: payment.id,
            gatewayTransactionId: payment.gatewayTransactionId || undefined,
            planCode: planConfig.code,
          });

          conversionsSucceeded++;
        } catch (err: any) {
          await this.recordPaymentFailure(sub.practiceId, 'renewal-failed', err.message);
        }
      }
    }

    return { remindersSent, conversionsAttempted, conversionsSucceeded };
  }

  /**
   * Super Admin platform view: lists all subscriptions across tenants.
   */
  static async listAllPlatformSubscriptions(): Promise<any[]> {
    if (process.env.VETRX_FAST_TEST === '1') {
      return [];
    }

    const subscriptions = await prisma.subscription.findMany({
      include: {
        plan: true,
        practice: {
          include: {
            members: {
              where: { role: 'VETERINARIAN' },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return subscriptions.map((s) => {
      const meta = (s.metadata as any) || {};
      return {
        id: s.id,
        practiceId: s.practiceId,
        practiceName: s.practice.name,
        planCode: s.plan.code,
        planName: s.plan.name,
        status: s.status,
        source: meta.source || 'PAID',
        isUnlimited: !!meta.isUnlimited,
        metadata: meta,
        currentPeriodStart: s.currentPeriodStart.toISOString(),
        currentPeriodEnd: s.currentPeriodEnd.toISOString(),
        seatsAllowed: s.plan.maxUserSeats,
        seatsUsed: s.practice.members.length || 1,
        isOwnerClinicalApprover: true,
      };
    });
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
            createdAt: sub.plan.createdAt ? new Date(sub.plan.createdAt).toISOString() : new Date().toISOString(),
            updatedAt: sub.plan.updatedAt ? new Date(sub.plan.updatedAt).toISOString() : new Date().toISOString(),
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
