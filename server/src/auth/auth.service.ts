import { Role, InvitationStatus } from '@prisma/client';
import { InvitationService } from './invitation.service.js';
import { EntitlementService } from '../commercial/entitlement.service.js';
import { SubscriptionService } from '../commercial/subscription.service.js';
import { prisma } from '../lib/prisma.js';
import { PasswordService } from '../lib/password.js';
import { AuditService } from '../lib/audit.service.js';
import { SessionService } from './session.service.js';
import { AppError } from '../middleware/errorHandler.js';
import { getPermissionsForRole } from './permissions.js';
import { AuthorizationService } from './authorization.service.js';
import type {
  AuthenticatedIdentity,
  SafeUserDTO,
  SafePracticeDTO,
  SafeMembershipDTO,
  SafePracticeSettingsDTO,
  AuthMeResponse,
} from '../types/index.js';

export class AuthService {
  /**
   * Registers a new user with Email and Password in an atomic transaction.
   */
  static async registerWithPassword(params: {
    name: string;
    email: string;
    password: string;
    practiceName?: string;
    practiceType?: 'INDEPENDENT' | 'CLINIC';
    isClinicalApprover?: boolean;
    phone?: string;
    address?: string;
    teamMembers?: Array<{ name?: string; email: string; role: Role | string }>;
    invitationToken?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ token: string; data: AuthMeResponse }> {
    const {
      name,
      email,
      password,
      practiceName,
      practiceType,
      isClinicalApprover,
      phone,
      address,
      teamMembers,
      invitationToken,
      ipAddress,
      userAgent,
    } = params;

    const normalizedEmail = email.toLowerCase().trim();

    // 1. Password strength validation
    const strength = PasswordService.validatePasswordStrength(password);
    if (!strength.isValid) {
      throw new AppError(400, 'WEAK_PASSWORD', strength.message || 'Password does not meet requirements.');
    }

    // 2. Check if user with normalized email exists
    const existing = await prisma.user.findUnique({
      where: { normalizedEmail },
    });

    if (existing) {
      throw new AppError(
        409,
        'EMAIL_ALREADY_EXISTS',
        'An account with this email address already exists. Please sign in instead.'
      );
    }

    // Check invitation if token provided
    let invitation: any = null;
    if (invitationToken) {
      const tokenHash = InvitationService.hashToken(invitationToken);
      const dbInv = await prisma.practiceInvitation.findUnique({
        where: { tokenHash },
        include: {
          practice: {
            include: {
              settings: true,
            },
          },
        },
      });

      if (!dbInv) {
        throw new AppError(404, 'INVITATION_NOT_FOUND', 'Invitation not found or invalid.');
      }
      if (dbInv.status === InvitationStatus.ACCEPTED) {
        throw new AppError(409, 'INVITATION_ALREADY_ACCEPTED', 'This invitation has already been accepted.');
      }
      if (dbInv.status === InvitationStatus.REVOKED) {
        throw new AppError(400, 'INVITATION_REVOKED', 'This invitation has been revoked.');
      }
      if (dbInv.status === InvitationStatus.EXPIRED || new Date() > new Date(dbInv.expiresAt)) {
        throw new AppError(400, 'INVITATION_EXPIRED', 'This invitation has expired.');
      }
      if (normalizedEmail !== dbInv.email.toLowerCase()) {
        throw new AppError(
          403,
          'INVITATION_EMAIL_MISMATCH',
          `Invitation was issued for ${dbInv.email}, but registration email is ${email}.`
        );
      }
      await EntitlementService.assertCanAddSeat(dbInv.practiceId, dbInv.role);
      invitation = dbInv;
    }

    // 3. Hash password
    const passwordHash = await PasswordService.hashPassword(password);
    const defaultPracticeName = (practiceName && practiceName.trim()) || `${name.trim()}'s Practice`;

    // 4. Atomic Prisma transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create User
      const user = await tx.user.create({
        data: {
          email,
          normalizedEmail,
          name: name.trim(),
          passwordHash,
          emailVerified: false,
        },
      });

      // Create AuthIdentity
      await tx.authIdentity.create({
        data: {
          userId: user.id,
          provider: 'password',
          providerUserId: normalizedEmail,
          providerEmail: email,
        },
      });

      if (invitation) {
        // Mark invitation consumed
        await tx.practiceInvitation.update({
          where: { id: invitation.id },
          data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
        });

        // Create Practice Membership in INVITING practice directly
        const membership = await tx.practiceMember.create({
          data: {
            practiceId: invitation.practiceId,
            userId: user.id,
            role: invitation.role,
            isClinicalApprover: invitation.role === Role.VETERINARIAN,
            isActive: true,
          },
        });

        return {
          user,
          practice: invitation.practice,
          membership,
          settings: invitation.practice.settings,
          isInvitation: true,
          invitationId: invitation.id,
        };
      } else {
        // Create Practice (Tenant boundary)
        const practice = await tx.practice.create({
          data: {
            name: defaultPracticeName,
            ownerUserId: user.id,
          },
        });

        // For Independent Practitioner, automatically designate as clinical veterinarian (consumes 1 seat).
        // For Veterinary Clinic, use explicit designation (default false unless requested).
        const clinicalApproverDesignation =
          practiceType === 'INDEPENDENT'
            ? true
            : Boolean(isClinicalApprover);

        // Create Practice Membership as PRACTICE_OWNER
        const membership = await tx.practiceMember.create({
          data: {
            practiceId: practice.id,
            userId: user.id,
            role: Role.PRACTICE_OWNER,
            isClinicalApprover: clinicalApproverDesignation,
          },
        });

        // Create Practice Settings
        const settings = await tx.practiceSettings.create({
          data: {
            practiceId: practice.id,
            clinicName: defaultPracticeName,
            doctorName: user.name,
            email: user.email,
            phone: phone || null,
            address: address || null,
          },
        });

        // Initialize 14-day commercial trial
        await SubscriptionService.initializePracticeTrial(practice.id, { tx });

        return { user, practice, membership, settings, isInvitation: false };
      }
    });

