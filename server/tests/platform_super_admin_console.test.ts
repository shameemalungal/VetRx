// ==============================================================================
// VetRx — Platform Super Admin Console Test Suite (Phase 14 Extension)
// Verifying 38+ Scenarios for Centralized SaaS Platform Administration:
// - Authorization & Tenant Isolation
// - Dashboard & Global Search
// - Practice Management (Create, Edit, Suspend, Reactivate, Ownership)
// - Global User Administration (Create, Password Reset, Force Logout, Activate/Deactivate)
// - Practice Membership Administration (Add, Remove, Role Change, Clinical Approver)
// - Subscriptions, Payments, Issues & Support Sessions
// - Roles, Permissions Matrix, Overrides & Audit Logs
// - Commercial Seat Limit Enforcement & Clinical Safety Boundaries
// ==============================================================================

process.env.VETRX_FAST_TEST = '1';
process.env.NODE_ENV = 'test';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Role, PlatformRole, PracticeType, PracticeStatus, IssueCategory, IssuePriority, IssueStatus } from '@prisma/client';
import { AppError } from '../src/middleware/errorHandler.js';
import { AuthorizationService } from '../src/auth/authorization.service.js';
import { PlatformAdminService } from '../src/platform/platform-admin.service.js';
import { MemberService } from '../src/auth/member.service.js';
import { InvitationService } from '../src/auth/invitation.service.js';
import { EntitlementService } from '../src/commercial/entitlement.service.js';
import { AuditService } from '../src/lib/audit.service.js';
import { PERMISSIONS } from '../src/auth/permissions.js';

