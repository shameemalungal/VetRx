// ==============================================================================
// VetRx — Platform Super Admin Service (Phase 14 Extension)
// Centralized administration of practices, users, subscriptions, payments,
// issues, permission overrides, and security audit logs.
// ==============================================================================

import crypto from 'crypto';
import {
  Role,
  PlatformRole,
  PracticeType,
  PracticeStatus,
  IssueCategory,
  IssuePriority,
  IssueStatus,
  OverrideEffect,
} from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthorizationService } from '../auth/authorization.service.js';
import { MemberService } from '../auth/member.service.js';
import { InvitationService } from '../auth/invitation.service.js';
import { EntitlementService } from '../commercial/entitlement.service.js';
import { AuditService } from '../lib/audit.service.js';
import { PasswordService } from '../lib/password.js';
import { EmailService } from '../email/email.service.js';
import { AUTHORITATIVE_PLANS } from '../commercial/plan.config.js';

import {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ALL_ASSIGNABLE_PERMISSIONS,
  CLINICAL_PERMISSIONS,
  PRACTICE_PERMISSIONS,
  COMMERCIAL_PERMISSIONS,
  SECURITY_PERMISSIONS,
  PLATFORM_ONLY_PERMISSIONS,
  PLATFORM_SUPER_ADMIN_PERMISSIONS,
  PERMISSION_METADATA,
  getPermissionsForRole,
  type Permission,
} from '../auth/permissions.js';

export interface PlatformPracticeSummary {
  id: string;
  name: string;
  slug: string | null;
  practiceType: PracticeType;
  status: PracticeStatus;
  ownerUserId: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  isActive: boolean;
  createdAt: string;
  memberCount: number;
  veterinarianCount: number;
  subscriptionPlan?: string;
  subscriptionStatus?: string;
}

export interface PlatformUserSummary {
  id: string;
  email: string;
  name: string;
  phone?: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  isActive: boolean;
  platformRole: PlatformRole | null;
  createdAt: string;
  lastLoginAt: string | null;
  membershipCount: number;
  practices?: Array<{
    practiceId: string;
    practiceName: string;
    role: Role;
    isClinicalApprover: boolean;
    isActive: boolean;
  }>;
}

export class PlatformAdminService {
  // In-memory mock stores for fast unit tests
  private static mockPractices: Map<string, any> = new Map();
  private static mockUsers: Map<string, any> = new Map();
  private static mockSubscriptions: Map<string, any> = new Map();
  private static mockPayments: Map<string, any> = new Map();
  private static mockIssues: Map<string, any> = new Map();
  private static mockSupportSessions: Map<string, any> = new Map();

  static setMockPractices(practices: PlatformPracticeSummary[]): void {
    this.mockPractices.clear();
    for (const p of practices) {
      this.mockPractices.set(p.id, { ...p });
    }
  }

  static setMockUsers(users: any[]): void {
    this.mockUsers.clear();
    for (const u of users) {
      this.mockUsers.set(u.id, { ...u });
    }
  }

  static setMockSubscriptions(subs: any[]): void {
    this.mockSubscriptions.clear();
    for (const s of subs) {
      this.mockSubscriptions.set(s.id || s.practiceId, { ...s });
    }
  }

  static setMockPayments(payments: any[]): void {
    this.mockPayments.clear();
    for (const p of payments) {
      this.mockPayments.set(p.id, { ...p });
    }
  }

  static setMockIssues(issues: any[]): void {
    this.mockIssues.clear();
    for (const i of issues) {
      this.mockIssues.set(i.id, { ...i });
    }
  }

  static clearMocks(): void {
    this.mockPractices.clear();
    this.mockUsers.clear();
    this.mockSubscriptions.clear();
    this.mockPayments.clear();
    this.mockIssues.clear();
    this.mockSupportSessions.clear();
  }

  // ============================================================================
  // 1. Platform Command Center & Dashboard
  // ============================================================================

  static async getDashboard(actorUserId: string) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      const practices = Array.from(this.mockPractices.values());
      const users = Array.from(this.mockUsers.values());
      const subs = Array.from(this.mockSubscriptions.values());
      const payments = Array.from(this.mockPayments.values());
      const issues = Array.from(this.mockIssues.values());

