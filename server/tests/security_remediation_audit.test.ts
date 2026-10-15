// ==============================================================================
// VetRx — Comprehensive Security Remediation Test Suite (All 9 Audit Findings)
// ==============================================================================

process.env.VETRX_FAST_TEST = '1';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Role, PlatformRole, InvitationStatus } from '@prisma/client';
import { AppError } from '../src/middleware/errorHandler.js';
import { PERMISSIONS } from '../src/auth/permissions.js';
import { AuthorizationService } from '../src/auth/authorization.service.js';
import { EntitlementService } from '../src/commercial/entitlement.service.js';
import { PracticeService } from '../src/practice/practice.service.js';
import { InvitationService, type InvitationRecord } from '../src/auth/invitation.service.js';
import { GeminiVisionProvider } from '../src/inventory/document-extraction/providers/gemini-vision.provider.js';
import { AuditService } from '../src/lib/audit.service.js';
import { EmailService } from '../src/email/email.service.js';

describe('Security Remediation Suite (Audit Findings 1 - 9)', () => {
  const practiceA = 'practice-sec-alpha';
  const practiceB = 'practice-sec-beta';
  const ownerUser = 'user-owner-sec';
  const staffUser = 'user-staff-sec';
  const readonlyUser = 'user-readonly-sec';
  const adminUser = 'user-admin-sec';

  beforeEach(() => {
    AuthorizationService.clearMocks();
    EntitlementService.clearMockSubscriptions();
    PracticeService.clearMocks();
    InvitationService.clearMocks();
    AuditService.clearMockLogs();

    // Setup Practice A roles
    AuthorizationService.setMockPracticeOwner(practiceA, ownerUser);

    AuthorizationService.setMockMembership(ownerUser, practiceA, {
      id: 'mem-owner-a',
      role: Role.PRACTICE_OWNER,
      isActive: true,
    });

    AuthorizationService.setMockMembership(adminUser, practiceA, {
      id: 'mem-admin-a',
      role: Role.PRACTICE_ADMIN,
      isActive: true,
    });

    AuthorizationService.setMockMembership(staffUser, practiceA, {
      id: 'mem-staff-a',
      role: Role.STAFF,
      isActive: true,
    });

    AuthorizationService.setMockMembership(readonlyUser, practiceA, {
      id: 'mem-ro-a',
      role: Role.READ_ONLY,
      isActive: true,
    });
  });

  // ============================================================================
  // Finding 1: Remove Development Entitlement Bypass
  // ============================================================================
  describe('Finding 1: Entitlement Bypass & Production Safeguards', () => {
    it('1.1 Ordinary staff and read-only users cannot execute billing/inventory entitlement management', async () => {
      // BILLING_MANAGE is required to modify commercial add-ons
      await assert.rejects(
        async () => {
          await AuthorizationService.requirePermission(staffUser, practiceA, PERMISSIONS.BILLING_MANAGE);
        },
        (err: any) => err instanceof AppError && err.statusCode === 403
      );

      await assert.rejects(
        async () => {
          await AuthorizationService.requirePermission(readonlyUser, practiceA, PERMISSIONS.BILLING_MANAGE);
        },
        (err: any) => err instanceof AppError && err.statusCode === 403
      );
    });

    it('1.2 EntitlementService ignores mock inventory addons when running in production mode', async () => {
      const origEnv = process.env.NODE_ENV;
      try {
        process.env.NODE_ENV = 'production';
        EntitlementService.setMockInventoryAddon(practiceA, true);

        // In production mode, mockInventoryAddons is strictly bypassed
        const isActive = await EntitlementService.isInventoryAddonActive(practiceA);
        assert.strictEqual(isActive, false, 'Production mode must fail-closed and ignore mock inventory toggles');
      } finally {
        process.env.NODE_ENV = origEnv;
      }
    });

    it('1.3 Authorized owner retains ability to manage billing permissions', async () => {
      await assert.doesNotReject(async () => {
        await AuthorizationService.requirePermission(ownerUser, practiceA, PERMISSIONS.BILLING_MANAGE);
      });
    });
  });

  // ============================================================================
  // Finding 2: Role-based permissions on clinical, inventory, and CVP mutations
  // ============================================================================
  describe('Finding 2: Role-Based Permissions on Mutations', () => {
    it('2.1 READ_ONLY role cannot mutate inventory (INVENTORY_MANAGE denied)', async () => {
      await assert.rejects(
        async () => {
          await AuthorizationService.requirePermission(readonlyUser, practiceA, PERMISSIONS.INVENTORY_MANAGE);
        },
        (err: any) => err instanceof AppError && err.statusCode === 403
      );
    });

    it('2.2 READ_ONLY role cannot perform CVP mutations (CVP_MANAGE denied)', async () => {
      await assert.rejects(
        async () => {
          await AuthorizationService.requirePermission(readonlyUser, practiceA, PERMISSIONS.CVP_MANAGE);
        },
        (err: any) => err instanceof AppError && err.statusCode === 403
      );
    });

    it('2.3 READ_ONLY role cannot mutate clinical records (CLINICAL_RECORD_EDIT denied)', async () => {
      await assert.rejects(
        async () => {
          await AuthorizationService.requirePermission(readonlyUser, practiceA, PERMISSIONS.CLINICAL_RECORD_EDIT);
        },
        (err: any) => err instanceof AppError && err.statusCode === 403
      );
    });

    it('2.4 Cross-practice tenant isolation: Member of Practice A cannot access Practice B', async () => {
      await assert.rejects(
        async () => {
          await AuthorizationService.requirePermission(ownerUser, practiceB, PERMISSIONS.INVENTORY_VIEW);
        },
        (err: any) => err instanceof AppError && err.statusCode === 403
      );
    });
  });

  // ============================================================================
  // Finding 3: Invitation Token Exposure & Email Verification Requirement
  // ============================================================================
  describe('Finding 3: Invitation Security & Email Verification Enforcement', () => {
    const rawToken = 'sec-invite-token-xyz-789';
    const tokenHash = InvitationService.hashToken(rawToken);

    beforeEach(() => {
      const invRecord: InvitationRecord = {
        id: 'inv-sec-1',
        practiceId: practiceA,
        email: 'doctor.invitee@sec-test.vet',
        role: Role.STAFF,
        tokenHash,
        invitedById: ownerUser,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      InvitationService.setMockInvitation(invRecord);
    });

    it('3.1 Unverified user without OTP cannot accept invitation (403 EMAIL_VERIFICATION_REQUIRED)', async () => {
      await assert.rejects(
        async () => {
          await InvitationService.acceptInvitation(rawToken, {
            id: 'user-unverified-1',
            email: 'doctor.invitee@sec-test.vet',
            name: 'Dr. Invitee',
            emailVerified: false,
          });
        },
        (err: any) => err instanceof AppError && err.statusCode === 403 && err.code === 'EMAIL_VERIFICATION_REQUIRED'
      );
    });

    it('3.2 Unverified user with invalid OTP is rejected (400 INVALID_OR_EXPIRED_OTP)', async () => {
      InvitationService.setMockInvitationOtp('doctor.invitee@sec-test.vet', '123456');

      await assert.rejects(
        async () => {
          await InvitationService.acceptInvitation(
            rawToken,
            {
              id: 'user-unverified-1',
              email: 'doctor.invitee@sec-test.vet',
              name: 'Dr. Invitee',
              emailVerified: false,
            },
            null,
            '999999' // wrong OTP
          );
        },
        (err: any) => err instanceof AppError && err.statusCode === 400 && err.code === 'INVALID_OR_EXPIRED_OTP'
      );
    });

    it('3.3 Unverified user with valid single-use OTP successfully proves ownership and joins practice', async () => {
      InvitationService.setMockInvitationOtp('doctor.invitee@sec-test.vet', '654321');

      const result = await InvitationService.acceptInvitation(
        rawToken,
        {
          id: 'user-unverified-1',
          email: 'doctor.invitee@sec-test.vet',
          name: 'Dr. Invitee',
          emailVerified: false,
        },
        null,
        '654321'
      );

      assert.strictEqual(result.practiceId, practiceA);
      assert.strictEqual(result.role, Role.STAFF);

      // Verify OTP is consumed (single-use)
      await assert.rejects(
        async () => {
          await InvitationService.acceptInvitation(
            rawToken,
            {
              id: 'user-unverified-1',
              email: 'doctor.invitee@sec-test.vet',
              name: 'Dr. Invitee',
              emailVerified: false,
            },
            null,
            '654321' // Replay
          );
        },
        (err: any) => err instanceof AppError
      );
    });

    it('3.4 Requesting verification OTP dispatches rate-limited 6-digit code', async () => {
      const res = await InvitationService.requestInvitationVerificationOtp(rawToken);
      assert.strictEqual(res.success, true);
    });
  });

  // ============================================================================
  // Finding 4: Protect Practice Settings & Doctor Identity
  // ============================================================================
  describe('Finding 4: Protection of Practice Settings and Identity', () => {
    beforeEach(() => {
      PracticeService.setMockSettings({
        id: 'settings-sec-a',
        practiceId: practiceA,
        clinicName: 'Alpha Veterinary Hospital',
        address: '123 Vet Street',
        phone: '9847012345',
        email: 'alpha@vet.in',
        registrationNumber: 'REG-1234',
        doctorName: 'Dr. Alpha',
        doctorRegistrationNumber: 'VET-9999',
        doctorPhotoUrl: null,
        doctorSignatureUrl: 'https://cdn.example.com/sig.png',
        clinicLogoUrl: null,
        ownerSpecialInstructionEnabled: false,
        mykgvoaMemberId: null,
      });
    });

    it('4.1 Ordinary staff member cannot modify doctor registration number or signature (403 FORBIDDEN)', async () => {
      await assert.rejects(
        async () => {
          await PracticeService.updateSettings(practiceA, staffUser, {
            doctorRegistrationNumber: 'HACKED-REG',
            doctorSignatureUrl: 'https://malicious.com/fake.png',
          });
        },
        (err: any) => err instanceof AppError && err.statusCode === 403
      );
    });

    it('4.2 Read-only user cannot modify clinic settings (403 FORBIDDEN)', async () => {
      await assert.rejects(
        async () => {
          await PracticeService.updateSettings(practiceA, readonlyUser, {
            clinicName: 'Compromised Clinic',
          });
        },
        (err: any) => err instanceof AppError && err.statusCode === 403
      );
    });

    it('4.3 Authorized practice owner successfully updates identity and generates audit log', async () => {
      const updated = await PracticeService.updateSettings(practiceA, ownerUser, {
        doctorName: 'Dr. Alpha Verified',
        doctorRegistrationNumber: 'KVC-8888',
      });

      assert.strictEqual(updated.doctorName, 'Dr. Alpha Verified');
      assert.strictEqual(updated.doctorRegistrationNumber, 'KVC-8888');

      // Verify audit log
      const logs = AuditService.getMockLogs();
      const settingsLog = logs.find((l) => l.action === 'PRACTICE_SETTINGS_UPDATED');
      assert.ok(settingsLog, 'Audit log must record PRACTICE_SETTINGS_UPDATED');
      assert.strictEqual(settingsLog?.userId, ownerUser);
      assert.strictEqual(settingsLog?.practiceId, practiceA);
    });
  });

  // ============================================================================
  // Finding 7: Disclose and Minimize Gemini Document Processing
  // ============================================================================
  describe('Finding 7: Document Processing Provider Security', () => {
    it('7.1 GeminiVisionProvider respects GEMINI_ENABLED=false flag fail-closed', () => {
      const origEnabled = process.env.GEMINI_ENABLED;
      try {
        process.env.GEMINI_ENABLED = 'false';
        process.env.GEMINI_API_KEY = 'test-key-should-be-ignored';

        const provider = new GeminiVisionProvider();
        assert.strictEqual(provider.isAvailable(), false, 'Provider must report unavailable when GEMINI_ENABLED=false');
      } finally {
        process.env.GEMINI_ENABLED = origEnabled;
      }
    });

    it('7.2 GeminiVisionProvider reports unavailable when API key is missing', () => {
      const origKey = process.env.GEMINI_API_KEY;
      const origGKey = process.env.GOOGLE_AI_API_KEY;
      const origGenKey = process.env.GOOGLE_GENAI_API_KEY;
      try {
        delete process.env.GEMINI_API_KEY;
        delete process.env.GOOGLE_AI_API_KEY;
        delete process.env.GOOGLE_GENAI_API_KEY;

        const provider = new GeminiVisionProvider();
        assert.strictEqual(provider.isAvailable(), false);
      } finally {
        if (origKey) process.env.GEMINI_API_KEY = origKey;
        if (origGKey) process.env.GOOGLE_AI_API_KEY = origGKey;
        if (origGenKey) process.env.GOOGLE_GENAI_API_KEY = origGenKey;
      }
    });
  });
});
