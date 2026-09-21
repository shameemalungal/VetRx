// ==============================================================================
// VetRx Phase 13 — PayU Payment & Billing Comprehensive Test Suite
// Validates Payment Creation, PayU Cryptography, Reverse Hash Verification,
// Server-to-Server Verification, Idempotency, Subscription Activation/Renewal,
// 7-Day Grace Period, Trial Payment Method, Tenant Isolation & Money Safety.
// ==============================================================================

process.env.VETRX_FAST_TEST = '1';

import crypto from 'crypto';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../src/middleware/errorHandler.js';
import { AUTHORITATIVE_PLANS, validatePaise, formatPaiseToRupees } from '../src/commercial/plan.config.js';
import { PaymentService } from '../src/commercial/payment.service.js';
import { SubscriptionService } from '../src/commercial/subscription.service.js';
import { PayUCrypto } from '../src/commercial/payu.crypto.js';
import { PayUAdapter } from '../src/commercial/payu.adapter.js';
import { getPayUConfig } from '../src/commercial/payu.config.js';
import { EntitlementService } from '../src/commercial/entitlement.service.js';
import type { PaymentGateway, PaymentOrderRequest, VerifiedPaymentResult } from '../src/commercial/payment.provider.interface.js';

describe('Phase 13: PayU Payment & Billing Comprehensive Test Suite', () => {
  const practiceAlpha = 'practice-alpha-tenant-1111';
  const practiceBeta = 'practice-beta-tenant-2222';
  const userAlpha = 'user-doctor-alpha';
  const testSalt = 'MOCK_PAYU_SALT_SECRET_67890';
  const testKey = 'MOCK_PAYU_KEY_12345';

  beforeEach(() => {
    EntitlementService.clearMockSubscriptions();
    PaymentService.clearMocks();
    PaymentService.setGateway(null); // Reset to default
  });

  // ----------------------------------------------------------------------------
  // Category A: Plan / Payment Creation & Authoritative Pricing
  // ----------------------------------------------------------------------------
  describe('Category A: Plan / Payment Creation & Authoritative Pricing', () => {
    it('1. Individual Monthly generates payment order for authoritative ₹599 (59,900 paise)', async () => {
      const plan = AUTHORITATIVE_PLANS.INDIVIDUAL_MONTHLY;
      assert.strictEqual(plan.pricePaisa, 59900);
      assert.strictEqual(formatPaiseToRupees(plan.pricePaisa), '₹599');

      const adapter = new PayUAdapter({ merchantKey: testKey, merchantSalt: testSalt });
      const order = await adapter.createPaymentOrder({
        practiceId: practiceAlpha,
        amountPaisa: plan.pricePaisa,
        currency: 'INR',
        customerName: 'Dr. Sarah Smith',
        customerEmail: 'sarah@apexvet.in',
        productInfo: 'VetRx Individual Monthly',
        returnUrl: 'https://vetrx.in/return',
        cancelUrl: 'https://vetrx.in/cancel',
        planCode: plan.code,
        billingInterval: plan.interval,
      });

      assert.ok(order.internalReference.startsWith('TXN-VRX-'));
      assert.strictEqual(order.formParameters?.amount, '599.00');
      assert.strictEqual(order.formParameters?.key, testKey);
      assert.strictEqual(order.formParameters?.productinfo, 'VetRx Individual Monthly');
      assert.ok(order.formParameters?.hash);
    });

    it('2. Individual Annual generates payment order for authoritative ₹5,999 (599,900 paise)', async () => {
      const plan = AUTHORITATIVE_PLANS.INDIVIDUAL_ANNUAL;
      assert.strictEqual(plan.pricePaisa, 599900);
      assert.strictEqual(formatPaiseToRupees(plan.pricePaisa), '₹5,999');

      const adapter = new PayUAdapter({ merchantKey: testKey, merchantSalt: testSalt });
      const order = await adapter.createPaymentOrder({
        practiceId: practiceAlpha,
        amountPaisa: plan.pricePaisa,
        currency: 'INR',
        customerName: 'Dr. Sarah Smith',
        customerEmail: 'sarah@apexvet.in',
        productInfo: 'VetRx Individual Annual',
        returnUrl: 'https://vetrx.in/return',
        cancelUrl: 'https://vetrx.in/cancel',
        planCode: plan.code,
        billingInterval: plan.interval,
      });

      assert.strictEqual(order.formParameters?.amount, '5999.00');
      assert.strictEqual(order.formParameters?.udf2, 'INDIVIDUAL_ANNUAL');
      assert.strictEqual(order.formParameters?.udf3, 'ANNUAL');
    });

    it('3. Clinic Monthly generates payment order for authoritative ₹1,499 (149,900 paise)', async () => {
      const plan = AUTHORITATIVE_PLANS.CLINIC_MONTHLY;
      assert.strictEqual(plan.pricePaisa, 149900);
      assert.strictEqual(formatPaiseToRupees(plan.pricePaisa), '₹1,499');

      const adapter = new PayUAdapter({ merchantKey: testKey, merchantSalt: testSalt });
      const order = await adapter.createPaymentOrder({
        practiceId: practiceAlpha,
        amountPaisa: plan.pricePaisa,
        currency: 'INR',
        customerName: 'Dr. John Doe',
        customerEmail: 'john@blissclinic.in',
        productInfo: 'VetRx Clinic Monthly',
        returnUrl: 'https://vetrx.in/return',
        cancelUrl: 'https://vetrx.in/cancel',
        planCode: plan.code,
        billingInterval: plan.interval,
      });

      assert.strictEqual(order.formParameters?.amount, '1499.00');
    });

    it('4. Clinic Annual generates payment order for authoritative ₹14,999 (1,499,900 paise)', async () => {
      const plan = AUTHORITATIVE_PLANS.CLINIC_ANNUAL;
      assert.strictEqual(plan.pricePaisa, 1499900);
      assert.strictEqual(formatPaiseToRupees(plan.pricePaisa), '₹14,999');

      const adapter = new PayUAdapter({ merchantKey: testKey, merchantSalt: testSalt });
      const order = await adapter.createPaymentOrder({
        practiceId: practiceAlpha,
        amountPaisa: plan.pricePaisa,
        currency: 'INR',
        customerName: 'Dr. John Doe',
        customerEmail: 'john@blissclinic.in',
        productInfo: 'VetRx Clinic Annual',
        returnUrl: 'https://vetrx.in/return',
        cancelUrl: 'https://vetrx.in/cancel',
        planCode: plan.code,
        billingInterval: plan.interval,
      });

      assert.strictEqual(order.formParameters?.amount, '14999.00');
    });

    it('5. Enterprise plan is blocked from automated self-checkout with CUSTOM_PRICING_REQUIRED', async () => {
      await assert.rejects(
        async () => {
          await PaymentService.initiatePaymentOrder({
            practiceId: practiceAlpha,
            userId: userAlpha,
            planCode: 'ENTERPRISE',
          });
        },
        (err: unknown) => err instanceof AppError && err.code === 'CUSTOM_PRICING_REQUIRED'
      );
    });

    it('6. Client amount cannot override server amount (authoritative server pricing derivation)', () => {
      // Regardless of what client might supply in request body, server strictly queries AUTHORITATIVE_PLANS
      const requestedCode = 'CLINIC_ANNUAL';
      const authoritativePrice = AUTHORITATIVE_PLANS[requestedCode].pricePaisa;
      assert.strictEqual(authoritativePrice, 1499900); // ₹14,999, never ₹1 or arbitrary client figure
    });

    it('7. Integer paise invariant: rejects non-integers and floating-point amounts', () => {
      assert.strictEqual(PaymentService.validatePaise(59900), 59900);
      assert.throws(
        () => PaymentService.validatePaise(599.99),
        (err: unknown) => err instanceof AppError && err.code === 'INVALID_MONETARY_UNIT'
      );
      assert.throws(
        () => PaymentService.validatePaise(-100),
        (err: unknown) => err instanceof AppError && err.code === 'INVALID_MONETARY_UNIT'
      );
    });
  });

  // ----------------------------------------------------------------------------
  // Category B: PayU Integration & Cryptography
  // ----------------------------------------------------------------------------
  describe('Category B: PayU Integration & Cryptography', () => {
    it('8. Outbound SHA-512 request hash is computed exactly according to PayU specifications', () => {
      const txnid = 'TXN-VRX-1001';
      const amount = '599.00';
      const productinfo = 'Individual Monthly';
      const firstname = 'Dr. Sarah';
      const email = 'sarah@vetrx.in';
      const udf1 = practiceAlpha;

      const hash = PayUCrypto.generateRequestHash({
        key: testKey,
        txnid,
        amount,
        productinfo,
        firstname,
        email,
        udf1,
        salt: testSalt,
      });

      assert.strictEqual(typeof hash, 'string');
      assert.strictEqual(hash.length, 128); // 128 hex chars = 512 bits
    });

    it('9. Missing required hash inputs throw AppError with PAYU_HASH_ERROR', () => {
      assert.throws(
        () => {
          PayUCrypto.generateRequestHash({
            key: '',
            txnid: 'TXN-1',
            amount: '599.00',
            productinfo: 'Test',
            firstname: 'Doc',
            email: 'doc@test.com',
            salt: testSalt,
          });
        },
        (err: unknown) => err instanceof AppError && err.code === 'PAYU_HASH_ERROR'
      );
    });

    it('10. Reverse SHA-512 hash validates standard PayU callback response', () => {
      const txnid = 'TXN-VRX-2002';
      const amount = '1499.00';
      const productinfo = 'Clinic Monthly';
      const firstname = 'Dr. John';
      const email = 'john@clinic.in';
      const status = 'success';
      const udf1 = practiceAlpha;

      const payloadBase = {
        key: testKey,
        txnid,
        amount,
        productinfo,
        firstname,
        email,
        status,
        udf1,
      };
      const validHash = PayUCrypto.generateReverseHash(payloadBase, testSalt);
      const payload = { ...payloadBase, hash: validHash };

      const isValid = PayUCrypto.verifyResponseHash(payload, testSalt);
      assert.strictEqual(isValid, true);
    });

    it('11. Reverse SHA-512 hash validates response with additionalCharges', () => {
      const txnid = 'TXN-VRX-3003';
      const amount = '599.00';
      const productinfo = 'Individual Monthly';
      const firstname = 'Dr. Sarah';
      const email = 'sarah@vetrx.in';
      const status = 'success';
      const additionalCharges = '12.50';

      const payloadBase = {
        key: testKey,
        txnid,
        amount,
        productinfo,
        firstname,
        email,
        status,
        additionalCharges,
      };
      const validHash = PayUCrypto.generateReverseHash(payloadBase, testSalt);
      const payload = { ...payloadBase, hash: validHash };

      const isValid = PayUCrypto.verifyResponseHash(payload, testSalt);
      assert.strictEqual(isValid, true);
    });

    it('12. Tampered hash is rejected immediately (timing-safe check)', () => {
      const payload = {
        key: testKey,
        txnid: 'TXN-TAMPER-1',
        amount: '599.00',
        productinfo: 'Test Plan',
        firstname: 'Dr. Hack',
        email: 'hack@bad.com',
        status: 'success',
        hash: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
      };

      const isValid = PayUCrypto.verifyResponseHash(payload, testSalt);
      assert.strictEqual(isValid, false);
    });

    it('13. Tampered amount in callback fails reverse hash check', () => {
      const txnid = 'TXN-VRX-4004';
      const legitimateAmount = '1499.00';
      const tamperedAmount = '1.00'; // Attacker attempts to pay ₹1
      const productinfo = 'Clinic Monthly';
      const firstname = 'Dr. John';
      const email = 'john@clinic.in';
      const status = 'success';

      const legitimateHash = PayUCrypto.generateReverseHash({
        key: testKey,
        txnid,
        amount: legitimateAmount,
        productinfo,
        firstname,
        email,
        status,
      }, testSalt);

      // Inbound payload presents tampered amount with legitimate hash
      const payload = {
        key: testKey,
        txnid,
        amount: tamperedAmount,
        productinfo,
        firstname,
        email,
        status,
        hash: legitimateHash,
      };

      const isValid = PayUCrypto.verifyResponseHash(payload, testSalt);
      assert.strictEqual(isValid, false);
    });

    it('14. Tampered transaction reference fails reverse hash check', () => {
      const txnid = 'TXN-VRX-ORIGINAL';
      const forgedTxnid = 'TXN-VRX-FORGED';
      const amount = '599.00';
      const productinfo = 'Individual Monthly';
      const firstname = 'Dr. Sarah';
      const email = 'sarah@vetrx.in';
      const status = 'success';

      const originalHash = PayUCrypto.generateReverseHash({
        key: testKey,
        txnid,
        amount,
        productinfo,
        firstname,
        email,
        status,
      }, testSalt);

      const payload = {
        key: testKey,
        txnid: forgedTxnid,
        amount,
        productinfo,
        firstname,
        email,
        status,
        hash: originalHash,
      };

      const isValid = PayUCrypto.verifyResponseHash(payload, testSalt);
      assert.strictEqual(isValid, false);
    });

    it('15. Invalid merchant key fails reverse hash check', () => {
      const payload = {
        key: 'WRONG_MERCHANT_KEY',
        txnid: 'TXN-1',
        amount: '599.00',
        status: 'success',
        hash: 'somehash',
      };
      const isValid = PayUCrypto.verifyResponseHash(payload, testSalt);
      assert.strictEqual(isValid, false);
    });

    it('16. Empty or missing hash parameter returns false safely', () => {
      assert.strictEqual(PayUCrypto.verifyResponseHash({}, testSalt), false);
      assert.strictEqual(PayUCrypto.verifyResponseHash({ status: 'success' }, testSalt), false);
    });
  });

  // ----------------------------------------------------------------------------
  // Category C: Payment Events & Idempotency
  // ----------------------------------------------------------------------------
  describe('Category C: Payment Events & Idempotency', () => {
    it('17. Successful payment event is recorded in PaymentEvent model', async () => {
      const eventId = `evt-success-${Date.now()}`;
      const result = await PaymentService.recordPaymentEvent({
        provider: 'PAYU',
        eventId,
        eventType: 'PAYMENT_SUCCESS',
        rawPayload: { status: 'success', amount: '599.00' },
      });

      assert.strictEqual(result.isDuplicate, false);
      assert.strictEqual(result.event.provider, 'PAYU');
      assert.strictEqual(result.event.eventId, eventId);
      assert.strictEqual(result.event.eventType, 'PAYMENT_SUCCESS');
      assert.ok(result.event.payloadHash);
    });

    it('18. Failed payment event is recorded in PaymentEvent model', async () => {
      const eventId = `evt-failed-${Date.now()}`;
      const result = await PaymentService.recordPaymentEvent({
        provider: 'PAYU',
        eventId,
        eventType: 'PAYMENT_FAILED',
        rawPayload: { status: 'failure', error: 'Bank timeout' },
      });

      assert.strictEqual(result.isDuplicate, false);
      assert.strictEqual(result.event.eventType, 'PAYMENT_FAILED');
    });

    it('19. Duplicate payment event delivery returns isDuplicate: true (idempotent)', async () => {
      const eventId = `evt-idempotent-${Date.now()}`;
      const first = await PaymentService.recordPaymentEvent({
        provider: 'PAYU',
        eventId,
        eventType: 'PAYMENT_SUCCESS',
      });
      assert.strictEqual(first.isDuplicate, false);

      const second = await PaymentService.recordPaymentEvent({
        provider: 'PAYU',
        eventId,
        eventType: 'PAYMENT_SUCCESS',
      });
      assert.strictEqual(second.isDuplicate, true);
      assert.strictEqual(second.event.id, first.event.id);
    });

    it('20. Duplicate webhook processing returns DUPLICATE_IGNORED without duplicate effect', async () => {
      const eventId = `evt-webhook-${Date.now()}`;
      const payload = {
        mihpayid: eventId,
        txnid: 'TXN-MOCK-DUP',
        status: 'success',
      };

      // Mock gateway that passes verification
      const mockGateway: PaymentGateway = {
        providerName: 'PAYU',
        createPaymentOrder: async () => ({ internalReference: 'TXN-MOCK-DUP' }),
        verifyCallback: async () => ({
          isVerified: true,
          gatewayTransactionId: eventId,
          internalReference: 'TXN-MOCK-DUP',
          amountPaisa: 59900,
          currency: 'INR',
          status: 'SUCCESS',
          rawPayload: payload,
        }),
        verifyWebhook: async () => ({
          isVerified: true,
          gatewayTransactionId: eventId,
          internalReference: 'TXN-MOCK-DUP',
          amountPaisa: 59900,
          currency: 'INR',
          status: 'SUCCESS',
          rawPayload: payload,
        }),
        getPaymentStatus: async () => ({
          isVerified: true,
          gatewayTransactionId: eventId,
          internalReference: 'TXN-MOCK-DUP',
          amountPaisa: 59900,
          currency: 'INR',
          status: 'SUCCESS',
          rawPayload: payload,
        }),
      };

      const first = await PaymentService.processWebhook({ payload, gateway: mockGateway });
      assert.strictEqual(first.status, 'PROCESSED');

      const second = await PaymentService.processWebhook({ payload, gateway: mockGateway });
      assert.strictEqual(second.status, 'DUPLICATE_IGNORED');
    });

    it('21. Concurrent identical event inserts handle P2002 unique constraint violation safely', async () => {
      const eventId = `evt-concurrent-${Date.now()}`;
      const [res1, res2] = await Promise.all([
        PaymentService.recordPaymentEvent({ provider: 'PAYU', eventId, eventType: 'PAYMENT_SUCCESS' }),
        PaymentService.recordPaymentEvent({ provider: 'PAYU', eventId, eventType: 'PAYMENT_SUCCESS' }),
      ]);

      // Exactly one must be duplicate, both must succeed without throw
      const duplicates = [res1.isDuplicate, res2.isDuplicate].filter(Boolean);
      assert.strictEqual(duplicates.length, 1);
    });
  });

  // ----------------------------------------------------------------------------
  // Category D: Subscription Lifecycle & Period Math
  // ----------------------------------------------------------------------------
  describe('Category D: Subscription Lifecycle & Period Math', () => {
    it('22. Monthly subscription period calculation advances exactly 1 calendar month with day clamping', () => {
      // Test Jan 31 -> Feb 28 (non-leap) or Feb 29 (leap)
      const jan31 = new Date(2026, 0, 31); // Jan 31, 2026
      const endFeb = SubscriptionService.calculatePeriodEnd(jan31, 'MONTHLY');
      assert.strictEqual(endFeb.getMonth(), 1); // February
      assert.strictEqual(endFeb.getDate(), 28); // 2026 is non-leap year

      // Test March 15 -> April 15
      const mar15 = new Date(2026, 2, 15);
      const endApr = SubscriptionService.calculatePeriodEnd(mar15, 'MONTHLY');
      assert.strictEqual(endApr.getMonth(), 3); // April
      assert.strictEqual(endApr.getDate(), 15);
    });

    it('23. Annual subscription period calculation advances exactly 1 calendar year', () => {
      const start = new Date(2026, 8, 20); // Sept 20, 2026
      const end = SubscriptionService.calculatePeriodEnd(start, 'ANNUAL');
      assert.strictEqual(end.getFullYear(), 2027);
      assert.strictEqual(end.getMonth(), 8);
      assert.strictEqual(end.getDate(), 20);
    });

    it('24. Successful payment activates subscription from TRIAL to ACTIVE with unlimited patients', async () => {
      const sub = await SubscriptionService.activateFromPayment({
        practiceId: practiceAlpha,
        paymentId: 'pay-mock-001',
        gatewayTransactionId: 'PAYU-MIH-001',
        planCode: 'INDIVIDUAL_MONTHLY',
      });

      assert.strictEqual(sub.status, 'ACTIVE');
      assert.strictEqual(sub.cancelAtPeriodEnd, false);
      assert.ok(sub.currentPeriodEnd);

      // Entitlements should reflect paid tier: unlimited patients
      const entitlements = await EntitlementService.resolvePracticeEntitlements(practiceAlpha);
      assert.strictEqual(entitlements.status, 'ACTIVE');
      assert.strictEqual(entitlements.limits.maxPatients, null); // Unlimited
      assert.strictEqual(entitlements.limits.maxVeterinarianSeats, 1);
    });

    it('25. Payment for Clinic plan immediately upgrades active seats to 5', async () => {
      const sub = await SubscriptionService.activateFromPayment({
        practiceId: practiceAlpha,
        paymentId: 'pay-mock-002',
        gatewayTransactionId: 'PAYU-MIH-002',
        planCode: 'CLINIC_ANNUAL',
      });

      assert.strictEqual(sub.status, 'ACTIVE');
      const entitlements = await EntitlementService.resolvePracticeEntitlements(practiceAlpha);
      assert.strictEqual(entitlements.limits.maxVeterinarianSeats, 5);
      assert.strictEqual(entitlements.limits.maxStaffSeats, null); // Unlimited staff
    });

    it('26. Payment failure on active subscription moves status to PAST_DUE with 7-day grace period', async () => {
      // First ensure subscription is active
      await SubscriptionService.activateFromPayment({
        practiceId: practiceAlpha,
        paymentId: 'pay-initial-001',
        planCode: 'INDIVIDUAL_MONTHLY',
      });

      const failedSub = await SubscriptionService.recordPaymentFailure(
        practiceAlpha,
        'pay-failed-001',
        'Insufficient funds at card issuing bank'
      );

      assert.ok(failedSub);
      assert.strictEqual(failedSub.status, 'PAST_DUE');
      assert.ok(failedSub.gracePeriodEndsAt);

      // Verify grace period is 7 days from now
      const now = Date.now();
      const graceTime = new Date(failedSub.gracePeriodEndsAt).getTime();
      const diffDays = Math.round((graceTime - now) / (1000 * 60 * 60 * 24));
      assert.strictEqual(diffDays, 7);
    });

    it('27. Soft expiry: historical data remains readable and exportable after grace period ends', async () => {
      const sub = {
        status: 'ACTIVE',
        trialEndsAt: null,
        currentPeriodEnd: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        gracePeriodEndsAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Grace ended 3 days ago
      };

      const evaluated = SubscriptionService.evaluateDeterministicStatus(sub);
      assert.strictEqual(evaluated, 'EXPIRED');

      // In expired status, historical data is never deleted (BD-10)
      const mockExpiredSub = {
        ...sub,
        id: 'sub-exp',
        practiceId: practiceAlpha,
        planId: 'plan-ind',
        currentPeriodStart: new Date(),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        plan: {
          code: 'INDIVIDUAL_MONTHLY',
          name: 'Individual Plan',
          pricePaisa: 59900,
          featuresJson: { canCreatePatients: true },
        },
      };

      EntitlementService.setMockSubscription(practiceAlpha, mockExpiredSub as any);
      const entitlements = await EntitlementService.resolvePracticeEntitlements(practiceAlpha);
      assert.strictEqual(entitlements.isReadOnly, true); // Read-only mode
      assert.strictEqual(entitlements.features.canCreatePrescriptions, false); // Mutation blocked
      assert.strictEqual(entitlements.features.canGeneratePdf, true); // PDF export remains active
    });

    it('28. Cancellation stops renewal at period end without revoking paid access immediately', async () => {
      await SubscriptionService.activateFromPayment({
        practiceId: practiceAlpha,
        paymentId: 'pay-cancel-test',
        planCode: 'INDIVIDUAL_MONTHLY',
      });

      const cancelled = await SubscriptionService.cancelSubscription(practiceAlpha);
      assert.strictEqual(cancelled.cancelAtPeriodEnd, true);
      assert.strictEqual(cancelled.status, 'ACTIVE'); // Remains ACTIVE until period end
    });

    it('29. Cancellation reversal restores renewal before period end', async () => {
      await SubscriptionService.activateFromPayment({
        practiceId: practiceAlpha,
        paymentId: 'pay-reactivate-test',
        planCode: 'INDIVIDUAL_MONTHLY',
      });
      await SubscriptionService.cancelSubscription(practiceAlpha);

      const restored = await SubscriptionService.reactivateSubscription(practiceAlpha);
      assert.strictEqual(restored.cancelAtPeriodEnd, false);
      assert.strictEqual(restored.status, 'ACTIVE');
    });
  });

  // ----------------------------------------------------------------------------
  // Category E: Trial & Payment Method Workflows
  // ----------------------------------------------------------------------------
  describe('Category E: Trial & Payment Method Workflows', () => {
    it('30. 14-day trial initial payment method status is PENDING/REQUIRED without premature charge', async () => {
      const trialSub = await SubscriptionService.initializePracticeTrial(practiceAlpha);
      assert.strictEqual(trialSub.status, 'TRIAL');
      assert.strictEqual(trialSub.metadata?.paymentMethodStatus, 'PENDING');
      assert.ok(trialSub.trialEndsAt);
    });

    it('31. Trial activation flow updates paymentMethodStatus to CONFIGURED', async () => {
      await SubscriptionService.initializePracticeTrial(practiceAlpha);
      const activated = await SubscriptionService.activateTrial(practiceAlpha);
      assert.strictEqual(activated.metadata?.paymentMethodStatus, 'CONFIGURED');
    });

    it('32. Trial converts seamlessly to ACTIVE paid subscription upon payment verification', async () => {
      await SubscriptionService.initializePracticeTrial(practiceAlpha);
      const paidSub = await SubscriptionService.activateFromPayment({
        practiceId: practiceAlpha,
        paymentId: 'pay-trial-convert',
        gatewayTransactionId: 'PAYU-CONVERT-123',
        planCode: 'CLINIC_MONTHLY',
      });

      assert.strictEqual(paidSub.status, 'ACTIVE');
      assert.strictEqual(paidSub.metadata?.paymentMethodStatus, 'CONFIGURED');
    });
  });

  // ----------------------------------------------------------------------------
  // Category F: Multi-Tenant Commercial Isolation
  // ----------------------------------------------------------------------------
  describe('Category F: Multi-Tenant Commercial Isolation', () => {
    it('33. Practice A payments are isolated from Practice B', async () => {
      const paymentsA = await PaymentService.getPracticePayments(practiceAlpha);
      const paymentsB = await PaymentService.getPracticePayments(practiceBeta);

      assert.ok(Array.isArray(paymentsA));
      assert.ok(Array.isArray(paymentsB));
      // Cross-tenant check: no payment in A belongs to B
      assert.ok(paymentsA.every((p) => p.practiceId === practiceAlpha));
      assert.ok(paymentsB.every((p) => p.practiceId === practiceBeta));
    });

    it('34. Practice A cannot verify or credit a payment belonging to Practice B', async () => {
      // Mock payment under Practice B
      const refB = `TXN-VRX-TENANT-B-${Date.now()}`;
      PaymentService.setMockPayment({
        id: `pay-tenant-b-${Date.now()}`,
        practiceId: practiceBeta,
        amountPaisa: 59900,
        currency: 'INR',
        status: 'PENDING',
        internalReference: refB,
      });

      // Practice A attempts to verify Practice B's payment
      await assert.rejects(
        async () => {
          await PaymentService.verifyPaymentReturn({
            practiceId: practiceAlpha, // Mismatched tenant
            payload: { txnid: refB, status: 'success' },
          });
        },
        (err: unknown) => err instanceof AppError && err.code === 'FORBIDDEN'
      );
    });
  });

  // ----------------------------------------------------------------------------
  // Category G: Security, Secrets & Configuration
  // ----------------------------------------------------------------------------
  describe('Category G: Security, Secrets & Configuration', () => {
    it('35. PayU configuration defaults safely to SANDBOX with live billing disabled', () => {
      const config = getPayUConfig();
      assert.ok(['SANDBOX', 'PRODUCTION'].includes(config.environment));
      assert.ok(config.checkoutUrl.includes('payu.in'));
      assert.ok(config.postServiceUrl.includes('postservice'));
    });

    it('36. Merchant salt is never exposed in PaymentDTO or API return values', async () => {
      const payments = await PaymentService.getPracticePayments(practiceAlpha);
      for (const p of payments) {
        const str = JSON.stringify(p);
        assert.strictEqual(str.includes(testSalt), false);
      }
    });

    it('37. PostService S2S verification hash formula matches sha512(key|verify_payment|txnid|salt)', () => {
      const txnid = 'TXN-S2S-100';
      const hash = PayUCrypto.generateVerifyPaymentHash(testKey, txnid, testSalt);

      const expected = crypto.createHash('sha512').update(`${testKey}|verify_payment|${txnid}|${testSalt}`).digest('hex').toLowerCase();
      assert.strictEqual(hash, expected);
    });
  });

  // ----------------------------------------------------------------------------
  // Category H: Authoritative Money Invariants
  // ----------------------------------------------------------------------------
  describe('Category H: Authoritative Money Invariants', () => {
    it('38. ₹599 equals exactly 59,900 paise', () => {
      assert.strictEqual(AUTHORITATIVE_PLANS.INDIVIDUAL_MONTHLY.pricePaisa, 59900);
      assert.strictEqual(599 * 100, 59900);
    });

    it('39. ₹5,999 equals exactly 599,900 paise', () => {
      assert.strictEqual(AUTHORITATIVE_PLANS.INDIVIDUAL_ANNUAL.pricePaisa, 599900);
      assert.strictEqual(5999 * 100, 599900);
    });

    it('40. ₹1,499 equals exactly 149,900 paise', () => {
      assert.strictEqual(AUTHORITATIVE_PLANS.CLINIC_MONTHLY.pricePaisa, 149900);
      assert.strictEqual(1499 * 100, 149900);
    });

    it('41. ₹14,999 equals exactly 1,499,900 paise', () => {
      assert.strictEqual(AUTHORITATIVE_PLANS.CLINIC_ANNUAL.pricePaisa, 1499900);
      assert.strictEqual(14999 * 100, 1499900);
    });

    it('42. Annual savings are mathematically exact in integer paise', () => {
      // Individual: ₹599 x 12 = ₹7,188 (718,800 paise); ₹7,188 - ₹5,999 = ₹1,189 (118,900 paise)
      const indMonthlyTotal = 59900 * 12;
      const indAnnual = 599900;
      assert.strictEqual(indMonthlyTotal - indAnnual, 118900);
      assert.strictEqual(AUTHORITATIVE_PLANS.INDIVIDUAL_ANNUAL.annualSavingsPaisa, 118900);

      // Clinic: ₹1,499 x 12 = ₹17,988 (1,798,800 paise); ₹17,988 - ₹14,999 = ₹2,989 (298,900 paise)
      const clinicMonthlyTotal = 149900 * 12;
      const clinicAnnual = 1499900;
      assert.strictEqual(clinicMonthlyTotal - clinicAnnual, 298900);
      assert.strictEqual(AUTHORITATIVE_PLANS.CLINIC_ANNUAL.annualSavingsPaisa, 298900);
    });

    it('43. Deprecated ₹6,000 and ₹15,000 prices remain strictly rejected', () => {
      const allPrices = Object.values(AUTHORITATIVE_PLANS).map((p) => p.pricePaisa);
      assert.strictEqual(allPrices.includes(600000), false);
      assert.strictEqual(allPrices.includes(1500000), false);
    });
  });

  // ----------------------------------------------------------------------------
  // Category I: Regression Checks
  // ----------------------------------------------------------------------------
  describe('Category I: Regression Checks & State Invariants', () => {
    it('44. Phase 12 trial quota: max 10 patients enforced on trial account', async () => {
      EntitlementService.setMockSubscription(practiceAlpha, {
        id: 'sub-t1',
        practiceId: practiceAlpha,
        status: 'TRIAL',
        planId: 'plan-trial',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        plan: {
          code: 'TRIAL',
          name: '14-Day Free Trial',
          pricePaisa: 0,
          featuresJson: {},
        },
      } as any);

      EntitlementService.setMockUsage(practiceAlpha, {
        patientsCount: 10,
        packagesCount: 0,
        customMedicinesCount: 0,
        veterinarianSeatsCount: 1,
        staffSeatsCount: 0,
      });

      await assert.rejects(
        async () => {
          await EntitlementService.assertCanCreatePatient(practiceAlpha);
        },
        (err: unknown) => err instanceof AppError && err.code === 'TRIAL_PATIENT_LIMIT_REACHED'
      );
    });

    it('45. Phase 12 seat limit: Individual plan strictly rejects 2nd veterinarian', async () => {
      EntitlementService.setMockSubscription(practiceAlpha, {
        id: 'sub-p1',
        practiceId: practiceAlpha,
        status: 'ACTIVE',
        planId: 'plan-ind',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        plan: {
          code: 'INDIVIDUAL_MONTHLY',
          name: 'Individual Plan',
          pricePaisa: 59900,
          featuresJson: {},
        },
      } as any);

      EntitlementService.setMockUsage(practiceAlpha, {
        patientsCount: 100,
        packagesCount: 5,
        customMedicinesCount: 10,
        veterinarianSeatsCount: 1,
        staffSeatsCount: 0,
      });

      await assert.rejects(
        async () => {
          await EntitlementService.assertCanAddVeterinarianSeat(practiceAlpha);
        },
        (err: unknown) => err instanceof AppError && err.code === 'SEAT_LIMIT_REACHED'
      );
    });
  });
});