    // 5. Create Session with explicit practiceId
    const token = await SessionService.createSession({
      userId: result.user.id,
      practiceId: result.practice.id,
      ipAddress,
      userAgent,
    });

    // 5.5 If teamMembers provided during clinic onboarding, send invitations
    if (!result.isInvitation && teamMembers && Array.isArray(teamMembers) && teamMembers.length > 0) {
      for (const member of teamMembers) {
        if (member.email && member.role) {
          try {
            await InvitationService.createInvitation(
              result.user.id,
              result.practice.id,
              member.email,
              member.role as Role
            );
          } catch (err: any) {
            console.warn(`[Onboarding] Failed to invite team member ${member.email}:`, err?.message || err);
          }
        }
      }
    }

    // 6. Record audit log asynchronously
    if (result.isInvitation) {
      void AuditService.record({
        practiceId: result.practice.id,
        userId: result.user.id,
        action: 'INVITATION_ACCEPTED',
        resource: 'PracticeMember',
        resourceId: result.membership.id,
        details: { invitationId: (result as any).invitationId, role: result.membership.role },
        ipAddress,
        userAgent,
      });
    }
    void AuditService.record({
      practiceId: result.practice.id,
      userId: result.user.id,
      action: 'USER_REGISTERED',
      resource: 'User',
      resourceId: result.user.id,
      details: { email: result.user.email, practiceName: result.practice.name },
      ipAddress,
      userAgent,
    });

