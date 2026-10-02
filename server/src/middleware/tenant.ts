import type { Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { AppError } from './errorHandler.js';
import type { AuthenticatedRequest, SafePracticeDTO, SafeMembershipDTO, UserRole } from '../types/index.js';

/**
 * Derives active practice context server-side based on user membership.
 * Never trusts client-supplied practice ID headers or body.
 */
export async function requirePractice(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required prior to resolving practice context.');
    }

    // Resolve user's active practice membership authoritative from session.practiceId
    let membership = null;
    const sessionPracticeId = req.session?.practiceId;

    if (sessionPracticeId) {
      membership = await prisma.practiceMember.findFirst({
        where: {
          userId: req.user.id,
          practiceId: sessionPracticeId,
          isActive: true,
        },
        include: {
          practice: true,
        },
      });
    }

    // Fallback: If session had no practiceId or practiceId was invalidated, resolve valid active membership
    if (!membership) {
      membership = await prisma.practiceMember.findFirst({
        where: {
          userId: req.user.id,
          isActive: true,
        },
        include: {
          practice: true,
        },
      });

      // Backfill session.practiceId if session exists
      if (membership && req.session?.id) {
        req.session.practiceId = membership.practiceId;
        prisma.session
          .update({
            where: { id: req.session.id },
            data: { practiceId: membership.practiceId },
          })
          .catch((err) => console.warn('Failed to backfill session practiceId:', err));
      }
    }

    if (!membership || !membership.practice || !membership.practice.isActive) {
      throw new AppError(
        403,
        'NO_ACTIVE_PRACTICE',
        'No active practice found for this user. Please complete practice onboarding.'
      );
    }

    const safePractice: SafePracticeDTO = {
      id: membership.practice.id,
      name: membership.practice.name,
      slug: membership.practice.slug,
      ownerUserId: membership.practice.ownerUserId,
      isActive: membership.practice.isActive,
      createdAt: membership.practice.createdAt.toISOString(),
    };

    const safeMembership: SafeMembershipDTO = {
      id: membership.id,
      practiceId: membership.practiceId,
      userId: membership.userId,
      role: membership.role as UserRole,
      isActive: membership.isActive,
    };

    // Inject into request context
    req.practice = safePractice;
    req.membership = safeMembership;

    next();
  } catch (error) {
    next(error);
  }
}
