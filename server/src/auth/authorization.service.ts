// ==============================================================================
// VetRx — Centralized Authorization Service (Phase 14)
// Authoritative server-side evaluation of permissions, roles, and administrative limits.
// ==============================================================================

import { Role, PlatformRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import {
  PERMISSIONS,
  type Permission,
  getPermissionsForRole,
  roleHasPermission,
  PLATFORM_SUPER_ADMIN_PERMISSIONS,
} from './permissions.js';

export interface MembershipRecord {
  id: string;
  practiceId: string;
  userId: string;
  role: Role;
  isActive: boolean;
}

export class AuthorizationService {
  // In-memory mock store for fast isolated unit testing
  private static mockMemberships: Map<string, MembershipRecord> = new Map();
  private static mockPlatformUsers: Map<string, { platformRole: PlatformRole | null }> = new Map();
  private static mockPracticeOwners: Map<string, string> = new Map(); // practiceId -> ownerUserId

  static setMockMembership(userId: string, practiceId: string, record: Partial<MembershipRecord>): void {
    const key = `${userId}:${practiceId}`;
    this.mockMemberships.set(key, {
      id: record.id || `mem-${userId}-${practiceId}`,
      practiceId,
      userId,
      role: record.role || Role.STAFF,
      isActive: record.isActive !== undefined ? record.isActive : true,
    });
  }

  static setMockPlatformUser(userId: string, platformRole: PlatformRole | null): void {
    this.mockPlatformUsers.set(userId, { platformRole });
  }

  static setMockPracticeOwner(practiceId: string, ownerUserId: string): void {
    this.mockPracticeOwners.set(practiceId, ownerUserId);
  }

  static clearMocks(): void {
    this.mockMemberships.clear();
    this.mockPlatformUsers.clear();
    this.mockPracticeOwners.clear();
  }

  /**
   * Resolves a user's membership in a specific practice.
   */
  static async resolveMembership(
    userId: string,
    practiceId: string
  ): Promise<MembershipRecord | null> {
    const mock = this.mockMemberships.get(`${userId}:${practiceId}`);
    if (mock) {
      return mock;
    }

    if (process.env.VETRX_FAST_TEST === '1') {
      return null;
    }

    try {
      const member = await prisma.practiceMember.findUnique({
        where: {
          practiceId_userId: {
            practiceId,
            userId,
          },
        },
      });

      if (!member) return null;

      return {
        id: member.id,
        practiceId: member.practiceId,
        userId: member.userId,
        role: member.role,
        isActive: member.isActive,
      };
    } catch {
      return null;
    }
  }

  /**
   * Returns the role of a user in a practice, or null if not a member or deactivated.
   */
  static async getMembershipRole(userId: string, practiceId: string): Promise<Role | null> {
    const membership = await this.resolveMembership(userId, practiceId);
    if (!membership || !membership.isActive) {
      return null;
    }
    return membership.role;
  }

  /**
   * Returns effective permissions for a user in a practice.
   */
  static async getEffectivePermissions(userId: string, practiceId: string): Promise<Permission[]> {
    const membership = await this.resolveMembership(userId, practiceId);
    if (!membership || !membership.isActive) {
      return [];
    }
    return getPermissionsForRole(membership.role);
  }

  /**
   * Checks whether a user has a specific permission in a practice.
   */
  static async hasPermission(
    userId: string,
    practiceId: string,
    permission: Permission | string
  ): Promise<boolean> {
    const membership = await this.resolveMembership(userId, practiceId);
    if (!membership) {
      return false;
    }
    if (!membership.isActive) {
      return false;
    }
    return roleHasPermission(membership.role, permission);
  }

  /**
   * Asserts that a user has a specific permission in a practice, throwing an AppError if not.
   */
  static async requirePermission(
    userId: string,
    practiceId: string,
    permission: Permission | string
  ): Promise<void> {
    const membership = await this.resolveMembership(userId, practiceId);
    if (!membership) {
      throw new AppError(
        403,
        'NOT_PRACTICE_MEMBER',
        'User is not a member of the requested practice.'
      );
    }
    if (!membership.isActive) {
      throw new AppError(
        403,
        'MEMBERSHIP_DISABLED',
        'Your membership in this practice has been deactivated.'
      );
    }
    if (!roleHasPermission(membership.role, permission)) {
      throw new AppError(
        403,
        'INSUFFICIENT_PERMISSION',
        `Action requires permission: ${permission}`
      );
    }
  }

  /**
   * Checks whether a user is the authoritative owner of a practice.
   */
  static async isPracticeOwner(userId: string, practiceId: string): Promise<boolean> {
    const mockOwner = this.mockPracticeOwners.get(practiceId);
    if (mockOwner) {
      return mockOwner === userId;
    }

    const membership = await this.resolveMembership(userId, practiceId);
    if (membership && membership.isActive && membership.role === Role.PRACTICE_OWNER) {
      return true;
    }

    if (process.env.VETRX_FAST_TEST !== '1') {
      try {
        const practice = await prisma.practice.findUnique({
          where: { id: practiceId },
          select: { ownerUserId: true },
        });
        return practice?.ownerUserId === userId;
      } catch {
        return false;
      }
    }

    return false;
  }

  /**
   * Authoritative platform Super Admin check.
   */
  static async isPlatformSuperAdmin(userId: string): Promise<boolean> {
    const mockUser = this.mockPlatformUsers.get(userId);
    if (mockUser) {
      return mockUser.platformRole === PlatformRole.PLATFORM_SUPER_ADMIN;
    }

    if (process.env.VETRX_FAST_TEST === '1') {
      return false;
    }

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { platformRole: true },
      });
      return user?.platformRole === PlatformRole.PLATFORM_SUPER_ADMIN;
    } catch {
      return false;
    }
  }

  /**
   * Asserts platform super admin permission.
   */
  static async requirePlatformSuperAdmin(userId: string): Promise<void> {
    const isSuperAdmin = await this.isPlatformSuperAdmin(userId);
    if (!isSuperAdmin) {
      throw new AppError(
        403,
        'PLATFORM_ACCESS_REQUIRED',
        'This operation requires Platform Super Admin privileges.'
      );
    }
  }
}
