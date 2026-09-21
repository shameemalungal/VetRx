// ==============================================================================
// VetRx — Platform Super Admin REST Controller (Phase 14)
// Endpoints strictly protected by platform authorization (independent of practice context).
// ==============================================================================

import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { requirePlatformPermission } from '../middleware/authorization.js';
import { PlatformAdminService } from './platform-admin.service.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const platformAdminRouter = Router();

// Strictly enforce authentication and platform super admin authorization
platformAdminRouter.use(requireAuth, requirePlatformPermission());

/**
 * GET /api/platform/admin/practices
 * Lists all practices across the platform.
 */
platformAdminRouter.get('/practices', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const practices = await PlatformAdminService.listPractices(actorUserId);
    res.status(200).json(practices);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/platform/admin/practices/:id
 * Fetches practice details for administration.
 */
platformAdminRouter.get('/practices/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    if (!id) throw new AppError(400, 'BAD_REQUEST', 'Practice ID required.');
    const practice = await PlatformAdminService.getPracticeDetails(actorUserId, id);
    res.status(200).json(practice);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/platform/admin/users
 * Lists platform users for oversight.
 */
platformAdminRouter.get('/users', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const users = await PlatformAdminService.listUsers(actorUserId);
    res.status(200).json(users);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/platform/admin/audit
 * Lists platform-wide security audit logs.
 */
platformAdminRouter.get('/audit', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const logs = await PlatformAdminService.listAuditLogs(actorUserId);
    res.status(200).json(logs);
  } catch (err) {
    next(err);
  }
});
