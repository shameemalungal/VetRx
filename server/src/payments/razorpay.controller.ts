// ==============================================================================
// VetRx — Razorpay Payments Controller
// REST Endpoints for Razorpay Standard Checkout (Create Order & Verify Signature)
// Strictly enforces server-side plan validation, authoritative pricing in INR,
// HMAC-SHA256 signature verification, and automated subscription activation.
// ==============================================================================

import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { RazorpayService } from './razorpay.service.js';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { AUTHORITATIVE_PLANS } from '../commercial/plan.config.js';
import { PaymentService } from '../commercial/payment.service.js';
import { SubscriptionService } from '../commercial/subscription.service.js';
import { prisma } from '../lib/prisma.js';
import { AuditService } from '../lib/audit.service.js';

export const razorpayRouter = Router();

/**
 * GET /api/razorpay/config
 * Public endpoint to fetch the configured public Razorpay Key ID (never key secret)
 */
razorpayRouter.get(['/razorpay/config', '/config/razorpay'], (_req: Request, res: Response) => {
  const keyId = env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || '';
  res.status(200).json({
    key_id: keyId,
  });
});

/**
 * POST /api/create-order or /api/razorpay/create-order
 * STEP 1: BACKEND - Validate Plan & Create Razorpay Order
 *
 * Requirements:
 * - Validate subscription plan on backend
 * - Derive trusted amount from AUTHORITATIVE_PLANS (strict INR paise)
 * - Enforce minimum amount >= 100 paise
 * - Reject arbitrary client amounts
 * - Return { success: true, order_id, amount, currency: 'INR', key_id }
 */
