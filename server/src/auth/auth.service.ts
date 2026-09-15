import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { PasswordService } from '../lib/password.js';
import { AuditService } from '../lib/audit.service.js';
import { SessionService } from './session.service.js';
import { AppError } from '../middleware/errorHandler.js';
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
    ipAddress?: string;
    userAgent?: string;
  }): Promise<{ token: string; data: AuthMeResponse }> {
    const { name, email, password, practiceName, ipAddress, userAgent } = params;

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

      // Create Practice (Tenant boundary)
      const practice = await tx.practice.create({
        data: {
          name: defaultPracticeName,
          ownerUserId: user.id,
        },
      });

      // Create Practice Membership as PRACTICE_OWNER
      const membership = await tx.practiceMember.create({
        data: {
          practiceId: practice.id,
          userId: user.id,
          role: Role.PRACTICE_OWNER,
        },
      });

      // Create Practice Settings
      const settings = await tx.practiceSettings.create({
        data: {
          practiceId: practice.id,
          doctorName: user.name,
          email: user.email,
        },
      });

      return { user, practice, membership, settings };
    });

    // 5. Create Session
    const token = await SessionService.createSession({
      userId: result.user.id,
      ipAddress,
      userAgent,
    });
    // 6. Record audit log asynchronously
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
          isActive: result.membership.isActive,
        },
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
        },
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
   * Does NOT automatically merge existing password accounts on email collision.
   */
  static async handleOAuthIdentity(
    identity: AuthenticatedIdentity,
    meta: { ipAddress?: string; userAgent?: string }
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

    if (existingIdentity) {
      if (!existingIdentity.user.isActive) {
        throw new AppError(403, 'ACCOUNT_INACTIVE', 'This account has been deactivated.');
      }

      await prisma.user.update({
        where: { id: existingIdentity.userId },
        data: { lastLoginAt: new Date() },
      });

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

    // 2. Identity does not exist: check if email is already taken by another account
    const normalizedEmail = identity.email.toLowerCase().trim();
    const existingUser = await prisma.user.findUnique({
      where: { normalizedEmail },
    });

    if (existingUser) {
      // SECURITY RULE: Do not automatically merge accounts based on email alone.
      throw new AppError(
        409,
        'ACCOUNT_COLLISION',
        'An account with this email address already exists. Please sign in with your email and password to link your Google account.'
      );
    }

    // 3. New user registration via Google OAuth (atomic transaction)
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

      return user;
    });

    const token = await SessionService.createSession({
      userId: result.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      token,
      user: {
        id: result.id,
        email: result.email,
        name: result.name,
        avatarUrl: result.avatarUrl,
        emailVerified: result.emailVerified,
        createdAt: result.createdAt.toISOString(),
      },
    };
  }

  /**
   * Retrieves full context for the authenticated user and their active practice.
   */
  static async getMeContext(userId: string): Promise<AuthMeResponse> {
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
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User record not found.');
    }

    const membership = user.memberships[0];
    if (!membership || !membership.practice) {
      throw new AppError(403, 'NO_ACTIVE_PRACTICE', 'No active practice membership found.');
    }

    const practice = membership.practice;
    const settings = practice.settings;

    return {
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
        id: membership.id,
        practiceId: membership.practiceId,
        userId: membership.userId,
        role: membership.role,
        isActive: membership.isActive,
      },
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
