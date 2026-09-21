// ==============================================================================
// VetRx — Platform Super Admin Service (Phase 14)
// Secure oversight of practices, tenant accounts, subscriptions, and platform audit logs.
// ==============================================================================

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthorizationService } from '../auth/authorization.service.js';
import { AuditService } from '../lib/audit.service.js';

import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ALL_ASSIGNABLE_PERMISSIONS,
  CLINICAL_PERMISSIONS,
  PRACTICE_PERMISSIONS,
  COMMERCIAL_PERMISSIONS,
  SECURITY_PERMISSIONS,
  PLATFORM_ONLY_PERMISSIONS,
  PERMISSION_METADATA,
  getPermissionsForRole,
  type Permission,
} from '../auth/permissions.js';
import type { OverrideEffect } from '@prisma/client';

export interface PlatformPracticeSummary {
  id: string;
  name: string;
  slug: string | null;
  ownerUserId: string;
  isActive: boolean;
  createdAt: string;
  memberCount: number;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
}

export class PlatformAdminService {
  private static mockPractices: PlatformPracticeSummary[] = [];

  static setMockPractices(practices: PlatformPracticeSummary[]): void {
    this.mockPractices = [...practices];
  }

  static clearMocks(): void {
    this.mockPractices = [];
  }

  /**
   * Lists all practices across the platform for Super Admins.
   */
  static async listPractices(actorUserId: string): Promise<PlatformPracticeSummary[]> {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      return [...this.mockPractices];
    }

