// ==============================================================================
// VetRx — Backend Authorization Middleware (Phase 14)
// Reusable express middleware enforcing practice permissions and platform boundaries.
// ==============================================================================

import type { Response, NextFunction } from 'express';
import { AppError } from './errorHandler.js';
import type { AuthenticatedRequest } from '../types/index.js';
import { AuthorizationService } from '../auth/authorization.service.js';
import type { Permission } from '../auth/permissions.js';

/**
 * Middleware factory requiring a specific practice-level permission.
 * Assumes authenticateSession and requirePractice have executed first.
 */
export function requirePracticePermission(permission: Permission | string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
      }
      if (!req.practice || !req.membership) {
        throw new AppError(403, 'NO_ACTIVE_PRACTICE', 'No active practice context.');
      }

      await AuthorizationService.requirePermission(req.user.id, req.practice.id, permission);

      // Hydrate effective permissions into request context
      if (!req.permissions) {
        req.permissions = await AuthorizationService.getEffectivePermissions(
          req.user.id,
          req.practice.id
        );
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Middleware requiring platform super admin authorization.
 * Operates independently from practice tenant membership.
 */
export function requirePlatformPermission(permission?: Permission | string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
      }

      await AuthorizationService.requirePlatformSuperAdmin(req.user.id);

      next();
    } catch (error) {
      next(error);
    }
  };
}