    return {
      token,
      data: {
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          avatarUrl: result.user.avatarUrl,
          emailVerified: result.user.emailVerified,
          createdAt: result.user.createdAt.toISOString(),
        },
        practice: {
          id: result.practice.id,
          name: result.practice.name,
          slug: result.practice.slug,
          ownerUserId: result.practice.ownerUserId,
          isActive: result.practice.isActive,
          createdAt: result.practice.createdAt.toISOString(),
        },
        membership: {
          id: result.membership.id,
          practiceId: result.membership.practiceId,
          userId: result.membership.userId,
          role: result.membership.role,
          isClinicalApprover: Boolean(result.membership.isClinicalApprover || result.membership.role === Role.VETERINARIAN),
          isActive: result.membership.isActive,
          permissions: getPermissionsForRole(result.membership.role),
        },
        permissions: getPermissionsForRole(result.membership.role),
        practices: [
          {
            practiceId: result.practice.id,
            practiceName: result.practice.name,
            role: result.membership.role as any,
            isClinicalApprover: Boolean(result.membership.isClinicalApprover || result.membership.role === Role.VETERINARIAN),
            isCurrent: true,
          },
        ],
        settings: {
          id: result.settings.id,
          practiceId: result.settings.practiceId,
          clinicName: result.settings.clinicName,
          address: result.settings.address,
          phone: result.settings.phone,
          email: result.settings.email,
          registrationNumber: result.settings.registrationNumber,
          doctorName: result.settings.doctorName,
          doctorRegistrationNumber: result.settings.doctorRegistrationNumber,
          doctorPhotoUrl: result.settings.doctorPhotoUrl,
          doctorSignatureUrl: result.settings.doctorSignatureUrl,
          clinicLogoUrl: result.settings.clinicLogoUrl,
          ownerSpecialInstructionEnabled: result.settings.ownerSpecialInstructionEnabled,
          mykgvoaMemberId: result.settings.mykgvoaMemberId,
        },
      },
    };
  }

  /**
   * Logs in a user with Email and Password.
   */
  static async loginWithPassword(params: {
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ token: string; data: AuthMeResponse }> {
    const { email, password, ipAddress, userAgent } = params;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await prisma.user.findUnique({
      where: { normalizedEmail },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            practice: {
              include: {
                settings: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user || !user.passwordHash) {
      // Generic message to prevent email enumeration
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    if (!user.isActive) {
      throw new AppError(403, 'ACCOUNT_INACTIVE', 'This account has been deactivated. Please contact support.');
    }

    const isMatch = await PasswordService.verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    // Update lastLoginAt
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Resolve primary practice & membership
    const primaryMembership = user.memberships[0];
    if (!primaryMembership || !primaryMembership.practice) {
      throw new AppError(403, 'NO_ACTIVE_PRACTICE', 'No active practice associated with this account.');
    }

    const practice = primaryMembership.practice;
    const settings = practice.settings;

    const token = await SessionService.createSession({
      userId: user.id,
      practiceId: practice.id,
      ipAddress,
      userAgent,
    });
    // Record audit log asynchronously
    void AuditService.record({
      practiceId: practice.id,
      userId: user.id,
      action: 'USER_LOGGED_IN',
      resource: 'Session',
      details: { email: user.email },
      ipAddress,
      userAgent,
    });

    return {
      token,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt.toISOString(),
        },
        practice: {
          id: practice.id,
          name: practice.name,
          slug: practice.slug,
          ownerUserId: practice.ownerUserId,
          isActive: practice.isActive,
          createdAt: practice.createdAt.toISOString(),
        },
        membership: {
          id: primaryMembership.id,
          practiceId: primaryMembership.practiceId,
          userId: primaryMembership.userId,
          role: primaryMembership.role,
          isActive: primaryMembership.isActive,
          permissions: getPermissionsForRole(primaryMembership.role),
        },
        permissions: getPermissionsForRole(primaryMembership.role),
        settings: settings
          ? {
              id: settings.id,
              practiceId: settings.practiceId,
              clinicName: settings.clinicName,
              address: settings.address,
              phone: settings.phone,
              email: settings.email,
              registrationNumber: settings.registrationNumber,
              doctorName: settings.doctorName,
              doctorRegistrationNumber: settings.doctorRegistrationNumber,
              doctorPhotoUrl: settings.doctorPhotoUrl,
              doctorSignatureUrl: settings.doctorSignatureUrl,
              clinicLogoUrl: settings.clinicLogoUrl,
              ownerSpecialInstructionEnabled: settings.ownerSpecialInstructionEnabled,
              mykgvoaMemberId: settings.mykgvoaMemberId,
            }
          : null,
      },
    };
  }

  /**
   * Handles OAuth identity authentication (Google).
   * Supports deterministic account linking for verified matching emails.
   */
  static async handleOAuthIdentity(
    identity: AuthenticatedIdentity,
    meta: {
      ipAddress?: string;
      userAgent?: string;
      action?: 'login' | 'link';
      linkingUserId?: string;
      invitationToken?: string;
    }
  ): Promise<{ token: string; user: SafeUserDTO }> {
    // 1. Check if AuthIdentity already exists for provider + providerUserId
    const existingIdentity = await prisma.authIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: identity.provider,
          providerUserId: identity.providerUserId,
        },
      },
      include: {
        user: true,
      },
    });

    // Handle Explicit Linking Flow from authenticated user session
    if (meta.linkingUserId) {
      if (existingIdentity) {
        if (existingIdentity.userId === meta.linkingUserId) {
          // Already linked to this exact user
          const token = await SessionService.createSession({
            userId: existingIdentity.userId,
            ipAddress: meta.ipAddress,
            userAgent: meta.userAgent,
          });
          return {
            token,
            user: {
              id: existingIdentity.user.id,
              email: existingIdentity.user.email,
              name: existingIdentity.user.name,
              avatarUrl: existingIdentity.user.avatarUrl,
              emailVerified: existingIdentity.user.emailVerified,
              createdAt: existingIdentity.user.createdAt.toISOString(),
            },
          };
        }
        // Linked to a DIFFERENT user
        throw new AppError(
          409,
          'GOOGLE_ALREADY_LINKED_TO_OTHER',
          'This Google account is already linked to another VetRx user account.'
        );
      }

      // Link to the authenticated user
      await prisma.authIdentity.create({
        data: {
          userId: meta.linkingUserId,
          provider: identity.provider,
          providerUserId: identity.providerUserId,
          providerEmail: identity.email,
        },
      });

      void AuditService.record({
        userId: meta.linkingUserId,
        action: 'GOOGLE_IDENTITY_LINKED',
        resource: 'AuthIdentity',
        details: { email: identity.email, provider: 'google', sub: identity.providerUserId },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      const user = await prisma.user.findUniqueOrThrow({ where: { id: meta.linkingUserId } });
      const token = await SessionService.createSession({
        userId: user.id,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt.toISOString(),
        },
      };
    }

    const normalizedEmail = identity.email.toLowerCase().trim();

    // Check if invitation token is present and valid
    let oauthInvitation: any = null;
    if (meta.invitationToken) {
      const tokenHash = InvitationService.hashToken(meta.invitationToken);
      const dbInv = await prisma.practiceInvitation.findUnique({
        where: { tokenHash },
        include: { practice: { include: { settings: true } } },
      });
      if (
        dbInv &&
        dbInv.status === InvitationStatus.PENDING &&
        new Date() <= new Date(dbInv.expiresAt) &&
        dbInv.email.toLowerCase() === normalizedEmail
      ) {
        oauthInvitation = dbInv;
      }
    }

    // CASE B: Existing Google Identity Match
    if (existingIdentity) {
      if (!existingIdentity.user.isActive) {
        throw new AppError(403, 'ACCOUNT_INACTIVE', 'This account has been deactivated.');
      }

      await prisma.user.update({
        where: { id: existingIdentity.userId },
        data: { lastLoginAt: new Date() },
      });

      let practiceId = oauthInvitation?.practiceId || null;
      if (oauthInvitation) {
        await prisma.practiceInvitation.update({
          where: { id: oauthInvitation.id },
          data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
        });
        await prisma.practiceMember.upsert({
          where: {
            practiceId_userId: {
              practiceId: oauthInvitation.practiceId,
              userId: existingIdentity.userId,
            },
          },
          create: {
            practiceId: oauthInvitation.practiceId,
            userId: existingIdentity.userId,
            role: oauthInvitation.role,
            isActive: true,
          },
          update: {
            role: oauthInvitation.role,
            isActive: true,
          },
        });
      } else {
        const mem = await prisma.practiceMember.findFirst({
          where: { userId: existingIdentity.userId, isActive: true },
        });
        practiceId = mem?.practiceId || null;
      }

      const token = await SessionService.createSession({
        userId: existingIdentity.userId,
        practiceId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      void AuditService.record({
        userId: existingIdentity.userId,
        action: 'GOOGLE_LOGIN_SUCCESS',
        resource: 'Session',
        details: { email: existingIdentity.user.email },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return {
        token,
        user: {
          id: existingIdentity.user.id,
          email: existingIdentity.user.email,
          name: existingIdentity.user.name,
          avatarUrl: existingIdentity.user.avatarUrl,
          emailVerified: existingIdentity.user.emailVerified,
          createdAt: existingIdentity.user.createdAt.toISOString(),
        },
      };
    }

    // 2. Identity does not exist: check if email is already taken by an existing account
    const existingUser = await prisma.user.findUnique({
      where: { normalizedEmail },
      include: {
        authIdentities: true,
      },
    });

    if (existingUser) {
      if (!existingUser.isActive) {
        throw new AppError(403, 'ACCOUNT_INACTIVE', 'This account has been deactivated.');
      }

      // CASE D: Unsafe / Unverified email match -> DO NOT silently merge!
      if (!identity.emailVerified) {
        throw new AppError(
          409,
          'UNVERIFIED_OAUTH_EMAIL',
          'Google reports this email is not verified. Please sign in with your email and password to link accounts.'
        );
      }

      // CASE A: Existing password account with matching verified Google email -> Link Google identity!
      const hasGoogleIdentity = existingUser.authIdentities.some((i) => i.provider === 'google');
      if (hasGoogleIdentity) {
        throw new AppError(
          409,
          'GOOGLE_IDENTITY_ALREADY_LINKED',
          'This VetRx account is already linked to a different Google account.'
        );
      }

      await prisma.$transaction(async (tx) => {
        await tx.authIdentity.create({
          data: {
            userId: existingUser.id,
            provider: identity.provider,
            providerUserId: identity.providerUserId,
            providerEmail: identity.email,
          },
        });

        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            emailVerified: true,
            lastLoginAt: new Date(),
          },
        });
      });

      let practiceId = oauthInvitation?.practiceId || null;
      if (oauthInvitation) {
        await prisma.practiceInvitation.update({
          where: { id: oauthInvitation.id },
          data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
        });
        await prisma.practiceMember.upsert({
          where: {
            practiceId_userId: {
              practiceId: oauthInvitation.practiceId,
              userId: existingUser.id,
            },
          },
          create: {
            practiceId: oauthInvitation.practiceId,
            userId: existingUser.id,
            role: oauthInvitation.role,
            isActive: true,
          },
          update: {
            role: oauthInvitation.role,
            isActive: true,
          },
        });
      } else {
        const mem = await prisma.practiceMember.findFirst({
          where: { userId: existingUser.id, isActive: true },
        });
        practiceId = mem?.practiceId || null;
      }

      void AuditService.record({
        userId: existingUser.id,
        action: 'GOOGLE_IDENTITY_LINKED',
        resource: 'AuthIdentity',
        details: { email: existingUser.email, provider: 'google', sub: identity.providerUserId },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      void AuditService.record({
        userId: existingUser.id,
        action: 'GOOGLE_LOGIN_SUCCESS',
        resource: 'Session',
        details: { email: existingUser.email },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      const token = await SessionService.createSession({
        userId: existingUser.id,
        practiceId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return {
        token,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          avatarUrl: existingUser.avatarUrl,
          emailVerified: true,
          createdAt: existingUser.createdAt.toISOString(),
        },
      };
    }

    // CASE C: Completely new user registration via Google OAuth (atomic transaction)
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: identity.email,
          normalizedEmail,
          name: identity.name,
          avatarUrl: identity.avatarUrl || null,
          emailVerified: identity.emailVerified,
          passwordHash: null,
        },
      });

      await tx.authIdentity.create({
        data: {
          userId: user.id,
          provider: identity.provider,
          providerUserId: identity.providerUserId,
          providerEmail: identity.email,
        },
      });

      if (oauthInvitation) {
        // Mark invitation accepted
        await tx.practiceInvitation.update({
          where: { id: oauthInvitation.id },
          data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
        });

        // Add directly as member of inviting practice
        const membership = await tx.practiceMember.create({
          data: {
            practiceId: oauthInvitation.practiceId,
            userId: user.id,
            role: oauthInvitation.role,
            isActive: true,
          },
        });

        return {
          user,
          practiceId: oauthInvitation.practiceId,
          membershipId: membership.id,
          isInvitation: true,
        };
      } else {
        const practice = await tx.practice.create({
          data: {
            name: `${user.name}'s Practice`,
            ownerUserId: user.id,
          },
        });

        await tx.practiceMember.create({
          data: {
            practiceId: practice.id,
            userId: user.id,
            role: Role.PRACTICE_OWNER,
          },
        });

        await tx.practiceSettings.create({
          data: {
            practiceId: practice.id,
            doctorName: user.name,
            email: user.email,
          },
        });

        // Initialize 14-day commercial trial
        await SubscriptionService.initializePracticeTrial(practice.id, { tx });

        return { user, practiceId: practice.id, isInvitation: false };
      }
    });

    if (result.isInvitation) {
      void AuditService.record({
        practiceId: result.practiceId,
        userId: result.user.id,
        action: 'INVITATION_ACCEPTED',
        resource: 'PracticeMember',
        resourceId: (result as any).membershipId,
        details: { invitationId: oauthInvitation.id, role: oauthInvitation.role },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
    }

    void AuditService.record({
      userId: result.user.id,
      action: 'USER_REGISTERED_GOOGLE',
      resource: 'User',
      details: { email: result.user.email },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const token = await SessionService.createSession({
      userId: result.user.id,
      practiceId: result.practiceId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      token,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        avatarUrl: result.user.avatarUrl,
        emailVerified: result.user.emailVerified,
        createdAt: result.user.createdAt.toISOString(),
      },
    };
  }

  /**
   * Retrieves security and identity provider connection status for a user.
   */
  static async getUserIdentities(userId: string): Promise<{
    userId: string;
    email: string;
    hasPassword: boolean;
    hasGoogle: boolean;
    googleEmail: string | null;
    identities: Array<{
      id: string;
      provider: string;
      providerEmail: string | null;
      createdAt: string;
    }>;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { authIdentities: true },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    const googleIdentity = user.authIdentities.find((i) => i.provider === 'google');

    return {
      userId: user.id,
      email: user.email,
      hasPassword: Boolean(user.passwordHash),
      hasGoogle: Boolean(googleIdentity),
      googleEmail: googleIdentity?.providerEmail || null,
      identities: user.authIdentities.map((i) => ({
        id: i.id,
        provider: i.provider,
        providerEmail: i.providerEmail,
        createdAt: i.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Sets initial password for a user who registered via OAuth only.
   */
  static async setPassword(userId: string, newPassword: string): Promise<void> {
    const strength = PasswordService.validatePasswordStrength(newPassword);
    if (!strength.isValid) {
      throw new AppError(400, 'WEAK_PASSWORD', strength.message || 'Password does not meet requirements.');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { authIdentities: true },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    if (user.passwordHash) {
      throw new AppError(
        400,
        'PASSWORD_ALREADY_SET',
        'A password is already configured for this account. Use change password instead.'
      );
    }

    const passwordHash = await PasswordService.hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });

      const hasPasswordIdentity = user.authIdentities.some((i) => i.provider === 'password');
      if (!hasPasswordIdentity) {
        await tx.authIdentity.create({
          data: {
            userId: user.id,
            provider: 'password',
            providerUserId: user.normalizedEmail,
            providerEmail: user.email,
          },
        });
      }
    });

    void AuditService.record({
      userId: user.id,
      action: 'PASSWORD_CONFIGURED',
      resource: 'User',
      details: { email: user.email },
    });
  }

  /**
   * Changes existing password after verifying the current password.
   */
  static async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.passwordHash) {
      throw new AppError(400, 'NO_PASSWORD_SET', 'No password is currently configured for this account.');
    }

    const isMatch = await PasswordService.verifyPassword(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new AppError(401, 'INVALID_CURRENT_PASSWORD', 'The current password you entered is incorrect.');
    }

    const strength = PasswordService.validatePasswordStrength(newPassword);
    if (!strength.isValid) {
      throw new AppError(400, 'WEAK_PASSWORD', strength.message || 'New password does not meet requirements.');
    }

    const passwordHash = await PasswordService.hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    void AuditService.record({
      userId: user.id,
      action: 'PASSWORD_CHANGED',
      resource: 'User',
      details: { email: user.email },
    });
  }

  /**
   * Safely disconnects Google OAuth identity from user account.
   * Requires that an account password exists to prevent total account lockout.
   */
  static async unlinkGoogleIdentity(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { authIdentities: true },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    if (!user.passwordHash) {
      throw new AppError(
        400,
        'CANNOT_UNLINK_PRIMARY_AUTH',
        'You must set an account password before disconnecting Google to prevent losing access.'
      );
    }

    const googleIdentity = user.authIdentities.find((i) => i.provider === 'google');
    if (!googleIdentity) {
      throw new AppError(404, 'IDENTITY_NOT_FOUND', 'No Google account is currently linked to this user.');
    }

    await prisma.authIdentity.delete({
      where: { id: googleIdentity.id },
    });

    void AuditService.record({
      userId: user.id,
      action: 'GOOGLE_IDENTITY_UNLINKED',
      resource: 'AuthIdentity',
      details: { email: user.email, provider: 'google' },
    });
  }

  /**
   * Retrieves full context for the authenticated user and their active practice.
   */
  static async getMeContext(
    userId: string,
    activePracticeId?: string | null,
    sessionId?: string | null
  ): Promise<AuthMeResponse> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            practice: {
              include: {
                settings: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User record not found.');
    }

    // Resolve membership by authoritative session.practiceId if available
    let membership = null;
    if (activePracticeId) {
      membership = user.memberships.find(
        (m) => m.practiceId === activePracticeId && m.isActive && m.practice?.isActive
      );
    }

    // Fallback if session had no practiceId or practiceId was deactivated
    if (!membership) {
      membership = user.memberships.find((m) => m.isActive && m.practice?.isActive);
      if (membership && sessionId) {
        prisma.session
          .update({
            where: { id: sessionId },
            data: { practiceId: membership.practiceId },
          })
          .catch((err) => console.warn('Failed to backfill session practiceId in getMeContext:', err));
      }
    }

    if (!membership || !membership.practice) {
      throw new AppError(403, 'NO_ACTIVE_PRACTICE', 'No active practice membership found.');
    }

    const practice = membership.practice;
    const settings = practice.settings;
    const permissions = await AuthorizationService.getEffectivePermissions(user.id, practice.id);

    const practices = user.memberships
      .filter((m) => m.isActive && m.practice?.isActive)
      .map((m) => ({
        practiceId: m.practiceId,
        practiceName: m.practice.name,
        role: m.role as any,
        isClinicalApprover: Boolean(m.isClinicalApprover || m.role === Role.VETERINARIAN),
        isCurrent: m.practiceId === practice.id,
      }));

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        platformRole: user.platformRole as any,
        createdAt: user.createdAt.toISOString(),
      },
      practice: {
        id: practice.id,
        name: practice.name,
        slug: practice.slug,
        ownerUserId: practice.ownerUserId,
        isActive: practice.isActive,
        createdAt: practice.createdAt.toISOString(),
      },
      membership: {
        id: membership.id,
        practiceId: membership.practiceId,
        userId: membership.userId,
        role: membership.role,
        isClinicalApprover: Boolean(membership.isClinicalApprover || membership.role === Role.VETERINARIAN),
        isActive: membership.isActive,
        permissions,
      },
      permissions,
      practices,
      settings: settings
        ? {
            id: settings.id,
            practiceId: settings.practiceId,
            clinicName: settings.clinicName,
            address: settings.address,
            phone: settings.phone,
            email: settings.email,
            registrationNumber: settings.registrationNumber,
            doctorName: settings.doctorName,
            doctorRegistrationNumber: settings.doctorRegistrationNumber,
            doctorPhotoUrl: settings.doctorPhotoUrl,
            doctorSignatureUrl: settings.doctorSignatureUrl,
            clinicLogoUrl: settings.clinicLogoUrl,
            ownerSpecialInstructionEnabled: settings.ownerSpecialInstructionEnabled,
            mykgvoaMemberId: settings.mykgvoaMemberId,
          }
        : null,
    };
  }
}