    const practices = await prisma.practice.findMany({
      include: {
        _count: { select: { members: true } },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return practices.map((p) => {
      const activeSub = p.subscriptions[0];
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        ownerUserId: p.ownerUserId,
        isActive: p.isActive,
        createdAt: p.createdAt.toISOString(),
        memberCount: p._count.members,
        subscriptionPlan: activeSub?.plan?.name || 'Foundational',
        subscriptionStatus: activeSub?.status || 'TRIAL',
      };
    });
  }

  /**
   * Gets comprehensive details of a single practice.
   */
  static async getPracticeDetails(actorUserId: string, practiceId: string): Promise<any> {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      const found = this.mockPractices.find((p) => p.id === practiceId);
      if (!found) throw new AppError(404, 'PRACTICE_NOT_FOUND', 'Practice not found.');
      return found;
    }

    const practice = await prisma.practice.findUnique({
      where: { id: practiceId },
      include: {
        owner: { select: { id: true, email: true, name: true } },
        members: {
          include: {
            user: { select: { id: true, email: true, name: true } },
            permissionOverrides: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
        settings: true,
      },
    });

    if (!practice) {
      throw new AppError(404, 'PRACTICE_NOT_FOUND', 'Practice not found.');
    }

    return practice;
  }

  /**
   * Lists all users across the platform.
   */
  static async listUsers(actorUserId: string): Promise<any[]> {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      return [];
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        emailVerified: true,
        isActive: true,
        platformRole: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { memberships: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    return users;
  }

  /**
   * Lists security audit logs across the platform.
   */
  static async listAuditLogs(actorUserId: string): Promise<any[]> {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      return AuditService.mockLogs;
    }

    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { id: true, email: true, name: true } },
        practice: { select: { id: true, name: true } },
      },
    });

    return logs;
  }

  /**
   * Returns authoritative global role-action permission matrix and metadata.
   */
  static async getGlobalPermissionMatrix(actorUserId: string) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    return {
      rolePermissions: ROLE_PERMISSIONS,
      assignablePermissions: ALL_ASSIGNABLE_PERMISSIONS,
      metadata: PERMISSION_METADATA,
      categories: {
        CLINICAL: CLINICAL_PERMISSIONS,
        PRACTICE: PRACTICE_PERMISSIONS,
        COMMERCIAL: COMMERCIAL_PERMISSIONS,
        SECURITY: SECURITY_PERMISSIONS,
        PLATFORM: PLATFORM_ONLY_PERMISSIONS,
      },
    };
  }

  /**
   * Returns effective permissions, defaults, and overrides for a specific practice member.
   */
  static async getMemberPermissions(actorUserId: string, practiceId: string, memberId: string) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    let member: any = null;

    if (process.env.VETRX_FAST_TEST !== '1') {
      member = await prisma.practiceMember.findFirst({
        where: { id: memberId, practiceId },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          permissionOverrides: {
            include: {
              createdBy: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    }

    if (!member) {
      // In-memory fallback
      const membership = await AuthorizationService.resolveMembership(memberId, practiceId);
      if (membership) {
        member = {
          id: membership.id,
          practiceId,
          userId: membership.userId,
          role: membership.role,
          isActive: membership.isActive,
          user: { id: membership.userId, name: 'User ' + membership.userId, email: 'user@vetrx.test' },
          permissionOverrides: [],
        };
      }
    }

    if (!member) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Practice member not found.');
    }

    const defaultPermissions = getPermissionsForRole(member.role);
    const effectivePermissions = await AuthorizationService.getEffectivePermissions(member.userId || member.user?.id, practiceId);

    return {
      member: {
        id: member.id,
        practiceId: member.practiceId,
        userId: member.userId || member.user?.id,
        role: member.role,
        isActive: member.isActive,
        user: member.user,
      },
      defaultPermissions,
      overrides: member.permissionOverrides || [],
      effectivePermissions,
    };
  }

  /**
   * Sets or updates an account-level permission override for a practice member.
   */
  static async setMemberPermissionOverride(
    actorUserId: string,
    practiceId: string,
    memberId: string,
    data: {
      permission: string;
      effect: 'ALLOW' | 'DENY';
      reason?: string;
    }
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    // Validation: Must be a known assignable permission
    const validPermissions = ALL_ASSIGNABLE_PERMISSIONS as readonly string[];
    if (!validPermissions.includes(data.permission)) {
      if ((PLATFORM_ONLY_PERMISSIONS as readonly string[]).includes(data.permission)) {
        throw new AppError(
          400,
          'PLATFORM_PERMISSION_RESTRICTED',
          'Platform Super Admin permissions cannot be granted through practice member overrides.'
        );
      }
      throw new AppError(400, 'INVALID_PERMISSION', `Unknown permission: ${data.permission}`);
    }

    if (data.effect !== 'ALLOW' && data.effect !== 'DENY') {
      throw new AppError(400, 'INVALID_EFFECT', 'Override effect must be ALLOW or DENY.');
    }

    let member: any = null;
    if (process.env.VETRX_FAST_TEST !== '1') {
      member = await prisma.practiceMember.findFirst({
        where: { id: memberId, practiceId },
      });
      if (!member) {
        throw new AppError(404, 'MEMBER_NOT_FOUND', 'Practice member not found.');
      }

      const override = await prisma.memberPermissionOverride.upsert({
        where: {
          practiceMemberId_permission: {
            practiceMemberId: memberId,
            permission: data.permission,
          },
        },
        create: {
          practiceMemberId: memberId,
          permission: data.permission,
          effect: data.effect as OverrideEffect,
          createdByUserId: actorUserId,
        },
        update: {
          effect: data.effect as OverrideEffect,
          createdByUserId: actorUserId,
        },
      });

      void AuditService.record({
        practiceId,
        userId: actorUserId,
        action: 'PERMISSION_OVERRIDE_CONFIGURED',
        resource: 'MemberPermissionOverride',
        resourceId: override.id,
        details: { memberId, permission: data.permission, effect: data.effect, reason: data.reason },
      });

      return override;
    } else {
      AuthorizationService.setMockOverride(memberId, data.permission, data.effect);

      void AuditService.record({
        practiceId,
        userId: actorUserId,
        action: 'PERMISSION_OVERRIDE_CONFIGURED',
        resource: 'MemberPermissionOverride',
        resourceId: `mock-override-${memberId}-${data.permission}`,
        details: { memberId, permission: data.permission, effect: data.effect, reason: data.reason },
      });

      return {
        id: `mock-override-${memberId}-${data.permission}`,
        practiceMemberId: memberId,
        permission: data.permission,
        effect: data.effect,
        createdByUserId: actorUserId,
      };
    }
  }

  /**
   * Removes an account-level permission override, restoring the role default.
   */
  static async removeMemberPermissionOverride(
    actorUserId: string,
    practiceId: string,
    memberId: string,
    permission: string,
    reason?: string
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST !== '1') {
      const member = await prisma.practiceMember.findFirst({
        where: { id: memberId, practiceId },
      });
      if (!member) {
        throw new AppError(404, 'MEMBER_NOT_FOUND', 'Practice member not found.');
      }

      await prisma.memberPermissionOverride.deleteMany({
        where: {
          practiceMemberId: memberId,
          permission,
        },
      });
    } else {
      AuthorizationService.removeMockOverride(memberId, permission);
    }

    void AuditService.record({
      practiceId,
      userId: actorUserId,
      action: 'PERMISSION_OVERRIDE_REMOVED',
      resource: 'MemberPermissionOverride',
      resourceId: `${memberId}:${permission}`,
      details: { memberId, permission, reason },
    });

    return {
      success: true,
      practiceMemberId: memberId,
      permission,
    };
  }
}
