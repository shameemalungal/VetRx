// ==============================================================================
// VetRx — Commercial REST Controller (Phase 10 Foundation)
// Read-only foundational endpoints scoped strictly to the authenticated tenant practice.
// ==============================================================================

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePractice } from '../middleware/tenant.js';
import { AppError } from '../middleware/errorHandler.js';
import { CommercialAccountService } from './commercial.service.js';
import { SubscriptionService } from './subscription.service.js';
import { EntitlementService } from './entitlement.service.js';
import { PaymentService } from './payment.service.js';
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
 * Returns resolved capabilities, feature flags, and quotas for the authenticated practice.
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
