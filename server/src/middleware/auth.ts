import type { Response, NextFunction } from 'express';
import { env } from '../config/env.js';
import { SessionService } from '../auth/session.service.js';
import { AppError } from './errorHandler.js';
import type { AuthenticatedRequest, SafeUserDTO } from '../types/index.js';

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Check cookie first (primary mechanism), fallback to Bearer header for testing
    let rawToken = req.cookies?.[env.COOKIE_NAME];
    if (!rawToken && req.headers.authorization?.startsWith('Bearer ')) {
      rawToken = req.headers.authorization.slice(7).trim();
    }

    if (!rawToken) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required. No active session found.');
    }

    const session = await SessionService.validateSession(rawToken);
    if (!session) {
      // Clear invalid cookie if present
      SessionService.clearCookie(res);
      throw new AppError(401, 'SESSION_EXPIRED', 'Your session has expired or been revoked. Please sign in again.');
    }

    const safeUser: SafeUserDTO = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      avatarUrl: session.user.avatarUrl,
      emailVerified: session.user.emailVerified,
      createdAt: session.user.createdAt.toISOString(),
    };

    req.user = safeUser;
    req.session = {
      id: session.id,
      practiceId: (session as any).practiceId || null,
    };
    next();
  } catch (error) {
    next(error);
  }
}
