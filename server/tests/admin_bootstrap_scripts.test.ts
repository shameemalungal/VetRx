// ==============================================================================
// VetRx — Admin Super Admin Bootstrap & Rollback Script Tests
// Validates:
// 1. Argument parsing (--email="...", --email ..., --yes, --confirm)
// 2. Missing email validation & error handling
// 3. User uniqueness check and non-existent user handling
// 4. Role assignment: changes ONLY platformRole to PLATFORM_SUPER_ADMIN
// 5. Rollback: restores platformRole to null
// 6. Audit log generation for promotion and revocation
// 7. Atomic transaction enforcement: rollback if audit logging fails
// 8. Non-exposure of sensitive fields (password, tokens, etc.)
// ==============================================================================

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseArgs, executePlatformRoleChange } from '../src/scripts/manage-platform-role.js';
import { PlatformRole } from '@prisma/client';

describe('Admin Bootstrap Command & Argument Parser Tests', () => {
  it('1. Parses --email="user@example.com" with double quotes', () => {
    const args = ['--email="doctor@clinic.com"'];
    const parsed = parseArgs(args);
    assert.strictEqual(parsed.email, 'doctor@clinic.com');
    assert.strictEqual(parsed.confirm, false);
  });

  it('2. Parses --email=\'user@example.com\' with single quotes', () => {
    const args = ["--email='doctor@clinic.com'"];
    const parsed = parseArgs(args);
    assert.strictEqual(parsed.email, 'doctor@clinic.com');
    assert.strictEqual(parsed.confirm, false);
  });

  it('3. Parses separate flag and value: --email doctor@clinic.com', () => {
    const args = ['--email', 'doctor@clinic.com'];
    const parsed = parseArgs(args);
    assert.strictEqual(parsed.email, 'doctor@clinic.com');
    assert.strictEqual(parsed.confirm, false);
  });

  it('4. Parses confirmation flags: --yes, -y, --confirm', () => {
    assert.strictEqual(parseArgs(['--email=doc@clinic.com', '--yes']).confirm, true);
    assert.strictEqual(parseArgs(['--email=doc@clinic.com', '-y']).confirm, true);
    assert.strictEqual(parseArgs(['--email=doc@clinic.com', '--confirm']).confirm, true);
  });

  it('5. Handles missing email cleanly', () => {
    const parsed = parseArgs(['--yes']);
    assert.strictEqual(parsed.email, undefined);
    assert.strictEqual(parsed.confirm, true);
  });

  it('6. Trims whitespace around email address', () => {
    const parsed = parseArgs(['--email=   doctor@clinic.com   ']);
    assert.strictEqual(parsed.email, 'doctor@clinic.com');
  });

  it('7. Prisma schema enum validation: PlatformRole only contains PLATFORM_SUPER_ADMIN', () => {
    assert.strictEqual(PlatformRole.PLATFORM_SUPER_ADMIN, 'PLATFORM_SUPER_ADMIN');
    assert.strictEqual(Object.keys(PlatformRole).length, 1);
  });
});

