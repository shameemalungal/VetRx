// ==============================================================================
// VetRx — Comprehensive Clinical Approval Routing & Veterinarian Seat Tests
// Covering Phase 14 Extension Correction #2 Requirements (Section 23 Scenarios)
// ==============================================================================

process.env.VETRX_FAST_TEST = '1';
process.env.NODE_ENV = 'test';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Role } from '@prisma/client';
import { AuthorizationService } from '../src/auth/authorization.service.js';
import { EntitlementService } from '../src/commercial/entitlement.service.js';
import { MemberService } from '../src/auth/member.service.js';
import { ClinicalService } from '../src/clinical/clinical.service.js';
import { PERMISSIONS } from '../src/auth/permissions.js';

describe('Clinical Approval Routing & Veterinarian Seat Management', () => {
  const practiceId = 'practice-routing-test-1';
  const ownerUserId = 'user-owner-1';
  const hiredVetUserId = 'user-hired-vet-1';
  const staffUserId = 'user-staff-1';

  beforeEach(() => {
    // Reset mock members for isolation
    AuthorizationService.clearMocks();
    MemberService.clearMocks();
    EntitlementService.clearMockSubscriptions();

    // Designate practice owner
    AuthorizationService.setMockPracticeOwner(practiceId, ownerUserId);

    // Set mock subscription: Individual Plan (max 1 veterinarian seat)
    EntitlementService.setMockSubscription(practiceId, {
      status: 'ACTIVE',
      planCode: 'INDIVIDUAL_MONTHLY',
      currentPeriodEnd: new Date(Date.now() + 86400000).toISOString(),
    });

    // 1. Practice Owner: non-clinical administrator by default (occupies 0 seats)
    MemberService.setMockMember({
      id: `member-${ownerUserId}`,
      practiceId,
      userId: ownerUserId,
      role: Role.PRACTICE_OWNER,
      isClinicalApprover: false,
      isActive: true,
      user: {
        id: ownerUserId,
        email: 'owner@clinic.com',
        name: 'Dr. Jane Owner',
        avatarUrl: null,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. Staff member (unlimited seats)
    MemberService.setMockMember({
      id: `member-${staffUserId}`,
      practiceId,
      userId: staffUserId,
      role: Role.STAFF,
      isClinicalApprover: false,
      isActive: true,
      user: {
        id: staffUserId,
        email: 'staff@clinic.com',
        name: 'Sam Staff',
        avatarUrl: null,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SCENARIO 1: Solo practice, Owner is the practicing veterinarian
  // ────────────────────────────────────────────────────────────────────────────
  describe('Scenario 1: Solo practice where Owner is practicing veterinarian', () => {
    it('should consume 1 seat when Practice Owner is designated as clinical approver (1/1)', async () => {
      // Designate owner as clinical approver
      const updated = await MemberService.updateClinicalStatus(
        ownerUserId,
        practiceId,
        `member-${ownerUserId}`,
        true
      );
      assert.strictEqual(updated.isClinicalApprover, true);

      const usage = await EntitlementService.getPracticeUsage(practiceId);
      assert.strictEqual(usage.veterinarianSeatsCount, 1, 'Owner should consume 1 veterinarian seat');

      const isEligible = await ClinicalService.isEligiblePrescriptionApprover(ownerUserId, practiceId);
      assert.strictEqual(isEligible, true, 'Designated Owner must be an eligible prescription approver');

      const permissions = await AuthorizationService.getEffectivePermissions(ownerUserId, practiceId);
      assert.ok(permissions.includes(PERMISSIONS.PRESCRIPTION_APPROVE), 'Owner must have PRESCRIPTION_APPROVE permission');
      assert.ok(permissions.includes(PERMISSIONS.PRESCRIPTION_REQUEST_CHANGES), 'Owner must have PRESCRIPTION_REQUEST_CHANGES permission');
    });

    it('should list Owner as the sole eligible clinician in getEligibleClinicians', async () => {
      await MemberService.updateClinicalStatus(
        ownerUserId,
        practiceId,
        `member-${ownerUserId}`,
        true
      );

      const clinicians = await ClinicalService.getEligibleClinicians(practiceId);
      assert.strictEqual(clinicians.length, 1);
      assert.strictEqual(clinicians[0].id, ownerUserId);
      assert.strictEqual(clinicians[0].role, Role.PRACTICE_OWNER);
      assert.strictEqual(clinicians[0].isClinicalApprover, true);
    });

    it('should validate forwarding target to designated Owner succeeds', async () => {
      await MemberService.updateClinicalStatus(
        ownerUserId,
        practiceId,
        `member-${ownerUserId}`,
        true
      );

      const isEligible = await ClinicalService.isEligiblePrescriptionApprover(ownerUserId, practiceId);
      assert.strictEqual(isEligible, true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SCENARIO 2: Practice has non-clinical Owner + hired Veterinarian
  // ────────────────────────────────────────────────────────────────────────────
  describe('Scenario 2: Practice with non-clinical Owner and hired Veterinarian', () => {
    it('should consume exactly 1 seat for the hired Veterinarian while Owner consumes 0 seats (1/1)', async () => {
      // Non-clinical owner consumes 0 seats
      const initialUsage = await EntitlementService.getPracticeUsage(practiceId);
      assert.strictEqual(initialUsage.veterinarianSeatsCount, 0);

      // Add hired veterinarian
      MemberService.setMockMember({
        id: `member-${hiredVetUserId}`,
        practiceId,
        userId: hiredVetUserId,
        role: Role.VETERINARIAN,
        isClinicalApprover: true,
        isActive: true,
        user: {
          id: hiredVetUserId,
          email: 'vet@clinic.com',
          name: 'Dr. Alex Vet',
          avatarUrl: null,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const usage = await EntitlementService.getPracticeUsage(practiceId);
      assert.strictEqual(usage.veterinarianSeatsCount, 1, 'Practice should use exactly 1 veterinarian seat');

      // Check Owner cannot approve
      const isOwnerEligible = await ClinicalService.isEligiblePrescriptionApprover(ownerUserId, practiceId);
      assert.strictEqual(isOwnerEligible, false, 'Non-clinical Owner cannot be an approver');

      // Check Hired Vet can approve
      const isVetEligible = await ClinicalService.isEligiblePrescriptionApprover(hiredVetUserId, practiceId);
      assert.strictEqual(isVetEligible, true, 'Hired Veterinarian must be an approver');

      // Eligible clinicians list contains only Hired Vet
      const eligible = await ClinicalService.getEligibleClinicians(practiceId);
      assert.strictEqual(eligible.length, 1);
      assert.strictEqual(eligible[0].id, hiredVetUserId);
    });

    it('should promote Staff to Veterinarian without hitting seat limit when Owner is non-clinical', async () => {
      // Owner is non-clinical (0 seats used)
      const usageBefore = await EntitlementService.getPracticeUsage(practiceId);
      assert.strictEqual(usageBefore.veterinarianSeatsCount, 0, 'No seats should be used initially');

      // MemberService promotes Staff to Veterinarian
      const updated = await MemberService.updateMemberRole(
        ownerUserId,
        practiceId,
        `member-${staffUserId}`,
        Role.VETERINARIAN
      );

      assert.strictEqual(updated.role, Role.VETERINARIAN);

      const usageAfter = await EntitlementService.getPracticeUsage(practiceId);
      assert.strictEqual(usageAfter.veterinarianSeatsCount, 1, 'Promoted vet occupies 1 seat (1/1)');

      const isStaffVetEligible = await ClinicalService.isEligiblePrescriptionApprover(staffUserId, practiceId);
      assert.strictEqual(isStaffVetEligible, true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SCENARIO 3: Seat Limit Enforcement on Individual Plan (Max 1 Vet)
  // ────────────────────────────────────────────────────────────────────────────
  describe('Scenario 3: Seat Limit Enforcement', () => {
    it('should prevent designating Owner as clinical approver if seat is already occupied by a Veterinarian', async () => {
      // Hired vet occupies the 1 seat
      MemberService.setMockMember({
        id: `member-${hiredVetUserId}`,
        practiceId,
        userId: hiredVetUserId,
        role: Role.VETERINARIAN,
        isClinicalApprover: true,
        isActive: true,
        user: {
          id: hiredVetUserId,
          email: 'vet@clinic.com',
          name: 'Dr. Alex Vet',
          avatarUrl: null,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Attempt to designate Owner as clinical approver (would require 2 seats on a 1-seat plan)
      await assert.rejects(
        async () => {
          await MemberService.updateClinicalStatus(
            ownerUserId,
            practiceId,
            `member-${ownerUserId}`,
            true // target: true
          );
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'SEAT_LIMIT_REACHED');
          return true;
        }
      );
    });

    it('should prevent promoting Staff to Veterinarian if Owner is designated as clinical approver', async () => {
      // Owner occupies the 1 seat
      await MemberService.updateClinicalStatus(
        ownerUserId,
        practiceId,
        `member-${ownerUserId}`,
        true
      );

      // Attempt to promote Staff to Veterinarian
      await assert.rejects(
        async () => {
          await MemberService.updateMemberRole(
            ownerUserId,
            practiceId,
            `member-${staffUserId}`,
            Role.VETERINARIAN
          );
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'SEAT_LIMIT_REACHED');
          return true;
        }
      );
    });

    it('should correctly calculate net change when a Veterinarian transitions to Staff', async () => {
      // Hired vet occupies 1 seat
      MemberService.setMockMember({
        id: `member-${hiredVetUserId}`,
        practiceId,
        userId: hiredVetUserId,
        role: Role.VETERINARIAN,
        isClinicalApprover: true,
        isActive: true,
        user: {
          id: hiredVetUserId,
          email: 'vet@clinic.com',
          name: 'Dr. Alex Vet',
          avatarUrl: null,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Demoting vet to staff should succeed and decrement seats to 0
      const updated = await MemberService.updateMemberRole(
        ownerUserId,
        practiceId,
        `member-${hiredVetUserId}`,
        Role.STAFF
      );

      assert.strictEqual(updated.role, Role.STAFF);

      const usage = await EntitlementService.getPracticeUsage(practiceId);
      assert.strictEqual(usage.veterinarianSeatsCount, 0, 'Seat count should drop back to 0');
    });

    it('should allow toggling Owner clinical designation on and off smoothly', async () => {
      // 1. Turn ON
      const memberOn = await MemberService.updateClinicalStatus(
        ownerUserId,
        practiceId,
        `member-${ownerUserId}`,
        true
      );
      assert.strictEqual(memberOn.isClinicalApprover, true);
      let usage = await EntitlementService.getPracticeUsage(practiceId);
      assert.strictEqual(usage.veterinarianSeatsCount, 1);

      // 2. Turn OFF
      const memberOff = await MemberService.updateClinicalStatus(
        ownerUserId,
        practiceId,
        `member-${ownerUserId}`,
        false
      );
      assert.strictEqual(memberOff.isClinicalApprover, false);
      usage = await EntitlementService.getPracticeUsage(practiceId);
      assert.strictEqual(usage.veterinarianSeatsCount, 0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // SCENARIO 4: Strict Clinical Eligibility & Boundary Cases
  // ────────────────────────────────────────────────────────────────────────────
  describe('Scenario 4: Strict Clinical Eligibility & Boundary Cases', () => {
    it('should strictly reject Staff from clinical approver designation', async () => {
      await assert.rejects(
        async () => {
          await MemberService.updateClinicalStatus(
            ownerUserId,
            practiceId,
            `member-${staffUserId}`,
            true
          );
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'CLINICAL_ROLE_FORBIDDEN');
          return true;
        }
      );
    });

    it('should strictly reject revoking clinical status directly from VETERINARIAN role', async () => {
      MemberService.setMockMember({
        id: `member-${hiredVetUserId}`,
        practiceId,
        userId: hiredVetUserId,
        role: Role.VETERINARIAN,
        isClinicalApprover: true,
        isActive: true,
        user: {
          id: hiredVetUserId,
          email: 'vet@clinic.com',
          name: 'Dr. Alex Vet',
          avatarUrl: null,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await assert.rejects(
        async () => {
          await MemberService.updateClinicalStatus(
            ownerUserId,
            practiceId,
            `member-${hiredVetUserId}`,
            false
          );
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'CANNOT_REVOKE_VET_CLINICAL');
          return true;
        }
      );
    });

    it('should strictly reject non-owners / staff from modifying clinical status', async () => {
      await assert.rejects(
        async () => {
          await MemberService.updateClinicalStatus(
            staffUserId, // Staff actor!
            practiceId,
            `member-${ownerUserId}`,
            true
          );
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          return true;
        }
      );
    });

    it('should return 0 eligible clinicians in a practice with non-clinical owner and staff', async () => {
      const eligible = await ClinicalService.getEligibleClinicians(practiceId);
      assert.strictEqual(eligible.length, 0, 'No clinicians should be eligible');
    });

    it('should return false for isEligiblePrescriptionApprover on non-clinical owner and staff', async () => {
      const isOwnerEligible = await ClinicalService.isEligiblePrescriptionApprover(ownerUserId, practiceId);
      assert.strictEqual(isOwnerEligible, false);

      const isStaffEligible = await ClinicalService.isEligiblePrescriptionApprover(staffUserId, practiceId);
      assert.strictEqual(isStaffEligible, false);
    });

    it('should return false for isEligiblePrescriptionApprover if member is deactivated', async () => {
      // Owner is clinical approver but deactivated
      MemberService.setMockMember({
        id: `member-${ownerUserId}`,
        practiceId,
        userId: ownerUserId,
        role: Role.PRACTICE_OWNER,
        isClinicalApprover: true,
        isActive: false, // DEACTIVATED
        user: {
          id: ownerUserId,
          email: 'owner@clinic.com',
          name: 'Dr. Jane Owner',
          avatarUrl: null,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const isEligible = await ClinicalService.isEligiblePrescriptionApprover(ownerUserId, practiceId);
      assert.strictEqual(isEligible, false, 'Deactivated member cannot be an approver');
    });

    it('should return 0 pending approvals count in practice with no prescriptions', async () => {
      const res = await ClinicalService.getPendingApprovalsCount(practiceId);
      assert.strictEqual(res.count, 0);
    });
  });
});