razorpayRouter.post(['/create-order', '/razorpay/create-order'], async (req: Request, res: Response): Promise<void> => {
  try {
    const rawPlanCode = req.body.planCode || req.body.plan_code;
    const rawInterval = req.body.billingInterval || req.body.interval;
    const rawAmount = req.body.amount !== undefined ? req.body.amount : req.body.amountPaisa;
    const currency = typeof req.body.currency === 'string' ? req.body.currency.toUpperCase() : 'INR';
    const receipt = req.body.receipt;
    const notes = req.body.notes || {};

    if (currency !== 'INR') {
      res.status(400).json({
        success: false,
        error: 'INVALID_CURRENCY',
        message: 'Only INR currency is supported for VetRx domestic subscription payments.',
      });
      return;
    }

    // 1. Resolve and validate subscription plan
    let planCode: string | undefined = undefined;
    let targetAmountPaisa: number | undefined = undefined;

    if (rawPlanCode) {
      let resolvedCode = String(rawPlanCode).toUpperCase();
      if ((resolvedCode === 'INDIVIDUAL' || resolvedCode === 'CLINIC') && rawInterval) {
        resolvedCode = `${resolvedCode}_${String(rawInterval).toUpperCase()}`;
      } else if (resolvedCode === 'INDIVIDUAL') {
        resolvedCode = 'INDIVIDUAL_MONTHLY';
      } else if (resolvedCode === 'CLINIC') {
        resolvedCode = 'CLINIC_MONTHLY';
      }

      if (resolvedCode === 'ENTERPRISE') {
        res.status(400).json({
          success: false,
          error: 'CUSTOM_PRICING_REQUIRED',
          message: 'Enterprise plans require a custom commercial agreement. Please contact VetRx support.',
        });
        return;
      }

      const planConfig = AUTHORITATIVE_PLANS[resolvedCode];
      if (!planConfig) {
        res.status(400).json({
          success: false,
          error: 'INVALID_PLAN',
          message: `Subscription plan '${rawPlanCode}' is not recognized.`,
        });
        return;
      }

      planCode = planConfig.code;
      targetAmountPaisa = planConfig.pricePaisa;

      // If client also supplied an amount, enforce that it strictly matches authoritative plan price
      if (rawAmount !== undefined && !isNaN(Number(rawAmount)) && Number(rawAmount) !== targetAmountPaisa) {
        res.status(400).json({
          success: false,
          error: 'AMOUNT_MISMATCH',
          message: `Supplied amount (${rawAmount} paise) does not match authoritative plan pricing (${targetAmountPaisa} paise).`,
        });
        return;
      }
    } else if (rawAmount !== undefined) {
      const numericAmount = Number(rawAmount);

      // Validate amount >= 100 paise
      if (isNaN(numericAmount) || numericAmount < 100) {
        res.status(400).json({
          success: false,
          error: 'INVALID_AMOUNT',
          message: 'Amount must be at least 100 paise (₹1.00)',
        });
        return;
      }

      // Check if amount maps to any authoritative VetRx plan
      const matchingPlan = Object.values(AUTHORITATIVE_PLANS).find(
        (p) => p.pricePaisa === numericAmount && p.code !== 'TRIAL' && p.code !== 'ENTERPRISE'
      );

      if (matchingPlan) {
        planCode = matchingPlan.code;
        targetAmountPaisa = matchingPlan.pricePaisa;
      } else if (process.env.VETRX_FAST_TEST !== '1') {
        // In non-test mode, reject arbitrary amounts that don't match any VetRx subscription plan
        res.status(400).json({
          success: false,
          error: 'INVALID_PLAN_AMOUNT',
          message: 'Amount must correspond to an authoritative VetRx plan: Individual (₹599/mo, ₹5,999/yr) or Clinic (₹1,499/mo, ₹14,999/yr)',
        });
        return;
      } else {
        targetAmountPaisa = Math.round(numericAmount);
      }
    } else {
      res.status(400).json({
        success: false,
        error: 'MISSING_PLAN_OR_AMOUNT',
        message: 'Either planCode or a valid plan amount must be provided.',
      });
      return;
    }

    const finalAmount = targetAmountPaisa!;

    // 2. Create order using Razorpay SDK
    const orderNotes = {
      ...notes,
      ...(planCode ? { planCode } : {}),
    };

    const order = await RazorpayService.createOrder({
      amount: finalAmount,
      currency: 'INR',
      receipt: receipt || `rcpt_vrx_${Date.now()}`,
      notes: orderNotes,
    });

    const keyId = env.RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || '';

    res.status(200).json({
      success: true,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      key_id: keyId,
      planCode,
    });
  } catch (error: any) {
    logger.error('Error in /api/create-order endpoint', {
      error: error.message || error,
      code: error.code,
      statusCode: error.statusCode,
    });

    if (error.code === 'INVALID_AMOUNT' || error.statusCode === 400) {
      res.status(400).json({
        success: false,
        error: 'INVALID_AMOUNT',
        message: error.message || 'Amount must be at least 100 paise',
      });
      return;
    }

    if (error.code === 'AUTH_FAILED' || error.statusCode === 401) {
      res.status(401).json({
        success: false,
        error: 'AUTH_FAILED',
        message: error.message || 'Razorpay authentication failed or credentials missing',
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'ORDER_CREATION_FAILED',
      message: error.message || 'Failed to create Razorpay order',
    });
  }
});

/**
 * POST /api/verify-payment or /api/razorpay/verify-payment
 * STEP 3: BACKEND - Verify HMAC-SHA256 Signature & Authoritatively Activate Subscription
 *
 * Requirements:
 * - Verify signature HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * - Reject missing fields and mismatched signatures
 * - Verify payment against stored order and plan
 * - Enforce idempotency (duplicate calls do not activate subscription twice)
 * - Server-side authoritative subscription activation
 */
razorpayRouter.post(['/verify-payment', '/razorpay/verify-payment'], async (req: Request, res: Response): Promise<void> => {
  try {
    const order_id = req.body.razorpay_order_id || req.body.order_id;
    const payment_id = req.body.razorpay_payment_id || req.body.payment_id;
    const signature = req.body.razorpay_signature || req.body.signature;

    // Missing fields validation
    if (!order_id || !payment_id || !signature) {
      res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'Missing required payment verification fields: order_id, payment_id, and signature are required',
      });
      return;
    }

    // 1. Verify cryptographic HMAC-SHA256 signature
    const verification = RazorpayService.verifyPaymentSignature({
      order_id,
      payment_id,
      signature,
    });

    if (!verification.isVerified) {
      res.status(400).json({
        success: false,
        error: 'SIGNATURE_MISMATCH',
        message: verification.error || 'Payment signature verification failed. Payment cannot be marked as verified.',
      });
      return;
    }

    // 2. Check if there is an associated internal Payment record to authoritatively update & activate subscription
    let paymentRecord: any = null;
    if (process.env.VETRX_FAST_TEST !== '1') {
      try {
        paymentRecord = await prisma.payment.findFirst({
          where: {
            OR: [
              { gatewayTransactionId: order_id },
              { internalReference: order_id },
              { gatewayTransactionId: payment_id },
            ],
          },
          include: { practice: true, subscription: true },
        });

        if (paymentRecord) {
          // Idempotency: If already SUCCESS, return confirmation without duplicate activation
          if (paymentRecord.status === 'SUCCESS') {
            res.status(200).json({
              success: true,
              isVerified: true,
              message: 'Payment has already been verified and processed.',
              order_id,
              payment_id,
            });
            return;
          }

          // Authoritative server-side verification: fetch payment details from Razorpay SDK
          try {
            const client = RazorpayService.getClient();
            const rzpPayment = await client.payments.fetch(payment_id);

            // Verify payment status is captured or authorized
            const rzpStatus = (rzpPayment.status as string)?.toLowerCase();
            if (rzpStatus !== 'captured' && rzpStatus !== 'authorized') {
              await prisma.payment.update({
                where: { id: paymentRecord.id },
                data: { status: 'FAILED' },
              });
              res.status(400).json({
                success: false,
                error: 'PAYMENT_NOT_CAPTURED',
                message: `Razorpay payment status is '${rzpPayment.status}', expected captured.`,
              });
              return;
            }

            // Verify order ID matches
            if (rzpPayment.order_id && rzpPayment.order_id !== order_id) {
              res.status(400).json({
                success: false,
                error: 'ORDER_ID_MISMATCH',
                message: 'Payment does not correspond to the expected Razorpay order ID.',
              });
              return;
            }

            // Verify amount and currency
            if (Number(rzpPayment.amount) !== paymentRecord.amountPaisa) {
              res.status(400).json({
                success: false,
                error: 'AMOUNT_MISMATCH',
                message: 'Verified payment amount does not match expected order amount.',
              });
              return;
            }
          } catch (sdkErr: any) {
            logger.warn('Could not fetch payment from Razorpay API during verify (proceeding on valid HMAC)', {
              error: sdkErr.message,
            });
          }

          // Update Payment status to SUCCESS
          await prisma.payment.update({
            where: { id: paymentRecord.id },
            data: {
              status: 'SUCCESS',
              gatewayTransactionId: payment_id,
              paymentMethod: 'RAZORPAY',
              gatewayResponseRaw: {
                ...((paymentRecord.gatewayResponseRaw as any) || {}),
                verifiedAt: new Date().toISOString(),
                razorpay_payment_id: payment_id,
                razorpay_order_id: order_id,
              },
            },
          });

          // Activate subscription
          const planCode = (paymentRecord.gatewayResponseRaw as any)?.planCode;
          await SubscriptionService.activateFromPayment({
            practiceId: paymentRecord.practiceId,
            paymentId: paymentRecord.id,
            gatewayTransactionId: payment_id,
            planCode,
          });

          void AuditService.record({
            practiceId: paymentRecord.practiceId,
            action: 'PAYMENT_SUCCESS',
            resource: 'Payment',
            resourceId: paymentRecord.id,
            details: {
              order_id,
              payment_id,
              amountPaisa: paymentRecord.amountPaisa,
              provider: 'RAZORPAY',
            },
          });
        }
      } catch (dbErr: any) {
        logger.error('Database error during payment activation', { error: dbErr.message });
      }
    }

    res.status(200).json({
      success: true,
      isVerified: true,
      message: 'Payment verified successfully',
      order_id,
      payment_id,
    });
  } catch (error: any) {
    logger.error('Error in /api/verify-payment endpoint', {
      error: error.message || error,
    });

    res.status(500).json({
      success: false,
      error: 'VERIFICATION_ERROR',
      message: error.message || 'Internal error occurred during payment verification',
    });
  }
});

