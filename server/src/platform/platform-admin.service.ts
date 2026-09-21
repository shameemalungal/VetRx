// ==============================================================================
// VetRx — Platform Super Admin Service (Phase 14)
// Secure oversight of practices, tenant accounts, subscriptions, and platform audit logs.
// ==============================================================================

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuthorizationService } from '../auth/authorization.service.js';
import { AuditService } from '../lib/audit.service.js';

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
}
