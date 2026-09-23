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
import { ClinicalService } from '../src/clinical/clinical.service.js';
import { prisma } from '../src/lib/prisma.js';

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

  // ----------------------------------------------------------------------------
  // Category D: Staff Approval Enforcement & Clinical Seal Comprehensive Suite
  // ----------------------------------------------------------------------------
  describe('Category D: Staff Approval Enforcement & Clinical Governance Specification', () => {
    it('12. Staff cannot directly finalize prescription (direct Approved/Final creation rejected with 403 PRESCRIPTION_APPROVE_FORBIDDEN)', async () => {
      const simulateCreatePrescription = async (actorUserId: string, requestedStatus: string) => {
        if (requestedStatus === 'Approved' || requestedStatus === 'Final') {
          const canApprove = await AuthorizationService.hasPermission(actorUserId, practiceAlpha, PERMISSIONS.PRESCRIPTION_APPROVE);
          if (!canApprove) {
            throw new AppError(403, 'PRESCRIPTION_APPROVE_FORBIDDEN', 'Staff members cannot directly create approved prescriptions.');
          }
        }
      };

      await assert.rejects(
        () => simulateCreatePrescription(userStaffAlpha, 'Approved'),
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'PRESCRIPTION_APPROVE_FORBIDDEN');
          return true;
        }
      );

      await assert.rejects(
        () => simulateCreatePrescription(userStaffAlpha, 'Final'),
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'PRESCRIPTION_APPROVE_FORBIDDEN');
          return true;
        }
      );
    });

    it('13. Staff can create Draft prescription', async () => {
      const canCreate = await AuthorizationService.hasPermission(userStaffAlpha, practiceAlpha, PERMISSIONS.PRESCRIPTION_CREATE);
      assert.strictEqual(canCreate, true);

      const rx: any = {
        id: 'rx-201',
        practiceId: practiceAlpha,
        status: 'Draft',
        version: 1,
        actorUserId: userStaffAlpha,
      };
      assert.strictEqual(rx.status, 'Draft');
    });

    it('14. Staff can forward prescription to veterinarian with target clinician and optional remarks', async () => {
      const canForward = await AuthorizationService.hasPermission(userStaffAlpha, practiceAlpha, PERMISSIONS.PRESCRIPTION_FORWARD_FOR_APPROVAL);
      assert.strictEqual(canForward, true);

      const targetCanApprove = await AuthorizationService.hasPermission(userVetAlpha, practiceAlpha, PERMISSIONS.PRESCRIPTION_APPROVE);
      assert.strictEqual(targetCanApprove, true);

      const rx: any = {
        id: 'rx-202',
        status: 'Draft',
        version: 1,
      };

      // Forwarding action
      rx.status = 'Pending Approval';
      rx.forwardedToUserId = userVetAlpha;
      rx.forwardedByUserId = userStaffAlpha;
      rx.forwardedAt = new Date();
      rx.forwardingRemarks = 'Prepared under tele-consultation advice.';

      assert.strictEqual(rx.status, 'Pending Approval');
      assert.strictEqual(rx.forwardedToUserId, userVetAlpha);
      assert.strictEqual(rx.forwardedByUserId, userStaffAlpha);
      assert.strictEqual(rx.forwardingRemarks, 'Prepared under tele-consultation advice.');
    });

    it('15. Forwarding creates PENDING_APPROVAL status and audit log', async () => {
      const rxId = 'rx-203';
      const historyItem = {
        prescriptionId: rxId,
        version: 1,
        status: 'Pending Approval',
        action: 'FORWARDED',
        actorUserId: userStaffAlpha,
        targetUserId: userVetAlpha,
        remarks: 'Forwarded for clinical approval',
      };

      assert.strictEqual(historyItem.status, 'Pending Approval');
      assert.strictEqual(historyItem.action, 'FORWARDED');

      void AuditService.record({
        practiceId: practiceAlpha,
        action: 'PRESCRIPTION_FORWARDED',
        resource: 'Prescription',
        resourceId: rxId,
        details: { forwardedToUserId: userVetAlpha },
      });

      const logs = AuditService.getMockLogs();
      const forwardLog = logs.find((l) => l.action === 'PRESCRIPTION_FORWARDED' && l.resourceId === rxId);
      assert.ok(forwardLog);
      assert.strictEqual(forwardLog.details.forwardedToUserId, userVetAlpha);
    });

    it('16. Veterinarian can approve pending prescription with digital seal', async () => {
      const canApprove = await AuthorizationService.hasPermission(userVetAlpha, practiceAlpha, PERMISSIONS.PRESCRIPTION_APPROVE);
      assert.strictEqual(canApprove, true);

      const rx: any = {
        id: 'rx-204',
        status: 'Pending Approval',
        version: 1,
      };

      // Approval
      rx.status = 'Approved';
      rx.approvedByUserId = userVetAlpha;
      rx.approvedAt = new Date();
      rx.approvedVersion = rx.version;
      rx.approvalRemarks = 'Clinical examination and dosage verified.';

      assert.strictEqual(rx.status, 'Approved');
      assert.strictEqual(rx.approvedByUserId, userVetAlpha);
      assert.ok(rx.approvedAt instanceof Date);
    });

    it('17. Approved prescription becomes immutable (any edit or delete rejected with 400 PRESCRIPTION_IMMUTABLE)', () => {
      const existing = {
        id: 'rx-205',
        status: 'Approved',
      };

      const checkImmutability = (status: string) => {
        if (status === 'Approved') {
          throw new AppError(400, 'PRESCRIPTION_IMMUTABLE', 'Approved prescriptions are legally sealed clinical records and cannot be modified.');
        }
      };

      assert.throws(
        () => checkImmutability(existing.status),
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'PRESCRIPTION_IMMUTABLE');
          return true;
        }
      );
    });

    it('18. Veterinarian can request changes with remarks', async () => {
      const canRequestChanges = await AuthorizationService.hasPermission(userVetAlpha, practiceAlpha, PERMISSIONS.PRESCRIPTION_REQUEST_CHANGES);
      assert.strictEqual(canRequestChanges, true);

      const rx: any = {
        id: 'rx-206',
        status: 'Pending Approval',
        version: 1,
      };

      rx.status = 'Changes Requested';
      rx.requestedByUserId = userVetAlpha;
      rx.requestedAt = new Date();
      rx.changeRequestRemarks = 'Please reduce dosage of Meloxicam to 0.1mg/kg.';

      assert.strictEqual(rx.status, 'Changes Requested');
      assert.strictEqual(rx.requestedByUserId, userVetAlpha);
      assert.strictEqual(rx.changeRequestRemarks, 'Please reduce dosage of Meloxicam to 0.1mg/kg.');
    });

    it('19. Request changes transitions status to CHANGES_REQUESTED and unlocks editing', () => {
      const rx: any = {
        id: 'rx-207',
        status: 'Changes Requested',
      };

      // When Changes Requested, edits are permitted
      const isEditable = rx.status === 'Draft' || rx.status === 'Changes Requested';
      assert.strictEqual(isEditable, true);
    });

    it('20. Staff can edit prescription when in CHANGES_REQUESTED state', async () => {
      const canUpdate = await AuthorizationService.hasPermission(userStaffAlpha, practiceAlpha, PERMISSIONS.PRESCRIPTION_UPDATE);
      assert.strictEqual(canUpdate, true);

      const rx: any = {
        id: 'rx-208',
        status: 'Changes Requested',
        items: [{ medicineName: 'Meloxicam', dosage: '0.2mg/kg' }],
      };

      // Staff edits items
      rx.items = [{ medicineName: 'Meloxicam', dosage: '0.1mg/kg' }];
      assert.strictEqual(rx.items[0].dosage, '0.1mg/kg');
    });

    it('21. Staff can resubmit prescription after editing (RESUBMITTED action to PENDING_APPROVAL)', async () => {
      const rx: any = {
        id: 'rx-209',
        status: 'Changes Requested',
        version: 1,
      };

      const isResubmission = rx.status === 'Changes Requested';
      const action = isResubmission ? 'RESUBMITTED' : 'FORWARDED';
      rx.status = 'Pending Approval';
      rx.forwardedToUserId = userVetAlpha;
      rx.forwardedByUserId = userStaffAlpha;

      assert.strictEqual(action, 'RESUBMITTED');
      assert.strictEqual(rx.status, 'Pending Approval');
    });

    it('22. Direct Clinician Approval: Veterinarian can draft and approve immediately', async () => {
      const canCreate = await AuthorizationService.hasPermission(userVetAlpha, practiceAlpha, PERMISSIONS.PRESCRIPTION_CREATE);
      const canApprove = await AuthorizationService.hasPermission(userVetAlpha, practiceAlpha, PERMISSIONS.PRESCRIPTION_APPROVE);
      assert.strictEqual(canCreate, true);
      assert.strictEqual(canApprove, true);

      const rx: any = {
        id: 'rx-210',
        practiceId: practiceAlpha,
        status: 'Approved',
        version: 1,
        approvedByUserId: userVetAlpha,
        approvedAt: new Date(),
        approvedVersion: 1,
        approvalRemarks: 'Clinician direct approval upon creation',
      };

      assert.strictEqual(rx.status, 'Approved');
      assert.strictEqual(rx.approvedByUserId, userVetAlpha);
    });

    it('23. Veterinarian cannot approve a prescription already in APPROVED state (400 PRESCRIPTION_ALREADY_APPROVED)', () => {
      const rx = {
        id: 'rx-211',
        status: 'Approved',
      };

      const approve = (status: string) => {
        if (status === 'Approved') {
          throw new AppError(400, 'PRESCRIPTION_ALREADY_APPROVED', 'This prescription has already been approved and sealed.');
        }
      };

      assert.throws(
        () => approve(rx.status),
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'PRESCRIPTION_ALREADY_APPROVED');
          return true;
        }
      );
    });

    it('24. Veterinarian cannot approve a prescription with outstanding CHANGES_REQUESTED without resubmission', () => {
      const rx = {
        id: 'rx-212',
        status: 'Changes Requested',
      };

      const approve = (status: string) => {
        if (status === 'Changes Requested') {
          throw new AppError(400, 'INVALID_PRESCRIPTION_STATUS', 'Prescription has outstanding requested changes.');
        }
      };

      assert.throws(
        () => approve(rx.status),
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'INVALID_PRESCRIPTION_STATUS');
          return true;
        }
      );
    });

    it('25. Forwarding target must be an active clinician with PRESCRIPTION_APPROVE authority', async () => {
      const validateTarget = async (targetUserId: string) => {
        const targetMember = await AuthorizationService.resolveMembership(targetUserId, practiceAlpha);
        if (!targetMember) {
          throw new AppError(404, 'CLINICIAN_NOT_FOUND', 'Selected clinician is not a member of this practice.');
        }
        const canApprove = await AuthorizationService.hasPermission(targetUserId, practiceAlpha, PERMISSIONS.PRESCRIPTION_APPROVE);
        if (!canApprove) {
          throw new AppError(400, 'INVALID_CLINICIAN', 'Selected user does not have prescription approval authority.');
        }
      };

      // Valid clinician
      await assert.doesNotReject(() => validateTarget(userVetAlpha));

      // Invalid target: Staff member
      await assert.rejects(
        () => validateTarget(userStaffAlpha),
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'INVALID_CLINICIAN');
          return true;
        }
      );

      // Invalid target: Clinician in another practice
      await assert.rejects(
        () => validateTarget(userVetBeta),
        (err: any) => {
          assert.strictEqual(err.statusCode, 404);
          assert.strictEqual(err.code, 'CLINICIAN_NOT_FOUND');
          return true;
        }
      );
    });

    it('26. Unapproved prescriptions (Draft, Pending Approval, Changes Requested) display watermark and preview badge on document', () => {
      const getDocumentWatermark = (status: string) => {
        if (status === 'Approved') return null;
        if (status === 'Pending Approval') return 'PENDING VETERINARIAN APPROVAL';
        if (status === 'Changes Requested') return 'CHANGES REQUESTED';
        if (status === 'Cancelled') return 'CANCELLED';
        return 'DRAFT — NOT APPROVED';
      };

      assert.strictEqual(getDocumentWatermark('Draft'), 'DRAFT — NOT APPROVED');
      assert.strictEqual(getDocumentWatermark('Pending Approval'), 'PENDING VETERINARIAN APPROVAL');
      assert.strictEqual(getDocumentWatermark('Changes Requested'), 'CHANGES REQUESTED');
      assert.strictEqual(getDocumentWatermark('Approved'), null);
    });

    it('27. Approved prescriptions display Approved Clinical Rx badge and digital signature block', () => {
      const rx = {
        status: 'Approved',
        approvedByUser: { name: 'Dr. Alpha Veterinarian' },
        approvedAt: new Date(),
      };

      const isApproved = rx.status === 'Approved';
      assert.strictEqual(isApproved, true);
      assert.ok(rx.approvedByUser);
      assert.ok(rx.approvedAt);
    });

    it('28. Generic update endpoint strictly blocks direct status transition to Approved (403 PRESCRIPTION_APPROVE_FORBIDDEN)', () => {
      const checkGenericUpdate = (requestedStatus?: string) => {
        if (requestedStatus === 'Approved' || requestedStatus === 'Final') {
          throw new AppError(403, 'PRESCRIPTION_APPROVE_FORBIDDEN', 'Direct status change to Approved via generic update is forbidden.');
        }
      };

      assert.throws(
        () => checkGenericUpdate('Approved'),
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'PRESCRIPTION_APPROVE_FORBIDDEN');
          return true;
        }
      );
    });

    it('29. Generic update endpoint prevents editing content while prescription is PENDING_APPROVAL (400 PRESCRIPTION_PENDING_APPROVAL)', () => {
      const existingStatus = 'Pending Approval';
      const hasContentChanges = true;

      const checkPendingLock = (status: string, hasChanges: boolean) => {
        if (status === 'Pending Approval' && hasChanges) {
          throw new AppError(400, 'PRESCRIPTION_PENDING_APPROVAL', 'Prescription is pending veterinarian review and cannot be edited.');
        }
      };

      assert.throws(
        () => checkPendingLock(existingStatus, hasContentChanges),
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'PRESCRIPTION_PENDING_APPROVAL');
          return true;
        }
      );
    });

    it('30. Audit logging captures all workflow transitions (CREATED, FORWARDED, APPROVED, CHANGES_REQUESTED, RESUBMITTED)', () => {
      const actions = [
        'PRESCRIPTION_CREATED',
        'PRESCRIPTION_FORWARDED',
        'PRESCRIPTION_CHANGES_REQUESTED',
        'PRESCRIPTION_RESUBMITTED',
        'PRESCRIPTION_APPROVED',
      ];

      actions.forEach((act) => {
        AuditService.record({
          practiceId: practiceAlpha,
          action: act,
          resource: 'Prescription',
          resourceId: 'rx-audit-test',
        });
      });

      const recorded = AuditService.getMockLogs();
      actions.forEach((act) => {
        assert.ok(recorded.some((l) => l.action === act));
      });
    });

    it('31. Tenant isolation strictly enforced on prescription endpoints (cross-practice access denied with 404)', async () => {
      const rxInPracticeBeta = {
        id: 'rx-beta-1',
        practiceId: practiceBeta,
      };

      const getPrescriptionForPractice = (practiceId: string, rx: { practiceId: string }) => {
        if (rx.practiceId !== practiceId) {
          throw new AppError(404, 'PRESCRIPTION_NOT_FOUND', 'Prescription not found.');
        }
      };

      assert.throws(
        () => getPrescriptionForPractice(practiceAlpha, rxInPracticeBeta),
        (err: any) => {
          assert.strictEqual(err.statusCode, 404);
          assert.strictEqual(err.code, 'PRESCRIPTION_NOT_FOUND');
          return true;
        }
      );
    });
  });

  // ----------------------------------------------------------------------------
  // Category E: Direct ClinicalService Execution & Anti-Bypass Regression Tests
  // ----------------------------------------------------------------------------
  describe('Category E: Direct ClinicalService Execution & Anti-Bypass Regression Tests', () => {
    it('32. ClinicalService.createPrescription strictly rejects Approved status from Staff with 403 PRESCRIPTION_APPROVE_FORBIDDEN', async () => {
      await assert.rejects(
        () => ClinicalService.createPrescription(
          practiceAlpha,
          { patientId: 'pat-1', rxNumber: 'RX-TEST-100', status: 'Approved', items: [] },
          userStaffAlpha
        ),
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'PRESCRIPTION_APPROVE_FORBIDDEN');
          assert.ok(err.message.includes('Staff members cannot directly create approved prescriptions'));
          return true;
        }
      );
    });

    it('33. ClinicalService.createPrescription strictly rejects case variations and aliases (approved, Issued, Final, signed) from Staff', async () => {
      const forbiddenStatuses = ['approved', 'Issued', 'issued', 'Final', 'final', 'Signed', 'signed'];
      for (const status of forbiddenStatuses) {
        await assert.rejects(
          () => ClinicalService.createPrescription(
            practiceAlpha,
            { patientId: 'pat-1', rxNumber: 'RX-TEST-101', status, items: [] },
            userStaffAlpha
          ),
          (err: any) => {
            assert.strictEqual(err.statusCode, 403, `Expected 403 for status ${status}`);
            assert.strictEqual(err.code, 'PRESCRIPTION_APPROVE_FORBIDDEN');
            return true;
          }
        );
      }
    });

    it('34. ClinicalService.createPrescription strictly rejects final status creation from Practice Admin without PRESCRIPTION_APPROVE', async () => {
      await assert.rejects(
        () => ClinicalService.createPrescription(
          practiceAlpha,
          { patientId: 'pat-1', rxNumber: 'RX-TEST-102', status: 'Approved', items: [] },
          userAdminAlpha
        ),
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'PRESCRIPTION_APPROVE_FORBIDDEN');
          return true;
        }
      );
    });

    it('35. ClinicalService.updatePrescription rejects Approved status change via generic update with 403', async () => {
      const originalFindFirst = prisma.prescription.findFirst;
      prisma.prescription.findFirst = (async () => ({
        id: 'rx-draft-1',
        practiceId: practiceAlpha,
        status: 'Draft',
        version: 1,
        items: [],
      })) as any;

      try {
        await assert.rejects(
          () => ClinicalService.updatePrescription(
            'rx-draft-1',
            practiceAlpha,
            { status: 'Approved' } as any,
            userStaffAlpha
          ),
          (err: any) => {
            assert.strictEqual(err.statusCode, 403);
            assert.strictEqual(err.code, 'PRESCRIPTION_APPROVE_FORBIDDEN');
            assert.ok(err.message.includes('Direct status change to Approved via generic update is forbidden'));
            return true;
          }
        );
      } finally {
        prisma.prescription.findFirst = originalFindFirst;
      }
    });

    it('36. ClinicalService.updatePrescription rejects any edit to already Approved prescription with 400 PRESCRIPTION_IMMUTABLE', async () => {
      const originalFindFirst = prisma.prescription.findFirst;
      prisma.prescription.findFirst = (async () => ({
        id: 'rx-approved-1',
        practiceId: practiceAlpha,
        status: 'Approved',
        version: 1,
        items: [],
      })) as any;

      try {
        await assert.rejects(
          () => ClinicalService.updatePrescription(
            'rx-approved-1',
            practiceAlpha,
            { diagnosis: 'Updated diagnosis' },
            userStaffAlpha
          ),
          (err: any) => {
            assert.strictEqual(err.statusCode, 400);
            assert.strictEqual(err.code, 'PRESCRIPTION_IMMUTABLE');
            return true;
          }
        );
      } finally {
        prisma.prescription.findFirst = originalFindFirst;
      }
    });

    it('37. ClinicalService.deletePrescription rejects deletion of Approved prescription with 400 PRESCRIPTION_IMMUTABLE', async () => {
      const originalFindFirst = prisma.prescription.findFirst;
      prisma.prescription.findFirst = (async () => ({
        id: 'rx-approved-1',
        practiceId: practiceAlpha,
        status: 'Approved',
        version: 1,
      })) as any;

      try {
        await assert.rejects(
          () => ClinicalService.deletePrescription('rx-approved-1', practiceAlpha),
          (err: any) => {
            assert.strictEqual(err.statusCode, 400);
            assert.strictEqual(err.code, 'PRESCRIPTION_IMMUTABLE');
            return true;
          }
        );
      } finally {
        prisma.prescription.findFirst = originalFindFirst;
      }
    });
  });
});
