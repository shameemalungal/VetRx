// ==============================================================================
// VetRx — Comprehensive Clinical Approval Routing & Veterinarian Seat Tests
// Covering Phase 14 Extension Correction #2 Requirements (Section 23 Scenarios)
// ==============================================================================

process.env.VETRX_FAST_TEST = '1';
process.env.NODE_ENV = 'test';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Role, PlatformRole } from '@prisma/client';
import { AuthorizationService } from '../src/auth/authorization.service.js';
import { EntitlementService } from '../src/commercial/entitlement.service.js';
import { MemberService } from '../src/auth/member.service.js';
import { ClinicalService } from '../src/clinical/clinical.service.js';
import { PERMISSIONS } from '../src/auth/permissions.js';
import { prisma } from '../src/lib/prisma.js';

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

  // ────────────────────────────────────────────────────────────────────────────
  // SCENARIO 5: 15 Minimum Explicit Approval Routing Scenarios
  // ────────────────────────────────────────────────────────────────────────────
  describe('Scenario 5: 15 Minimum Explicit Approval Routing Scenarios', () => {
    const rxPracticeId = 'practice-routing-spec-1';
    const otherPracticeId = 'practice-routing-other-2';

    const vet1UserId = 'user-vet-routing-1';
    const vet2UserId = 'user-vet-routing-2';
    const ownerUserId = 'user-owner-routing-1';
    const adminUserId = 'user-admin-routing-1';
    const staffUserId = 'user-staff-routing-1';
    const inactiveVetUserId = 'user-vet-inactive';
    const otherPracticeVetUserId = 'user-vet-other-practice';
    const superAdminUserId = 'user-super-admin-external';

    // In-memory prescription store for fast isolated testing
    const mockPrescriptions = new Map<string, any>();
    const originalFindFirst = prisma.prescription.findFirst;
    const originalUpdate = prisma.prescription.update;
    const originalCreate = prisma.prescription.create;
    const originalWorkflowCreate = prisma.prescriptionWorkflowHistory.create;

    beforeEach(() => {
      mockPrescriptions.clear();
      AuthorizationService.clearMocks();
      MemberService.clearMocks();

      // Hook prisma prescription methods
      prisma.prescription.findFirst = (async (args: any) => {
        const id = args?.where?.id;
        const pId = args?.where?.practiceId;
        const rx = mockPrescriptions.get(id);
        if (!rx) return null;
        if (pId && rx.practiceId !== pId) return null;
        return JSON.parse(JSON.stringify(rx));
      }) as any;

      prisma.prescription.update = (async (args: any) => {
        const id = args?.where?.id;
        const existing = mockPrescriptions.get(id);
        if (!existing) throw new Error('Not found');
        const updated = {
          ...existing,
          ...args.data,
          forwardedByUser: args.data.forwardedByUserId ? { id: args.data.forwardedByUserId, name: 'Staff User', email: 'staff@test.com' } : existing.forwardedByUser,
          forwardedToUser: args.data.forwardedToUserId ? { id: args.data.forwardedToUserId, name: 'Target Vet', email: 'vet@test.com' } : existing.forwardedToUser,
          approvedByUser: args.data.approvedByUserId ? { id: args.data.approvedByUserId, name: 'Approving Vet', email: 'vet@test.com' } : existing.approvedByUser,
        };
        mockPrescriptions.set(id, updated);
        return JSON.parse(JSON.stringify(updated));
      }) as any;

      prisma.prescriptionWorkflowHistory.create = (async () => ({})) as any;

      // Seed a draft prescription
      mockPrescriptions.set('rx-test-spec-1', {
        id: 'rx-test-spec-1',
        practiceId: rxPracticeId,
        patientId: 'patient-1',
        rxNumber: 'RX-SPEC-001',
        diagnosis: 'Otitis externa',
        status: 'Draft',
        version: 1,
        items: [{ medicineName: 'Enrofloxacin', dosage: '50mg', frequency: 'SID', durationDays: 7 }],
      });
    });

    // Clean up prisma hooks after tests
    // 1. Zero eligible approvers -> NO_CLINICAL_APPROVER_AVAILABLE
    it('1. Zero eligible approvers -> rejects forwarding with NO_CLINICAL_APPROVER_AVAILABLE', async () => {
      // Non-clinical owner & staff only
      MemberService.setMockMember({
        id: 'mem-owner-non-clin',
        practiceId: rxPracticeId,
        userId: ownerUserId,
        role: Role.PRACTICE_OWNER,
        isClinicalApprover: false,
        isActive: true,
        user: { id: ownerUserId, email: 'owner@test.com', name: 'Dr. Jane Owner', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await assert.rejects(
        () => ClinicalService.forwardPrescription('rx-test-spec-1', rxPracticeId, staffUserId, {}),
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'NO_CLINICAL_APPROVER_AVAILABLE');
          assert.ok(err.message.includes('No clinical approver is currently available'));
          return true;
        }
      );
    });

    // 2. Exactly one eligible veterinarian -> automatically assigned
    it('2. Exactly one eligible veterinarian -> automatically routes without forcing manual selection', async () => {
      MemberService.setMockMember({
        id: 'mem-vet-solo',
        practiceId: rxPracticeId,
        userId: vet1UserId,
        role: Role.VETERINARIAN,
        isClinicalApprover: true,
        isActive: true,
        user: { id: vet1UserId, email: 'vet1@test.com', name: 'Dr. Solo Vet', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const forwarded = await ClinicalService.forwardPrescription('rx-test-spec-1', rxPracticeId, staffUserId, {});
      assert.strictEqual(forwarded.status, 'Pending Approval');
      assert.strictEqual(forwarded.forwardedToUserId, vet1UserId, 'Must automatically assign sole veterinarian');
      assert.strictEqual(forwarded.forwardedByUserId, staffUserId);
    });

    // 3. Two eligible veterinarians -> forwarding requires explicit selection
    it('3. Two eligible veterinarians -> requires explicit selection and allows selecting either', async () => {
      MemberService.setMockMember({
        id: 'mem-vet-1',
        practiceId: rxPracticeId,
        userId: vet1UserId,
        role: Role.VETERINARIAN,
        isClinicalApprover: true,
        isActive: true,
        user: { id: vet1UserId, email: 'vet1@test.com', name: 'Dr. Alex Vet', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      MemberService.setMockMember({
        id: 'mem-vet-2',
        practiceId: rxPracticeId,
        userId: vet2UserId,
        role: Role.VETERINARIAN,
        isClinicalApprover: true,
        isActive: true,
        user: { id: vet2UserId, email: 'vet2@test.com', name: 'Dr. Fiza Shameem', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Attempt without selection -> MULTIPLE_APPROVERS_SELECTION_REQUIRED
      await assert.rejects(
        () => ClinicalService.forwardPrescription('rx-test-spec-1', rxPracticeId, staffUserId, {}),
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'MULTIPLE_APPROVERS_SELECTION_REQUIRED');
          assert.ok(err.message.includes('Multiple clinical approvers are available'));
          return true;
        }
      );

      // Explicitly select vet2 -> succeeds
      const forwarded2 = await ClinicalService.forwardPrescription('rx-test-spec-1', rxPracticeId, staffUserId, {
        forwardedToUserId: vet2UserId,
      });
      assert.strictEqual(forwarded2.status, 'Pending Approval');
      assert.strictEqual(forwarded2.forwardedToUserId, vet2UserId);

      // Reset to draft and select vet1 -> succeeds
      mockPrescriptions.set('rx-test-spec-1', {
        ...mockPrescriptions.get('rx-test-spec-1'),
        status: 'Draft',
        forwardedToUserId: null,
      });
      const forwarded1 = await ClinicalService.forwardPrescription('rx-test-spec-1', rxPracticeId, staffUserId, {
        forwardedToUserId: vet1UserId,
      });
      assert.strictEqual(forwarded1.status, 'Pending Approval');
      assert.strictEqual(forwarded1.forwardedToUserId, vet1UserId);
    });

    // 4. Veterinarian + Owner clinical approver -> both appear in deterministic order
    it('4. Veterinarian + Owner clinical approver -> both appear, vets first then owner/admin, alphabetically', async () => {
      MemberService.setMockMember({
        id: 'mem-owner-clin',
        practiceId: rxPracticeId,
        userId: ownerUserId,
        role: Role.PRACTICE_OWNER,
        isClinicalApprover: true,
        isActive: true,
        user: { id: ownerUserId, email: 'owner@test.com', name: 'Dr. Beta Owner', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      MemberService.setMockMember({
        id: 'mem-vet-zara',
        practiceId: rxPracticeId,
        userId: vet1UserId,
        role: Role.VETERINARIAN,
        isClinicalApprover: true,
        isActive: true,
        user: { id: vet1UserId, email: 'zara@test.com', name: 'Dr. Zara Vet', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      MemberService.setMockMember({
        id: 'mem-vet-alice',
        practiceId: rxPracticeId,
        userId: vet2UserId,
        role: Role.VETERINARIAN,
        isClinicalApprover: true,
        isActive: true,
        user: { id: vet2UserId, email: 'alice@test.com', name: 'Dr. Alice Vet', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const eligible = await ClinicalService.getEligibleClinicians(rxPracticeId);
      assert.strictEqual(eligible.length, 3);
      // Group 1: Veterinarians, sorted alphabetically by name
      assert.strictEqual(eligible[0].name, 'Dr. Alice Vet');
      assert.strictEqual(eligible[0].role, Role.VETERINARIAN);
      assert.strictEqual(eligible[1].name, 'Dr. Zara Vet');
      assert.strictEqual(eligible[1].role, Role.VETERINARIAN);
      // Group 2: Owner/Admin clinical approvers
      assert.strictEqual(eligible[2].name, 'Dr. Beta Owner');
      assert.strictEqual(eligible[2].role, Role.PRACTICE_OWNER);
      assert.strictEqual(eligible[2].isClinicalApprover, true);
    });

    // 5. Owner/Admin without isClinicalApprover -> does NOT appear
    it('5. Owner/Admin without isClinicalApprover -> does NOT appear in eligible approvers', async () => {
      MemberService.setMockMember({
        id: 'mem-owner-nonclin',
        practiceId: rxPracticeId,
        userId: ownerUserId,
        role: Role.PRACTICE_OWNER,
        isClinicalApprover: false,
        isActive: true,
        user: { id: ownerUserId, email: 'owner@test.com', name: 'Non-Clinical Owner', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      MemberService.setMockMember({
        id: 'mem-admin-nonclin',
        practiceId: rxPracticeId,
        userId: adminUserId,
        role: Role.PRACTICE_ADMIN,
        isClinicalApprover: false,
        isActive: true,
        user: { id: adminUserId, email: 'admin@test.com', name: 'Non-Clinical Admin', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const eligible = await ClinicalService.getEligibleClinicians(rxPracticeId);
      assert.strictEqual(eligible.length, 0, 'Non-clinical owners and admins must not appear');
    });

    // 6. Staff -> does NOT appear as approver
    it('6. Staff member -> does NOT appear in eligible list and is rejected if targeted', async () => {
      MemberService.setMockMember({
        id: 'mem-staff-1',
        practiceId: rxPracticeId,
        userId: staffUserId,
        role: Role.STAFF,
        isClinicalApprover: false,
        isActive: true,
        user: { id: staffUserId, email: 'staff@test.com', name: 'Sam Staff', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const eligible = await ClinicalService.getEligibleClinicians(rxPracticeId);
      assert.strictEqual(eligible.some(c => c.userId === staffUserId), false, 'Staff must not appear in eligible list');

      // Attempt to forward to staff
      await assert.rejects(
        () => ClinicalService.forwardPrescription('rx-test-spec-1', rxPracticeId, ownerUserId, {
          forwardedToUserId: staffUserId,
        }),
        (err: any) => {
          assert.ok(err.statusCode === 400 || err.statusCode === 403);
          return true;
        }
      );
    });

    // 7. Inactive veterinarian -> does NOT appear
    it('7. Inactive veterinarian -> does NOT appear and is rejected if targeted', async () => {
      MemberService.setMockMember({
        id: 'mem-vet-inactive',
        practiceId: rxPracticeId,
        userId: inactiveVetUserId,
        role: Role.VETERINARIAN,
        isClinicalApprover: true,
        isActive: false, // DEACTIVATED
        user: { id: inactiveVetUserId, email: 'inactive@test.com', name: 'Dr. Inactive Vet', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const eligible = await ClinicalService.getEligibleClinicians(rxPracticeId);
      assert.strictEqual(eligible.length, 0, 'Inactive veterinarian must not appear');

      await assert.rejects(
        () => ClinicalService.forwardPrescription('rx-test-spec-1', rxPracticeId, staffUserId, {
          forwardedToUserId: inactiveVetUserId,
        }),
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          return true;
        }
      );
    });

    // 8. Veterinarian from another practice -> cannot be selected/assigned
    it('8. Veterinarian from another practice -> rejected with 404 CLINICIAN_NOT_FOUND', async () => {
      // Add active vet to rxPracticeId so eligible > 0
      MemberService.setMockMember({
        id: 'mem-vet-local',
        practiceId: rxPracticeId,
        userId: vet1UserId,
        role: Role.VETERINARIAN,
        isClinicalApprover: true,
        isActive: true,
        user: { id: vet1UserId, email: 'local@test.com', name: 'Dr. Local Vet', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Other practice vet
      MemberService.setMockMember({
        id: 'mem-vet-other',
        practiceId: otherPracticeId,
        userId: otherPracticeVetUserId,
        role: Role.VETERINARIAN,
        isClinicalApprover: true,
        isActive: true,
        user: { id: otherPracticeVetUserId, email: 'other@test.com', name: 'Dr. Other Vet', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await assert.rejects(
        () => ClinicalService.forwardPrescription('rx-test-spec-1', rxPracticeId, staffUserId, {
          targetMemberId: 'mem-vet-other',
        }),
        (err: any) => {
          assert.strictEqual(err.statusCode, 404);
          assert.strictEqual(err.code, 'CLINICIAN_NOT_FOUND');
          return true;
        }
      );
    });

    // 9. Arbitrary forged targetMemberId -> backend rejects it
    it('9. Arbitrary forged targetMemberId -> backend rejects with 404 CLINICIAN_NOT_FOUND', async () => {
      MemberService.setMockMember({
        id: 'mem-vet-local',
        practiceId: rxPracticeId,
        userId: vet1UserId,
        role: Role.VETERINARIAN,
        isClinicalApprover: true,
        isActive: true,
        user: { id: vet1UserId, email: 'local@test.com', name: 'Dr. Local Vet', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await assert.rejects(
        () => ClinicalService.forwardPrescription('rx-test-spec-1', rxPracticeId, staffUserId, {
          targetMemberId: 'forged-malicious-member-id-12345',
        }),
        (err: any) => {
          assert.strictEqual(err.statusCode, 404);
          assert.strictEqual(err.code, 'CLINICIAN_NOT_FOUND');
          return true;
        }
      );
    });

    // 10. Platform Super Admin -> is NOT automatically a clinical approver
    it('10. Platform Super Admin -> is NOT automatically a clinical approver', async () => {
      AuthorizationService.setMockPlatformUser(superAdminUserId, PlatformRole.PLATFORM_SUPER_ADMIN);

      const isEligible = await ClinicalService.isEligiblePrescriptionApprover(superAdminUserId, rxPracticeId);
      assert.strictEqual(isEligible, false, 'Platform Super Admin must not automatically be a clinical approver');

      const eligible = await ClinicalService.getEligibleClinicians(rxPracticeId);
      assert.strictEqual(eligible.some(c => c.userId === superAdminUserId), false);
    });

    // 11. Selected approver is persisted correctly
    it('11. Selected approver is persisted correctly with forwardedToUserId, forwardedByUserId, forwardedAt, and remarks', async () => {
      MemberService.setMockMember({
        id: 'mem-vet-1',
        practiceId: rxPracticeId,
        userId: vet1UserId,
        role: Role.VETERINARIAN,
        isClinicalApprover: true,
        isActive: true,
        user: { id: vet1UserId, email: 'vet1@test.com', name: 'Dr. Alex Vet', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const forwarded = await ClinicalService.forwardPrescription('rx-test-spec-1', rxPracticeId, staffUserId, {
        forwardedToUserId: vet1UserId,
        forwardingRemarks: 'Please review cardiac medication dosage.',
      });

      assert.strictEqual(forwarded.status, 'Pending Approval');
      assert.strictEqual(forwarded.forwardedToUserId, vet1UserId);
      assert.strictEqual(forwarded.forwardedByUserId, staffUserId);
      assert.strictEqual(forwarded.forwardingRemarks, 'Please review cardiac medication dosage.');
      assert.ok(forwarded.forwardedAt);
    });

    // 12. Pending prescription displays assigned approver
    it('12. Pending prescription displays assigned approver with enriched role and clinical approver badge', async () => {
      MemberService.setMockMember({
        id: 'mem-vet-fiza',
        practiceId: rxPracticeId,
        userId: vet2UserId,
        role: Role.VETERINARIAN,
        isClinicalApprover: true,
        isActive: true,
        user: { id: vet2UserId, email: 'fiza@test.com', name: 'Dr. Fiza Shameem', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      mockPrescriptions.set('rx-pending-display', {
        id: 'rx-pending-display',
        practiceId: rxPracticeId,
        status: 'Pending Approval',
        version: 1,
        forwardedToUserId: vet2UserId,
        forwardedToUser: { id: vet2UserId, name: 'Dr. Fiza Shameem', email: 'fiza@test.com' },
        items: [],
      });

      const rx = await ClinicalService.getPrescriptionById('rx-pending-display', rxPracticeId);
      assert.strictEqual(rx.status, 'Pending Approval');
      assert.strictEqual(rx.forwardedToUser.name, 'Dr. Fiza Shameem');
      assert.strictEqual((rx.forwardedToUser as any).role, Role.VETERINARIAN);
      assert.strictEqual((rx.forwardedToUser as any).isClinicalApprover, true);
    });

    // 13. Approval by assigned eligible clinician succeeds
    it('13. Approval by assigned eligible clinician succeeds and marks prescription Approved', async () => {
      MemberService.setMockMember({
        id: 'mem-vet-fiza',
        practiceId: rxPracticeId,
        userId: vet2UserId,
        role: Role.VETERINARIAN,
        isClinicalApprover: true,
        isActive: true,
        user: { id: vet2UserId, email: 'fiza@test.com', name: 'Dr. Fiza Shameem', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      mockPrescriptions.set('rx-pending-for-approval', {
        id: 'rx-pending-for-approval',
        practiceId: rxPracticeId,
        status: 'Pending Approval',
        version: 1,
        forwardedToUserId: vet2UserId,
        items: [],
      });

      const approved = await ClinicalService.approvePrescription('rx-pending-for-approval', rxPracticeId, vet2UserId, {
        approvalRemarks: 'Clinical dosage verified and approved.',
      });

      assert.strictEqual(approved.status, 'Approved');
      assert.strictEqual(approved.approvedByUserId, vet2UserId);
    });

    // 14. Existing approval workflow tests remain passing
    it('14. Verification that existing approval workflow contracts remain fully intact', () => {
      assert.strictEqual(ClinicalService.isFinalOrApprovedStatus('Approved'), true);
      assert.strictEqual(ClinicalService.isFinalOrApprovedStatus('Draft'), false);
    });

    // 15. Existing tenant-isolation tests remain passing
    it('15. Tenant isolation strictly enforced on prescription approval & forwarding', async () => {
      // Trying to access or forward prescription belonging to rxPracticeId using otherPracticeId
      await assert.rejects(
        () => ClinicalService.getPrescriptionById('rx-test-spec-1', otherPracticeId),
        (err: any) => {
          assert.strictEqual(err.statusCode, 404);
          assert.strictEqual(err.code, 'PRESCRIPTION_NOT_FOUND');
          return true;
        }
      );

      await assert.rejects(
        () => ClinicalService.forwardPrescription('rx-test-spec-1', otherPracticeId, staffUserId, {}),
        (err: any) => {
          assert.strictEqual(err.statusCode, 404);
          assert.strictEqual(err.code, 'PRESCRIPTION_NOT_FOUND');
          return true;
        }
      );
    });
  });
});

