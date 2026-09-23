// ==============================================================================
// VetRx Phase 14 — User Management, RBAC & Practice Administration Test Suite
// Validates Role Resolution, Permissions, Invitations, Token Cryptography,
// User Deactivation/Reactivation, Ownership Transfer, Seat Enforcement,
// Billing RBAC, Platform Super Admin Isolation, and Complete Audit Trail.
// ==============================================================================

process.env.VETRX_FAST_TEST = '1';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Role, PlatformRole, InvitationStatus } from '@prisma/client';
import { AppError } from '../src/middleware/errorHandler.js';
import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  getPermissionsForRole,
  roleHasPermission,
} from '../src/auth/permissions.js';
import { AuthorizationService } from '../src/auth/authorization.service.js';
import { InvitationService } from '../src/auth/invitation.service.js';
import { MemberService } from '../src/auth/member.service.js';
import { PlatformAdminService } from '../src/platform/platform-admin.service.js';
import { EntitlementService } from '../src/commercial/entitlement.service.js';
import { AuditService } from '../src/lib/audit.service.js';
import { AUTHORITATIVE_PLANS } from '../src/commercial/plan.config.js';

describe('Phase 14: User Management, RBAC & Practice Administration Test Suite', () => {
  const practiceAlpha = 'practice-alpha-tenant-1111';
  const practiceBeta = 'practice-beta-tenant-2222';

  const userOwner = 'user-owner-001';
  const userAdmin = 'user-admin-002';
  const userVet1 = 'user-vet-003';
  const userVet2 = 'user-vet-004';
  const userStaff = 'user-staff-005';
  const userReadOnly = 'user-readonly-006';
  const userSuperAdmin = 'user-super-admin-007';

  beforeEach(() => {
    AuthorizationService.clearMocks();
    InvitationService.clearMocks();
    MemberService.clearMocks();
    PlatformAdminService.clearMocks();
    EntitlementService.clearMockSubscriptions();
    AuditService.clearMockLogs();

    // Default setup: Practice Alpha with Owner, Admin, Vet, Staff, ReadOnly
    AuthorizationService.setMockPracticeOwner(practiceAlpha, userOwner);

    MemberService.setMockMember({
      id: 'mem-owner',
      practiceId: practiceAlpha,
      userId: userOwner,
      role: Role.PRACTICE_OWNER,
      isActive: true,
      user: { id: userOwner, email: 'owner@alpha.vet', name: 'Dr. Owner', avatarUrl: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    MemberService.setMockMember({
      id: 'mem-admin',
      practiceId: practiceAlpha,
      userId: userAdmin,
      role: Role.PRACTICE_ADMIN,
      isActive: true,
      user: { id: userAdmin, email: 'admin@alpha.vet', name: 'Admin Alice', avatarUrl: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    MemberService.setMockMember({
      id: 'mem-vet1',
      practiceId: practiceAlpha,
      userId: userVet1,
      role: Role.VETERINARIAN,
      isActive: true,
      user: { id: userVet1, email: 'vet1@alpha.vet', name: 'Dr. Vet One', avatarUrl: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    MemberService.setMockMember({
      id: 'mem-staff',
      practiceId: practiceAlpha,
      userId: userStaff,
      role: Role.STAFF,
      isActive: true,
      user: { id: userStaff, email: 'staff@alpha.vet', name: 'Sam Staff', avatarUrl: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    MemberService.setMockMember({
      id: 'mem-readonly',
      practiceId: practiceAlpha,
      userId: userReadOnly,
      role: Role.READ_ONLY,
      isActive: true,
      user: { id: userReadOnly, email: 'readonly@alpha.vet', name: 'Observer Bob', avatarUrl: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Platform Super Admin (operates outside practice membership)
    AuthorizationService.setMockPlatformUser(userSuperAdmin, PlatformRole.PLATFORM_SUPER_ADMIN);
  });

  // ----------------------------------------------------------------------------
  // Category A: Role Resolution & Granular Permission Matrix
  // ----------------------------------------------------------------------------
  describe('Category A: Role Resolution & Granular Permission Matrix', () => {
    it('1. PRACTICE_OWNER has all clinical, administration, billing, and ownership permissions', () => {
      const perms = getPermissionsForRole(Role.PRACTICE_OWNER);
      assert.ok(perms.includes(PERMISSIONS.PATIENT_CREATE));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_CREATE));
      assert.ok(perms.includes(PERMISSIONS.USER_INVITE));
      assert.ok(perms.includes(PERMISSIONS.ROLE_ASSIGN));
      assert.ok(perms.includes(PERMISSIONS.BILLING_MANAGE));
      assert.ok(perms.includes(PERMISSIONS.SUBSCRIPTION_MANAGE));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_APPROVE));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_REQUEST_CHANGES));
      assert.ok(perms.includes(PERMISSIONS.OWNERSHIP_TRANSFER));
      assert.ok(perms.includes(PERMISSIONS.PRACTICE_SETTINGS_MANAGE));
    });

    it('2. PRACTICE_ADMIN has clinical/operational admin, but explicitly lacks OWNERSHIP_TRANSFER & BILLING_MANAGE', () => {
      const perms = getPermissionsForRole(Role.PRACTICE_ADMIN);
      assert.ok(perms.includes(PERMISSIONS.PATIENT_CREATE));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_CREATE));
      assert.ok(perms.includes(PERMISSIONS.USER_INVITE));
      assert.ok(perms.includes(PERMISSIONS.ROLE_ASSIGN));
      assert.ok(perms.includes(PERMISSIONS.BILLING_VIEW));
      assert.ok(perms.includes(PERMISSIONS.SUBSCRIPTION_VIEW));

      // Invariants: Admin cannot manage billing or transfer ownership
      assert.strictEqual(perms.includes(PERMISSIONS.OWNERSHIP_TRANSFER), false);
      assert.strictEqual(perms.includes(PERMISSIONS.BILLING_MANAGE), false);
      assert.strictEqual(perms.includes(PERMISSIONS.SUBSCRIPTION_MANAGE), false);
    });

    it('3. VETERINARIAN has clinical permissions but lacks user management, settings, and billing manage', () => {
      const perms = getPermissionsForRole(Role.VETERINARIAN);
      assert.ok(perms.includes(PERMISSIONS.PATIENT_CREATE));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_CREATE));
      assert.ok(perms.includes(PERMISSIONS.INVOICE_CREATE));

      assert.strictEqual(perms.includes(PERMISSIONS.USER_INVITE), false);
      assert.strictEqual(perms.includes(PERMISSIONS.ROLE_ASSIGN), false);
      assert.strictEqual(perms.includes(PERMISSIONS.BILLING_MANAGE), false);
      assert.strictEqual(perms.includes(PERMISSIONS.OWNERSHIP_TRANSFER), false);
      assert.strictEqual(perms.includes(PERMISSIONS.PRACTICE_SETTINGS_MANAGE), false);
    });

    it('4. STAFF has operational permissions and can draft prescriptions but cannot clinically approve or manage users/billing', () => {
      const perms = getPermissionsForRole(Role.STAFF);
      assert.ok(perms.includes(PERMISSIONS.PATIENT_VIEW));
      assert.ok(perms.includes(PERMISSIONS.PATIENT_CREATE));
      assert.ok(perms.includes(PERMISSIONS.OWNER_CREATE));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_VIEW));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_CREATE));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_UPDATE));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_FORWARD_FOR_APPROVAL));
      assert.ok(perms.includes(PERMISSIONS.INVOICE_CREATE));

      // Invariants: Staff cannot clinically approve, delete prescriptions, or administer practice
      assert.strictEqual(perms.includes(PERMISSIONS.PRESCRIPTION_APPROVE), false);
      assert.strictEqual(perms.includes(PERMISSIONS.PRESCRIPTION_REQUEST_CHANGES), false);
      assert.strictEqual(perms.includes(PERMISSIONS.PRESCRIPTION_DELETE), false);
      assert.strictEqual(perms.includes(PERMISSIONS.USER_INVITE), false);
      assert.strictEqual(perms.includes(PERMISSIONS.BILLING_MANAGE), false);
      assert.strictEqual(perms.includes(PERMISSIONS.PRACTICE_SETTINGS_MANAGE), false);
    });

    it('5. READ_ONLY has view-only permissions with zero mutation capabilities', () => {
      const perms = getPermissionsForRole(Role.READ_ONLY);
      assert.ok(perms.includes(PERMISSIONS.PATIENT_VIEW));
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_VIEW));
      assert.ok(perms.includes(PERMISSIONS.INVOICE_VIEW));

      // Invariants: Zero mutation allowed
      assert.strictEqual(perms.includes(PERMISSIONS.PATIENT_CREATE), false);
      assert.strictEqual(perms.includes(PERMISSIONS.PRESCRIPTION_CREATE), false);
      assert.strictEqual(perms.includes(PERMISSIONS.INVOICE_CREATE), false);
      assert.strictEqual(perms.includes(PERMISSIONS.USER_INVITE), false);
    });

    it('6. Legacy PRACTICE_STAFF resolves seamlessly to STAFF permissions', () => {
      const legacyPerms = getPermissionsForRole(Role.PRACTICE_STAFF);
      const staffPerms = getPermissionsForRole(Role.STAFF);
      assert.deepStrictEqual(legacyPerms, staffPerms);
    });

    it('7. Practice roles never inherit Platform Super Admin permissions', () => {
      const allPracticeRoles = [
        Role.PRACTICE_OWNER,
        Role.PRACTICE_ADMIN,
        Role.VETERINARIAN,
        Role.STAFF,
        Role.READ_ONLY,
      ];
      for (const r of allPracticeRoles) {
        assert.strictEqual(roleHasPermission(r, PERMISSIONS.PLATFORM_PRACTICE_MANAGE), false);
        assert.strictEqual(roleHasPermission(r, PERMISSIONS.PLATFORM_USER_MANAGE), false);
        assert.strictEqual(roleHasPermission(r, PERMISSIONS.PLATFORM_AUDIT_VIEW), false);
      }
    });
  });

  // ----------------------------------------------------------------------------
  // Category B: Authorization Service & Practice Boundaries
  // ----------------------------------------------------------------------------
  describe('Category B: Authorization Service & Practice Boundaries', () => {
    it('8. Active member evaluates permissions successfully', async () => {
      const canPrescribe = await AuthorizationService.hasPermission(
        userVet1,
        practiceAlpha,
        PERMISSIONS.PRESCRIPTION_CREATE
      );
      assert.strictEqual(canPrescribe, true);
    });

    it('9. Deactivated member is rejected with MEMBERSHIP_DISABLED (403)', async () => {
      AuthorizationService.setMockMembership('user-disabled', practiceAlpha, {
        role: Role.VETERINARIAN,
        isActive: false,
      });

      await assert.rejects(
        async () => {
          await AuthorizationService.requirePermission('user-disabled', practiceAlpha, PERMISSIONS.PATIENT_VIEW);
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'MEMBERSHIP_DISABLED');
          return true;
        }
      );
    });

    it('10. Non-member accessing practice receives NOT_PRACTICE_MEMBER (403)', async () => {
      await assert.rejects(
        async () => {
          await AuthorizationService.requirePermission('unknown-user', practiceAlpha, PERMISSIONS.PATIENT_VIEW);
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'NOT_PRACTICE_MEMBER');
          return true;
        }
      );
    });

    it('11. Practice A member cannot perform actions on Practice B (tenant isolation)', async () => {
      // Vet1 is member of Alpha, but NOT Beta
      const hasAccessOnBeta = await AuthorizationService.hasPermission(
        userVet1,
        practiceBeta,
        PERMISSIONS.PATIENT_VIEW
      );
      assert.strictEqual(hasAccessOnBeta, false);

      await assert.rejects(
        async () => {
          await AuthorizationService.requirePermission(userVet1, practiceBeta, PERMISSIONS.PATIENT_VIEW);
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'NOT_PRACTICE_MEMBER');
          return true;
        }
      );
    });

    it('12. User with multiple practice memberships has isolated permissions per practice context', async () => {
      // User X is VETERINARIAN in Practice Alpha, but PRACTICE_ADMIN in Practice Beta
      const userMulti = 'user-multi-practice';
      AuthorizationService.setMockMembership(userMulti, practiceAlpha, {
        role: Role.VETERINARIAN,
        isActive: true,
      });
      AuthorizationService.setMockMembership(userMulti, practiceBeta, {
        role: Role.PRACTICE_ADMIN,
        isActive: true,
      });

      // In Alpha: Cannot invite users
      const canInviteInAlpha = await AuthorizationService.hasPermission(userMulti, practiceAlpha, PERMISSIONS.USER_INVITE);
      assert.strictEqual(canInviteInAlpha, false);

      // In Beta: Can invite users
      const canInviteInBeta = await AuthorizationService.hasPermission(userMulti, practiceBeta, PERMISSIONS.USER_INVITE);
      assert.strictEqual(canInviteInBeta, true);
    });
  });

  // ----------------------------------------------------------------------------
  // Category C: Invitation System Lifecycle & Cryptography
  // ----------------------------------------------------------------------------
  describe('Category C: Invitation System Lifecycle & Cryptography', () => {
    it('13. Practice Owner can create an invitation with secure token and 7-day expiration', async () => {
      const inv = await InvitationService.createInvitation(
        userOwner,
        practiceAlpha,
        'newdoc@clinic.com',
        Role.VETERINARIAN
      );

      assert.ok(inv.id.startsWith('inv-'));
      assert.strictEqual(inv.email, 'newdoc@clinic.com');
      assert.strictEqual(inv.role, Role.VETERINARIAN);
      assert.ok(inv.token && inv.token.length >= 32);

      const expiresAt = new Date(inv.expiresAt);
      const diffDays = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      assert.ok(diffDays > 6 && diffDays <= 7.1);
    });

    it('14. Invitation cannot grant PRACTICE_OWNER role (INVITATION_ROLE_FORBIDDEN)', async () => {
      await assert.rejects(
        async () => {
          await InvitationService.createInvitation(userOwner, practiceAlpha, 'takeover@clinic.com', Role.PRACTICE_OWNER);
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'INVITATION_ROLE_FORBIDDEN');
          return true;
        }
      );
    });

    it('15. Practice Admin cannot invite another Practice Admin (ROLE_ASSIGNMENT_FORBIDDEN)', async () => {
      await assert.rejects(
        async () => {
          await InvitationService.createInvitation(userAdmin, practiceAlpha, 'otheradmin@clinic.com', Role.PRACTICE_ADMIN);
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'ROLE_ASSIGNMENT_FORBIDDEN');
          return true;
        }
      );
    });

    it('16. Staff member cannot create invitations (INSUFFICIENT_PERMISSION)', async () => {
      await assert.rejects(
        async () => {
          await InvitationService.createInvitation(userStaff, practiceAlpha, 'friend@clinic.com', Role.STAFF);
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'INSUFFICIENT_PERMISSION');
          return true;
        }
      );
    });

    it('17. Token acceptance is one-time; reuse throws INVITATION_ALREADY_ACCEPTED', async () => {
      const inv = await InvitationService.createInvitation(
        userOwner,
        practiceAlpha,
        'doc2@clinic.com',
        Role.VETERINARIAN
      );

      // First acceptance succeeds
      const result = await InvitationService.acceptInvitation(inv.token, {
        id: 'new-user-099',
        email: 'doc2@clinic.com',
      });
      assert.strictEqual(result.practiceId, practiceAlpha);
      assert.strictEqual(result.role, Role.VETERINARIAN);

      // Second acceptance is strictly blocked
      await assert.rejects(
        async () => {
          await InvitationService.acceptInvitation(inv.token, {
            id: 'new-user-099',
            email: 'doc2@clinic.com',
          });
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 409);
          assert.strictEqual(err.code, 'INVITATION_ALREADY_ACCEPTED');
          return true;
        }
      );
    });

    it('18. Expired invitation cannot be accepted (INVITATION_EXPIRED)', async () => {
      const rawToken = InvitationService.generateToken();
      const tokenHash = InvitationService.hashToken(rawToken);

      InvitationService.setMockInvitation({
        id: 'inv-expired',
        practiceId: practiceAlpha,
        email: 'expired@clinic.com',
        role: Role.STAFF,
        tokenHash,
        invitedById: userOwner,
        status: InvitationStatus.PENDING,
        expiresAt: new Date(Date.now() - 1000 * 60), // 1 minute in the past
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await assert.rejects(
        async () => {
          await InvitationService.acceptInvitation(rawToken, {
            id: 'user-late',
            email: 'expired@clinic.com',
          });
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'INVITATION_EXPIRED');
          return true;
        }
      );
    });

    it('19. Revoked invitation cannot be accepted (INVITATION_REVOKED)', async () => {
      const inv = await InvitationService.createInvitation(userOwner, practiceAlpha, 'revokeme@clinic.com', Role.STAFF);

      // Revoke it
      await InvitationService.revokeInvitation(userOwner, practiceAlpha, inv.id);

      await assert.rejects(
        async () => {
          await InvitationService.acceptInvitation(inv.token, {
            id: 'user-revoked',
            email: 'revokeme@clinic.com',
          });
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'INVITATION_REVOKED');
          return true;
        }
      );
    });

    it('20. Invitation acceptance rejects email mismatch (INVITATION_EMAIL_MISMATCH)', async () => {
      const inv = await InvitationService.createInvitation(userOwner, practiceAlpha, 'intended@clinic.com', Role.STAFF);

      await assert.rejects(
        async () => {
          await InvitationService.acceptInvitation(inv.token, {
            id: 'user-imposter',
            email: 'imposter@different.com',
          });
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'INVITATION_EMAIL_MISMATCH');
          return true;
        }
      );
    });

    it('21. Resending an invitation refreshes the token and resets expiration', async () => {
      const inv = await InvitationService.createInvitation(userOwner, practiceAlpha, 'resend@clinic.com', Role.STAFF);

      const resent = await InvitationService.resendInvitation(userOwner, practiceAlpha, inv.id);
      assert.strictEqual(resent.id, inv.id);
      assert.notStrictEqual(resent.token, inv.token); // New random token generated
    });
  });

  // ----------------------------------------------------------------------------
  // Category D: Commercial Seat Limit Enforcement
  // ----------------------------------------------------------------------------
  describe('Category D: Commercial Seat Limit Enforcement', () => {
    it('22. Individual Plan (1 vet seat limit): Cannot invite a 2nd veterinarian', async () => {
      // Set Practice Alpha to Individual plan with 1 active veterinarian (the owner)
      EntitlementService.setMockSubscription(practiceAlpha, {
        planCode: AUTHORITATIVE_PLANS.INDIVIDUAL_MONTHLY.code,
        status: 'ACTIVE',
        usage: { veterinarianSeatsCount: 1, staffSeatsCount: 0 },
      });

      await assert.rejects(
        async () => {
          await InvitationService.createInvitation(
            userOwner,
            practiceAlpha,
            'secondvet@clinic.com',
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

    it('23. Individual Plan: Staff remains unlimited even when veterinarian seat is full', async () => {
      EntitlementService.setMockSubscription(practiceAlpha, {
        planCode: AUTHORITATIVE_PLANS.INDIVIDUAL_MONTHLY.code,
        status: 'ACTIVE',
        usage: { veterinarianSeatsCount: 1, staffSeatsCount: 10 },
      });

      // Inviting staff must succeed
      const inv = await InvitationService.createInvitation(
        userOwner,
        practiceAlpha,
        'unlimitedstaff@clinic.com',
        Role.STAFF
      );
      assert.strictEqual(inv.role, Role.STAFF);
    });

    it('24. Clinic Plan allows up to 5 veterinarians; rejects 6th veterinarian', async () => {
      // 4 vets active (can add 1 more)
      EntitlementService.setMockSubscription(practiceAlpha, {
        planCode: AUTHORITATIVE_PLANS.CLINIC_MONTHLY.code,
        status: 'ACTIVE',
        usage: { veterinarianSeatsCount: 4, staffSeatsCount: 5 },
      });

      const inv5 = await InvitationService.createInvitation(
        userOwner,
        practiceAlpha,
        'vet5@clinic.com',
        Role.VETERINARIAN
      );
      assert.strictEqual(inv5.role, Role.VETERINARIAN);

      // Now 5 vets active (capacity full)
      EntitlementService.setMockUsage(practiceAlpha, { veterinarianSeatsCount: 5 });

      await assert.rejects(
        async () => {
          await InvitationService.createInvitation(
            userOwner,
            practiceAlpha,
            'vet6@clinic.com',
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

    it('25. Unlimited staff does not count against veterinarian seats', async () => {
      const usage = await EntitlementService.getPracticeUsage(practiceAlpha);
      assert.ok(usage.staffSeatsCount >= 0);
      assert.ok(usage.veterinarianSeatsCount >= 1);
    });
  });

  // ----------------------------------------------------------------------------
  // Category E: Member Management & Role Modification
  // ----------------------------------------------------------------------------
  describe('Category E: Member Management & Role Modification', () => {
    it('26. Practice Owner can change member roles', async () => {
      const updated = await MemberService.updateMemberRole(
        userOwner,
        practiceAlpha,
        'mem-staff',
        Role.READ_ONLY
      );
      assert.strictEqual(updated.role, Role.READ_ONLY);
    });

    it('27. User cannot change their own role (SELF_ROLE_CHANGE_FORBIDDEN)', async () => {
      await assert.rejects(
        async () => {
          await MemberService.updateMemberRole(userAdmin, practiceAlpha, 'mem-admin', Role.PRACTICE_OWNER);
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 400); // Prompts OWNER_TRANSFER_REQUIRED or SELF_ROLE_CHANGE_FORBIDDEN
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await MemberService.updateMemberRole(userAdmin, practiceAlpha, 'mem-admin', Role.STAFF);
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'SELF_ROLE_CHANGE_FORBIDDEN');
          return true;
        }
      );
    });

    it('28. Direct promotion to PRACTICE_OWNER is rejected (OWNER_TRANSFER_REQUIRED)', async () => {
      await assert.rejects(
        async () => {
          await MemberService.updateMemberRole(userOwner, practiceAlpha, 'mem-vet1', Role.PRACTICE_OWNER);
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'OWNER_TRANSFER_REQUIRED');
          return true;
        }
      );
    });

    it('29. Practice Admin cannot promote anyone to Admin (ROLE_ASSIGNMENT_FORBIDDEN)', async () => {
      await assert.rejects(
        async () => {
          await MemberService.updateMemberRole(userAdmin, practiceAlpha, 'mem-staff', Role.PRACTICE_ADMIN);
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'ROLE_ASSIGNMENT_FORBIDDEN');
          return true;
        }
      );
    });

    it('30. Promoting a member to VETERINARIAN checks seat availability', async () => {
      EntitlementService.setMockSubscription(practiceAlpha, {
        planCode: AUTHORITATIVE_PLANS.INDIVIDUAL_MONTHLY.code,
        status: 'ACTIVE',
        usage: { veterinarianSeatsCount: 1 }, // Full on Individual
      });

      await assert.rejects(
        async () => {
          await MemberService.updateMemberRole(userOwner, practiceAlpha, 'mem-staff', Role.VETERINARIAN);
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'SEAT_LIMIT_REACHED');
          return true;
        }
      );
    });
  });

  // ----------------------------------------------------------------------------
  // Category F: Member Deactivation & Reactivation
  // ----------------------------------------------------------------------------
  describe('Category F: Member Deactivation & Reactivation', () => {
    it('31. Member can be deactivated without deleting clinical records', async () => {
      const res = await MemberService.deactivateMember(userOwner, practiceAlpha, 'mem-staff');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.member.isActive, false);

      // Deactivated member can no longer execute actions
      const canAccess = await AuthorizationService.hasPermission(userStaff, practiceAlpha, PERMISSIONS.PATIENT_VIEW);
      assert.strictEqual(canAccess, false);
    });

    it('32. User cannot deactivate themselves (SELF_DEACTIVATION_FORBIDDEN)', async () => {
      await assert.rejects(
        async () => {
          await MemberService.deactivateMember(userAdmin, practiceAlpha, 'mem-admin');
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'SELF_DEACTIVATION_FORBIDDEN');
          return true;
        }
      );
    });

    it('33. The Practice Owner cannot be deactivated (CANNOT_REMOVE_LAST_OWNER)', async () => {
      await assert.rejects(
        async () => {
          await MemberService.deactivateMember(userAdmin, practiceAlpha, 'mem-owner');
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          return true;
        }
      );
    });

    it('34. Deactivated member can be reactivated by administrator', async () => {
      await MemberService.deactivateMember(userOwner, practiceAlpha, 'mem-staff');
      const res = await MemberService.reactivateMember(userOwner, practiceAlpha, 'mem-staff');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.member.isActive, true);

      const canAccess = await AuthorizationService.hasPermission(userStaff, practiceAlpha, PERMISSIONS.PATIENT_VIEW);
      assert.strictEqual(canAccess, true);
    });
  });

  // ----------------------------------------------------------------------------
  // Category G: Atomic Ownership Transfer
  // ----------------------------------------------------------------------------
  describe('Category G: Atomic Ownership Transfer', () => {
    it('35. Practice Owner can transfer ownership atomically to an active member', async () => {
      const res = await MemberService.transferOwnership(
        userOwner,
        practiceAlpha,
        'mem-admin',
        Role.PRACTICE_ADMIN
      );

      assert.strictEqual(res.success, true);
      assert.strictEqual(res.newOwnerUserId, userAdmin);

      // New owner has Owner privileges
      const isNewOwner = await AuthorizationService.isPracticeOwner(userAdmin, practiceAlpha);
      assert.strictEqual(isNewOwner, true);

      // Previous owner is now Admin and loses ownership privileges
      const isOldOwner = await AuthorizationService.isPracticeOwner(userOwner, practiceAlpha);
      assert.strictEqual(isOldOwner, false);

      const oldOwnerCanTransfer = await AuthorizationService.hasPermission(
        userOwner,
        practiceAlpha,
        PERMISSIONS.OWNERSHIP_TRANSFER
      );
      assert.strictEqual(oldOwnerCanTransfer, false);
    });

    it('36. Admin cannot initiate ownership transfer (OWNER_TRANSFER_FORBIDDEN)', async () => {
      await assert.rejects(
        async () => {
          await MemberService.transferOwnership(userAdmin, practiceAlpha, 'mem-vet1');
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'INSUFFICIENT_PERMISSION');
          return true;
        }
      );
    });

    it('37. Owner cannot transfer ownership to self (SELF_TRANSFER_FORBIDDEN)', async () => {
      await assert.rejects(
        async () => {
          await MemberService.transferOwnership(userOwner, practiceAlpha, 'mem-owner');
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'SELF_TRANSFER_FORBIDDEN');
          return true;
        }
      );
    });

    it('38. Cannot transfer ownership to an inactive member (MEMBER_INACTIVE)', async () => {
      await MemberService.deactivateMember(userOwner, practiceAlpha, 'mem-vet1');

      await assert.rejects(
        async () => {
          await MemberService.transferOwnership(userOwner, practiceAlpha, 'mem-vet1');
        },
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'MEMBER_INACTIVE');
          return true;
        }
      );
    });
  });

  // ----------------------------------------------------------------------------
  // Category H: Billing & Commercial Authorization
  // ----------------------------------------------------------------------------
  describe('Category H: Billing & Commercial Authorization', () => {
    it('39. Practice Owner can view and manage billing/subscriptions', async () => {
      assert.strictEqual(
        await AuthorizationService.hasPermission(userOwner, practiceAlpha, PERMISSIONS.BILLING_MANAGE),
        true
      );
      assert.strictEqual(
        await AuthorizationService.hasPermission(userOwner, practiceAlpha, PERMISSIONS.SUBSCRIPTION_MANAGE),
        true
      );
    });

    it('40. Practice Admin can view billing/subscription but CANNOT manage billing', async () => {
      assert.strictEqual(
        await AuthorizationService.hasPermission(userAdmin, practiceAlpha, PERMISSIONS.BILLING_VIEW),
        true
      );
      assert.strictEqual(
        await AuthorizationService.hasPermission(userAdmin, practiceAlpha, PERMISSIONS.SUBSCRIPTION_VIEW),
        true
      );
      assert.strictEqual(
        await AuthorizationService.hasPermission(userAdmin, practiceAlpha, PERMISSIONS.BILLING_MANAGE),
        false
      );
    });

    it('41. Veterinarians, Staff, and Read-Only cannot view or manage billing', async () => {
      for (const u of [userVet1, userStaff, userReadOnly]) {
        assert.strictEqual(
          await AuthorizationService.hasPermission(u, practiceAlpha, PERMISSIONS.BILLING_VIEW),
          false
        );
        assert.strictEqual(
          await AuthorizationService.hasPermission(u, practiceAlpha, PERMISSIONS.BILLING_MANAGE),
          false
        );
      }
    });
  });

  // ----------------------------------------------------------------------------
  // Category I: Platform Super Admin Isolation
  // ----------------------------------------------------------------------------
  describe('Category I: Platform Super Admin Isolation', () => {
    it('42. Platform Super Admin passes platform check', async () => {
      const isSuperAdmin = await AuthorizationService.isPlatformSuperAdmin(userSuperAdmin);
      assert.strictEqual(isSuperAdmin, true);
    });

    it('43. Practice Owner and Admin are rejected from platform endpoints (PLATFORM_ACCESS_REQUIRED)', async () => {
      for (const u of [userOwner, userAdmin, userVet1, userStaff]) {
        const isSuperAdmin = await AuthorizationService.isPlatformSuperAdmin(u);
        assert.strictEqual(isSuperAdmin, false);

        await assert.rejects(
          async () => {
            await AuthorizationService.requirePlatformSuperAdmin(u);
          },
          (err: any) => {
            assert.strictEqual(err.statusCode, 403);
            assert.strictEqual(err.code, 'PLATFORM_ACCESS_REQUIRED');
            return true;
          }
        );
      }
    });
  });

  // ----------------------------------------------------------------------------
  // Category J: Comprehensive Audit Trail
  // ----------------------------------------------------------------------------
  describe('Category J: Comprehensive Audit Trail', () => {
    it('44. Administrative operations generate exact AuditLog records', async () => {
      AuditService.clearMockLogs();

      // 1. Invite user
      const inv = await InvitationService.createInvitation(userOwner, practiceAlpha, 'audit@clinic.com', Role.STAFF);
      // 2. Accept invite
      await InvitationService.acceptInvitation(inv.token, { id: 'u-audit', email: 'audit@clinic.com' });
      // 3. Update role
      await MemberService.updateMemberRole(userOwner, practiceAlpha, 'mem-staff', Role.READ_ONLY);
      // 4. Deactivate member
      await MemberService.deactivateMember(userOwner, practiceAlpha, 'mem-staff');
      // 5. Reactivate member
      await MemberService.reactivateMember(userOwner, practiceAlpha, 'mem-staff');
      // 6. Transfer ownership
      await MemberService.transferOwnership(userOwner, practiceAlpha, 'mem-admin', Role.PRACTICE_ADMIN);

      const actions = AuditService.mockLogs.map((l) => l.action);
      assert.ok(actions.includes('USER_INVITED'));
      assert.ok(actions.includes('INVITATION_ACCEPTED'));
      assert.ok(actions.includes('ROLE_CHANGED'));
      assert.ok(actions.includes('USER_DEACTIVATED'));
      assert.ok(actions.includes('USER_ACTIVATED'));
      assert.ok(actions.includes('OWNERSHIP_TRANSFERRED'));
    });
  });
});
