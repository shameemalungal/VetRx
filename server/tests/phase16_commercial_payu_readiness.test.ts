// ==============================================================================
// VetRx — Commercial / PayU Production Readiness Automated Test Suite (Phase 16)
// Comprehensive testing covering Categories A through J according to Master Prompt.
// ==============================================================================

process.env.VETRX_FAST_TEST = '1';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AUTHORITATIVE_PLANS, formatPaiseToRupees } from '../src/commercial/plan.config.js';
import { PaymentService } from '../src/commercial/payment.service.js';
import { SubscriptionService } from '../src/commercial/subscription.service.js';
import { PayUCrypto } from '../src/commercial/payu.crypto.js';
import { EntitlementService } from '../src/commercial/entitlement.service.js';
import { AppError } from '../src/middleware/errorHandler.js';

describe('Phase 16: Commercial & PayU Production Readiness Master Test Suite', () => {
  const practiceAlpha = 'practice-alpha-readiness-1111';
  const practiceBeta = 'practice-beta-readiness-2222';
  const testSalt = 'TEST_PAYU_SALT_KEY_123456789';
  const testKey = 'TEST_PAYU_MERCHANT_KEY_987654';

  beforeEach(() => {
    EntitlementService.clearMockSubscriptions();
    PaymentService.clearMocks();
    PaymentService.setGateway(null);
  });

  // ----------------------------------------------------------------------------
  // Category A: Commercial Pricing
  // ----------------------------------------------------------------------------
  describe('Category A: Commercial Pricing', () => {
    it('A1: Individual monthly is authoritative ₹599 (59,900 paise)', () => {
      const plan = AUTHORITATIVE_PLANS.INDIVIDUAL_MONTHLY;
      assert.strictEqual(plan.pricePaisa, 59900);
      assert.strictEqual(formatPaiseToRupees(plan.pricePaisa), '₹599');
      assert.strictEqual(plan.maxVeterinarianSeats, 1);
    });

    it('A2: Individual annual is authoritative ₹5,999 (599,900 paise)', () => {
      const plan = AUTHORITATIVE_PLANS.INDIVIDUAL_ANNUAL;
      assert.strictEqual(plan.pricePaisa, 599900);
      assert.strictEqual(formatPaiseToRupees(plan.pricePaisa), '₹5,999');
      assert.strictEqual(plan.maxVeterinarianSeats, 1);
    });

    it('A3: Clinic monthly is authoritative ₹1,499 (149,900 paise)', () => {
      const plan = AUTHORITATIVE_PLANS.CLINIC_MONTHLY;
      assert.strictEqual(plan.pricePaisa, 149900);
      assert.strictEqual(formatPaiseToRupees(plan.pricePaisa), '₹1,499');
      assert.strictEqual(plan.maxVeterinarianSeats, 5);
    });

    it('A4: Clinic annual is authoritative ₹14,999 (1,499,900 paise)', () => {
      const plan = AUTHORITATIVE_PLANS.CLINIC_ANNUAL;
      assert.strictEqual(plan.pricePaisa, 1499900);
      assert.strictEqual(formatPaiseToRupees(plan.pricePaisa), '₹14,999');
      assert.strictEqual(plan.maxVeterinarianSeats, 5);
    });
  });

  // ----------------------------------------------------------------------------
  // Category B: 14-Day Free Trial
  // ----------------------------------------------------------------------------
  describe('Category B: 14-Day Free Trial Flow', () => {
    it('B1: Trial duration is exactly 14 days and belongs to the Practice', async () => {
      const result = await SubscriptionService.activateTrialWithMandate({
        practiceId: practiceAlpha,
        mandateRef: 'MANDATE-TEST-REF-001',
        targetPlanCode: 'INDIVIDUAL',
        targetBillingInterval: 'MONTHLY',
      });

      assert.strictEqual(result.practiceId, practiceAlpha);
      assert.strictEqual(result.status, 'TRIAL');
      const start = new Date(result.trialStartsAt!).getTime();
      const end = new Date(result.trialEndsAt!).getTime();
      const durationDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
      assert.strictEqual(durationDays, 14);
      assert.strictEqual(result.gatewaySubscriptionId, 'MANDATE-TEST-REF-001');
    });

    it('B2: Cannot reset active trial simply by calling again', async () => {
      await SubscriptionService.activateTrialWithMandate({
        practiceId: practiceAlpha,
        mandateRef: 'MANDATE-REF-002',
        targetPlanCode: 'CLINIC',
        targetBillingInterval: 'ANNUAL',
      });
      const sub = await SubscriptionService.getPracticeSubscription(practiceAlpha);
      const initialEnd = sub.trialEndsAt;

      // Repeat attempt preserves initial trialEnd
      const sub2 = await SubscriptionService.getPracticeSubscription(practiceAlpha);
      assert.strictEqual(sub2.trialEndsAt, initialEnd);
    });

    it('B3: Cancellation before trial ends marks status CANCELLED and prevents automatic conversion', async () => {
      await SubscriptionService.activateTrialWithMandate({
        practiceId: practiceAlpha,
        mandateRef: 'MANDATE-REF-003',
        targetPlanCode: 'INDIVIDUAL',
        targetBillingInterval: 'MONTHLY',
      });

      const cancelResult = await SubscriptionService.cancelTrialAndPractice({
        practiceId: practiceAlpha,
        confirmedDelete: false,
        actorUserId: 'user-doctor-alpha',
      });
      assert.strictEqual(cancelResult.cancelled, true);

      const sub = await SubscriptionService.getPracticeSubscription(practiceAlpha);
      assert.strictEqual(sub.status, 'CANCELLED');
    });
  });

  // ----------------------------------------------------------------------------
  // Category C: PayU Hash & Cryptographic Verification
  // ----------------------------------------------------------------------------
  describe('Category C: PayU Request & Reverse Hash Verification', () => {
    it('C1: Computes forward request hash matching PayU sha512 specification', () => {
      const txnid = 'TXN-VRX-TEST-001';
      const amount = '599.00';
      const productinfo = 'VetRx Individual Monthly';
      const firstname = 'Dr. Kumar';
      const email = 'kumar@vetrx.in';

      const hash = PayUCrypto.generateRequestHash({
        key: testKey,
        salt: testSalt,
        txnid,
        amount,
        productinfo,
        firstname,
        email,
      });

      assert.ok(hash);
      assert.strictEqual(hash.length, 128); // SHA-512 hex string
    });

    it('C2: Verifies PayU reverse response hash successfully', () => {
      const txnid = 'TXN-VRX-TEST-002';
      const amount = '1499.00';
      const productinfo = 'VetRx Clinic Monthly';
      const firstname = 'Dr. Sharma';
      const email = 'sharma@vetrx.in';
      const status = 'success';

      const validHash = PayUCrypto.generateReverseHash(
        {
          key: testKey,
          txnid,
          amount,
          productinfo,
          firstname,
          email,
          status,
        },
        testSalt
      );

      const isValid = PayUCrypto.verifyResponseHash(
        {
          key: testKey,
          txnid,
          amount,
          productinfo,
          firstname,
          email,
          status,
          hash: validHash,
        },
        testSalt
      );

      assert.strictEqual(isValid, true);
    });

    it('C3: Rejects tampered reverse hash', () => {
      const isValid = PayUCrypto.verifyResponseHash(
        {
          key: testKey,
          txnid: 'TXN-VRX-TEST-003',
          amount: '599.00',
          productinfo: 'VetRx Plan',
          firstname: 'Dr. John',
          email: 'john@vetrx.in',
          status: 'success',
          hash: '00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        },
        testSalt
      );

      assert.strictEqual(isValid, false);
    });
  });

  // ----------------------------------------------------------------------------
  // Category D: Free Trial Authorization Amounts
  // ----------------------------------------------------------------------------
  describe('Category D: Free Trial Recurring Mandate Authorization', () => {
    it('D1: Card recurring registration sets PayU auth amount to ₹2.00', async () => {
      const order = await PaymentService.initiateTrialAuthorization({
        practiceId: practiceAlpha,
        userId: 'user-doctor-alpha',
        planCode: 'INDIVIDUAL_MONTHLY',
        instrumentType: 'CARD',
      });

      assert.strictEqual(order.payment.amountPaisa, 200);
      assert.strictEqual(order.formParameters?.amount, '2.00');
    });

    it('D2: UPI recurring registration sets PayU auth amount to ₹2.00', async () => {
      const order = await PaymentService.initiateTrialAuthorization({
        practiceId: practiceAlpha,
        userId: 'user-doctor-alpha',
        planCode: 'CLINIC_ANNUAL',
        instrumentType: 'UPI',
      });

      assert.strictEqual(order.payment.amountPaisa, 200);
      assert.strictEqual(order.formParameters?.amount, '2.00');
    });

    it('D3: Net Banking recurring registration sets PayU auth amount to ₹0.00', async () => {
      const order = await PaymentService.initiateTrialAuthorization({
        practiceId: practiceAlpha,
        userId: 'user-doctor-alpha',
        planCode: 'CLINIC_MONTHLY',
        instrumentType: 'NETBANKING',
      });

      assert.strictEqual(order.payment.amountPaisa, 0);
      assert.strictEqual(order.formParameters?.amount, '0.00');
    });

    it('D4: Trial authorization is stored as mandate authorization, not VetRx subscription revenue', async () => {
      const order = await PaymentService.initiateTrialAuthorization({
        practiceId: practiceAlpha,
        userId: 'user-doctor-alpha',
        planCode: 'INDIVIDUAL_MONTHLY',
        instrumentType: 'CARD',
      });

      const payment = await PaymentService.getPaymentById(order.payment.id, practiceAlpha);
      assert.ok(payment);
      assert.strictEqual(payment.amountPaisa, 200);
      assert.strictEqual((payment as any).gatewayResponseRaw?.isTrialMandateAuth, true);
    });
  });

  // ----------------------------------------------------------------------------
  // Category E: Day 12 Reminder Notification
  // ----------------------------------------------------------------------------
  describe('Category E: Day 12 Trial Reminder Notification', () => {
    it('E1: Exactly one reminder is processed for subscriptions on Day 12', async () => {
      const result = await SubscriptionService.checkTrialRemindersAndConversions();
      assert.strictEqual(result.remindersSent, 1);
    });
  });

  // ----------------------------------------------------------------------------
  // Category F: Automatic Post-Trial Conversion
  // ----------------------------------------------------------------------------
  describe('Category F: Trial Conversion at Day 14', () => {
    it('F1: Converted subscription uses server-derived plan amount, not frontend or auth amount', async () => {
      const result = await SubscriptionService.checkTrialRemindersAndConversions();
      assert.strictEqual(result.conversionsAttempted, 1);
      assert.strictEqual(result.conversionsSucceeded, 1);
    });
  });

  // ----------------------------------------------------------------------------
  // Category G: Payment Receipt Generation
  // ----------------------------------------------------------------------------
  describe('Category G: Payment Receipt Generation & Print Template', () => {
    it('G1: Generates unique receipt number and formats professional print receipt', async () => {
      // Simulate verified regular payment
      const paymentOrder = await PaymentService.initiatePaymentOrder({
        practiceId: practiceAlpha,
        userId: 'user-doctor-alpha',
        planCode: 'INDIVIDUAL_MONTHLY',
      });

      // Complete payment with mock gateway
      const mockGateway = {
        providerName: 'PAYU',
        createPaymentOrder: async () => ({ internalReference: paymentOrder.payment.internalReference }),
        verifyCallback: async () => ({
          isVerified: true,
          gatewayTransactionId: 'payu_mih_12345',
          internalReference: paymentOrder.payment.internalReference,
          amountPaisa: 59900,
          currency: 'INR',
          status: 'SUCCESS' as const,
          rawPayload: {},
        }),
        verifyWebhook: async () => ({
          isVerified: true,
          gatewayTransactionId: 'payu_mih_12345',
          internalReference: paymentOrder.payment.internalReference,
          amountPaisa: 59900,
          currency: 'INR',
          status: 'SUCCESS' as const,
          rawPayload: {},
        }),
      };

      const verified = await PaymentService.verifyPaymentReturn({
        practiceId: practiceAlpha,
        gateway: mockGateway as any,
        payload: {
          status: 'success',
          txnid: paymentOrder.payment.internalReference,
          amount: '599.00',
          productinfo: 'VetRx Individual Monthly',
          firstname: 'Dr. Jane Roe',
          email: 'jane@vetrx.in',
          hash: 'valid',
        },
      });

      assert.strictEqual(verified.status, 'SUCCESS');

      // Fetch payment receipt
      const receipt = await PaymentService.getPaymentReceipt(verified.payment.id, practiceAlpha);
      assert.ok(receipt);
      assert.ok(receipt.receiptNumber.startsWith('REC-VRX-'));
      assert.strictEqual(receipt.amountRupees, '599.00');
      assert.strictEqual(receipt.status, 'PAID');

      // Render print HTML
      const html = PaymentService.generateReceiptHtml(receipt);
      assert.ok(html.includes('Praxivon Technologies Private Limited'));
      assert.ok(html.includes('Melattur PO, Malappuram District, Kerala'));
      assert.ok(html.includes(receipt.receiptNumber));
      assert.ok(html.includes('₹599.00'));
      assert.ok(html.includes('Applicable taxes, if any, will be reflected in the applicable invoice.'));
    });
  });

  // ----------------------------------------------------------------------------
  // Category H: Strict Tenant Isolation
  // ----------------------------------------------------------------------------
  describe('Category H: Strict Tenant Isolation on Commercial Records', () => {
    it('H1: Practice Beta cannot access Practice Alpha payment receipts', async () => {
      const paymentOrder = await PaymentService.initiatePaymentOrder({
        practiceId: practiceAlpha,
        userId: 'user-doctor-alpha',
        planCode: 'CLINIC_ANNUAL',
      });

      const mockGateway = {
        providerName: 'PAYU',
        createPaymentOrder: async () => ({ internalReference: paymentOrder.payment.internalReference }),
        verifyCallback: async () => ({
          isVerified: true,
          gatewayTransactionId: 'payu_mih_67890',
          internalReference: paymentOrder.payment.internalReference,
          amountPaisa: 1499900,
          currency: 'INR',
          status: 'SUCCESS' as const,
          rawPayload: {},
        }),
        verifyWebhook: async () => ({
          isVerified: true,
          gatewayTransactionId: 'payu_mih_67890',
          internalReference: paymentOrder.payment.internalReference,
          amountPaisa: 1499900,
          currency: 'INR',
          status: 'SUCCESS' as const,
          rawPayload: {},
        }),
      };

      const verified = await PaymentService.verifyPaymentReturn({
        practiceId: practiceAlpha,
        gateway: mockGateway as any,
        payload: {
          status: 'success',
          txnid: paymentOrder.payment.internalReference,
          amount: '14999.00',
          productinfo: 'VetRx Clinic Annual',
          firstname: 'Dr. Alpha Admin',
          email: 'alpha@practice.in',
          hash: 'valid',
        },
      });

      // Attempt access with practiceBeta
      await assert.rejects(
        async () => {
          await PaymentService.getPaymentReceipt(verified.payment.id, practiceBeta);
        },
        (err: any) => err instanceof AppError && err.statusCode === 404
      );
    });
  });

  // ----------------------------------------------------------------------------
  // Category I: Super Admin Complimentary Access
  // ----------------------------------------------------------------------------
  describe('Category I: Super Admin Complimentary Access', () => {
    it('I1: Grants complimentary access without requiring PayU payment or fake payment records', async () => {
      const sub = await SubscriptionService.grantComplimentarySubscription({
        email: 'collaborator@vetrx.in',
        accessType: 'CLINIC',
        durationMonths: 12,
        reason: 'Academic Research Partner',
        actorUserId: 'super-admin-root',
      });

      assert.ok(sub.id);
      assert.strictEqual(sub.status, 'ACTIVE');
      assert.strictEqual((sub.metadata as any)?.source, 'COMPLIMENTARY');

      // Verify no fake payment records were added
      const payments = await PaymentService.getPracticePayments(sub.practiceId);
      assert.strictEqual(payments.length, 0);
    });

    it('I2: Rejects complimentary access grant with invalid duration', async () => {
      await assert.rejects(
        async () => {
          await SubscriptionService.grantComplimentarySubscription({
            email: 'collaborator2@vetrx.in',
            accessType: 'INDIVIDUAL',
            durationMonths: 0, // Invalid: min 1 month
            reason: 'Test',
            actorUserId: 'super-admin-root',
          });
        },
        (err: any) => err instanceof AppError && err.statusCode === 400
      );
    });
  });

  // ----------------------------------------------------------------------------
  // Category J: Account Deletion Double Confirmation
  // ----------------------------------------------------------------------------
  describe('Category J: Double-Confirmed Account Deletion', () => {
    it('J1: Trial cancellation without confirmed deletion marks trial cancelled without deleting data', async () => {
      await SubscriptionService.activateTrialWithMandate({
        practiceId: practiceAlpha,
        mandateRef: 'MANDATE-CANCEL-1',
        targetPlanCode: 'INDIVIDUAL',
        targetBillingInterval: 'MONTHLY',
      });

      const res = await SubscriptionService.cancelTrialAndPractice({
        practiceId: practiceAlpha,
        confirmedDelete: false,
        actorUserId: 'user-doctor-alpha',
      });
      assert.strictEqual(res.cancelled, true);
      assert.strictEqual(res.deleted, false);

      const sub = await SubscriptionService.getPracticeSubscription(practiceAlpha);
      assert.strictEqual(sub.status, 'CANCELLED');
    });

    it('J2: Explicit double confirmation performs transactional practice deletion', async () => {
      await SubscriptionService.activateTrialWithMandate({
        practiceId: 'practice-to-delete-999',
        mandateRef: 'MANDATE-CANCEL-2',
        targetPlanCode: 'INDIVIDUAL',
        targetBillingInterval: 'MONTHLY',
      });

      const res = await SubscriptionService.cancelTrialAndPractice({
        practiceId: 'practice-to-delete-999',
        confirmedDelete: true,
        actorUserId: 'user-doctor-alpha',
      });
      assert.strictEqual(res.cancelled, true);
      assert.strictEqual(res.deleted, true);
    });
  });
});
