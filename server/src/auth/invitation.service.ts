// ==============================================================================
// VetRx — Practice Invitation Service (Phase 14)
// Secure cryptographic invitation issuance, token hashing, expiration, and acceptance.
// ==============================================================================

import crypto from 'crypto';
import { Role, InvitationStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { PERMISSIONS } from './permissions.js';
import { AuthorizationService } from './authorization.service.js';
import { EntitlementService } from '../commercial/entitlement.service.js';
import { AuditService } from '../lib/audit.service.js';

export interface InvitationRecord {
  id: string;
  practiceId: string;
  email: string;
  role: Role;
  tokenHash: string;
  invitedById: string;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt?: Date | null;
  revokedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateInvitationResult {
  id: string;
  practiceId: string;
  email: string;
  role: Role;
  expiresAt: string;
  token: string;
}

export class InvitationService {
  // In-memory mock store for fast isolated unit testing
  private static mockInvitations: Map<string, InvitationRecord> = new Map();

  static setMockInvitation(invitation: InvitationRecord): void {
    this.mockInvitations.set(invitation.id, invitation);
    this.mockInvitations.set(`hash:${invitation.tokenHash}`, invitation);
  }

  static clearMocks(): void {
    this.mockInvitations.clear();
  }

  /**
   * Hashes a raw token with SHA-256 for secure lookup.
   */
  static hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Generates a cryptographically secure random token.
   */
  static generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Creates a practice invitation with seat validation and audit logging.
   */
  static async createInvitation(
    actorUserId: string,
    practiceId: string,
    email: string,
    rawRole: Role | string
  ): Promise<CreateInvitationResult> {
    // 1. Authoritative permission check
    await AuthorizationService.requirePermission(actorUserId, practiceId, PERMISSIONS.USER_INVITE);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !normalizedEmail.includes('@')) {
      throw new AppError(400, 'INVALID_EMAIL', 'A valid email address is required.');
    }

    const role = (rawRole === 'PRACTICE_STAFF' ? Role.STAFF : rawRole) as Role;

    // 2. Role restriction: Owner cannot be invited (ownership must be transferred)
    if (role === Role.PRACTICE_OWNER) {
      throw new AppError(
        400,
        'INVITATION_ROLE_FORBIDDEN',
        'Practice Owner role cannot be assigned via invitation. Ownership must be explicitly transferred.'
      );
    }

    // 3. Admin escalation protection: Admin cannot invite an Admin
    const actorRole = await AuthorizationService.getMembershipRole(actorUserId, practiceId);
    if (actorRole === Role.PRACTICE_ADMIN && role === Role.PRACTICE_ADMIN) {
      throw new AppError(
        403,
        'ROLE_ASSIGNMENT_FORBIDDEN',
        'Practice Admin cannot invite another Practice Admin. Only the Practice Owner may invite Admins.'
      );
    }

    // 4. Check if user is already an active member of this practice
    if (process.env.VETRX_FAST_TEST !== '1') {
      try {
        const existingMember = await prisma.practiceMember.findFirst({
          where: {
            practiceId,
            isActive: true,
            user: { normalizedEmail },
          },
        });
        if (existingMember) {
          throw new AppError(
            409,
            'ALREADY_PRACTICE_MEMBER',
            'User is already an active member of this practice.'
          );
        }
      } catch (err) {
        if (err instanceof AppError) throw err;
      }
    }

    // 5. Authoritative commercial seat availability check
    await EntitlementService.assertCanAddSeat(practiceId, role);

    // 6. Generate secure one-time token & hash
    const rawToken = this.generateToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day expiry

    const id = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();

    const record: InvitationRecord = {
      id,
      practiceId,
      email: normalizedEmail,
      role,
      tokenHash,
      invitedById: actorUserId,
      status: InvitationStatus.PENDING,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    };

    if (process.env.VETRX_FAST_TEST === '1') {
      this.mockInvitations.set(id, record);
      this.mockInvitations.set(`hash:${tokenHash}`, record);
    } else {
      // Invalidate any prior pending invitations for this email in this practice
      await prisma.practiceInvitation.updateMany({
        where: { practiceId, email: normalizedEmail, status: InvitationStatus.PENDING },
        data: { status: InvitationStatus.REVOKED, revokedAt: now },
      });

      await prisma.practiceInvitation.create({
        data: {
          id,
          practiceId,
          email: normalizedEmail,
          role,
          tokenHash,
          invitedById: actorUserId,
          status: InvitationStatus.PENDING,
          expiresAt,
        },
      });
    }

    // 7. Security audit trail
    await AuditService.record({
      practiceId,
      userId: actorUserId,
      action: 'USER_INVITED',
      resource: 'PracticeInvitation',
      resourceId: id,
      details: { email: normalizedEmail, role, expiresAt: expiresAt.toISOString() },
    });

    return {
      id,
      practiceId,
      email: normalizedEmail,
      role,
      expiresAt: expiresAt.toISOString(),
      token: rawToken,
    };
  }

  /**
   * Accepts an invitation using the one-time raw token.
   */
  static async acceptInvitation(
    rawToken: string,
    acceptingUser: { id: string; email: string; name?: string }
  ): Promise<{ practiceId: string; role: Role; membershipId: string }> {
    if (!rawToken || typeof rawToken !== 'string') {
      throw new AppError(400, 'INVALID_TOKEN', 'A valid invitation token is required.');
    }

    const tokenHash = this.hashToken(rawToken);

    let invitation: InvitationRecord | null = null;
    if (process.env.VETRX_FAST_TEST === '1') {
      invitation = this.mockInvitations.get(`hash:${tokenHash}`) || null;
    } else {
      const dbInv = await prisma.practiceInvitation.findUnique({
        where: { tokenHash },
      });
      if (dbInv) {
        invitation = {
          id: dbInv.id,
          practiceId: dbInv.practiceId,
          email: dbInv.email,
          role: dbInv.role,
          tokenHash: dbInv.tokenHash,
          invitedById: dbInv.invitedById,
          status: dbInv.status,
          expiresAt: dbInv.expiresAt,
          acceptedAt: dbInv.acceptedAt,
          revokedAt: dbInv.revokedAt,
          createdAt: dbInv.createdAt,
          updatedAt: dbInv.updatedAt,
        };
      }
    }

    if (!invitation) {
      throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation not found or invalid.');
    }

    // Verify status
    if (invitation.status === InvitationStatus.ACCEPTED) {
      throw new AppError(
        409,
        'INVITATION_ALREADY_ACCEPTED',
        'This invitation has already been accepted and consumed.'
      );
    }
    if (invitation.status === InvitationStatus.REVOKED) {
      throw new AppError(
        400,
        'INVITATION_REVOKED',
        'This invitation has been revoked by practice administration.'
      );
    }
    if (invitation.status === InvitationStatus.EXPIRED || new Date() > new Date(invitation.expiresAt)) {
      throw new AppError(400, 'INVITATION_EXPIRED', 'This invitation has expired.');
    }

    // Verify email identity match
    const normalizedUserEmail = acceptingUser.email.trim().toLowerCase();
    if (normalizedUserEmail !== invitation.email.toLowerCase()) {
      throw new AppError(
        403,
        'INVITATION_EMAIL_MISMATCH',
        `Invitation was issued for ${invitation.email}, but current account is ${acceptingUser.email}.`
      );
    }

    // Re-verify commercial seat availability at consumption time
    await EntitlementService.assertCanAddSeat(invitation.practiceId, invitation.role);

    const now = new Date();
    let membershipId = `mem-${acceptingUser.id}-${invitation.practiceId}`;

    if (process.env.VETRX_FAST_TEST === '1') {
      invitation.status = InvitationStatus.ACCEPTED;
      invitation.acceptedAt = now;
      this.mockInvitations.set(invitation.id, invitation);
      this.mockInvitations.set(`hash:${tokenHash}`, invitation);

      AuthorizationService.setMockMembership(acceptingUser.id, invitation.practiceId, {
        id: membershipId,
        practiceId: invitation.practiceId,
        userId: acceptingUser.id,
        role: invitation.role,
        isActive: true,
      });
    } else {
      const result = await prisma.$transaction(async (tx) => {
        // Mark invitation consumed
        await tx.practiceInvitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.ACCEPTED, acceptedAt: now },
        });

        // Upsert practice membership
        const member = await tx.practiceMember.upsert({
          where: {
            practiceId_userId: {
              practiceId: invitation.practiceId,
              userId: acceptingUser.id,
            },
          },
          create: {
            practiceId: invitation.practiceId,
            userId: acceptingUser.id,
            role: invitation.role,
            isActive: true,
          },
          update: {
            role: invitation.role,
            isActive: true,
          },
        });

        return member;
      });
      membershipId = result.id;
    }

    // Security audit trail
    await AuditService.record({
      practiceId: invitation.practiceId,
      userId: acceptingUser.id,
      action: 'INVITATION_ACCEPTED',
      resource: 'PracticeMember',
      resourceId: membershipId,
      details: { invitationId: invitation.id, role: invitation.role },
    });

    return {
      practiceId: invitation.practiceId,
      role: invitation.role,
      membershipId,
    };
  }

  /**
   * Revokes a pending invitation.
   */
  static async revokeInvitation(
    actorUserId: string,
    practiceId: string,
    invitationId: string
  ): Promise<{ success: boolean }> {
    await AuthorizationService.requirePermission(actorUserId, practiceId, PERMISSIONS.USER_INVITE);

    const now = new Date();

    if (process.env.VETRX_FAST_TEST === '1') {
      const inv = this.mockInvitations.get(invitationId);
      if (!inv || inv.practiceId !== practiceId) {
        throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation not found.');
      }
      inv.status = InvitationStatus.REVOKED;
      inv.revokedAt = now;
      this.mockInvitations.set(inv.id, inv);
      this.mockInvitations.set(`hash:${inv.tokenHash}`, inv);
    } else {
      const inv = await prisma.practiceInvitation.findUnique({
        where: { id: invitationId },
      });
      if (!inv || inv.practiceId !== practiceId) {
        throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation not found.');
      }

      await prisma.practiceInvitation.update({
        where: { id: invitationId },
        data: { status: InvitationStatus.REVOKED, revokedAt: now },
      });
    }

    await AuditService.record({
      practiceId,
      userId: actorUserId,
      action: 'INVITATION_REVOKED',
      resource: 'PracticeInvitation',
      resourceId: invitationId,
    });

    return { success: true };
  }

  /**
   * Resends an invitation with a fresh expiration and token.
   */
  static async resendInvitation(
    actorUserId: string,
    practiceId: string,
    invitationId: string
  ): Promise<CreateInvitationResult> {
    await AuthorizationService.requirePermission(actorUserId, practiceId, PERMISSIONS.USER_INVITE);

    let inv: InvitationRecord | null = null;
    if (process.env.VETRX_FAST_TEST === '1') {
      inv = this.mockInvitations.get(invitationId) || null;
    } else {
      const dbInv = await prisma.practiceInvitation.findUnique({
        where: { id: invitationId },
      });
      if (dbInv) {
        inv = { ...dbInv } as InvitationRecord;
      }
    }

    if (!inv || inv.practiceId !== practiceId) {
      throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation not found.');
    }

    if (inv.status === InvitationStatus.ACCEPTED) {
      throw new AppError(409, 'INVITATION_ALREADY_ACCEPTED', 'Cannot resend an already accepted invitation.');
    }

    // Check seat limit again
    await EntitlementService.assertCanAddSeat(practiceId, inv.role);

    const rawToken = this.generateToken();
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const now = new Date();

    inv.tokenHash = tokenHash;
    inv.expiresAt = expiresAt;
    inv.status = InvitationStatus.PENDING;
    inv.updatedAt = now;

    if (process.env.VETRX_FAST_TEST === '1') {
      this.mockInvitations.set(inv.id, inv);
      this.mockInvitations.set(`hash:${tokenHash}`, inv);
    } else {
      await prisma.practiceInvitation.update({
        where: { id: invitationId },
        data: {
          tokenHash,
          expiresAt,
          status: InvitationStatus.PENDING,
          updatedAt: now,
        },
      });
    }

    await AuditService.record({
      practiceId,
      userId: actorUserId,
      action: 'USER_INVITED',
      resource: 'PracticeInvitation',
      resourceId: invitationId,
      details: { email: inv.email, role: inv.role, resend: true },
    });

    return {
      id: inv.id,
      practiceId,
      email: inv.email,
      role: inv.role,
      expiresAt: expiresAt.toISOString(),
      token: rawToken,
    };
  }

  /**
   * Lists invitations for a practice.
   */
  static async listInvitations(practiceId: string): Promise<Omit<InvitationRecord, 'tokenHash'>[]> {
    if (process.env.VETRX_FAST_TEST === '1') {
      const list: Omit<InvitationRecord, 'tokenHash'>[] = [];
      for (const [key, inv] of this.mockInvitations.entries()) {
        if (!key.startsWith('hash:') && inv.practiceId === practiceId) {
          const { tokenHash, ...safe } = inv;
          list.push(safe);
        }
      }
      return list;
    }

    const invitations = await prisma.practiceInvitation.findMany({
      where: { practiceId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        practiceId: true,
        email: true,
        role: true,
        invitedById: true,
        status: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return invitations;
  }
}