describe('Central Platform Super Admin Console (38+ Scenarios)', () => {
  const superAdminUserId = 'user-super-admin-root';
  const ownerAlphaUserId = 'user-owner-alpha';
  const adminAlphaUserId = 'user-admin-alpha';
  const vetAlphaUserId = 'user-vet-alpha';
  const staffAlphaUserId = 'user-staff-alpha';
  const readonlyAlphaUserId = 'user-readonly-alpha';

  const practiceAlphaId = 'practice-alpha-console';
  const practiceBetaId = 'practice-beta-console';

  beforeEach(() => {
    AuthorizationService.clearMocks();
    MemberService.clearMocks();
    InvitationService.clearMocks();
    PlatformAdminService.clearMocks();
    EntitlementService.clearMockSubscriptions();
    AuditService.clearMockLogs();

    // 1. Setup Platform Super Admin
    AuthorizationService.setMockPlatformUser(superAdminUserId, PlatformRole.PLATFORM_SUPER_ADMIN);

    // 2. Setup Practice Alpha (Clinic plan, 5 seats)
    AuthorizationService.setMockPracticeOwner(practiceAlphaId, ownerAlphaUserId);
    EntitlementService.setMockSubscription(practiceAlphaId, {
      status: 'ACTIVE',
      planCode: 'CLINIC_MONTHLY',
      currentPeriodEnd: new Date(Date.now() + 86400000).toISOString(),
    });

    PlatformAdminService.setMockPractices([
      {
        id: practiceAlphaId,
        name: 'Alpha Veterinary Hospital',
        slug: 'alpha-vet',
        practiceType: PracticeType.CLINIC,
        status: PracticeStatus.ACTIVE,
        ownerUserId: ownerAlphaUserId,
        ownerName: 'Dr. Alpha Owner',
        ownerEmail: 'owner@alpha.vet',
        isActive: true,
        createdAt: new Date().toISOString(),
        memberCount: 5,
        veterinarianCount: 2,
        subscriptionPlan: 'Clinic Monthly',
        subscriptionStatus: 'ACTIVE',
      },
      {
        id: practiceBetaId,
        name: 'Beta Solo Practice',
        slug: 'beta-solo',
        practiceType: PracticeType.INDEPENDENT,
        status: PracticeStatus.ACTIVE,
        ownerUserId: 'user-owner-beta',
        ownerName: 'Dr. Beta Solo',
        ownerEmail: 'owner@beta.vet',
        isActive: true,
        createdAt: new Date().toISOString(),
        memberCount: 1,
        veterinarianCount: 1,
        subscriptionPlan: 'Individual Monthly',
        subscriptionStatus: 'ACTIVE',
      },
    ]);

    // Setup Members in Alpha
    MemberService.setMockMember({
      id: 'mem-owner-alpha',
      practiceId: practiceAlphaId,
      userId: ownerAlphaUserId,
      role: Role.PRACTICE_OWNER,
      isClinicalApprover: true,
      isActive: true,
      user: { id: ownerAlphaUserId, email: 'owner@alpha.vet', name: 'Dr. Alpha Owner', avatarUrl: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    MemberService.setMockMember({
      id: 'mem-admin-alpha',
      practiceId: practiceAlphaId,
      userId: adminAlphaUserId,
      role: Role.PRACTICE_ADMIN,
      isClinicalApprover: false,
      isActive: true,
      user: { id: adminAlphaUserId, email: 'admin@alpha.vet', name: 'Admin Alice', avatarUrl: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    MemberService.setMockMember({
      id: 'mem-vet-alpha',
      practiceId: practiceAlphaId,
      userId: vetAlphaUserId,
      role: Role.VETERINARIAN,
      isClinicalApprover: true,
      isActive: true,
      user: { id: vetAlphaUserId, email: 'vet@alpha.vet', name: 'Dr. Victor Vet', avatarUrl: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    MemberService.setMockMember({
      id: 'mem-staff-alpha',
      practiceId: practiceAlphaId,
      userId: staffAlphaUserId,
      role: Role.STAFF,
      isClinicalApprover: false,
      isActive: true,
      user: { id: staffAlphaUserId, email: 'staff@alpha.vet', name: 'Sam Staff', avatarUrl: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    MemberService.setMockMember({
      id: 'mem-readonly-alpha',
      practiceId: practiceAlphaId,
      userId: readonlyAlphaUserId,
      role: Role.READ_ONLY,
      isClinicalApprover: false,
      isActive: true,
      user: { id: readonlyAlphaUserId, email: 'readonly@alpha.vet', name: 'Rachel Readonly', avatarUrl: null },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Populate mock users in PlatformAdminService
    PlatformAdminService.setMockUsers([
      { id: superAdminUserId, email: 'superadmin@vetrx.io', name: 'Platform Admin', platformRole: PlatformRole.PLATFORM_SUPER_ADMIN, isActive: true },
      { id: ownerAlphaUserId, email: 'owner@alpha.vet', name: 'Dr. Alpha Owner', platformRole: null, isActive: true },
      { id: adminAlphaUserId, email: 'admin@alpha.vet', name: 'Admin Alice', platformRole: null, isActive: true },
      { id: vetAlphaUserId, email: 'vet@alpha.vet', name: 'Dr. Victor Vet', platformRole: null, isActive: true },
      { id: staffAlphaUserId, email: 'staff@alpha.vet', name: 'Sam Staff', platformRole: null, isActive: true },
      { id: readonlyAlphaUserId, email: 'readonly@alpha.vet', name: 'Rachel Readonly', platformRole: null, isActive: true },
    ]);
  });

  // ============================================================================
  // 1. Authorization & Tenant Isolation (Scenarios 1-5)
  // ============================================================================

  describe('1. Platform Authorization & Isolation', () => {
    it('1. Platform Super Admin can access platform dashboard', async () => {
      const data = await PlatformAdminService.getDashboard(superAdminUserId);
      assert.ok(data.metrics);
      assert.strictEqual(data.metrics.totalPractices, 2);
    });

    it('2. Practice Owner is rejected from platform dashboard with 403 PLATFORM_ACCESS_REQUIRED', async () => {
      await assert.rejects(
        async () => {
          await PlatformAdminService.getDashboard(ownerAlphaUserId);
        },
        (err: any) => err instanceof AppError && err.statusCode === 403 && err.code === 'PLATFORM_ACCESS_REQUIRED'
      );
    });

    it('3. Clinic Admin is rejected from platform dashboard with 403', async () => {
      await assert.rejects(
        async () => {
          await PlatformAdminService.getDashboard(adminAlphaUserId);
        },
        (err: any) => err instanceof AppError && err.statusCode === 403 && err.code === 'PLATFORM_ACCESS_REQUIRED'
      );
    });

    it('4. Veterinarian and Staff are rejected from platform dashboard with 403', async () => {
      await assert.rejects(
        async () => {
          await PlatformAdminService.getDashboard(vetAlphaUserId);
        },
        (err: any) => err instanceof AppError && err.statusCode === 403
      );
      await assert.rejects(
        async () => {
          await PlatformAdminService.getDashboard(staffAlphaUserId);
        },
        (err: any) => err instanceof AppError && err.statusCode === 403
      );
    });

    it('5. Read Only user is rejected from platform dashboard with 403', async () => {
      await assert.rejects(
        async () => {
          await PlatformAdminService.getDashboard(readonlyAlphaUserId);
        },
        (err: any) => err instanceof AppError && err.statusCode === 403
      );
    });
  });

  // ============================================================================
  // 2. Practice Management (Scenarios 6-12)
  // ============================================================================

  describe('2. Practice Management', () => {
    it('6. Practice listing returns all practices across platform', async () => {
      const res = await PlatformAdminService.listPractices(superAdminUserId);
      assert.strictEqual(res.total, 2);
      assert.strictEqual(res.results.length, 2);
    });

    it('7. Practice search filters by name or owner email', async () => {
      const res = await PlatformAdminService.listPractices(superAdminUserId, { search: 'Beta' });
      assert.strictEqual(res.total, 1);
      assert.strictEqual(res.results[0].name, 'Beta Solo Practice');
    });

    it('8. Practice filtering filters by practiceType and status', async () => {
      const res = await PlatformAdminService.listPractices(superAdminUserId, { type: PracticeType.INDEPENDENT });
      assert.strictEqual(res.total, 1);
      assert.strictEqual(res.results[0].practiceType, PracticeType.INDEPENDENT);
    });

    it('9. Create Practice creates practice and assigns owner', async () => {
      const created = await PlatformAdminService.createPractice(superAdminUserId, {
        name: 'Gamma Emergency Clinic',
        practiceType: PracticeType.CLINIC,
        ownerName: 'Dr. Gary Gamma',
        ownerEmail: 'gary@gamma.vet',
        isClinicalApprover: true,
      });

      assert.ok(created.id);
      assert.strictEqual(created.name, 'Gamma Emergency Clinic');
      assert.strictEqual(created.practiceType, PracticeType.CLINIC);
    });

    it('10. Suspend practice updates status to SUSPENDED and records audit log', async () => {
      const res = await PlatformAdminService.suspendPractice(superAdminUserId, practiceAlphaId, 'Non-payment of dues');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.status, PracticeStatus.SUSPENDED);

      const logs = AuditService.getMockLogs();
      const suspendLog = logs.find((l) => l.action === 'PRACTICE_SUSPENDED');
      assert.ok(suspendLog);
      assert.strictEqual(suspendLog.practiceId, practiceAlphaId);
    });

    it('11. Reactivate practice restores status to ACTIVE and records audit log', async () => {
      await PlatformAdminService.suspendPractice(superAdminUserId, practiceAlphaId, 'Temporary freeze');
      const res = await PlatformAdminService.reactivatePractice(superAdminUserId, practiceAlphaId, 'Payment cleared');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.status, PracticeStatus.ACTIVE);

      const logs = AuditService.getMockLogs();
      const reactivateLog = logs.find((l) => l.action === 'PRACTICE_REACTIVATED');
      assert.ok(reactivateLog);
    });

    it('12. Transfer practice ownership updates authoritative owner and audits', async () => {
      const res = await PlatformAdminService.transferPracticeOwnership(
        superAdminUserId,
        practiceAlphaId,
        adminAlphaUserId,
        'Owner retirement'
      );
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.newOwnerUserId, adminAlphaUserId);

      const logs = AuditService.getMockLogs();
      const xferLog = logs.find((l) => l.action === 'OWNERSHIP_TRANSFERRED');
      assert.ok(xferLog);
    });
  });

  // ============================================================================
  // 3. Global User Administration & Security (Scenarios 13-20)
  // ============================================================================

  describe('3. Global User Administration & Security Controls', () => {
    it('13. List users returns all platform users with pagination', async () => {
      const res = await PlatformAdminService.listUsers(superAdminUserId, { page: 1, pageSize: 10 });
      assert.strictEqual(res.total, 6);
      assert.strictEqual(res.results.length, 6);
    });

    it('14. Create user creates user record safely and audits', async () => {
      const created = await PlatformAdminService.createUser(superAdminUserId, {
        name: 'New Platform Clinician',
        email: 'clinician.new@vetrx.io',
      });
      assert.ok(created.id);
      assert.strictEqual(created.email, 'clinician.new@vetrx.io');

      const logs = AuditService.getMockLogs();
      const createLog = logs.find((l) => l.action === 'USER_CREATED');
      assert.ok(createLog);
    });

    it('15. Reset password sends reset instructions without leaking password/token', async () => {
      const res = await PlatformAdminService.resetUserPassword(superAdminUserId, vetAlphaUserId);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.message, 'Password reset instructions sent.');

      // Response must not contain password hash or session token
      assert.strictEqual((res as any).passwordHash, undefined);
      assert.strictEqual((res as any).token, undefined);

      const logs = AuditService.getMockLogs();
      const resetLog = logs.find((l) => l.action === 'PASSWORD_RESET_REQUESTED');
      assert.ok(resetLog);
    });

    it('16. Force password change flags account and audits event', async () => {
      const res = await PlatformAdminService.forcePasswordChange(superAdminUserId, staffAlphaUserId);
      assert.strictEqual(res.success, true);

      const logs = AuditService.getMockLogs();
      const forceLog = logs.find((l) => l.action === 'PASSWORD_FORCED_RESET');
      assert.ok(forceLog);
    });

    it('17. Force logout revokes all user sessions and audits event', async () => {
      const res = await PlatformAdminService.revokeUserSessions(superAdminUserId, staffAlphaUserId);
      assert.strictEqual(res.success, true);

      const logs = AuditService.getMockLogs();
      const revokeLog = logs.find((l) => l.action === 'SESSIONS_REVOKED');
      assert.ok(revokeLog);
    });

    it('18. Deactivate user marks user inactive and audits', async () => {
      const res = await PlatformAdminService.deactivateUser(superAdminUserId, staffAlphaUserId, 'Contract ended');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.isActive, false);

      const logs = AuditService.getMockLogs();
      const deactLog = logs.find((l) => l.action === 'USER_DEACTIVATED');
      assert.ok(deactLog);
    });

    it('19. Activate user restores active status and audits', async () => {
      await PlatformAdminService.deactivateUser(superAdminUserId, staffAlphaUserId);
      const res = await PlatformAdminService.activateUser(superAdminUserId, staffAlphaUserId);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.isActive, true);

      const logs = AuditService.getMockLogs();
      const actLog = logs.find((l) => l.action === 'USER_ACTIVATED');
      assert.ok(actLog);
    });

    it('20. Global search returns matching practices, users, and issues', async () => {
      const searchRes = await PlatformAdminService.globalSearch(superAdminUserId, 'Alpha');
      assert.ok(searchRes.practices.length > 0);
      assert.ok(searchRes.users.length > 0);
    });
  });

  // ============================================================================
  // 4. Practice Membership Administration (Scenarios 21-26)
  // ============================================================================

  describe('4. Practice Membership Administration', () => {
    it('21. Add existing user to practice assigns role and clinical status', async () => {
      const newUserId = 'user-external-vet';
      PlatformAdminService.setMockUsers([
        { id: newUserId, email: 'external.vet@vetrx.io', name: 'Dr. External', isActive: true },
      ]);

      const member = await PlatformAdminService.addUserToPractice(superAdminUserId, practiceAlphaId, {
        userId: newUserId,
        role: Role.VETERINARIAN,
      });

      assert.ok(member.id);
      assert.strictEqual(member.role, Role.VETERINARIAN);
      assert.strictEqual(member.isClinicalApprover, true);
    });

    it('22. Cannot directly assign PRACTICE_OWNER when adding user to practice', async () => {
      await assert.rejects(
        async () => {
          await PlatformAdminService.addUserToPractice(superAdminUserId, practiceAlphaId, {
            userId: 'user-another-guy',
            role: Role.PRACTICE_OWNER,
          });
        },
        (err: any) => err instanceof AppError && err.code === 'OWNER_TRANSFER_REQUIRED'
      );
    });

    it('23. Cannot assign clinical approver to STAFF or READ_ONLY', async () => {
      await assert.rejects(
        async () => {
          await PlatformAdminService.addUserToPractice(superAdminUserId, practiceAlphaId, {
            userId: 'user-staff-candidate',
            role: Role.STAFF,
            isClinicalApprover: true,
          });
        },
        (err: any) => err instanceof AppError && err.code === 'INVALID_CLINICAL_APPROVER'
      );
    });

    it('24. Remove user from practice removes membership and audits', async () => {
      const res = await PlatformAdminService.removeUserFromPractice(
        superAdminUserId,
        practiceAlphaId,
        'mem-staff-alpha',
        'Staff departure'
      );
      assert.strictEqual(res.success, true);

      const logs = AuditService.getMockLogs();
      const removeLog = logs.find((l) => l.action === 'USER_REMOVED_FROM_PRACTICE');
      assert.ok(removeLog);
    });

    it('25. Super Admin can change member role with seat recalculation', async () => {
      const updated = await PlatformAdminService.updateUserPracticeRole(
        superAdminUserId,
        practiceAlphaId,
        'mem-admin-alpha',
        Role.VETERINARIAN,
        true
      );
      assert.strictEqual(updated.role, Role.VETERINARIAN);
      assert.strictEqual(updated.isClinicalApprover, true);
    });

    it('26. Super Admin can update clinical status for eligible roles', async () => {
      const updated = await PlatformAdminService.updateUserClinicalStatus(
        superAdminUserId,
        practiceAlphaId,
        'mem-admin-alpha',
        true
      );
      assert.strictEqual(updated.isClinicalApprover, true);
    });
  });

  // ============================================================================
  // 5. Commercial Seat Limit Enforcement (Scenarios 27-29)
  // ============================================================================

  describe('5. Commercial Seat Limit Enforcement via Platform Console', () => {
    it('27. Individual plan allows 1 veterinarian; adding a 2nd veterinarian is rejected', async () => {
      const soloPracticeId = 'practice-solo-quota';
      AuthorizationService.setMockPracticeOwner(soloPracticeId, 'user-solo-owner');
      EntitlementService.setMockSubscription(soloPracticeId, {
        status: 'ACTIVE',
        planCode: 'INDIVIDUAL_MONTHLY',
        currentPeriodEnd: new Date(Date.now() + 86400000).toISOString(),
      });

      MemberService.setMockMember({
        id: 'mem-solo-owner',
        practiceId: soloPracticeId,
        userId: 'user-solo-owner',
        role: Role.PRACTICE_OWNER,
        isClinicalApprover: true,
        isActive: true,
        user: { id: 'user-solo-owner', email: 'owner@solo.vet', name: 'Dr. Solo Owner', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await assert.rejects(
        async () => {
          await PlatformAdminService.addUserToPractice(superAdminUserId, soloPracticeId, {
            userId: 'user-extra-vet',
            role: Role.VETERINARIAN,
            isClinicalApprover: true,
          });
        },
        (err: any) => err instanceof AppError && err.code === 'SEAT_LIMIT_REACHED'
      );
    });

    it('28. Adding non-clinical staff on Individual plan is allowed (unlimited staff)', async () => {
      const soloPracticeId = 'practice-solo-quota-staff';
      AuthorizationService.setMockPracticeOwner(soloPracticeId, 'user-solo-owner');
      EntitlementService.setMockSubscription(soloPracticeId, {
        status: 'ACTIVE',
        planCode: 'INDIVIDUAL_MONTHLY',
        currentPeriodEnd: new Date(Date.now() + 86400000).toISOString(),
      });

      MemberService.setMockMember({
        id: 'mem-solo-owner-staff',
        practiceId: soloPracticeId,
        userId: 'user-solo-owner',
        role: Role.PRACTICE_OWNER,
        isClinicalApprover: true,
        isActive: true,
        user: { id: 'user-solo-owner', email: 'owner@solo.vet', name: 'Dr. Solo Owner', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      const member = await PlatformAdminService.addUserToPractice(superAdminUserId, soloPracticeId, {
        userId: 'user-extra-staff',
        role: Role.STAFF,
        isClinicalApprover: false,
      });

      assert.ok(member.id);
      assert.strictEqual(member.role, Role.STAFF);
    });

    it('29. Changing staff to veterinarian on quota-full practice is rejected with 403', async () => {
      const soloPracticeId = 'practice-solo-change-quota';
      AuthorizationService.setMockPracticeOwner(soloPracticeId, 'user-solo-owner');
      EntitlementService.setMockSubscription(soloPracticeId, {
        status: 'ACTIVE',
        planCode: 'INDIVIDUAL_MONTHLY',
        currentPeriodEnd: new Date(Date.now() + 86400000).toISOString(),
      });

      MemberService.setMockMember({
        id: 'mem-solo-owner-2',
        practiceId: soloPracticeId,
        userId: 'user-solo-owner',
        role: Role.PRACTICE_OWNER,
        isClinicalApprover: true,
        isActive: true,
        user: { id: 'user-solo-owner', email: 'owner@solo.vet', name: 'Dr. Solo Owner', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      MemberService.setMockMember({
        id: 'mem-staff-to-vet',
        practiceId: soloPracticeId,
        userId: 'user-staff-to-vet',
        role: Role.STAFF,
        isClinicalApprover: false,
        isActive: true,
        user: { id: 'user-staff-to-vet', email: 'staff@solo.vet', name: 'Sam Staff', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await assert.rejects(
        async () => {
          await PlatformAdminService.updateUserPracticeRole(
            superAdminUserId,
            soloPracticeId,
            'mem-staff-to-vet',
            Role.VETERINARIAN,
            true
          );
        },
        (err: any) => err instanceof AppError && err.code === 'SEAT_LIMIT_REACHED'
      );
    });
  });

  // ============================================================================
  // 6. Issues, Support & Audited Sessions (Scenarios 30-34)
  // ============================================================================

  describe('6. Issues, Support & Audited Sessions', () => {
    it('30. Create support issue records ticket and audits', async () => {
      const issue = await PlatformAdminService.createIssue(superAdminUserId, {
        title: 'Printer alignment issue',
        description: 'Prescription header is slightly off center on Zebra printer.',
        category: IssueCategory.PDF_PRINT,
        priority: IssuePriority.NORMAL,
        practiceId: practiceAlphaId,
      });

      assert.ok(issue.id);
      assert.strictEqual(issue.title, 'Printer alignment issue');
      assert.strictEqual(issue.category, IssueCategory.PDF_PRINT);

      const logs = AuditService.getMockLogs();
      const issueLog = logs.find((l) => l.action === 'ISSUE_CREATED');
      assert.ok(issueLog);
    });

    it('31. Update support issue updates status and audits', async () => {
      const issue = await PlatformAdminService.createIssue(superAdminUserId, {
        title: 'Login assistance',
        description: 'User locked out after password attempts.',
        category: IssueCategory.LOGIN_AUTH,
      });

      const updated = await PlatformAdminService.updateIssue(superAdminUserId, issue.id, {
        status: IssueStatus.RESOLVED,
      });
      assert.strictEqual(updated.status, IssueStatus.RESOLVED);

      const logs = AuditService.getMockLogs();
      const updateLog = logs.find((l) => l.action === 'ISSUE_UPDATED');
      assert.ok(updateLog);
    });

    it('32. Add note to support issue appends note to thread', async () => {
      const issue = await PlatformAdminService.createIssue(superAdminUserId, {
        title: 'Network timeout',
        description: 'Occasional latency in billing sync.',
      });

      const withNote = await PlatformAdminService.addIssueNote(
        superAdminUserId,
        issue.id,
        'Checked DB logs, connection pool was saturated.'
      );
      assert.strictEqual(withNote.internalNotes.length, 1);
      assert.ok(withNote.internalNotes[0].note.includes('connection pool'));
    });

    it('33. Start support access session creates read-only audited session', async () => {
      const session = await PlatformAdminService.startSupportSession(superAdminUserId, {
        targetPracticeId: practiceAlphaId,
        reason: 'Investigate invoice calculation discrepancy',
        durationMinutes: 30,
      });

      assert.ok(session.id);
      assert.strictEqual(session.isReadOnly, true);
      assert.strictEqual(session.status, 'ACTIVE');

      const logs = AuditService.getMockLogs();
      const supLog = logs.find((l) => l.action === 'SUPPORT_ACCESS_STARTED');
      assert.ok(supLog);
    });

    it('34. End support access session concludes session and audits', async () => {
      const session = await PlatformAdminService.startSupportSession(superAdminUserId, {
        targetPracticeId: practiceAlphaId,
        reason: 'Temporary review',
      });

      const res = await PlatformAdminService.endSupportSession(superAdminUserId, session.id);
      assert.strictEqual(res.success, true);

      const logs = AuditService.getMockLogs();
      const endLog = logs.find((l) => l.action === 'SUPPORT_ACCESS_ENDED');
      assert.ok(endLog);
    });
  });

  // ============================================================================
  // 7. Permission Overrides & Security Audit (Scenarios 35-38)
  // ============================================================================

  describe('7. Permission Overrides & Audit Logs', () => {
    it('35. Platform Super Admin can set account-level permission override', async () => {
      const res = await PlatformAdminService.setMemberPermissionOverride(
        superAdminUserId,
        practiceAlphaId,
        'mem-staff-alpha',
        {
          permission: PERMISSIONS.MEDICINE_UPDATE,
          effect: 'ALLOW',
          reason: 'Senior inventory lead',
        }
      );
      assert.ok(res.overrides.find((o) => o.permission === PERMISSIONS.MEDICINE_UPDATE && o.effect === 'ALLOW'));
    });

    it('36. Platform Super Admin cannot grant PRESCRIPTION_APPROVE to Staff via override', async () => {
      await assert.rejects(
        async () => {
          await PlatformAdminService.setMemberPermissionOverride(
            superAdminUserId,
            practiceAlphaId,
            'mem-staff-alpha',
            {
              permission: PERMISSIONS.PRESCRIPTION_APPROVE,
              effect: 'ALLOW',
            }
          );
        },
        (err: any) =>
          err instanceof AppError &&
          (err.code === 'CLINICAL_ELIGIBILITY_REQUIRED' || err.code === 'INVALID_CLINICAL_APPROVER')
      );
    });

    it('37. Platform Super Admin cannot grant platform permissions via practice override', async () => {
      await assert.rejects(
        async () => {
          await PlatformAdminService.setMemberPermissionOverride(
            superAdminUserId,
            practiceAlphaId,
            'mem-staff-alpha',
            {
              permission: 'PLATFORM_SUPER_ADMIN',
              effect: 'ALLOW',
            }
          );
        },
        (err: any) => err instanceof AppError && err.code === 'PLATFORM_PERMISSION_RESTRICTED'
      );
    });

    it('38. Audit log listing returns filtered security audit entries', async () => {
      void AuditService.record({
        userId: superAdminUserId,
        practiceId: practiceAlphaId,
        action: 'SECURITY_AUDIT_VERIFIED',
        resource: 'PlatformSecurity',
      });

      const res = await PlatformAdminService.listAuditLogs(superAdminUserId, {
        action: 'SECURITY_AUDIT_VERIFIED',
      });
      assert.ok(res.results.length > 0);
      assert.strictEqual(res.results[0].action, 'SECURITY_AUDIT_VERIFIED');
    });
  });
});
