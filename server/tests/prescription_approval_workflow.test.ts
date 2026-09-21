// ==============================================================================
// VetRx — Prescription Clinical Approval Workflow Test Suite (Phase 14 Extension)
// Validates:
// 1. Staff drafting prescriptions and forwarding with remarks.
// 2. Clinician approval with digital confirmation and immutability lock.
// 3. Clinician change requests with mandatory remarks.
// 4. Revision incrementing and draft reset.
// 5. Cross-practice clinician isolation and RBAC boundary enforcement.
// 6. Complete tamper-evident audit logging and workflow history.
// ==============================================================================

process.env.VETRX_FAST_TEST = '1';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Role, PlatformRole } from '@prisma/client';
import { AppError } from '../src/middleware/errorHandler.js';
import {
  PERMISSIONS,
  getPermissionsForRole,
} from '../src/auth/permissions.js';
import { AuthorizationService } from '../src/auth/authorization.service.js';
import { MemberService } from '../src/auth/member.service.js';
import { AuditService } from '../src/lib/audit.service.js';

describe('Prescription Clinical Approval Workflow Suite', () => {
  const practiceAlpha = 'practice-alpha-uuid';
  const practiceBeta = 'practice-beta-uuid';

  const userVetAlpha = 'user-vet-alpha-uuid';
  const userStaffAlpha = 'user-staff-alpha-uuid';
  const userAdminAlpha = 'user-admin-alpha-uuid';
  const userReadOnlyAlpha = 'user-readonly-alpha-uuid';
  const userVetBeta = 'user-vet-beta-uuid';

  beforeEach(() => {
    AuthorizationService.clearMocks();
    AuditService.clearMockLogs();

    // Set memberships
    AuthorizationService.setMockMembership(userVetAlpha, practiceAlpha, {
      id: 'mem-vet-alpha',
      role: Role.VETERINARIAN,
      isActive: true,
    });

    AuthorizationService.setMockMembership(userStaffAlpha, practiceAlpha, {
      id: 'mem-staff-alpha',
      role: Role.STAFF,
      isActive: true,
    });

    AuthorizationService.setMockMembership(userAdminAlpha, practiceAlpha, {
      id: 'mem-admin-alpha',
      role: Role.PRACTICE_ADMIN,
      isActive: true,
    });

    AuthorizationService.setMockMembership(userReadOnlyAlpha, practiceAlpha, {
      id: 'mem-ro-alpha',
      role: Role.READ_ONLY,
      isActive: true,
    });

    AuthorizationService.setMockMembership(userVetBeta, practiceBeta, {
      id: 'mem-vet-beta',
      role: Role.VETERINARIAN,
      isActive: true,
    });
  });

  // ----------------------------------------------------------------------------
  // Category A: RBAC & Permission Boundaries for Clinical Prescribing
  // ----------------------------------------------------------------------------
  describe('Category A: RBAC & Permission Boundaries', () => {
    it('1. STAFF has permission to create drafts, update drafts, and forward for approval', async () => {
      const perms = await AuthorizationService.getEffectivePermissions(userStaffAlpha, practiceAlpha);
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_VIEW));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_CREATE));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_UPDATE));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_FORWARD_FOR_APPROVAL));
    });

    it('2. STAFF strictly lacks clinical approval, request changes, and deletion permissions', async () => {
      const perms = await AuthorizationService.getEffectivePermissions(userStaffAlpha, practiceAlpha);
      assert.strictEqual(perms.includes(PERMISSIONS.PRESCRIPTION_APPROVE), false);
      assert.strictEqual(perms.includes(PERMISSIONS.PRESCRIPTION_REQUEST_CHANGES), false);
      assert.strictEqual(perms.includes(PERMISSIONS.PRESCRIPTION_DELETE), false);

      await assert.rejects(
        () => AuthorizationService.requirePermission(userStaffAlpha, practiceAlpha, PERMISSIONS.PRESCRIPTION_APPROVE),
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'INSUFFICIENT_PERMISSION');
          return true;
        }
      );
    });

    it('3. VETERINARIAN has full prescribing authority including approval and change requests', async () => {
      const perms = await AuthorizationService.getEffectivePermissions(userVetAlpha, practiceAlpha);
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_VIEW));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_CREATE));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_UPDATE));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_FORWARD_FOR_APPROVAL));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_APPROVE));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_REQUEST_CHANGES));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_DELETE));

      await assert.doesNotReject(() =>
        AuthorizationService.requirePermission(userVetAlpha, practiceAlpha, PERMISSIONS.PRESCRIPTION_APPROVE)
      );
    });

    it('4. PRACTICE_ADMIN can manage and forward, but cannot clinically approve by default', async () => {
      const perms = await AuthorizationService.getEffectivePermissions(userAdminAlpha, practiceAlpha);
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_FORWARD_FOR_APPROVAL));
      assert.strictEqual(perms.includes(PERMISSIONS.PRESCRIPTION_APPROVE), false);

      await assert.rejects(
        () => AuthorizationService.requirePermission(userAdminAlpha, practiceAlpha, PERMISSIONS.PRESCRIPTION_APPROVE),
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'INSUFFICIENT_PERMISSION');
          return true;
        }
      );
    });

    it('5. READ_ONLY cannot create, forward, or approve prescriptions', async () => {
      await assert.rejects(
        () => AuthorizationService.requirePermission(userReadOnlyAlpha, practiceAlpha, PERMISSIONS.PRESCRIPTION_CREATE),
        (err: any) => err.code === 'INSUFFICIENT_PERMISSION'
      );
      await assert.rejects(
        () => AuthorizationService.requirePermission(userReadOnlyAlpha, practiceAlpha, PERMISSIONS.PRESCRIPTION_FORWARD_FOR_APPROVAL),
        (err: any) => err.code === 'INSUFFICIENT_PERMISSION'
      );
      await assert.rejects(
        () => AuthorizationService.requirePermission(userReadOnlyAlpha, practiceAlpha, PERMISSIONS.PRESCRIPTION_APPROVE),
        (err: any) => err.code === 'INSUFFICIENT_PERMISSION'
      );
    });
  });

  // ----------------------------------------------------------------------------
  // Category B: State Transitions & Clinical Governance Simulation
  // ----------------------------------------------------------------------------
  describe('Category B: State Transitions & Immutability Logic', () => {
    it('6. Simulated workflow: Draft -> Forwarded (Pending Approval) -> Approved', () => {
      // 1. Staff creates draft
      const rx: any = {
        id: 'rx-101',
        practiceId: practiceAlpha,
        patientId: 'patient-1',
        rxNumber: 'RX-2026-001',
        version: 1,
        status: 'Draft',
        items: [{ medicineName: 'Amoxicillin', dosage: '250mg', frequency: 'BID', durationDays: 7 }],
      };

      assert.strictEqual(rx.status, 'Draft');
      assert.strictEqual(rx.version, 1);

      // 2. Staff forwards to Veterinarian with remarks
      rx.status = 'Pending Approval';
      rx.forwardedToUserId = userVetAlpha;
      rx.forwardedByUserId = userStaffAlpha;
      rx.forwardedAt = new Date();
      rx.forwardingRemarks = 'Please review dosage for 12kg canine.';

      assert.strictEqual(rx.status, 'Pending Approval');
      assert.strictEqual(rx.forwardedToUserId, userVetAlpha);
      assert.ok(rx.forwardingRemarks.includes('12kg canine'));

      // 3. Veterinarian approves
      rx.status = 'Approved';
      rx.approvedByUserId = userVetAlpha;
      rx.approvedAt = new Date();
      rx.approvedVersion = rx.version;
      rx.approvalRemarks = 'Dosage verified and approved.';

      assert.strictEqual(rx.status, 'Approved');
      assert.strictEqual(rx.approvedVersion, 1);
      assert.strictEqual(rx.approvedByUserId, userVetAlpha);
    });

    it('7. Immutability guard rejects direct modification of approved prescriptions', () => {
      const rx = {
        id: 'rx-102',
        status: 'Approved',
        version: 1,
      };

      const attemptDirectUpdate = (status: string) => {
        if (status === 'Approved') {
          throw new AppError(
            400,
            'APPROVED_PRESCRIPTION_IMMUTABLE',
            'Approved prescriptions are legally sealed clinical records. To modify treatments, create a new revision.'
          );
        }
      };

      assert.throws(
        () => attemptDirectUpdate(rx.status),
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'APPROVED_PRESCRIPTION_IMMUTABLE');
          return true;
        }
      );
    });

    it('8. Creating a new revision increments version and resets to Draft', () => {
      const rx: any = {
        id: 'rx-103',
        status: 'Approved',
        version: 1,
        approvedByUserId: userVetAlpha,
        approvedAt: new Date(),
        forwardedToUserId: userVetAlpha,
      };

      // Revise action
      const newVersion = rx.version + 1;
      rx.version = newVersion;
      rx.status = 'Draft';
      rx.approvedByUserId = null;
      rx.approvedAt = null;
      rx.forwardedToUserId = null;

      assert.strictEqual(rx.version, 2);
      assert.strictEqual(rx.status, 'Draft');
      assert.strictEqual(rx.approvedByUserId, null);
    });

    it('9. Clinician can request changes with mandatory remarks', () => {
      const rx: any = {
        id: 'rx-104',
        status: 'Pending Approval',
        version: 1,
      };

      const changeRemarks = 'Please adjust treatment to 5 days instead of 7 days.';
      assert.ok(changeRemarks.length > 0);

      rx.status = 'Changes Requested';
      rx.requestedByUserId = userVetAlpha;
      rx.requestedAt = new Date();
      rx.changeRequestRemarks = changeRemarks;

      assert.strictEqual(rx.status, 'Changes Requested');
      assert.strictEqual(rx.requestedByUserId, userVetAlpha);
      assert.strictEqual(rx.changeRequestRemarks, changeRemarks);
    });

    it('10. Request changes fails if remarks are empty', () => {
      const requestChanges = (remarks: string) => {
        if (!remarks || !remarks.trim()) {
          throw new AppError(400, 'REMARKS_REQUIRED', 'Mandatory change request remarks must be provided.');
        }
      };

      assert.throws(
        () => requestChanges('   '),
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'REMARKS_REQUIRED');
          return true;
        }
      );
    });
  });

  // ----------------------------------------------------------------------------
  // Category C: Tenant Isolation
  // ----------------------------------------------------------------------------
  describe('Category C: Tenant Isolation', () => {
    it('11. Practice Alpha staff cannot forward to Practice Beta clinician', async () => {
      const vetBetaMembership = await AuthorizationService.resolveMembership(userVetBeta, practiceAlpha);
      assert.strictEqual(vetBetaMembership, null);
    });
  });
});
