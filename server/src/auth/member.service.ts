// ==============================================================================
// VetRx — Member Management & Ownership Transfer Service (Phase 14)
// Safe role updates, member activation/deactivation, and atomic ownership transfer.
// ==============================================================================

import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { PERMISSIONS } from './permissions.js';
import { AuthorizationService } from './authorization.service.js';
import { EntitlementService } from '../commercial/entitlement.service.js';
import { AuditService } from '../lib/audit.service.js';

export interface MemberListItemDTO {
  id: string;
  practiceId: string;
  userId: string;
  role: Role;
  isClinicalApprover: boolean;
  isActive: boolean;
  user: {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
  };
  createdAt: string;
  updatedAt: string;
}

export class MemberService {
  // In-memory mock store for fast isolated unit testing
  private static mockMembers: Map<string, MemberListItemDTO> = new Map();

  static setMockMember(member: MemberListItemDTO): void {
    const isClinicalApprover = member.isClinicalApprover !== undefined
      ? member.isClinicalApprover
      : member.role === Role.VETERINARIAN;
    const fullMember: MemberListItemDTO = {
      ...member,
      isClinicalApprover,
    };
    this.mockMembers.set(fullMember.id, fullMember);
    AuthorizationService.setMockMembership(fullMember.userId, fullMember.practiceId, {
      id: fullMember.id,
      practiceId: fullMember.practiceId,
      userId: fullMember.userId,
      role: fullMember.role,
      isClinicalApprover: fullMember.isClinicalApprover,
      isActive: fullMember.isActive,
    });
  }

  static clearMocks(): void {
    this.mockMembers.clear();
  }

