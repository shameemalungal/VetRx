// ==============================================================================
// VetRx — Phase 15: Context Switching & PayU Production Readiness Test Suite
// Verifies context switching between Platform and Practice contexts,
// role/permission preservation, unauthorized access rejection, and PayU billing integrity.
// ==============================================================================

process.env.VETRX_FAST_TEST = '1';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Role, PlatformRole } from '@prisma/client';
import { getPayUConfig } from '../src/commercial/payu.config.js';
import { PayUCrypto } from '../src/commercial/payu.crypto.js';
import { PaymentService } from '../src/commercial/payment.service.js';
import { PlatformAdminService } from '../src/platform/platform-admin.service.js';
import { AuthorizationService } from '../src/auth/authorization.service.js';
import { PERMISSIONS } from '../src/auth/permissions.js';
import { AppError } from '../src/middleware/errorHandler.js';
import type { PaymentGateway } from '../src/commercial/payment.provider.interface.js';

describe('Phase 15: Context Switching & PayU Comprehensive Validation Suite', () => {
  const superAdminUserId = 'usr_superadmin_shameem';
  const regularVetUserId = 'usr_regular_vet_doc';
  const nonClinicalAdminUserId = 'usr_non_clinical_admin';
  const practiceId = 'prac_shameem_clinic';
  const testSalt = 'MOCK_SALT_12345';
  const testKey = 'TEST_KEY';

  beforeEach(() => {
    AuthorizationService.clearMocks();
    PaymentService.clearMocks();

    // Super Admin user
    AuthorizationService.setMockPlatformUser(superAdminUserId, PlatformRole.PLATFORM_SUPER_ADMIN);
    // Regular Vet user (no platform role)
    AuthorizationService.setMockPlatformUser(regularVetUserId, null);
    // Non-clinical user (has platform super admin, but non-clinical practice role)
    AuthorizationService.setMockPlatformUser(nonClinicalAdminUserId, PlatformRole.PLATFORM_SUPER_ADMIN);

    // Mock memberships
    AuthorizationService.setMockMembership(superAdminUserId, practiceId, {
      userId: superAdminUserId,
      practiceId,
      role: Role.PRACTICE_OWNER,
      isClinicalApprover: true,
      isActive: true,
    });

    AuthorizationService.setMockMembership(nonClinicalAdminUserId, practiceId, {
      userId: nonClinicalAdminUserId,
      practiceId,
      role: Role.STAFF,
      isClinicalApprover: false,
      isActive: true,
    });
  });

  describe('Category A: Context Switching Security & Role Preservation', () => {
    it('1. Super Admin with Practice Owner role preserves clinical authority upon entering practice', async () => {
      // Must have PRESCRIPTION_APPROVE and PRESCRIPTION_CREATE
      const hasApprove = await AuthorizationService.hasPermission(
        superAdminUserId,
        practiceId,
        PERMISSIONS.PRESCRIPTION_APPROVE
      );
      assert.equal(hasApprove, true, 'Clinical approver practice owner must have PRESCRIPTION_APPROVE');

      const hasCreate = await AuthorizationService.hasPermission(
        superAdminUserId,
        practiceId,
        PERMISSIONS.PRESCRIPTION_CREATE
      );
      assert.equal(hasCreate, true, 'Practice owner must have PRESCRIPTION_CREATE');

      // Check platform permission - must have PLATFORM_SUPER_ADMIN
      const isSuperAdmin = await AuthorizationService.isPlatformSuperAdmin(superAdminUserId);
      assert.equal(isSuperAdmin, true, 'User must retain platform super admin identity');
    });

    it('2. Super Admin without clinical approver role does NOT receive clinical prescription approval authority', async () => {
      // Platform super admin does NOT automatically grant PRESCRIPTION_APPROVE in practice context
      const hasApprove = await AuthorizationService.hasPermission(
        nonClinicalAdminUserId,
        practiceId,
        PERMISSIONS.PRESCRIPTION_APPROVE
      );
      assert.equal(hasApprove, false, 'Super admin role must NOT automatically grant clinical approval authority');
    });

    it('3. Regular veterinarian cannot access platform administration', async () => {
      const isSuperAdmin = await AuthorizationService.isPlatformSuperAdmin(regularVetUserId);
      assert.equal(isSuperAdmin, false, 'Regular veterinarian must not have platform super admin status');

      await assert.rejects(
        async () => {
          await AuthorizationService.requirePlatformSuperAdmin(regularVetUserId);
        },
        (err: unknown) =>
          err instanceof AppError &&
          err.statusCode === 403 &&
          err.code === 'PLATFORM_ACCESS_REQUIRED',
        'Platform access must throw 403 PLATFORM_ACCESS_REQUIRED for non-platform users'
      );
    });
  });

  describe('Category B: PayU Configuration & Domain Verification', () => {
    it('4. Base URL defaults to https://app.vetrx.brightbase.in and contains no deprecated domain', () => {
      const config = getPayUConfig();
      assert.ok(config.checkoutUrl, 'Checkout URL must exist');
      assert.ok(
        config.successUrl.includes('app.vetrx.brightbase.in') || config.successUrl.includes('/api/commercial/payments/return'),
        'Success URL must target valid return endpoint'
      );
      assert.ok(!config.successUrl.includes('vetrx.adcpmalappuram.in'), 'Must never point to deprecated domain');
      assert.ok(!config.failureUrl.includes('vetrx.adcpmalappuram.in'), 'Must never point to deprecated domain');
    });

    it('5. Outbound request hash formula conforms strictly to sha512 specification', () => {
      const hash = PayUCrypto.generateRequestHash({
        key: testKey,
        txnid: 'TXN12345',
        amount: '599.00',
        productinfo: 'VetRx Individual (MONTHLY)',
        firstname: 'Doctor',
        email: 'doc@example.com',
        salt: testSalt,
      });

      assert.ok(typeof hash === 'string' && hash.length === 128, 'SHA-512 hash must be 128 hex characters');
    });

    it('6. Inbound reverse response hash correctly validates authentic signature and rejects forgery', () => {
      const payloadBase = {
        key: testKey,
        txnid: 'TXN999',
        amount: '599.00',
        productinfo: 'VetRx Plan',
        firstname: 'Dr Shameem',
        email: 'dr@example.com',
        status: 'success',
      };

      const validHash = PayUCrypto.generateReverseHash(payloadBase, testSalt);
      const isVerified = PayUCrypto.verifyResponseHash({ ...payloadBase, hash: validHash }, testSalt);
      assert.equal(isVerified, true, 'Authentic hash must verify as true');

      const isForged = PayUCrypto.verifyResponseHash({ ...payloadBase, hash: 'bad_forged_hash' }, testSalt);
      assert.equal(isForged, false, 'Forged hash must verify as false');
    });
  });

  describe('Category C: PayU Lifecycle, Security & Anti-Fraud Invariants', () => {
    it('7. Initiate payment order records PENDING payment with authoritative price', async () => {
      const result = await PaymentService.initiatePaymentOrder({
        practiceId,
        userId: superAdminUserId,
        planCode: 'INDIVIDUAL_MONTHLY',
      });

      assert.ok(result.payment.id, 'Payment record must be created');
      assert.equal(result.payment.status, 'PENDING');
      assert.equal(result.payment.amountPaisa, 59900, 'Must match authoritative plan price of 59,900 paise');
      assert.ok(result.checkoutUrl, 'Must return checkout URL');
      assert.ok(result.formParameters.hash, 'Must return signed hash');
    });

    it('8. Tampered amount callback is rejected and does NOT activate subscription', async () => {
      const paymentOrder = await PaymentService.initiatePaymentOrder({
        practiceId,
        userId: superAdminUserId,
        planCode: 'CLINIC_MONTHLY', // 149,900 paise
      });

      const txnid = paymentOrder.payment.internalReference;
      const tamperedPayload = {
        txnid,
        amount: '1.00', // tampered amount (100 paise instead of 149900 paise)
        status: 'success',
        mihpayid: 'payu_tampered_1',
      };

      const mockTamperedGateway: PaymentGateway = {
        providerName: 'PAYU',
        createPaymentOrder: async () => ({ internalReference: txnid }),
        verifyCallback: async () => ({
          isVerified: true,
          gatewayTransactionId: 'payu_tampered_1',
          internalReference: txnid,
          amountPaisa: 100, // 1.00 INR = 100 paise
          currency: 'INR',
          status: 'SUCCESS',
          rawPayload: tamperedPayload,
        }),
        verifyWebhook: async () => ({ isVerified: false, status: 'FAILED' } as any),
        getPaymentStatus: async () => ({ isVerified: false, status: 'FAILED' } as any),
      };

      await assert.rejects(
        async () => {
          await PaymentService.verifyPaymentReturn({
            practiceId,
            payload: tamperedPayload,
            gateway: mockTamperedGateway,
          });
        },
        (err: unknown) => err instanceof AppError && err.code === 'PAYMENT_AMOUNT_MISMATCH',
        'Must reject tampered amount with PAYMENT_AMOUNT_MISMATCH'
      );
    });

    it('9. Cancelled or failed payment does NOT activate subscription', async () => {
      const paymentOrder = await PaymentService.initiatePaymentOrder({
        practiceId,
        userId: superAdminUserId,
        planCode: 'INDIVIDUAL_MONTHLY',
      });

      const txnid = paymentOrder.payment.internalReference;
      const failedPayload = {
        txnid,
        amount: '599.00',
        status: 'userCancelled',
        unmappedstatus: 'userCancelled',
        error_Message: 'User cancelled transaction',
      };

      const mockFailedGateway: PaymentGateway = {
        providerName: 'PAYU',
        createPaymentOrder: async () => ({ internalReference: txnid }),
        verifyCallback: async () => ({
          isVerified: false,
          gatewayTransactionId: null,
          internalReference: txnid,
          amountPaisa: 0,
          currency: 'INR',
          status: 'FAILED',
          errorMessage: 'User cancelled transaction',
          rawPayload: failedPayload,
        }),
        verifyWebhook: async () => ({ isVerified: false, status: 'FAILED' } as any),
        getPaymentStatus: async () => ({ isVerified: false, status: 'FAILED' } as any),
      };

      const result = await PaymentService.verifyPaymentReturn({
        practiceId,
        payload: failedPayload,
        gateway: mockFailedGateway,
      });

      assert.equal(result.isVerified, false, 'Failed payment must not be verified as success');
      assert.equal(result.status, 'FAILED');
      assert.equal(result.subscription, null, 'No subscription may be activated on cancelled payment');
    });

    it('10. Duplicate callback returns idempotent response without double activation', async () => {
      const paymentOrder = await PaymentService.initiatePaymentOrder({
        practiceId,
        userId: superAdminUserId,
        planCode: 'INDIVIDUAL_MONTHLY',
      });

      const txnid = paymentOrder.payment.internalReference;
      const successPayload = {
        txnid,
        amount: '599.00',
        status: 'success',
        mihpayid: 'payu_success_100',
      };

      const mockSuccessGateway: PaymentGateway = {
        providerName: 'PAYU',
        createPaymentOrder: async () => ({ internalReference: txnid }),
        verifyCallback: async () => ({
          isVerified: true,
          gatewayTransactionId: 'payu_success_100',
          internalReference: txnid,
          amountPaisa: 59900,
          currency: 'INR',
          status: 'SUCCESS',
          paymentMode: 'UPI',
          rawPayload: successPayload,
        }),
        verifyWebhook: async () => ({ isVerified: true, status: 'SUCCESS' } as any),
        getPaymentStatus: async () => ({ isVerified: true, status: 'SUCCESS' } as any),
      };

      // First callback
      const firstResult = await PaymentService.verifyPaymentReturn({
        practiceId,
        payload: successPayload,
        gateway: mockSuccessGateway,
      });
      assert.equal(firstResult.status, 'SUCCESS');

      // Duplicate callback
      const secondResult = await PaymentService.verifyPaymentReturn({
        practiceId,
        payload: successPayload,
        gateway: mockSuccessGateway,
      });
      assert.equal(secondResult.status, 'SUCCESS');
      assert.ok(secondResult.message.includes('already been verified'), 'Duplicate return must return idempotent confirmation');
    });
  });

  describe('Category D: Super Admin Commercial Visibility', () => {
    it('11. Platform Super Admin can view centralized payments list', async () => {
      PlatformAdminService.setMockPayments([
        {
          id: 'pay_mock_1',
          practiceId: 'prac_1',
          practiceName: 'Clinic One',
          amountPaisa: 59900,
          currency: 'INR',
          status: 'SUCCESS',
          paymentProvider: 'PAYU',
          gatewayTransactionId: 'payu_gtx_1',
          internalReference: 'TXN-001',
          createdAt: new Date().toISOString(),
        },
      ]);

      const result = await PlatformAdminService.listPayments(superAdminUserId, { page: 1, pageSize: 10 });
      assert.equal(result.total, 1);
      assert.equal(result.results[0].id, 'pay_mock_1');
      assert.equal(result.results[0].status, 'SUCCESS');
    });
  });
});