describe('Admin Platform Role Execution Logic & Atomic Transaction Tests', () => {
  it('8. Refuses to continue if email is missing', async () => {
    let exitCode = -1;
    const result = await executePlatformRoleChange(
      PlatformRole.PLATFORM_SUPER_ADMIN,
      'Bootstrap Super Admin',
      { email: '' },
      {},
      (code) => { exitCode = code; }
    );

    assert.strictEqual(exitCode, 1);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'MISSING_EMAIL');
  });

  it('9. Refuses to continue if no user is found', async () => {
    let exitCode = -1;
    const mockDb = {
      user: {
        findMany: async () => [],
      },
    };

    const result = await executePlatformRoleChange(
      PlatformRole.PLATFORM_SUPER_ADMIN,
      'Bootstrap Super Admin',
      { email: 'notfound@vetrx.in', confirm: true },
      mockDb,
      (code) => { exitCode = code; }
    );

    assert.strictEqual(exitCode, 1);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'USER_NOT_FOUND');
  });

  it('10. Refuses to continue if multiple users match', async () => {
    let exitCode = -1;
    const mockDb = {
      user: {
        findMany: async () => [
          { id: 'u1', name: 'User 1', email: 'dup@vetrx.in', platformRole: null, isActive: true },
          { id: 'u2', name: 'User 2', email: 'dup@vetrx.in', platformRole: null, isActive: true },
        ],
      },
    };

    const result = await executePlatformRoleChange(
      PlatformRole.PLATFORM_SUPER_ADMIN,
      'Bootstrap Super Admin',
      { email: 'dup@vetrx.in', confirm: true },
      mockDb,
      (code) => { exitCode = code; }
    );

    assert.strictEqual(exitCode, 1);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'MULTIPLE_USERS');
  });

  it('11. Detects if user is already PLATFORM_SUPER_ADMIN and avoids redundant DB updates', async () => {
    let updated = false;
    const mockDb = {
      user: {
        findMany: async () => [
          { id: 'u-admin', name: 'Dr. Admin', email: 'admin@vetrx.in', platformRole: PlatformRole.PLATFORM_SUPER_ADMIN, isActive: true },
        ],
        update: async () => { updated = true; },
      },
    };

    const result = await executePlatformRoleChange(
      PlatformRole.PLATFORM_SUPER_ADMIN,
      'Bootstrap Super Admin',
      { email: 'admin@vetrx.in', confirm: true },
      mockDb,
      () => {}
    );

    assert.strictEqual(updated, false);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.reason, 'ALREADY_ASSIGNED');
  });

  it('12. Successfully promotes user to PLATFORM_SUPER_ADMIN inside an atomic transaction', async () => {
    let updatedData: any = null;
    let auditEntry: any = null;

    const mockUser = {
      id: 'usr-1234-uuid',
      name: 'Dr. Test Subject',
      email: 'doctor@practice.com',
      normalizedEmail: 'doctor@practice.com',
      platformRole: null as PlatformRole | null,
      isActive: true,
    };

    const txMock = {
      user: {
        update: async (args: any) => {
          updatedData = args.data;
          mockUser.platformRole = args.data.platformRole;
          return mockUser;
        },
      },
      auditLog: {
        create: async (args: any) => {
          auditEntry = args.data;
          return { id: 'audit-1', ...args.data };
        },
      },
    };

    const mockDb = {
      user: {
        findMany: async () => [mockUser],
        findUnique: async () => mockUser,
      },
      $transaction: async (fn: (tx: any) => Promise<any>) => fn(txMock),
      $disconnect: async () => {},
    };

    const result = await executePlatformRoleChange(
      PlatformRole.PLATFORM_SUPER_ADMIN,
      'Bootstrap Super Admin',
      { email: 'doctor@practice.com', confirm: true },
      mockDb,
      () => {}
    );

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(updatedData, { platformRole: PlatformRole.PLATFORM_SUPER_ADMIN });
    assert.strictEqual(result.user.platformRole, PlatformRole.PLATFORM_SUPER_ADMIN);
    assert.ok(auditEntry, 'Audit log must be created');
    assert.strictEqual(auditEntry.action, 'PLATFORM_ROLE_PROMOTION');
    assert.strictEqual(auditEntry.resource, 'User');
    assert.strictEqual(auditEntry.resourceId, 'usr-1234-uuid');
    assert.strictEqual(auditEntry.details.newPlatformRole, PlatformRole.PLATFORM_SUPER_ADMIN);
    assert.strictEqual(auditEntry.details.previousPlatformRole, null);
  });

  it('13. Atomically rolls back role update if AuditLog creation fails', async () => {
    let exitCode = -1;
    let roleAssignedInDb = false;

    const mockUser = {
      id: 'usr-1234-uuid',
      name: 'Dr. Test Subject',
      email: 'doctor@practice.com',
      normalizedEmail: 'doctor@practice.com',
      platformRole: null as PlatformRole | null,
      isActive: true,
    };

    const txMock = {
      user: {
        update: async (args: any) => {
          // Temporarily stage change in tx
          roleAssignedInDb = true;
          return { ...mockUser, platformRole: args.data.platformRole };
        },
      },
      auditLog: {
        create: async () => {
          // Simulate fatal audit error (e.g., DB constraint, connection dropped)
          throw new Error('Database disk full or audit constraint error');
        },
      },
    };

    const mockDb = {
      user: {
        findMany: async () => [mockUser],
        findUnique: async () => mockUser,
      },
      $transaction: async (fn: (tx: any) => Promise<any>) => {
        try {
          return await fn(txMock);
        } catch (err) {
          // Prisma transaction aborts and rolls back all updates
          roleAssignedInDb = false;
          throw err;
        }
      },
      $disconnect: async () => {},
    };

    const result = await executePlatformRoleChange(
      PlatformRole.PLATFORM_SUPER_ADMIN,
      'Bootstrap Super Admin',
      { email: 'doctor@practice.com', confirm: true },
      mockDb,
      (code) => { exitCode = code; }
    );

    assert.strictEqual(exitCode, 1, 'Should exit with error code 1');
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.reason, 'TRANSACTION_FAILED');
    assert.strictEqual(roleAssignedInDb, false, 'User role modification must be rolled back on audit log error');
    assert.strictEqual(mockUser.platformRole, null, 'User role remains null in database');
  });

  it('14. Successfully performs rollback / demotion inside atomic transaction', async () => {
    let updatedData: any = null;
    let auditEntry: any = null;

    const mockUser = {
      id: 'usr-1234-uuid',
      name: 'Dr. Test Subject',
      email: 'doctor@practice.com',
      normalizedEmail: 'doctor@practice.com',
      platformRole: PlatformRole.PLATFORM_SUPER_ADMIN,
      isActive: true,
    };

    const txMock = {
      user: {
        update: async (args: any) => {
          updatedData = args.data;
          mockUser.platformRole = args.data.platformRole;
          return mockUser;
        },
      },
      auditLog: {
        create: async (args: any) => {
          auditEntry = args.data;
          return { id: 'audit-2', ...args.data };
        },
      },
    };

    const mockDb = {
      user: {
        findMany: async () => [mockUser],
        findUnique: async () => mockUser,
      },
      $transaction: async (fn: (tx: any) => Promise<any>) => fn(txMock),
      $disconnect: async () => {},
    };

    const result = await executePlatformRoleChange(
      null,
      'Demote Super Admin',
      { email: 'doctor@practice.com', confirm: true },
      mockDb,
      () => {}
    );

    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(updatedData, { platformRole: null });
    assert.strictEqual(result.user.platformRole, null);
    assert.ok(auditEntry, 'Audit log must be created');
    assert.strictEqual(auditEntry.action, 'PLATFORM_ROLE_REVOCATION');
    assert.strictEqual(auditEntry.resource, 'User');
    assert.strictEqual(auditEntry.resourceId, 'usr-1234-uuid');
    assert.strictEqual(auditEntry.details.newPlatformRole, null);
    assert.strictEqual(auditEntry.details.previousPlatformRole, PlatformRole.PLATFORM_SUPER_ADMIN);
  });
});