  /**
   * Lists all members of a practice.
   */
  static async listMembers(actorUserId: string, practiceId: string): Promise<MemberListItemDTO[]> {
    await AuthorizationService.requirePermission(actorUserId, practiceId, PERMISSIONS.USER_VIEW);

    if (process.env.VETRX_FAST_TEST === '1') {
      const results: MemberListItemDTO[] = [];
      for (const member of this.mockMembers.values()) {
        if (member.practiceId === practiceId) {
          results.push(member);
        }
      }
      return results;
    }

    const members = await prisma.practiceMember.findMany({
      where: { practiceId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      practiceId: m.practiceId,
      userId: m.userId,
      role: m.role,
      isClinicalApprover: m.isClinicalApprover || m.role === Role.VETERINARIAN,
      isActive: m.isActive,
      user: m.user,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));
  }

  /**
   * Updates a practice member's role safely.
   */
  static async updateMemberRole(
    actorUserId: string,
    practiceId: string,
    targetMemberId: string,
    rawRole: Role | string
  ): Promise<MemberListItemDTO> {
    await AuthorizationService.requirePermission(actorUserId, practiceId, PERMISSIONS.ROLE_ASSIGN);

    const newRole = (rawRole === 'PRACTICE_STAFF' ? Role.STAFF : rawRole) as Role;

    // 1. Direct promotion to PRACTICE_OWNER is strictly forbidden (must use transfer)
    if (newRole === Role.PRACTICE_OWNER) {
      throw new AppError(
        400,
        'OWNER_TRANSFER_REQUIRED',
        'Practice Owner role cannot be assigned directly. Use practice ownership transfer.'
      );
    }

    let targetMember: MemberListItemDTO | null = null;
    if (process.env.VETRX_FAST_TEST === '1') {
      targetMember = this.mockMembers.get(targetMemberId) || null;
    } else {
      const dbMember = await prisma.practiceMember.findUnique({
        where: { id: targetMemberId },
        include: {
          user: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
      });
      if (dbMember) {
        targetMember = {
          id: dbMember.id,
          practiceId: dbMember.practiceId,
          userId: dbMember.userId,
          role: dbMember.role,
          isClinicalApprover: dbMember.isClinicalApprover || dbMember.role === Role.VETERINARIAN,
          isActive: dbMember.isActive,
          user: dbMember.user,
          createdAt: dbMember.createdAt.toISOString(),
          updatedAt: dbMember.updatedAt.toISOString(),
        };
      }
    }

    if (!targetMember || targetMember.practiceId !== practiceId) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Practice member not found.');
    }

    // 2. Prevent self-role modification / privilege escalation
    if (actorUserId === targetMember.userId) {
      throw new AppError(
        403,
        'SELF_ROLE_CHANGE_FORBIDDEN',
        'You cannot change your own role. Another administrator or owner must perform this action.'
      );
    }

    // 3. Current owner role cannot be downgraded through normal role change
    if (targetMember.role === Role.PRACTICE_OWNER) {
      throw new AppError(
        403,
        'OWNER_TRANSFER_REQUIRED',
        'Cannot modify the Practice Owner role directly. Practice ownership must be transferred.'
      );
    }

    // 4. Admin cannot promote to Admin or modify an Admin
    const actorRole = await AuthorizationService.getMembershipRole(actorUserId, practiceId);
    if (actorRole === Role.PRACTICE_ADMIN) {
      if (targetMember.role === Role.PRACTICE_ADMIN) {
        throw new AppError(
          403,
          'ROLE_ASSIGNMENT_FORBIDDEN',
          'Practice Admin cannot modify another Practice Admin.'
        );
      }
      if (newRole === Role.PRACTICE_ADMIN) {
        throw new AppError(
          403,
          'ROLE_ASSIGNMENT_FORBIDDEN',
          'Practice Admin cannot assign the Practice Admin role. Only Practice Owner may assign Admin.'
        );
      }
    }

    // 5. Commercial veterinarian seat check using projected net change
    const targetIsClinical = newRole === Role.VETERINARIAN
      ? true
      : (newRole === Role.STAFF || newRole === Role.PRACTICE_STAFF || newRole === Role.READ_ONLY ? false : targetMember.isClinicalApprover);
    await EntitlementService.assertCanAssignClinicalSeat(
      practiceId,
      { role: targetMember.role, isClinicalApprover: targetMember.isClinicalApprover },
      { role: newRole, isClinicalApprover: targetIsClinical }
    );

    const previousRole = targetMember.role;
    targetMember.role = newRole;
    targetMember.isClinicalApprover = targetIsClinical;
    targetMember.updatedAt = new Date().toISOString();

    if (process.env.VETRX_FAST_TEST === '1') {
      this.mockMembers.set(targetMember.id, targetMember);
      AuthorizationService.setMockMembership(targetMember.userId, practiceId, {
        id: targetMember.id,
        role: newRole,
        isClinicalApprover: targetIsClinical,
        isActive: targetMember.isActive,
      });
    } else {
      await prisma.practiceMember.update({
        where: { id: targetMember.id },
        data: {
          role: newRole,
          isClinicalApprover: targetIsClinical,
        },
      });
    }

    // 6. Security audit trail
    await AuditService.record({
      practiceId,
      userId: actorUserId,
      action: 'ROLE_CHANGED',
      resource: 'PracticeMember',
      resourceId: targetMember.id,
      details: {
        targetUserId: targetMember.userId,
        previousRole,
        newRole,
      },
    });

    return targetMember;
  }

  /**
   * Updates a member's clinical approver status (e.g. designating Practice Owner as clinical veterinarian).
   */
  static async updateClinicalStatus(
    actorUserId: string,
    practiceId: string,
    targetMemberId: string,
    isClinicalApprover: boolean
  ): Promise<MemberListItemDTO> {
    await AuthorizationService.requirePermission(actorUserId, practiceId, PERMISSIONS.ROLE_ASSIGN);

    let targetMember: MemberListItemDTO | null = null;
    if (process.env.VETRX_FAST_TEST === '1') {
      targetMember = this.mockMembers.get(targetMemberId) || null;
    } else {
      const dbMember = await prisma.practiceMember.findUnique({
        where: { id: targetMemberId },
        include: {
          user: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
      });
      if (dbMember) {
        targetMember = {
          id: dbMember.id,
          practiceId: dbMember.practiceId,
          userId: dbMember.userId,
          role: dbMember.role,
          isClinicalApprover: dbMember.isClinicalApprover || dbMember.role === Role.VETERINARIAN,
          isActive: dbMember.isActive,
          user: dbMember.user,
          createdAt: dbMember.createdAt.toISOString(),
          updatedAt: dbMember.updatedAt.toISOString(),
        };
      }
    }

    if (!targetMember || targetMember.practiceId !== practiceId) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Practice member not found.');
    }

    if (!targetMember.isActive) {
      throw new AppError(400, 'MEMBER_INACTIVE', 'Cannot update clinical status of a deactivated member.');
    }

    // Only VETERINARIAN, PRACTICE_OWNER, and PRACTICE_ADMIN can be clinical approvers
    if (targetMember.role !== Role.VETERINARIAN && targetMember.role !== Role.PRACTICE_OWNER && targetMember.role !== Role.PRACTICE_ADMIN) {
      throw new AppError(
        400,
        'CLINICAL_ROLE_FORBIDDEN',
        'Staff members cannot be designated as clinical approvers. To enable clinical approvals, change their role to Veterinarian.'
      );
    }

    // Role VETERINARIAN is always clinical
    if (targetMember.role === Role.VETERINARIAN && !isClinicalApprover) {
      throw new AppError(
        400,
        'CANNOT_REVOKE_VET_CLINICAL',
        'Members with the VETERINARIAN role must remain clinical approvers. To remove clinical authority, change their role to Staff or Administrator.'
      );
    }

    // Validate seat allocation
    await EntitlementService.assertCanAssignClinicalSeat(
      practiceId,
      { role: targetMember.role, isClinicalApprover: targetMember.isClinicalApprover },
      { role: targetMember.role, isClinicalApprover }
    );

    const previousStatus = targetMember.isClinicalApprover;
    targetMember.isClinicalApprover = isClinicalApprover;
    targetMember.updatedAt = new Date().toISOString();

    if (process.env.VETRX_FAST_TEST === '1') {
      this.mockMembers.set(targetMember.id, targetMember);
      AuthorizationService.setMockMembership(targetMember.userId, practiceId, {
        id: targetMember.id,
        role: targetMember.role,
        isClinicalApprover,
        isActive: targetMember.isActive,
      });
    } else {
      await prisma.practiceMember.update({
        where: { id: targetMember.id },
        data: { isClinicalApprover },
      });
    }

    await AuditService.record({
      practiceId,
      userId: actorUserId,
      action: 'MEMBER_CLINICAL_STATUS_UPDATED',
      resource: 'PracticeMember',
      resourceId: targetMember.id,
      details: {
        targetUserId: targetMember.userId,
        previousStatus,
        newStatus: isClinicalApprover,
      },
    });

    return targetMember;
  }

  /**
   * Deactivates a member in the practice without deleting historical clinical records.
   */
  static async deactivateMember(
    actorUserId: string,
    practiceId: string,
    targetMemberId: string
  ): Promise<{ success: boolean; member: MemberListItemDTO }> {
    await AuthorizationService.requirePermission(actorUserId, practiceId, PERMISSIONS.USER_DEACTIVATE);

    let targetMember: MemberListItemDTO | null = null;
    if (process.env.VETRX_FAST_TEST === '1') {
      targetMember = this.mockMembers.get(targetMemberId) || null;
    } else {
      const dbMember = await prisma.practiceMember.findUnique({
        where: { id: targetMemberId },
        include: {
          user: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
      });
      if (dbMember) {
        targetMember = {
          id: dbMember.id,
          practiceId: dbMember.practiceId,
          userId: dbMember.userId,
          role: dbMember.role,
          isActive: dbMember.isActive,
          user: dbMember.user,
          createdAt: dbMember.createdAt.toISOString(),
          updatedAt: dbMember.updatedAt.toISOString(),
        };
      }
    }

    if (!targetMember || targetMember.practiceId !== practiceId) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Practice member not found.');
    }

    // 1. Prevent self-deactivation
    if (actorUserId === targetMember.userId) {
      throw new AppError(
        403,
        'SELF_DEACTIVATION_FORBIDDEN',
        'You cannot deactivate your own practice membership.'
      );
    }

    // 2. Prevent deactivating the Practice Owner
    if (targetMember.role === Role.PRACTICE_OWNER) {
      throw new AppError(
        403,
        'CANNOT_REMOVE_LAST_OWNER',
        'The Practice Owner cannot be deactivated. Transfer practice ownership first.'
      );
    }

    // 3. Admin cannot deactivate another Admin
    const actorRole = await AuthorizationService.getMembershipRole(actorUserId, practiceId);
    if (actorRole === Role.PRACTICE_ADMIN && targetMember.role === Role.PRACTICE_ADMIN) {
      throw new AppError(
        403,
        'ROLE_ASSIGNMENT_FORBIDDEN',
        'Practice Admin cannot deactivate another Practice Admin.'
      );
    }

    targetMember.isActive = false;
    targetMember.updatedAt = new Date().toISOString();

    if (process.env.VETRX_FAST_TEST === '1') {
      this.mockMembers.set(targetMember.id, targetMember);
      AuthorizationService.setMockMembership(targetMember.userId, practiceId, {
        isActive: false,
      });
    } else {
      await prisma.practiceMember.update({
        where: { id: targetMember.id },
        data: { isActive: false },
      });
    }

    // Security audit trail
    await AuditService.record({
      practiceId,
      userId: actorUserId,
      action: 'USER_DEACTIVATED',
      resource: 'PracticeMember',
      resourceId: targetMember.id,
      details: { targetUserId: targetMember.userId, role: targetMember.role },
    });

    return { success: true, member: targetMember };
  }

  /**
   * Reactivates a deactivated practice member.
   */
  static async reactivateMember(
    actorUserId: string,
    practiceId: string,
    targetMemberId: string
  ): Promise<{ success: boolean; member: MemberListItemDTO }> {
    await AuthorizationService.requirePermission(actorUserId, practiceId, PERMISSIONS.USER_REACTIVATE);

    let targetMember: MemberListItemDTO | null = null;
    if (process.env.VETRX_FAST_TEST === '1') {
      targetMember = this.mockMembers.get(targetMemberId) || null;
    } else {
      const dbMember = await prisma.practiceMember.findUnique({
        where: { id: targetMemberId },
        include: {
          user: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
      });
      if (dbMember) {
        targetMember = {
          id: dbMember.id,
          practiceId: dbMember.practiceId,
          userId: dbMember.userId,
          role: dbMember.role,
          isActive: dbMember.isActive,
          user: dbMember.user,
          createdAt: dbMember.createdAt.toISOString(),
          updatedAt: dbMember.updatedAt.toISOString(),
        };
      }
    }

    if (!targetMember || targetMember.practiceId !== practiceId) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Practice member not found.');
    }

    // If reactivating a veterinarian, re-check veterinarian seat quota
    if (targetMember.role === Role.VETERINARIAN) {
      await EntitlementService.assertCanAddSeat(practiceId, Role.VETERINARIAN);
    }

    targetMember.isActive = true;
    targetMember.updatedAt = new Date().toISOString();

    if (process.env.VETRX_FAST_TEST === '1') {
      this.mockMembers.set(targetMember.id, targetMember);
      AuthorizationService.setMockMembership(targetMember.userId, practiceId, {
        isActive: true,
      });
    } else {
      await prisma.practiceMember.update({
        where: { id: targetMember.id },
        data: { isActive: true },
      });
    }

    await AuditService.record({
      practiceId,
      userId: actorUserId,
      action: 'USER_ACTIVATED',
      resource: 'PracticeMember',
      resourceId: targetMember.id,
      details: { targetUserId: targetMember.userId, role: targetMember.role },
    });

    return { success: true, member: targetMember };
  }

  /**
   * Atomically transfers practice ownership to an existing active practice member.
   */
  static async transferOwnership(
    actorUserId: string,
    practiceId: string,
    targetMemberId: string,
    rawPreviousRole: Role | string = Role.PRACTICE_ADMIN
  ): Promise<{ success: boolean; newOwnerUserId: string }> {
    // 1. Authoritative permission check
    await AuthorizationService.requirePermission(actorUserId, practiceId, PERMISSIONS.OWNERSHIP_TRANSFER);

    // 2. Must be verified current owner
    const isOwner = await AuthorizationService.isPracticeOwner(actorUserId, practiceId);
    if (!isOwner) {
      throw new AppError(
        403,
        'OWNER_TRANSFER_FORBIDDEN',
        'Only the current Practice Owner can transfer practice ownership.'
      );
    }

    let targetMember: MemberListItemDTO | null = null;
    if (process.env.VETRX_FAST_TEST === '1') {
      targetMember = this.mockMembers.get(targetMemberId) || null;
    } else {
      const dbMember = await prisma.practiceMember.findUnique({
        where: { id: targetMemberId },
        include: {
          user: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
      });
      if (dbMember) {
        targetMember = {
          id: dbMember.id,
          practiceId: dbMember.practiceId,
          userId: dbMember.userId,
          role: dbMember.role,
          isActive: dbMember.isActive,
          user: dbMember.user,
          createdAt: dbMember.createdAt.toISOString(),
          updatedAt: dbMember.updatedAt.toISOString(),
        };
      }
    }

    if (!targetMember || targetMember.practiceId !== practiceId) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Target member for ownership transfer not found.');
    }

    if (!targetMember.isActive) {
      throw new AppError(
        400,
        'MEMBER_INACTIVE',
        'Cannot transfer ownership to an inactive practice member. Reactivate member first.'
      );
    }

    if (actorUserId === targetMember.userId) {
      throw new AppError(
        400,
        'SELF_TRANSFER_FORBIDDEN',
        'You are already the Practice Owner. Ownership must be transferred to another member.'
      );
    }

    const previousOwnerRole = (rawPreviousRole === 'PRACTICE_STAFF' ? Role.STAFF : rawPreviousRole) as Role;
    if (previousOwnerRole === Role.PRACTICE_OWNER) {
      throw new AppError(
        400,
        'INVALID_PREVIOUS_ROLE',
        'Previous owner cannot retain the PRACTICE_OWNER role after transfer.'
      );
    }

    // Atomic execution
    if (process.env.VETRX_FAST_TEST === '1') {
      // Find actor member record
      let actorMember: MemberListItemDTO | null = null;
      for (const m of this.mockMembers.values()) {
        if (m.practiceId === practiceId && m.userId === actorUserId) {
          actorMember = m;
          break;
        }
      }

      if (actorMember) {
        actorMember.role = previousOwnerRole;
        this.mockMembers.set(actorMember.id, actorMember);
        AuthorizationService.setMockMembership(actorUserId, practiceId, { role: previousOwnerRole });
      }

      targetMember.role = Role.PRACTICE_OWNER;
      this.mockMembers.set(targetMember.id, targetMember);
      AuthorizationService.setMockMembership(targetMember.userId, practiceId, { role: Role.PRACTICE_OWNER });
      AuthorizationService.setMockPracticeOwner(practiceId, targetMember.userId);
    } else {
      await prisma.$transaction(async (tx) => {
        // 1. Update practice owner
        await tx.practice.update({
          where: { id: practiceId },
          data: { ownerUserId: targetMember.userId },
        });

        // 2. Promote new owner
        await tx.practiceMember.update({
          where: { id: targetMember.id },
          data: { role: Role.PRACTICE_OWNER },
        });

        // 3. Demote previous owner
        await tx.practiceMember.updateMany({
          where: { practiceId, userId: actorUserId },
          data: { role: previousOwnerRole },
        });
      });
    }

    // Strict audit trail
    await AuditService.record({
      practiceId,
      userId: actorUserId,
      action: 'OWNERSHIP_TRANSFERRED',
      resource: 'Practice',
      resourceId: practiceId,
      details: {
        previousOwnerUserId: actorUserId,
        newOwnerUserId: targetMember.userId,
        previousOwnerNewRole: previousOwnerRole,
      },
    });

    return {
      success: true,
      newOwnerUserId: targetMember.userId,
    };
  }
}
