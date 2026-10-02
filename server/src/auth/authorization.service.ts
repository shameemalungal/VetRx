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
  isClinicalApprover?: boolean;
  isActive: boolean;
}

export class AuthorizationService {
  // In-memory mock store for fast isolated unit testing
  private static mockMemberships: Map<string, MembershipRecord> = new Map();
  private static mockPlatformUsers: Map<string, { platformRole: PlatformRole | null }> = new Map();
  private static mockPracticeOwners: Map<string, string> = new Map(); // practiceId -> ownerUserId
  private static mockOverrides: Map<string, Map<string, 'ALLOW' | 'DENY'>> = new Map(); // practiceMemberId -> (permission -> effect)
  private static mockSupportAccess: Map<string, { expiresAt: Date }> = new Map(); // `${userId}:${practiceId}` -> session

  static setMockSupportAccess(userId: string, practiceId: string, durationMinutes = 60): void {
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
    this.mockSupportAccess.set(`${userId}:${practiceId}`, { expiresAt });
  }

  static clearMockSupportAccess(): void {
    this.mockSupportAccess.clear();
  }

  static async hasActiveSupportSession(userId: string, practiceId: string): Promise<boolean> {
    if (process.env.VETRX_FAST_TEST === '1') {
      const mock = this.mockSupportAccess.get(`${userId}:${practiceId}`);
      return Boolean(mock && mock.expiresAt > new Date());
    }

    try {
      const session = await prisma.supportAccessSession.findFirst({
        where: {
          platformAdminUserId: userId,
          targetPracticeId: practiceId,
          status: 'ACTIVE',
          expiresAt: { gt: new Date() },
        },
      });
      return Boolean(session);
    } catch {
      return false;
    }
  }

  static setMockMembership(userId: string, practiceId: string, record: Partial<MembershipRecord>): void {
    const key = `${userId}:${practiceId}`;
    const role = record.role || Role.STAFF;
    this.mockMemberships.set(key, {
      id: record.id || `mem-${userId}-${practiceId}`,
      practiceId,
      userId,
      role,
      isClinicalApprover: record.isClinicalApprover !== undefined
        ? record.isClinicalApprover
        : (role === Role.VETERINARIAN),
      isActive: record.isActive !== undefined ? record.isActive : true,
    });
  }

  static getMockMembers(practiceId?: string): MembershipRecord[] {
    const list: MembershipRecord[] = [];
    for (const m of this.mockMemberships.values()) {
      if (!practiceId || m.practiceId === practiceId) {
        list.push({ ...m });
      }
    }
    return list;
  }

  static getMockMemberCounts(practiceId: string): { vets: number; staff: number } {
    let vets = 0;
    let staff = 0;
    for (const m of this.mockMemberships.values()) {
      if (m.practiceId === practiceId && m.isActive) {
        if (m.role === Role.VETERINARIAN || m.isClinicalApprover) {
          vets++;
        } else {
          staff++;
        }
      }
    }
    return { vets, staff };
  }

  static setMockOverride(practiceMemberId: string, permission: string, effect: 'ALLOW' | 'DENY'): void {
    let memberMap = this.mockOverrides.get(practiceMemberId);
    if (!memberMap) {
      memberMap = new Map();
      this.mockOverrides.set(practiceMemberId, memberMap);
    }
    memberMap.set(permission, effect);
  }

  static removeMockOverride(practiceMemberId: string, permission: string): void {
    const memberMap = this.mockOverrides.get(practiceMemberId);
    if (memberMap) {
      memberMap.delete(permission);
    }
  }

