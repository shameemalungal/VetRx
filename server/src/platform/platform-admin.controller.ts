import { Router } from 'express';
import { z } from 'zod';
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

/**
 * GET /api/platform/admin/permission-matrix
 * Returns role-permission matrix and metadata.
 */
platformAdminRouter.get('/permission-matrix', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const matrix = await PlatformAdminService.getGlobalPermissionMatrix(actorUserId);
    res.status(200).json(matrix);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/platform/admin/practices/:practiceId/members/:memberId/permissions
 * Fetches effective permissions, defaults, and overrides for a member.
 */
platformAdminRouter.get(
  '/practices/:practiceId/members/:memberId/permissions',
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
      const practiceId = Array.isArray(req.params.practiceId) ? req.params.practiceId[0] : req.params.practiceId;
      const memberId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
      if (!practiceId || !memberId) throw new AppError(400, 'BAD_REQUEST', 'Practice and member ID required.');

      const result = await PlatformAdminService.getMemberPermissions(actorUserId, practiceId, memberId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/platform/admin/practices/:practiceId/members/:memberId/permissions
 * Sets or updates a permission override.
 */
platformAdminRouter.post(
  '/practices/:practiceId/members/:memberId/permissions',
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
      const practiceId = Array.isArray(req.params.practiceId) ? req.params.practiceId[0] : req.params.practiceId;
      const memberId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
      if (!practiceId || !memberId) throw new AppError(400, 'BAD_REQUEST', 'Practice and member ID required.');

      const body = z.object({
        permission: z.string().min(1),
        effect: z.enum(['ALLOW', 'DENY']),
        reason: z.string().max(500).optional(),
      }).parse(req.body);

      const override = await PlatformAdminService.setMemberPermissionOverride(actorUserId, practiceId, memberId, body);
      res.status(200).json(override);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/platform/admin/practices/:practiceId/members/:memberId/permissions/:permission
 * Removes a permission override and restores role default.
 */
platformAdminRouter.delete(
  '/practices/:practiceId/members/:memberId/permissions/:permission',
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
      const practiceId = Array.isArray(req.params.practiceId) ? req.params.practiceId[0] : req.params.practiceId;
      const memberId = Array.isArray(req.params.memberId) ? req.params.memberId[0] : req.params.memberId;
      const permission = Array.isArray(req.params.permission) ? req.params.permission[0] : req.params.permission;
      if (!practiceId || !memberId || !permission) throw new AppError(400, 'BAD_REQUEST', 'Missing route parameters.');

      const reason = req.query.reason as string | undefined;
      const result = await PlatformAdminService.removeMemberPermissionOverride(
        actorUserId,
        practiceId,
        memberId,
        permission,
        reason
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);
