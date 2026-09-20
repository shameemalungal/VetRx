// ==============================================================================
// VetRx — Commercial REST Controller (Phase 12 Operational API)
// Authenticated endpoints strictly scoped to the tenant practice context.
// ==============================================================================

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePractice } from '../middleware/tenant.js';
import { AppError } from '../middleware/errorHandler.js';
import { CommercialAccountService } from './commercial.service.js';
import { SubscriptionService } from './subscription.service.js';
import { EntitlementService } from './entitlement.service.js';
import { PaymentService } from './payment.service.js';
import { AUTHORITATIVE_PLANS } from './plan.config.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const commercialRouter = Router();

// Enforce strict authentication and server-side practice derivation
commercialRouter.use(requireAuth, requirePractice);

function getPracticeId(req: AuthenticatedRequest): string {
  if (!req.practice?.id) {
    throw new AppError(401, 'UNAUTHORIZED', 'Tenant practice context required.');
  }
  return req.practice.id;
}

const planActionSchema = z.object({
  planCode: z.string().min(1, 'Target plan code is required'),
});

/**
 * GET /api/commercial/plans
 * Returns authoritative catalog of VetRx commercial subscription plans and pricing.
 */
commercialRouter.get('/plans', (_req, res) => {
  const plans = Object.values(AUTHORITATIVE_PLANS).map((p) => ({
    code: p.code,
    name: p.name,
    description: p.description,
    interval: p.interval,
    pricePaisa: p.pricePaisa,
    annualSavingsPaisa: p.annualSavingsPaisa,
    savingsPercentage: p.savingsPercentage,
    currency: p.currency,
    trialPeriodDays: p.trialPeriodDays,
    maxVeterinarianSeats: p.maxVeterinarianSeats,
    maxStaffSeats: p.maxStaffSeats,
    maxPatients: p.maxPatients,
    features: p.features,
    sortOrder: p.sortOrder,
  }));

  res.status(200).json(plans);
});

/**
 * GET /api/commercial/status
 * Returns high-level commercial account status for the authenticated practice.
 */
commercialRouter.get('/status', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const status = await CommercialAccountService.getCommercialStatus(practiceId);
    res.status(200).json(status);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/commercial/subscription
 * Returns active subscription details for the authenticated practice.
 */
commercialRouter.get('/subscription', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const subscription = await SubscriptionService.getPracticeSubscription(practiceId);
    if (!subscription) {
      res.status(200).json({
        subscription: null,
        message: 'Practice is in default foundational trial access.',
      });
      return;
    }
    res.status(200).json(subscription);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/commercial/entitlements
 * Returns resolved capabilities, feature flags, limits, and quotas for the practice.
 */
commercialRouter.get('/entitlements', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const entitlements = await EntitlementService.resolvePracticeEntitlements(practiceId);
    res.status(200).json(entitlements);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/commercial/usage
 * Returns live practice resource consumption against commercial limits.
 */
commercialRouter.get('/usage', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const usage = await EntitlementService.getPracticeUsage(practiceId);
    res.status(200).json(usage);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/commercial/trial/activate
 * Controlled test activation for the 14-day trial.
 */
commercialRouter.post('/trial/activate', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const updated = await SubscriptionService.activateTrial(practiceId);
    res.status(200).json({
      message: 'Trial successfully activated.',
      subscription: updated,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/commercial/subscription/upgrade
 * Immediate plan upgrade (BD-16).
 */
commercialRouter.post('/subscription/upgrade', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const { planCode } = planActionSchema.parse(req.body);
    const updated = await SubscriptionService.upgradePlan(practiceId, planCode);
    res.status(200).json({
      message: `Successfully upgraded to plan ${planCode}.`,
      subscription: updated,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/commercial/subscription/downgrade
 * Scheduled plan downgrade effective at period end with limit validation (BD-17).
 */
commercialRouter.post('/subscription/downgrade', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const { planCode } = planActionSchema.parse(req.body);
    const result = await SubscriptionService.scheduleDowngrade(practiceId, planCode);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/commercial/subscription/cancel
 * Cancellation at period end (BD-18).
 */
commercialRouter.post('/subscription/cancel', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const updated = await SubscriptionService.cancelSubscription(practiceId);
    res.status(200).json({
      message: 'Subscription renewal cancelled. Paid access remains active until the end of your billing period.',
      subscription: updated,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/commercial/subscription/reactivate
 * Reverses pending period-end cancellation.
 */
commercialRouter.post('/subscription/reactivate', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const updated = await SubscriptionService.reactivateSubscription(practiceId);
    res.status(200).json({
      message: 'Subscription successfully reactivated.',
      subscription: updated,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/commercial/payments
 * Lists commercial payments for the authenticated practice.
 */
commercialRouter.get('/payments', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const payments = await PaymentService.getPracticePayments(practiceId);
    res.status(200).json(payments);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/commercial/payments/:id
 * Fetches a single commercial payment strictly within the authenticated practice context.
 */
commercialRouter.get('/payments/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) {
      throw new AppError(400, 'BAD_REQUEST', 'Missing payment ID parameter.');
    }
    const payment = await PaymentService.getPaymentById(id, practiceId);
    if (!payment) {
      throw new AppError(404, 'NOT_FOUND', 'Payment record not found.');
    }
    res.status(200).json(payment);
  } catch (err) {
    next(err);
  }
});