  static clearMockOverrides(): void {
    this.mockOverrides.clear();
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
    this.mockOverrides.clear();
    this.mockSupportAccess.clear();
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
        isClinicalApprover: member.isClinicalApprover || member.role === Role.VETERINARIAN,
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
   * Returns whether a user is an active member of a specific practice.
   */
  static async isPracticeMember(userId: string, practiceId: string): Promise<boolean> {
    const membership = await this.resolveMembership(userId, practiceId);
    return Boolean(membership && membership.isActive);
  }

  /**
   * Returns effective permissions for a user in a practice, incorporating role defaults and overrides.
   */
  static async getEffectivePermissions(userId: string, practiceId: string): Promise<Permission[]> {
    const membership = await this.resolveMembership(userId, practiceId);
    if (!membership || !membership.isActive) {
      return [];
    }
    const rolePermissions = new Set<Permission>(getPermissionsForRole(membership.role));

    // Clinical approval authority is attached if member is a designated clinical approver or Veterinarian
    if (membership.isClinicalApprover || membership.role === Role.VETERINARIAN) {
      rolePermissions.add(PERMISSIONS.PRESCRIPTION_APPROVE);
      rolePermissions.add(PERMISSIONS.PRESCRIPTION_REQUEST_CHANGES);
    }

    // Check mock overrides first
    const mockMemberOverrides = this.mockOverrides.get(membership.id);
    if (mockMemberOverrides && mockMemberOverrides.size > 0) {
      for (const [perm, effect] of mockMemberOverrides.entries()) {
        if (effect === 'ALLOW') {
          // Platform permissions cannot be granted via practice-level overrides
          if (!perm.startsWith('PLATFORM_')) {
            rolePermissions.add(perm as Permission);
          }
        } else if (effect === 'DENY') {
          rolePermissions.delete(perm as Permission);
        }
      }
      return Array.from(rolePermissions);
    }

    // If database lookup is enabled
    if (process.env.VETRX_FAST_TEST !== '1') {
      try {
        const dbOverrides = await prisma.memberPermissionOverride.findMany({
          where: { practiceMemberId: membership.id },
        });
        for (const ov of dbOverrides) {
          if (ov.effect === 'ALLOW') {
            if (!ov.permission.startsWith('PLATFORM_')) {
              rolePermissions.add(ov.permission as Permission);
            }
          } else if (ov.effect === 'DENY') {
            rolePermissions.delete(ov.permission as Permission);
          }
        }
      } catch {
        // Fallback to role permissions if table not accessible yet
      }
    }

    return Array.from(rolePermissions);
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
    if (!membership || !membership.isActive) {
      return false;
    }
    const effective = await this.getEffectivePermissions(userId, practiceId);
    return effective.includes(permission as Permission);
  }

  /**
   * Asserts that a user has a specific permission in a practice, throwing an AppError if not.
   *
   * STRICT DUAL CONTEXT SECURITY RULES:
   * 1. In Practice context (user is a PracticeMember):
   *    Authorization comes SOLELY from their PracticeMember record, practice role, and member overrides.
   *    Platform Super Admin permissions NEVER leak into practice context.
   * 2. Non-member context:
   *    Unrestricted impersonation is strictly prohibited.
   *    Platform Super Admins can only perform non-clinical administrative operations
   *    if an audited, time-limited Support Access session is currently active.
   */
  static async requirePermission(
    userId: string,
    practiceId: string,
    permission: Permission | string
  ): Promise<void> {
    const membership = await this.resolveMembership(userId, practiceId);

    // CASE 1: Practice Member context (including Super Admin's OWN practice)
    if (membership) {
      if (!membership.isActive) {
        throw new AppError(
          403,
          'MEMBERSHIP_DISABLED',
          'Your membership in this practice has been deactivated.'
        );
      }

      const effective = await this.getEffectivePermissions(userId, practiceId);
      if (effective.includes(permission as Permission)) {
        return; // Authorized via explicit practice role / overrides
      }

      throw new AppError(
        403,
        'INSUFFICIENT_PERMISSION',
        `Action requires permission: ${permission}`
      );
    }

    // CASE 2: Non-member context (Other practices)
    // Impersonation forbidden. Audited support session required for platform super admins.
    const isSuperAdmin = await this.isPlatformSuperAdmin(userId);
    if (isSuperAdmin) {
      const hasSupport = await this.hasActiveSupportSession(userId, practiceId);
      if (hasSupport) {
        const clinicalPermissions: string[] = [
          PERMISSIONS.PRESCRIPTION_APPROVE,
          PERMISSIONS.PRESCRIPTION_REQUEST_CHANGES,
          'PRESCRIPTION_SIGN',
          'PRESCRIPTION_ISSUE',
          'PRESCRIPTION_DISPENSE',
        ];
        if (clinicalPermissions.includes(permission as any)) {
          throw new AppError(
            403,
            'CLINICAL_AUTHORITY_RESTRICTED',
            'Platform Super Admins cannot execute clinical approval actions in support access mode.'
          );
        }
        return; // Permitted under active audited support access session
      }
    }

    throw new AppError(
      403,
      'NOT_PRACTICE_MEMBER',
      'User is not a member of the requested practice.'
    );
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