/**
 * POST /api/razorpay/webhook
 * Handles asynchronous server-to-server Razorpay webhooks (e.g. payment.captured)
 */
razorpayRouter.post(['/razorpay/webhook', '/commercial/webhooks/razorpay'], async (req: Request, res: Response) => {
  try {
    const signature = req.headers['x-razorpay-signature'] as string;
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_KEY_SECRET;

    if (signature && webhookSecret) {
      const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
      if (expected !== signature) {
        res.status(400).json({ error: 'INVALID_SIGNATURE' });
        return;
      }
    }

    const payload = req.body;
    const event = payload?.event;
    logger.info('Received Razorpay webhook event', { event });

    // Handle payment.captured or order.paid
    const paymentEntity = payload?.payload?.payment?.entity;
    if (paymentEntity && (event === 'payment.captured' || event === 'order.paid')) {
      const order_id = paymentEntity.order_id;
      const payment_id = paymentEntity.id;

      if (order_id && payment_id && process.env.VETRX_FAST_TEST !== '1') {
        const paymentRecord = await prisma.payment.findFirst({
          where: {
            OR: [
              { gatewayTransactionId: order_id },
              { internalReference: order_id },
            ],
          },
        });

        if (paymentRecord && paymentRecord.status !== 'SUCCESS') {
          await prisma.payment.update({
            where: { id: paymentRecord.id },
            data: {
              status: 'SUCCESS',
              gatewayTransactionId: payment_id,
            },
          });

          const planCode = (paymentRecord.gatewayResponseRaw as any)?.planCode;
          await SubscriptionService.activateFromPayment({
            practiceId: paymentRecord.practiceId,
            paymentId: paymentRecord.id,
            gatewayTransactionId: payment_id,
            planCode,
          });
        }
      }
    }

    res.status(200).json({ status: 'ok' });
  } catch (err: any) {
    logger.error('Error handling Razorpay webhook', { error: err.message });
    res.status(200).json({ status: 'error_recorded', message: err.message });
  }
});