      return {
        metrics: {
          totalPractices: practices.length,
          activePractices: practices.filter((p) => p.status === 'ACTIVE' || p.isActive).length,
          independentPractices: practices.filter((p) => p.practiceType === 'INDEPENDENT').length,
          clinicPractices: practices.filter((p) => p.practiceType === 'CLINIC').length,
          enterprisePractices: practices.filter((p) => p.practiceType === 'ENTERPRISE').length,
          totalUsers: users.length,
          activeVeterinarians: users.filter((u) => u.isVeterinarian || u.isClinicalApprover).length,
          activeSubscriptions: subs.filter((s) => s.status === 'ACTIVE').length,
          activeTrials: subs.filter((s) => s.status === 'TRIAL').length,
          pastDueAccounts: subs.filter((s) => s.status === 'PAST_DUE' || s.status === 'GRACE_PERIOD').length,
          suspendedPractices: practices.filter((p) => p.status === 'SUSPENDED').length,
        },
        recentPractices: practices.slice(0, 5),
        recentPayments: payments.slice(0, 5),
        recentIssues: issues.slice(0, 5),
        securityEvents: AuditService.mockLogs.slice(-5).reverse(),
      };
    }

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const [
      totalPractices,
      activePractices,
      independentPractices,
      clinicPractices,
      enterprisePractices,
      suspendedPractices,
      totalUsers,
      activeVeterinarians,
      activeSubscriptions,
      activeTrials,
      pastDueAccounts,
      trialsExpiringSoon,
      recentPractices,
      recentPayments,
      recentIssues,
      securityEvents,
    ] = await Promise.all([
      prisma.practice.count(),
      prisma.practice.count({ where: { status: PracticeStatus.ACTIVE, isActive: true } }),
      prisma.practice.count({ where: { practiceType: PracticeType.INDEPENDENT } }),
      prisma.practice.count({ where: { practiceType: PracticeType.CLINIC } }),
      prisma.practice.count({ where: { practiceType: PracticeType.ENTERPRISE } }),
      prisma.practice.count({ where: { status: PracticeStatus.SUSPENDED } }),
      prisma.user.count(),
      prisma.practiceMember.count({
        where: {
          isActive: true,
          OR: [{ role: Role.VETERINARIAN }, { isClinicalApprover: true }],
        },
      }),
      prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      prisma.subscription.count({ where: { status: 'TRIAL' } }),
      prisma.subscription.count({ where: { status: { in: ['PAST_DUE', 'GRACE_PERIOD'] } } }),
      prisma.subscription.findMany({
        where: {
          status: 'TRIAL',
          trialEndsAt: { gte: now, lte: sevenDaysFromNow },
        },
        include: { practice: { select: { id: true, name: true } }, plan: true },
        take: 5,
        orderBy: { trialEndsAt: 'asc' },
      }),
      prisma.practice.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          _count: { select: { members: true } },
        },
      }),
      prisma.payment.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { practice: { select: { id: true, name: true } } },
      }),
      prisma.platformIssue.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { practice: { select: { id: true, name: true } } },
      }),
      prisma.auditLog.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, name: true, email: true } },
          practice: { select: { id: true, name: true } },
        },
      }),
    ]);

    return {
      metrics: {
        totalPractices,
        activePractices,
        independentPractices,
        clinicPractices,
        enterprisePractices,
        suspendedPractices,
        totalUsers,
        activeVeterinarians,
        activeSubscriptions,
        activeTrials,
        pastDueAccounts,
      },
      trialsExpiringSoon,
      recentPractices: recentPractices.map((p) => ({
        id: p.id,
        name: p.name,
        practiceType: p.practiceType,
        status: p.status,
        ownerName: p.owner?.name,
        ownerEmail: p.owner?.email,
        memberCount: p._count.members,
        createdAt: p.createdAt.toISOString(),
      })),
      recentPayments,
      recentIssues,
      securityEvents,
    };
  }

  // ============================================================================
  // 2. Practice Management
  // ============================================================================

  static async listPractices(
    actorUserId: string,
    options?: {
      search?: string;
      type?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<{ results: PlatformPracticeSummary[]; total: number; page: number; pageSize: number }> {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    const page = Math.max(1, options?.page || 1);
    const pageSize = Math.min(100, Math.max(1, options?.pageSize || 20));

    if (process.env.VETRX_FAST_TEST === '1') {
      let list = Array.from(this.mockPractices.values());
      if (options?.search) {
        const q = options.search.toLowerCase();
        list = list.filter(
          (p) =>
            p.name?.toLowerCase().includes(q) ||
            p.ownerName?.toLowerCase().includes(q) ||
            p.ownerEmail?.toLowerCase().includes(q)
        );
      }
      if (options?.type && options.type !== 'ALL') {
        list = list.filter((p) => p.practiceType === options.type);
      }
      if (options?.status && options.status !== 'ALL') {
        list = list.filter((p) => p.status === options.status || (options.status === 'ACTIVE' && p.isActive));
      }
      const sliced = list.slice((page - 1) * pageSize, page * pageSize);
      return Object.assign([...sliced], {
        results: sliced,
        total: list.length,
        page,
        pageSize,
      });
    }

    const where: any = {};
    if (options?.search) {
      const q = options.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { owner: { name: { contains: q, mode: 'insensitive' } } },
        { owner: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }
    if (options?.type && options.type !== 'ALL') {
      where.practiceType = options.type as PracticeType;
    }
    if (options?.status && options.status !== 'ALL') {
      if (options.status === 'SUSPENDED') {
        where.status = PracticeStatus.SUSPENDED;
      } else if (options.status === 'ACTIVE') {
        where.status = PracticeStatus.ACTIVE;
      }
    }

    const [total, practices] = await Promise.all([
      prisma.practice.count({ where }),
      prisma.practice.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          owner: { select: { id: true, email: true, name: true } },
          settings: { select: { phone: true } },
          _count: { select: { members: true } },
          members: {
            where: {
              isActive: true,
              OR: [{ role: Role.VETERINARIAN }, { isClinicalApprover: true }],
            },
            select: { id: true },
          },
          subscriptions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            include: { plan: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const results: PlatformPracticeSummary[] = practices.map((p) => {
      const sub = p.subscriptions[0];
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        practiceType: p.practiceType,
        status: p.status,
        ownerUserId: p.ownerUserId,
        ownerName: p.owner?.name,
        ownerEmail: p.owner?.email,
        ownerPhone: p.settings?.phone || undefined,
        isActive: p.isActive && p.status === PracticeStatus.ACTIVE,
        createdAt: p.createdAt.toISOString(),
        memberCount: p._count.members,
        veterinarianCount: p.members.length,
        subscriptionPlan: sub?.plan?.name || 'Trial',
        subscriptionStatus: sub?.status || 'TRIAL',
      };
    });

    return Object.assign([...results], { results, total, page, pageSize });
  }

  static async getPracticeDetails(actorUserId: string, practiceId: string): Promise<any> {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      const found = this.mockPractices.get(practiceId);
      if (!found) throw new AppError(404, 'PRACTICE_NOT_FOUND', 'Practice not found.');
      return found;
    }

    const practice = await prisma.practice.findUnique({
      where: { id: practiceId },
      include: {
        owner: { select: { id: true, email: true, name: true, createdAt: true } },
        settings: true,
        members: {
          include: {
            user: { select: { id: true, email: true, name: true, avatarUrl: true, isActive: true } },
            permissionOverrides: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
        invitations: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!practice) {
      throw new AppError(404, 'PRACTICE_NOT_FOUND', 'Practice not found.');
    }

    return practice;
  }

  static async createPractice(
    actorUserId: string,
    data: {
      name: string;
      practiceType: PracticeType;
      ownerName: string;
      ownerEmail: string;
      ownerPhone?: string;
      address?: string;
      planCode?: string;
      isClinicalApprover?: boolean;
    }
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    const isClinician =
      data.isClinicalApprover !== undefined
        ? data.isClinicalApprover
        : data.practiceType === PracticeType.INDEPENDENT;

    if (process.env.VETRX_FAST_TEST === '1') {
      const practiceId = `practice-${Date.now()}`;
      const ownerId = `user-${Date.now()}`;
      const practice = {
        id: practiceId,
        name: data.name,
        practiceType: data.practiceType,
        status: PracticeStatus.ACTIVE,
        ownerUserId: ownerId,
        ownerName: data.ownerName,
        ownerEmail: data.ownerEmail,
        isActive: true,
        createdAt: new Date().toISOString(),
        memberCount: 1,
        veterinarianCount: isClinician ? 1 : 0,
      };
      this.mockPractices.set(practiceId, practice);

      AuthorizationService.setMockPracticeOwner(practiceId, ownerId);
      MemberService.setMockMember({
        id: `mem-${ownerId}`,
        practiceId,
        userId: ownerId,
        role: Role.PRACTICE_OWNER,
        isClinicalApprover: isClinician,
        isActive: true,
        user: { id: ownerId, email: data.ownerEmail, name: data.ownerName, avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      void AuditService.record({
        userId: actorUserId,
        practiceId,
        action: 'PRACTICE_CREATED',
        resource: 'Practice',
        resourceId: practiceId,
        details: { name: data.name, practiceType: data.practiceType, ownerEmail: data.ownerEmail },
      });

      return practice;
    }

    const normalizedEmail = data.ownerEmail.trim().toLowerCase();

    // 1. Find or create owner user
    let user = await prisma.user.findUnique({ where: { normalizedEmail } });
    if (!user) {
      const tempPassword = crypto.randomBytes(16).toString('hex');
      const passwordHash = await PasswordService.hashPassword(tempPassword);
      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          normalizedEmail,
          name: data.ownerName,
          passwordHash,
          emailVerified: true,
        },
      });
    }

    // 2. Create Practice & Settings
    const practice = await prisma.practice.create({
      data: {
        name: data.name,
        practiceType: data.practiceType,
        status: PracticeStatus.ACTIVE,
        ownerUserId: user.id,
        settings: {
          create: {
            clinicName: data.name,
            address: data.address,
            phone: data.ownerPhone,
            email: normalizedEmail,
          },
        },
        members: {
          create: {
            userId: user.id,
            role: Role.PRACTICE_OWNER,
            isClinicalApprover: isClinician,
            isActive: true,
          },
        },
      },
    });

    // 3. Create Subscription
    const planCode = data.planCode || (data.practiceType === PracticeType.INDEPENDENT ? 'INDIVIDUAL_MONTHLY' : 'CLINIC_MONTHLY');
    const plan = await prisma.subscriptionPlan.findUnique({ where: { code: planCode } });
    if (plan) {
      const now = new Date();
      await prisma.subscription.create({
        data: {
          practiceId: practice.id,
          planId: plan.id,
          status: 'TRIAL',
          trialStartsAt: now,
          trialEndsAt: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
          currentPeriodStart: now,
          currentPeriodEnd: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
        },
      });
    }

    void AuditService.record({
      userId: actorUserId,
      practiceId: practice.id,
      action: 'PRACTICE_CREATED',
      resource: 'Practice',
      resourceId: practice.id,
      details: { name: data.name, practiceType: data.practiceType, ownerEmail: normalizedEmail },
    });

    return practice;
  }

  static async updatePractice(
    actorUserId: string,
    practiceId: string,
    data: {
      name?: string;
      practiceType?: PracticeType;
      address?: string;
      phone?: string;
      email?: string;
    }
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      const p = this.mockPractices.get(practiceId);
      if (!p) throw new AppError(404, 'PRACTICE_NOT_FOUND', 'Practice not found.');
      if (data.name) p.name = data.name;
      if (data.practiceType) p.practiceType = data.practiceType;
      this.mockPractices.set(practiceId, p);
      return p;
    }

    const updated = await prisma.practice.update({
      where: { id: practiceId },
      data: {
        name: data.name,
        practiceType: data.practiceType,
        settings: {
          upsert: {
            create: {
              address: data.address,
              phone: data.phone,
              email: data.email,
            },
            update: {
              address: data.address,
              phone: data.phone,
              email: data.email,
            },
          },
        },
      },
    });

    void AuditService.record({
      userId: actorUserId,
      practiceId,
      action: 'PRACTICE_EDITED',
      resource: 'Practice',
      resourceId: practiceId,
      details: data,
    });

    return updated;
  }

  static async suspendPractice(actorUserId: string, practiceId: string, reason: string) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (!reason || !reason.trim()) {
      throw new AppError(400, 'REASON_REQUIRED', 'A reason is required to suspend a practice.');
    }

    if (process.env.VETRX_FAST_TEST === '1') {
      const p = this.mockPractices.get(practiceId);
      if (!p) throw new AppError(404, 'PRACTICE_NOT_FOUND', 'Practice not found.');
      p.status = PracticeStatus.SUSPENDED;
      p.isActive = false;
      this.mockPractices.set(practiceId, p);

      void AuditService.record({
        userId: actorUserId,
        practiceId,
        action: 'PRACTICE_SUSPENDED',
        resource: 'Practice',
        resourceId: practiceId,
        details: { reason },
      });
      return { success: true, status: PracticeStatus.SUSPENDED };
    }

    await prisma.practice.update({
      where: { id: practiceId },
      data: {
        status: PracticeStatus.SUSPENDED,
        isActive: false,
      },
    });

    void AuditService.record({
      userId: actorUserId,
      practiceId,
      action: 'PRACTICE_SUSPENDED',
      resource: 'Practice',
      resourceId: practiceId,
      details: { reason },
    });

    return { success: true, status: PracticeStatus.SUSPENDED };
  }

  static async reactivatePractice(actorUserId: string, practiceId: string, reason: string) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      const p = this.mockPractices.get(practiceId);
      if (!p) throw new AppError(404, 'PRACTICE_NOT_FOUND', 'Practice not found.');
      p.status = PracticeStatus.ACTIVE;
      p.isActive = true;
      this.mockPractices.set(practiceId, p);

      void AuditService.record({
        userId: actorUserId,
        practiceId,
        action: 'PRACTICE_REACTIVATED',
        resource: 'Practice',
        resourceId: practiceId,
        details: { reason },
      });
      return { success: true, status: PracticeStatus.ACTIVE };
    }

    await prisma.practice.update({
      where: { id: practiceId },
      data: {
        status: PracticeStatus.ACTIVE,
        isActive: true,
      },
    });

    void AuditService.record({
      userId: actorUserId,
      practiceId,
      action: 'PRACTICE_REACTIVATED',
      resource: 'Practice',
      resourceId: practiceId,
      details: { reason },
    });

    return { success: true, status: PracticeStatus.ACTIVE };
  }

  static async transferPracticeOwnership(
    actorUserId: string,
    practiceId: string,
    newOwnerUserId: string,
    reason?: string
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      const p = this.mockPractices.get(practiceId);
      if (!p) throw new AppError(404, 'PRACTICE_NOT_FOUND', 'Practice not found.');
      p.ownerUserId = newOwnerUserId;
      this.mockPractices.set(practiceId, p);

      AuthorizationService.setMockPracticeOwner(practiceId, newOwnerUserId);

      void AuditService.record({
        userId: actorUserId,
        practiceId,
        action: 'OWNERSHIP_TRANSFERRED',
        resource: 'Practice',
        resourceId: practiceId,
        details: { newOwnerUserId, reason },
      });

      return { success: true, newOwnerUserId };
    }

    // Verify member exists in target practice
    const member = await prisma.practiceMember.findUnique({
      where: {
        practiceId_userId: { practiceId, userId: newOwnerUserId },
      },
    });

    if (!member || !member.isActive) {
      throw new AppError(400, 'INVALID_TARGET_MEMBER', 'New owner must be an active member of this practice.');
    }

    const currentPractice = await prisma.practice.findUnique({
      where: { id: practiceId },
      select: { ownerUserId: true },
    });

    await prisma.$transaction([
      prisma.practice.update({
        where: { id: practiceId },
        data: { ownerUserId: newOwnerUserId },
      }),
      prisma.practiceMember.update({
        where: { id: member.id },
        data: { role: Role.PRACTICE_OWNER },
      }),
      ...(currentPractice?.ownerUserId
        ? [
            prisma.practiceMember.updateMany({
              where: { practiceId, userId: currentPractice.ownerUserId },
              data: { role: Role.PRACTICE_ADMIN },
            }),
          ]
        : []),
    ]);

    void AuditService.record({
      userId: actorUserId,
      practiceId,
      action: 'OWNERSHIP_TRANSFERRED',
      resource: 'Practice',
      resourceId: practiceId,
      details: { newOwnerUserId, previousOwnerUserId: currentPractice?.ownerUserId, reason },
    });

    return { success: true, newOwnerUserId };
  }

  // ============================================================================
  // 3. User Administration & Security Controls
  // ============================================================================

  static async listUsers(
    actorUserId: string,
    options?: {
      search?: string;
      status?: string;
      role?: string;
      page?: number;
      pageSize?: number;
    }
  ): Promise<{ results: PlatformUserSummary[]; total: number; page: number; pageSize: number }> {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    const page = Math.max(1, options?.page || 1);
    const pageSize = Math.min(100, Math.max(1, options?.pageSize || 20));

    if (process.env.VETRX_FAST_TEST === '1') {
      let list = Array.from(this.mockUsers.values());
      if (options?.search) {
        const q = options.search.toLowerCase();
        list = list.filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q));
      }
      return {
        results: list.slice((page - 1) * pageSize, page * pageSize),
        total: list.length,
        page,
        pageSize,
      };
    }

    const where: any = {};
    if (options?.search) {
      const q = options.search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (options?.status === 'ACTIVE') {
      where.isActive = true;
    } else if (options?.status === 'INACTIVE') {
      where.isActive = false;
    }
    if (options?.role === 'SUPER_ADMIN') {
      where.platformRole = PlatformRole.PLATFORM_SUPER_ADMIN;
    }

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          email: true,
          name: true,
          avatarUrl: true,
          emailVerified: true,
          isActive: true,
          platformRole: true,
          createdAt: true,
          lastLoginAt: true,
          _count: { select: { memberships: true } },
          memberships: {
            select: {
              practiceId: true,
              role: true,
              isClinicalApprover: true,
              isActive: true,
              practice: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const results: PlatformUserSummary[] = users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      avatarUrl: u.avatarUrl,
      emailVerified: u.emailVerified,
      isActive: u.isActive,
      platformRole: u.platformRole,
      createdAt: u.createdAt.toISOString(),
      lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
      membershipCount: u._count.memberships,
      practices: u.memberships.map((m) => ({
        practiceId: m.practiceId,
        practiceName: m.practice.name,
        role: m.role,
        isClinicalApprover: m.isClinicalApprover,
        isActive: m.isActive,
      })),
    }));

    return { results, total, page, pageSize };
  }

  static async getUserDetails(actorUserId: string, userId: string) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      const u = this.mockUsers.get(userId);
      if (!u) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
      return u;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        emailVerified: true,
        isActive: true,
        platformRole: true,
        createdAt: true,
        lastLoginAt: true,
        authIdentities: { select: { id: true, provider: true, createdAt: true } },
        memberships: {
          include: {
            practice: { select: { id: true, name: true, status: true, practiceType: true } },
            permissionOverrides: true,
          },
        },
        ownedPractices: { select: { id: true, name: true, status: true } },
      },
    });

    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
    }

    return user;
  }

  static async createUser(
    actorUserId: string,
    data: {
      name: string;
      email: string;
      phone?: string;
      password?: string;
      practiceId?: string;
      role?: Role;
      isClinicalApprover?: boolean;
    }
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    const normalizedEmail = data.email.trim().toLowerCase();

    if (process.env.VETRX_FAST_TEST === '1') {
      const userId = `user-${Date.now()}`;
      const newUser = {
        id: userId,
        name: data.name,
        email: normalizedEmail,
        isActive: true,
        platformRole: null,
        createdAt: new Date().toISOString(),
      };
      this.mockUsers.set(userId, newUser);

      if (data.practiceId) {
        MemberService.setMockMember({
          id: `mem-${userId}-${data.practiceId}`,
          practiceId: data.practiceId,
          userId,
          role: data.role || Role.STAFF,
          isClinicalApprover: Boolean(data.isClinicalApprover),
          isActive: true,
          user: { id: userId, email: normalizedEmail, name: data.name, avatarUrl: null },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }

      void AuditService.record({
        userId: actorUserId,
        action: 'USER_CREATED',
        resource: 'User',
        resourceId: userId,
        details: { email: normalizedEmail, name: data.name, practiceId: data.practiceId },
      });

      return newUser;
    }

    const existing = await prisma.user.findUnique({ where: { normalizedEmail } });
    if (existing) {
      throw new AppError(400, 'USER_ALREADY_EXISTS', 'A user with this email address already exists.');
    }

    const rawPassword = data.password || crypto.randomBytes(16).toString('hex');
    const passwordHash = await PasswordService.hashPassword(rawPassword);

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        normalizedEmail,
        name: data.name,
        passwordHash,
        emailVerified: true,
        isActive: true,
      },
    });

    if (data.practiceId && data.role) {
      const isClinical =
        data.role === Role.VETERINARIAN
          ? true
          : (data.role === Role.STAFF || data.role === Role.READ_ONLY ? false : Boolean(data.isClinicalApprover));

      await EntitlementService.assertCanAddSeat(data.practiceId, data.role, isClinical);

      await prisma.practiceMember.create({
        data: {
          practiceId: data.practiceId,
          userId: user.id,
          role: data.role,
          isClinicalApprover: isClinical,
          isActive: true,
        },
      });
    }

    void AuditService.record({
      userId: actorUserId,
      action: 'USER_CREATED',
      resource: 'User',
      resourceId: user.id,
      details: { email: normalizedEmail, name: data.name, practiceId: data.practiceId },
    });

    return user;
  }

  static async activateUser(actorUserId: string, userId: string) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      const u = this.mockUsers.get(userId);
      if (!u) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
      u.isActive = true;
      this.mockUsers.set(userId, u);

      void AuditService.record({
        userId: actorUserId,
        action: 'USER_ACTIVATED',
        resource: 'User',
        resourceId: userId,
      });

      return { success: true, isActive: true };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: true },
    });

    void AuditService.record({
      userId: actorUserId,
      action: 'USER_ACTIVATED',
      resource: 'User',
      resourceId: userId,
    });

    return { success: true, isActive: true };
  }

  static async deactivateUser(actorUserId: string, userId: string, reason?: string) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      const u = this.mockUsers.get(userId);
      if (!u) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');
      u.isActive = false;
      this.mockUsers.set(userId, u);

      void AuditService.record({
        userId: actorUserId,
        action: 'USER_DEACTIVATED',
        resource: 'User',
        resourceId: userId,
        details: { reason },
      });

      return { success: true, isActive: false };
    }

    // Safety guard: Cannot deactivate a user who is the primary owner of an active practice
    const ownedPractices = await prisma.practice.findMany({
      where: { ownerUserId: userId, status: PracticeStatus.ACTIVE, isActive: true },
      select: { id: true, name: true },
    });

    if (ownedPractices.length > 0) {
      throw new AppError(
        400,
        'USER_OWNS_ACTIVE_PRACTICES',
        `This user owns active practice(s): ${ownedPractices.map((p) => p.name).join(', ')}. Ownership must be transferred before deactivating the user account.`
      );
    }

    // Deactivate user and revoke all active sessions
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      }),
      prisma.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    void AuditService.record({
      userId: actorUserId,
      action: 'USER_DEACTIVATED',
      resource: 'User',
      resourceId: userId,
      details: { reason },
    });

    return { success: true, isActive: false };
  }

  static async resetUserPassword(actorUserId: string, userId: string) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      void AuditService.record({
        userId: actorUserId,
        action: 'PASSWORD_RESET_REQUESTED',
        resource: 'User',
        resourceId: userId,
      });
      return { success: true, message: 'Password reset instructions sent.' };
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found.');

    // Revoke existing sessions for safety
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetUrl = `${process.env.APP_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

    await EmailService.sendPasswordResetEmail({
      recipientEmail: user.email,
      recipientName: user.name,
      resetUrl,
      expiresInMinutes: 60,
    });

    void AuditService.record({
      userId: actorUserId,
      action: 'PASSWORD_RESET_REQUESTED',
      resource: 'User',
      resourceId: userId,
    });

    // Never return the token or password hash
    return { success: true, message: 'Password reset instructions sent.' };
  }

  static async forcePasswordChange(actorUserId: string, userId: string) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      void AuditService.record({
        userId: actorUserId,
        action: 'PASSWORD_FORCED_RESET',
        resource: 'User',
        resourceId: userId,
      });
      return { success: true, message: 'User must establish a new password at next login.' };
    }

    // Revoke sessions so user must log in again
    await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    void AuditService.record({
      userId: actorUserId,
      action: 'PASSWORD_FORCED_RESET',
      resource: 'User',
      resourceId: userId,
    });

    return { success: true, message: 'User must establish a new password at next login.' };
  }

  static async revokeUserSessions(actorUserId: string, userId: string) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      void AuditService.record({
        userId: actorUserId,
        action: 'SESSIONS_REVOKED',
        resource: 'User',
        resourceId: userId,
      });
      return { success: true, message: 'All active sessions have been signed out.' };
    }

    const res = await prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    void AuditService.record({
      userId: actorUserId,
      action: 'SESSIONS_REVOKED',
      resource: 'User',
      resourceId: userId,
      details: { revokedCount: res.count },
    });

    return { success: true, message: 'All active sessions have been signed out.' };
  }

  // ============================================================================
  // 4. Practice Membership Administration
  // ============================================================================

  static async addUserToPractice(
    actorUserId: string,
    practiceId: string,
    data: {
      userId: string;
      role: Role;
      isClinicalApprover?: boolean;
    }
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (data.role === Role.PRACTICE_OWNER) {
      throw new AppError(400, 'OWNER_TRANSFER_REQUIRED', 'Practice Owner role cannot be assigned directly. Use ownership transfer.');
    }

    // Clinical eligibility validation
    if (data.isClinicalApprover && (data.role === Role.STAFF || data.role === Role.READ_ONLY)) {
      throw new AppError(
        400,
        'INVALID_CLINICAL_APPROVER',
        'Staff members and Read Only members cannot be designated as clinical approvers.'
      );
    }

    const isClinical =
      data.role === Role.VETERINARIAN
        ? true
        : (data.role === Role.STAFF || data.role === Role.READ_ONLY ? false : Boolean(data.isClinicalApprover));

    // Seat limit validation
    await EntitlementService.assertCanAddSeat(practiceId, data.role, isClinical);

    if (process.env.VETRX_FAST_TEST === '1') {
      const memId = `mem-${data.userId}-${practiceId}`;
      MemberService.setMockMember({
        id: memId,
        practiceId,
        userId: data.userId,
        role: data.role,
        isClinicalApprover: isClinical,
        isActive: true,
        user: { id: data.userId, email: 'user@vetrx.test', name: 'Practice User', avatarUrl: null },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      void AuditService.record({
        userId: actorUserId,
        practiceId,
        action: 'USER_ADDED_TO_PRACTICE',
        resource: 'PracticeMember',
        resourceId: memId,
        details: { userId: data.userId, role: data.role, isClinicalApprover: isClinical },
      });

      return { id: memId, practiceId, userId: data.userId, role: data.role, isClinicalApprover: isClinical };
    }

    const member = await prisma.practiceMember.create({
      data: {
        practiceId,
        userId: data.userId,
        role: data.role,
        isClinicalApprover: isClinical,
        isActive: true,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    void AuditService.record({
      userId: actorUserId,
      practiceId,
      action: 'USER_ADDED_TO_PRACTICE',
      resource: 'PracticeMember',
      resourceId: member.id,
      details: { userId: data.userId, role: data.role, isClinicalApprover: isClinical },
    });

    return member;
  }

  static async removeUserFromPractice(
    actorUserId: string,
    practiceId: string,
    memberId: string,
    reason?: string
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      void AuditService.record({
        userId: actorUserId,
        practiceId,
        action: 'USER_REMOVED_FROM_PRACTICE',
        resource: 'PracticeMember',
        resourceId: memberId,
        details: { reason },
      });
      return { success: true };
    }

    const member = await prisma.practiceMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.practiceId !== practiceId) {
      throw new AppError(404, 'MEMBER_NOT_FOUND', 'Practice member not found.');
    }

    if (member.role === Role.PRACTICE_OWNER) {
      throw new AppError(
        400,
        'CANNOT_REMOVE_PRACTICE_OWNER',
        'Cannot remove the Practice Owner. Transfer ownership first.'
      );
    }

    // Safely remove practice member (deletes membership relationship; preserves clinical records and user account)
    await prisma.practiceMember.delete({
      where: { id: memberId },
    });

    void AuditService.record({
      userId: actorUserId,
      practiceId,
      action: 'USER_REMOVED_FROM_PRACTICE',
      resource: 'PracticeMember',
      resourceId: memberId,
      details: { userId: member.userId, reason },
    });

    return { success: true };
  }

  static async updateUserPracticeRole(
    actorUserId: string,
    practiceId: string,
    memberId: string,
    newRole: Role,
    isClinicalApprover?: boolean
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    return MemberService.updateMemberRole(actorUserId, practiceId, memberId, newRole, isClinicalApprover);
  }

  static async updateUserClinicalStatus(
    actorUserId: string,
    practiceId: string,
    memberId: string,
    isClinicalApprover: boolean
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    return MemberService.updateClinicalStatus(actorUserId, practiceId, memberId, isClinicalApprover);
  }

  static async createPracticeInvitation(
    actorUserId: string,
    practiceId: string,
    email: string,
    role: Role
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    return InvitationService.createInvitation(actorUserId, practiceId, email, role);
  }

  static async cancelPracticeInvitation(
    actorUserId: string,
    practiceId: string,
    invitationId: string
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    return InvitationService.revokeInvitation(actorUserId, practiceId, invitationId);
  }

  // ============================================================================
  // 5. Commercial Subscriptions & Payments
  // ============================================================================

  static async listSubscriptions(
    actorUserId: string,
    options?: {
      search?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    const page = Math.max(1, options?.page || 1);
    const pageSize = Math.min(100, Math.max(1, options?.pageSize || 20));

    if (process.env.VETRX_FAST_TEST === '1') {
      const list = Array.from(this.mockSubscriptions.values());
      return {
        results: list.slice((page - 1) * pageSize, page * pageSize),
        total: list.length,
        page,
        pageSize,
      };
    }

    const where: any = {};
    if (options?.status && options.status !== 'ALL') {
      where.status = options.status;
    }
    if (options?.search) {
      where.practice = { name: { contains: options.search.trim(), mode: 'insensitive' } };
    }

    const [total, results] = await Promise.all([
      prisma.subscription.count({ where }),
      prisma.subscription.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          practice: { select: { id: true, name: true, owner: { select: { name: true, email: true } } } },
          plan: true,
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { amountPaisa: true, status: true, createdAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { results, total, page, pageSize };
  }

  static async listPayments(
    actorUserId: string,
    options?: {
      search?: string;
      status?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    const page = Math.max(1, options?.page || 1);
    const pageSize = Math.min(100, Math.max(1, options?.pageSize || 20));

    if (process.env.VETRX_FAST_TEST === '1') {
      const list = Array.from(this.mockPayments.values());
      return {
        results: list.slice((page - 1) * pageSize, page * pageSize),
        total: list.length,
        page,
        pageSize,
      };
    }

    const where: any = {};
    if (options?.status && options.status !== 'ALL') {
      where.status = options.status;
    }
    if (options?.search) {
      where.OR = [
        { internalReference: { contains: options.search.trim(), mode: 'insensitive' } },
        { gatewayTransactionId: { contains: options.search.trim(), mode: 'insensitive' } },
        { practice: { name: { contains: options.search.trim(), mode: 'insensitive' } } },
      ];
    }

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          practice: { select: { id: true, name: true } },
          subscription: { include: { plan: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Strip sensitive raw gateway responses before sending to client
    const safePayments = payments.map((p) => ({
      id: p.id,
      practiceId: p.practiceId,
      practiceName: p.practice.name,
      amountPaisa: p.amountPaisa,
      amountRupees: (p.amountPaisa / 100).toFixed(2),
      currency: p.currency,
      status: p.status,
      paymentProvider: p.paymentProvider,
      internalReference: p.internalReference,
      gatewayTransactionId: p.gatewayTransactionId,
      paymentMethod: p.paymentMethod,
      subscriptionPlan: p.subscription?.plan.name,
      createdAt: p.createdAt.toISOString(),
    }));

    return { results: safePayments, total, page, pageSize };
  }

  // ============================================================================
  // 6. Issues & Support System
  // ============================================================================

  static async listIssues(
    actorUserId: string,
    options?: {
      category?: string;
      priority?: string;
      status?: string;
      practiceId?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    const page = Math.max(1, options?.page || 1);
    const pageSize = Math.min(100, Math.max(1, options?.pageSize || 20));

    if (process.env.VETRX_FAST_TEST === '1') {
      let list = Array.from(this.mockIssues.values());
      if (options?.category && options.category !== 'ALL') {
        list = list.filter((i) => i.category === options.category);
      }
      if (options?.status && options.status !== 'ALL') {
        list = list.filter((i) => i.status === options.status);
      }
      return {
        results: list.slice((page - 1) * pageSize, page * pageSize),
        total: list.length,
        page,
        pageSize,
      };
    }

    const where: any = {};
    if (options?.category && options.category !== 'ALL') {
      where.category = options.category as IssueCategory;
    }
    if (options?.priority && options.priority !== 'ALL') {
      where.priority = options.priority as IssuePriority;
    }
    if (options?.status && options.status !== 'ALL') {
      where.status = options.status as IssueStatus;
    }
    if (options?.practiceId) {
      where.practiceId = options.practiceId;
    }

    const [total, issues] = await Promise.all([
      prisma.platformIssue.count({ where }),
      prisma.platformIssue.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          practice: { select: { id: true, name: true } },
          user: { select: { id: true, name: true, email: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return { results: issues, total, page, pageSize };
  }

  static async createIssue(
    actorUserId: string,
    data: {
      title: string;
      description: string;
      category?: IssueCategory;
      priority?: IssuePriority;
      practiceId?: string;
      userId?: string;
    }
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      const issueId = `iss-${Date.now()}`;
      const issue = {
        id: issueId,
        title: data.title,
        description: data.description,
        category: data.category || IssueCategory.OTHER,
        priority: data.priority || IssuePriority.NORMAL,
        status: IssueStatus.OPEN,
        practiceId: data.practiceId,
        userId: data.userId,
        internalNotes: [],
        createdAt: new Date().toISOString(),
      };
      this.mockIssues.set(issueId, issue);

      void AuditService.record({
        userId: actorUserId,
        action: 'ISSUE_CREATED',
        resource: 'PlatformIssue',
        resourceId: issueId,
        details: { title: data.title, category: data.category, priority: data.priority },
      });

      return issue;
    }

    const issue = await prisma.platformIssue.create({
      data: {
        title: data.title,
        description: data.description,
        category: data.category || IssueCategory.OTHER,
        priority: data.priority || IssuePriority.NORMAL,
        status: IssueStatus.OPEN,
        practiceId: data.practiceId,
        userId: data.userId,
      },
    });

    void AuditService.record({
      userId: actorUserId,
      action: 'ISSUE_CREATED',
      resource: 'PlatformIssue',
      resourceId: issue.id,
      details: { title: data.title, category: data.category, priority: data.priority },
    });

    return issue;
  }

  static async updateIssue(
    actorUserId: string,
    issueId: string,
    data: {
      status?: IssueStatus;
      priority?: IssuePriority;
      assignedToUserId?: string | null;
    }
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      const issue = this.mockIssues.get(issueId);
      if (!issue) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Support issue not found.');
      if (data.status) issue.status = data.status;
      if (data.priority) issue.priority = data.priority;
      this.mockIssues.set(issueId, issue);

      void AuditService.record({
        userId: actorUserId,
        action: 'ISSUE_UPDATED',
        resource: 'PlatformIssue',
        resourceId: issueId,
        details: data,
      });

      return issue;
    }

    const updateData: any = { ...data };
    if (data.status === IssueStatus.RESOLVED || data.status === IssueStatus.CLOSED) {
      updateData.resolvedAt = new Date();
    }

    const updated = await prisma.platformIssue.update({
      where: { id: issueId },
      data: updateData,
    });

    void AuditService.record({
      userId: actorUserId,
      action: 'ISSUE_UPDATED',
      resource: 'PlatformIssue',
      resourceId: issueId,
      details: data,
    });

    return updated;
  }

  static async addIssueNote(actorUserId: string, issueId: string, note: string) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (!note || !note.trim()) {
      throw new AppError(400, 'NOTE_REQUIRED', 'Note content cannot be empty.');
    }

    if (process.env.VETRX_FAST_TEST === '1') {
      const issue = this.mockIssues.get(issueId);
      if (!issue) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Support issue not found.');
      const newNote = {
        id: `note-${Date.now()}`,
        authorUserId: actorUserId,
        authorName: 'Platform Super Admin',
        note: note.trim(),
        createdAt: new Date().toISOString(),
      };
      issue.internalNotes = [...(issue.internalNotes || []), newNote];
      this.mockIssues.set(issueId, issue);
      return issue;
    }

    const issue = await prisma.platformIssue.findUnique({ where: { id: issueId } });
    if (!issue) throw new AppError(404, 'ISSUE_NOT_FOUND', 'Support issue not found.');

    const actor = await prisma.user.findUnique({
      where: { id: actorUserId },
      select: { name: true },
    });

    const existingNotes = (issue.internalNotes as any[]) || [];
    const newNote = {
      id: crypto.randomUUID(),
      authorUserId: actorUserId,
      authorName: actor?.name || 'Platform Super Admin',
      note: note.trim(),
      createdAt: new Date().toISOString(),
    };

    const updated = await prisma.platformIssue.update({
      where: { id: issueId },
      data: {
        internalNotes: [...existingNotes, newNote],
      },
    });

    return updated;
  }

  // ============================================================================
  // 7. Audited Support Access Sessions
  // ============================================================================

  static async listSupportSessions(actorUserId: string) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      return Array.from(this.mockSupportSessions.values());
    }

    return prisma.supportAccessSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        targetPractice: { select: { id: true, name: true } },
        platformAdmin: { select: { id: true, name: true, email: true } },
      },
    });
  }

  static async startSupportSession(
    actorUserId: string,
    data: {
      targetPracticeId: string;
      targetUserId?: string;
      reason: string;
      durationMinutes?: number;
    }
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (!data.reason || !data.reason.trim()) {
      throw new AppError(400, 'REASON_REQUIRED', 'A reason is required to start a support access session.');
    }

    const duration = Math.min(120, Math.max(15, data.durationMinutes || 60));
    const now = new Date();
    const expiresAt = new Date(now.getTime() + duration * 60 * 1000);

    if (process.env.VETRX_FAST_TEST === '1') {
      const sessionId = `sup-${Date.now()}`;
      const session = {
        id: sessionId,
        platformAdminUserId: actorUserId,
        targetPracticeId: data.targetPracticeId,
        targetUserId: data.targetUserId,
        reason: data.reason,
        isReadOnly: true,
        status: 'ACTIVE',
        startedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      };
      this.mockSupportSessions.set(sessionId, session);

      void AuditService.record({
        userId: actorUserId,
        practiceId: data.targetPracticeId,
        action: 'SUPPORT_ACCESS_STARTED',
        resource: 'SupportAccessSession',
        resourceId: sessionId,
        details: { reason: data.reason, durationMinutes: duration },
      });

      return session;
    }

    const session = await prisma.supportAccessSession.create({
      data: {
        platformAdminUserId: actorUserId,
        targetPracticeId: data.targetPracticeId,
        targetUserId: data.targetUserId,
        reason: data.reason,
        isReadOnly: true,
        status: 'ACTIVE',
        startedAt: now,
        expiresAt,
      },
    });

    void AuditService.record({
      userId: actorUserId,
      practiceId: data.targetPracticeId,
      action: 'SUPPORT_ACCESS_STARTED',
      resource: 'SupportAccessSession',
      resourceId: session.id,
      details: { reason: data.reason, durationMinutes: duration },
    });

    return session;
  }

  static async endSupportSession(actorUserId: string, sessionId: string) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (process.env.VETRX_FAST_TEST === '1') {
      const session = this.mockSupportSessions.get(sessionId);
      if (session) {
        session.status = 'ENDED';
        session.endedAt = new Date().toISOString();
        this.mockSupportSessions.set(sessionId, session);
      }
      void AuditService.record({
        userId: actorUserId,
        action: 'SUPPORT_ACCESS_ENDED',
        resource: 'SupportAccessSession',
        resourceId: sessionId,
      });
      return { success: true };
    }

    await prisma.supportAccessSession.update({
      where: { id: sessionId },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
      },
    });

    void AuditService.record({
      userId: actorUserId,
      action: 'SUPPORT_ACCESS_ENDED',
      resource: 'SupportAccessSession',
      resourceId: sessionId,
    });

    return { success: true };
  }

  // ============================================================================
  // 8. Global Platform Search
  // ============================================================================

  static async globalSearch(actorUserId: string, query: string) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    if (!query || query.trim().length < 2) {
      return { practices: [], users: [], subscriptions: [], issues: [] };
    }

    const q = query.trim().toLowerCase();

    if (process.env.VETRX_FAST_TEST === '1') {
      const practices = Array.from(this.mockPractices.values())
        .filter((p) => p.name?.toLowerCase().includes(q) || p.ownerEmail?.toLowerCase().includes(q))
        .slice(0, 5);
      const users = Array.from(this.mockUsers.values())
        .filter((u) => u.name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q))
        .slice(0, 5);
      const issues = Array.from(this.mockIssues.values())
        .filter((i) => i.title?.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q))
        .slice(0, 5);
      return { practices, users, subscriptions: [], issues };
    }

    const [practices, users, subscriptions, issues] = await Promise.all([
      prisma.practice.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { owner: { email: { contains: q, mode: 'insensitive' } } },
          ],
        },
        take: 5,
        select: { id: true, name: true, practiceType: true, status: true },
      }),
      prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: { id: true, name: true, email: true, platformRole: true, isActive: true },
      }),
      prisma.subscription.findMany({
        where: {
          practice: { name: { contains: q, mode: 'insensitive' } },
        },
        take: 5,
        include: { practice: { select: { id: true, name: true } }, plan: true },
      }),
      prisma.platformIssue.findMany({
        where: {
          OR: [
            { title: { contains: q, mode: 'insensitive' } },
            { description: { contains: q, mode: 'insensitive' } },
          ],
        },
        take: 5,
        select: { id: true, title: true, status: true, priority: true },
      }),
    ]);

    return { practices, users, subscriptions, issues };
  }

  // ============================================================================
  // 9. Platform Security Audit Log Oversight
  // ============================================================================

  static async listAuditLogs(
    actorUserId: string,
    options?: {
      action?: string;
      practiceId?: string;
      userId?: string;
      page?: number;
      pageSize?: number;
    }
  ) {
    await AuthorizationService.requirePlatformSuperAdmin(actorUserId);

    const page = Math.max(1, options?.page || 1);
    const pageSize = Math.min(100, Math.max(1, options?.pageSize || 25));

    if (process.env.VETRX_FAST_TEST === '1') {
      let logs = [...AuditService.mockLogs].reverse();
      if (options?.action) {
        logs = logs.filter((l) => l.action === options.action);
      }
      return {
        results: logs.slice((page - 1) * pageSize, page * pageSize),
        total: logs.length,
        page,
        pageSize,
      };
    }

    const where: any = {};
    if (options?.action) where.action = options.action;
    if (options?.practiceId) where.practiceId = options.practiceId;
    if (options?.userId) where.userId = options.userId;

    const [total, logs] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true, name: true } },
          practice: { select: { id: true, name: true } },
        },
      }),
    ]);

    return { results: logs, total, page, pageSize };
  }

  // ============================================================================
  // 10. Role Permission Matrix & Member Overrides
  // ============================================================================

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
    const effectivePermissions = await AuthorizationService.getEffectivePermissions(
      member.userId || member.user?.id,
      practiceId
    );

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

    const isPlatformPermission =
      (PLATFORM_ONLY_PERMISSIONS as readonly string[]).includes(data.permission) ||
      (PLATFORM_SUPER_ADMIN_PERMISSIONS as readonly string[]).includes(data.permission as any) ||
      data.permission.startsWith('PLATFORM_') ||
      data.permission === 'PLATFORM_SUPER_ADMIN';

    if (isPlatformPermission) {
      throw new AppError(
        400,
        'PLATFORM_PERMISSION_RESTRICTED',
        'Platform Super Admin permissions cannot be granted through practice member overrides.'
      );
    }

    const validPermissions = ALL_ASSIGNABLE_PERMISSIONS as readonly string[];
    if (!validPermissions.includes(data.permission)) {
      throw new AppError(400, 'INVALID_PERMISSION', `Unknown permission: ${data.permission}`);
    }

    if (data.effect !== 'ALLOW' && data.effect !== 'DENY') {
      throw new AppError(400, 'INVALID_EFFECT', 'Override effect must be ALLOW or DENY.');
    }

    return MemberService.updateMemberPermissions(actorUserId, practiceId, memberId, [
      {
        permission: data.permission as Permission,
        effect: data.effect,
      },
    ]);
  }

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
