// ==============================================================================
// VetRx — Platform Super Admin Permission Overrides Test Suite (Phase 14 Extension)
// Validates:
// 1. Role-permission matrix inspection.
// 2. Account-level overrides (ALLOW and DENY) with effective permission resolution.
// 3. Clinical safety overrides (enabling approval for specific delegates).
// 4. Isolation against granting platform-only permissions to tenant members.
// 5. Non-super admin access rejection.
// 6. Resetting override to role default.
// 7. Audit logging of all override changes.
// ==============================================================================

process.env.VETRX_FAST_TEST = '1';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Role, PlatformRole } from '@prisma/client';
import { AppError } from '../src/middleware/errorHandler.js';
import {
  PERMISSIONS,
  ALL_ASSIGNABLE_PERMISSIONS,
  PLATFORM_ONLY_PERMISSIONS,
  getPermissionsForRole,
} from '../src/auth/permissions.js';
import { AuthorizationService } from '../src/auth/authorization.service.js';
import { PlatformAdminService } from '../src/platform/platform-admin.service.js';
import { AuditService } from '../src/lib/audit.service.js';

describe('Platform Super Admin Permission Overrides Suite', () => {
  const practiceId = 'practice-gamma-uuid';
  const superAdminUserId = 'user-super-admin-uuid';
  const regularAdminUserId = 'user-regular-admin-uuid';
  const staffUserId = 'user-staff-gamma-uuid';
  const staffMemberId = 'mem-staff-gamma';

  beforeEach(() => {
    AuthorizationService.clearMocks();
    AuditService.clearMockLogs();

    AuthorizationService.setMockPlatformUser(superAdminUserId, PlatformRole.PLATFORM_SUPER_ADMIN);
    AuthorizationService.setMockPlatformUser(regularAdminUserId, null);

    AuthorizationService.setMockMembership(staffUserId, practiceId, {
      id: staffMemberId,
      role: Role.STAFF,
      isActive: true,
    });
  });

  describe('Category A: Permission Matrix & Discovery', () => {
    it('1. Platform Super Admin can retrieve global permission matrix', async () => {
      const matrix = await PlatformAdminService.getGlobalPermissionMatrix(superAdminUserId);
      assert.ok(matrix.rolePermissions);
      assert.ok(matrix.assignablePermissions.length > 0);
      assert.ok(matrix.metadata[PERMISSIONS.PRESCRIPTION_APPROVE]);
      assert.strictEqual(matrix.metadata[PERMISSIONS.PRESCRIPTION_APPROVE].isClinicalSafetyCritical, true);
    });

    it('2. Non-super admin cannot access global permission matrix', async () => {
      await assert.rejects(
        () => PlatformAdminService.getGlobalPermissionMatrix(regularAdminUserId),
        (err: any) => {
          assert.strictEqual(err.statusCode, 403);
          assert.strictEqual(err.code, 'PLATFORM_ACCESS_REQUIRED');
          return true;
        }
      );
    });
  });

  describe('Category B: Account-Level Permission Overrides (ALLOW / DENY)', () => {
    it('3. Default staff member does not have PRESCRIPTION_APPROVE', async () => {
      const perms = await AuthorizationService.getEffectivePermissions(staffUserId, practiceId);
      assert.strictEqual(perms.includes(PERMISSIONS.PRESCRIPTION_APPROVE), false);
      const hasPerm = await AuthorizationService.hasPermission(staffUserId, practiceId, PERMISSIONS.PRESCRIPTION_APPROVE);
      assert.strictEqual(hasPerm, false);
    });

    it('4. Super admin configures ALLOW override for PRESCRIPTION_APPROVE on staff member', async () => {
      const override = await PlatformAdminService.setMemberPermissionOverride(
        superAdminUserId,
        practiceId,
        staffMemberId,
        {
          permission: PERMISSIONS.PRESCRIPTION_APPROVE,
          effect: 'ALLOW',
          reason: 'Authorized senior staff clinical delegate under clinic supervision',
        }
      );

      assert.strictEqual(override.permission, PERMISSIONS.PRESCRIPTION_APPROVE);
      assert.strictEqual(override.effect, 'ALLOW');

      // Effective permissions now include PRESCRIPTION_APPROVE
      const perms = await AuthorizationService.getEffectivePermissions(staffUserId, practiceId);
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_APPROVE));

      const hasPerm = await AuthorizationService.hasPermission(staffUserId, practiceId, PERMISSIONS.PRESCRIPTION_APPROVE);
      assert.strictEqual(hasPerm, true);

      await assert.doesNotReject(() =>
        AuthorizationService.requirePermission(staffUserId, practiceId, PERMISSIONS.PRESCRIPTION_APPROVE)
      );

      // Verify audit log
      const auditLog = AuditService.mockLogs.find((l) => l.action === 'PERMISSION_OVERRIDE_CONFIGURED');
      assert.ok(auditLog);
      assert.strictEqual(auditLog.details.permission, PERMISSIONS.PRESCRIPTION_APPROVE);
      assert.strictEqual(auditLog.details.effect, 'ALLOW');
    });

    it('5. Super admin configures DENY override to revoke an existing role permission', async () => {
      // Staff has PATIENT_CREATE by default
      const defaultPerms = await AuthorizationService.getEffectivePermissions(staffUserId, practiceId);
      assert.ok(defaultPerms.includes(PERMISSIONS.PATIENT_CREATE));

      // Deny PATIENT_CREATE
      await PlatformAdminService.setMemberPermissionOverride(
        superAdminUserId,
        practiceId,
        staffMemberId,
        {
          permission: PERMISSIONS.PATIENT_CREATE,
          effect: 'DENY',
          reason: 'Restricted registration access',
        }
      );

      // Effective permissions now EXCLUDE PATIENT_CREATE
      const effectivePerms = await AuthorizationService.getEffectivePermissions(staffUserId, practiceId);
      assert.strictEqual(effectivePerms.includes(PERMISSIONS.PATIENT_CREATE), false);

      const hasPerm = await AuthorizationService.hasPermission(staffUserId, practiceId, PERMISSIONS.PATIENT_CREATE);
      assert.strictEqual(hasPerm, false);
    });

    it('6. Resetting override restores the role default', async () => {
      // Configure override
      await PlatformAdminService.setMemberPermissionOverride(
        superAdminUserId,
        practiceId,
        staffMemberId,
        {
          permission: PERMISSIONS.PRESCRIPTION_APPROVE,
          effect: 'ALLOW',
        }
      );

      let perms = await AuthorizationService.getEffectivePermissions(staffUserId, practiceId);
      assert.ok(perms.includes(PERMISSIONS.PRESCRIPTION_APPROVE));

      // Remove override
      await PlatformAdminService.removeMemberPermissionOverride(
        superAdminUserId,
        practiceId,
        staffMemberId,
        PERMISSIONS.PRESCRIPTION_APPROVE,
        'Reset to standard role default'
      );

      // Restored
      perms = await AuthorizationService.getEffectivePermissions(staffUserId, practiceId);
      assert.strictEqual(perms.includes(PERMISSIONS.PRESCRIPTION_APPROVE), false);
    });
  });

  describe('Category C: Platform Isolation & Boundaries', () => {
    it('7. Cannot grant PLATFORM permissions via practice member override', async () => {
      await assert.rejects(
        () =>
          PlatformAdminService.setMemberPermissionOverride(
            superAdminUserId,
            practiceId,
            staffMemberId,
            {
              permission: PERMISSIONS.PLATFORM_PRACTICE_MANAGE,
              effect: 'ALLOW',
            }
          ),
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'PLATFORM_PERMISSION_RESTRICTED');
          return true;
        }
      );
    });

    it('8. Rejects unknown or invalid permissions', async () => {
      await assert.rejects(
        () =>
          PlatformAdminService.setMemberPermissionOverride(
            superAdminUserId,
            practiceId,
            staffMemberId,
            {
              permission: 'NON_EXISTENT_PERMISSION',
              effect: 'ALLOW',
            }
          ),
        (err: any) => {
          assert.strictEqual(err.statusCode, 400);
          assert.strictEqual(err.code, 'INVALID_PERMISSION');
          return true;
        }
      );
    });
  });
});
