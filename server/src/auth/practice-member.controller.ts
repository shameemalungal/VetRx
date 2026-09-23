// ==============================================================================
// VetRx — Practice Members & Invitations REST Controller (Phase 14)
// Endpoints for user management, RBAC roles, invitations, and ownership transfer.
// ==============================================================================

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { requirePractice } from '../middleware/tenant.js';
import { requirePracticePermission } from '../middleware/authorization.js';
import { PERMISSIONS, ROLE_PERMISSIONS, PERMISSION_GROUPS, getPermissionsForRole } from './permissions.js';
import { MemberService } from './member.service.js';
import { InvitationService } from './invitation.service.js';
import { AuthorizationService } from './authorization.service.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const practiceMemberRouter = Router();

// ------------------------------------------------------------------------------
// Preview Invitation (Public/Unauthenticated endpoint)
// Allows frontend invitation page to display safe details before accepting.
// ------------------------------------------------------------------------------
practiceMemberRouter.get('/invitations/preview/:token', async (req, res, next) => {
  try {
    const rawToken = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
    if (!rawToken) {
      throw new AppError(400, 'INVALID_TOKEN', 'A valid invitation token is required.');
    }

    const preview = await InvitationService.getInvitationPreview(rawToken);
    res.status(200).json(preview);
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// Accept Invitation (Public/Authenticated endpoint)
// User must be authenticated, but does not need prior membership in this practice.
// ------------------------------------------------------------------------------
practiceMemberRouter.post('/invitations/accept', requireAuth, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = req.user;
    if (!user) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');

    const { token } = z.object({ token: z.string().min(1, 'Token is required') }).parse(req.body);

    const result = await InvitationService.acceptInvitation(
      token,
      {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      req.session?.id
    );

    res.status(200).json({
      message: 'Invitation successfully accepted.',
      ...result,
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------------------------
// Practice-Scoped Administrative Endpoints
// Require valid session and active practice context
// ------------------------------------------------------------------------------
practiceMemberRouter.use(requireAuth, requirePractice);

function getPracticeId(req: AuthenticatedRequest): string {
  if (!req.practice?.id) {
    throw new AppError(401, 'UNAUTHORIZED', 'Tenant practice context required.');
  }
  return req.practice.id;
}

function getUserId(req: AuthenticatedRequest): string {
  if (!req.user?.id) {
    throw new AppError(401, 'UNAUTHORIZED', 'Authenticated user required.');
  }
  return req.user.id;
}

/**
 * GET /api/practice/roles
 * Lists available practice roles and their defined permissions.
 */
practiceMemberRouter.get('/roles', async (req: AuthenticatedRequest, res, next) => {
  try {
    const roles = Object.entries(ROLE_PERMISSIONS).map(([role, permissions]) => ({
      role,
      permissions,
    }));
    res.status(200).json(roles);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/practice/permission-groups
 * Lists human-readable permission groups for customized permission administration.
 */
practiceMemberRouter.get('/permission-groups', async (req: AuthenticatedRequest, res, next) => {
  try {
    res.status(200).json(PERMISSION_GROUPS);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/practice/permissions
 * Returns current user's effective permissions in this practice.
 */
practiceMemberRouter.get('/permissions', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const userId = getUserId(req);
    const permissions = await AuthorizationService.getEffectivePermissions(userId, practiceId);
    res.status(200).json({ permissions });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/practice/members
 * Lists all members of the practice.
 */
practiceMemberRouter.get(
  '/members',
  requirePracticePermission(PERMISSIONS.USER_VIEW),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const userId = getUserId(req);
      const members = await MemberService.listMembers(userId, practiceId);
      res.status(200).json(members);
    } catch (err) {
      next(err);
    }
  }
);

const updateRoleSchema = z.object({
  role: z.enum(['PRACTICE_OWNER', 'PRACTICE_ADMIN', 'VETERINARIAN', 'STAFF', 'PRACTICE_STAFF', 'READ_ONLY']),
});

/**
 * PATCH /api/practice/members/:id
 * Updates a member's role.
 */
practiceMemberRouter.patch(
  '/members/:id',
  requirePracticePermission(PERMISSIONS.ROLE_ASSIGN),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const actorUserId = getUserId(req);
      const memberId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!memberId) throw new AppError(400, 'BAD_REQUEST', 'Member ID required.');

      const { role } = updateRoleSchema.parse(req.body);
      const updated = await MemberService.updateMemberRole(actorUserId, practiceId, memberId, role);
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PATCH /api/practice/members/:id/clinical-status
 * Updates a member's clinical approver status.
 */
practiceMemberRouter.patch(
  '/members/:id/clinical-status',
  requirePracticePermission(PERMISSIONS.ROLE_ASSIGN),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const actorUserId = getUserId(req);
      const memberId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!memberId) throw new AppError(400, 'BAD_REQUEST', 'Member ID required.');

      const { isClinicalApprover } = z.object({
        isClinicalApprover: z.boolean(),
      }).parse(req.body);

      const updated = await MemberService.updateClinicalStatus(
        actorUserId,
        practiceId,
        memberId,
        isClinicalApprover
      );
      res.status(200).json(updated);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/practice/members/:id/permissions
 * Retrieves member defaults, overrides, and effective permissions.
 */
practiceMemberRouter.get(
  '/members/:id/permissions',
  requirePracticePermission(PERMISSIONS.ROLE_VIEW),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const actorUserId = getUserId(req);
      const memberId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!memberId) throw new AppError(400, 'BAD_REQUEST', 'Member ID required.');

      const result = await MemberService.getMemberPermissions(actorUserId, practiceId, memberId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

const updateMemberPermissionsSchema = z.object({
  overrides: z.array(
    z.object({
      permission: z.string().min(1),
      effect: z.enum(['ALLOW', 'DENY', 'DEFAULT']),
    })
  ),
});

/**
 * PATCH /api/practice/members/:id/permissions
 * Customizes member permission overrides.
 */
practiceMemberRouter.patch(
  '/members/:id/permissions',
  requirePracticePermission(PERMISSIONS.ROLE_ASSIGN),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const actorUserId = getUserId(req);
      const memberId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!memberId) throw new AppError(400, 'BAD_REQUEST', 'Member ID required.');

      const { overrides } = updateMemberPermissionsSchema.parse(req.body);
      const result = await MemberService.updateMemberPermissions(
        actorUserId,
        practiceId,
        memberId,
        overrides
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/practice/members/:id/permissions/reset
 * Resets member permission overrides back to role defaults.
 */
practiceMemberRouter.post(
  '/members/:id/permissions/reset',
  requirePracticePermission(PERMISSIONS.ROLE_ASSIGN),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const actorUserId = getUserId(req);
      const memberId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!memberId) throw new AppError(400, 'BAD_REQUEST', 'Member ID required.');

      const result = await MemberService.resetMemberPermissions(actorUserId, practiceId, memberId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/practice/members/:id/deactivate
 * Deactivates a member in the practice.
 */
practiceMemberRouter.post(
  '/members/:id/deactivate',
  requirePracticePermission(PERMISSIONS.USER_DEACTIVATE),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const actorUserId = getUserId(req);
      const memberId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!memberId) throw new AppError(400, 'BAD_REQUEST', 'Member ID required.');

      const result = await MemberService.deactivateMember(actorUserId, practiceId, memberId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/practice/members/:id/reactivate
 * Reactivates a member in the practice.
 */
practiceMemberRouter.post(
  '/members/:id/reactivate',
  requirePracticePermission(PERMISSIONS.USER_REACTIVATE),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const actorUserId = getUserId(req);
      const memberId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!memberId) throw new AppError(400, 'BAD_REQUEST', 'Member ID required.');

      const result = await MemberService.reactivateMember(actorUserId, practiceId, memberId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /api/practice/invitations
 * Lists invitations for the practice.
 */
practiceMemberRouter.get(
  '/invitations',
  requirePracticePermission(PERMISSIONS.USER_VIEW),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const invitations = await InvitationService.listInvitations(practiceId);
      res.status(200).json(invitations);
    } catch (err) {
      next(err);
    }
  }
);

const createInvitationSchema = z.object({
  email: z.string().email('Valid email address is required'),
  role: z.enum(['PRACTICE_ADMIN', 'VETERINARIAN', 'STAFF', 'PRACTICE_STAFF', 'READ_ONLY']),
});

/**
 * POST /api/practice/invitations
 * Creates a new invitation for a user.
 */
practiceMemberRouter.post(
  '/invitations',
  requirePracticePermission(PERMISSIONS.USER_INVITE),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const actorUserId = getUserId(req);
      const { email, role } = createInvitationSchema.parse(req.body);

      const result = await InvitationService.createInvitation(actorUserId, practiceId, email, role);
      res.status(201).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/practice/invitations/:id/resend
 * Refreshes an invitation and generates a new token.
 */
practiceMemberRouter.post(
  '/invitations/:id/resend',
  requirePracticePermission(PERMISSIONS.USER_INVITE),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const actorUserId = getUserId(req);
      const invitationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!invitationId) throw new AppError(400, 'BAD_REQUEST', 'Invitation ID required.');

      const result = await InvitationService.resendInvitation(actorUserId, practiceId, invitationId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /api/practice/invitations/:id/revoke
 * Revokes an existing invitation.
 */
practiceMemberRouter.post(
  '/invitations/:id/revoke',
  requirePracticePermission(PERMISSIONS.USER_INVITE),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const actorUserId = getUserId(req);
      const invitationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!invitationId) throw new AppError(400, 'BAD_REQUEST', 'Invitation ID required.');

      const result = await InvitationService.revokeInvitation(actorUserId, practiceId, invitationId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /api/practice/invitations/:id
 * Alias to revoke an existing invitation.
 */
practiceMemberRouter.delete(
  '/invitations/:id',
  requirePracticePermission(PERMISSIONS.USER_INVITE),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const actorUserId = getUserId(req);
      const invitationId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!invitationId) throw new AppError(400, 'BAD_REQUEST', 'Invitation ID required.');

      const result = await InvitationService.revokeInvitation(actorUserId, practiceId, invitationId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

const transferOwnershipSchema = z.object({
  targetMemberId: z.string().min(1, 'Target member ID is required'),
  previousOwnerRole: z
    .enum(['PRACTICE_ADMIN', 'VETERINARIAN', 'STAFF', 'PRACTICE_STAFF', 'READ_ONLY'])
    .default('PRACTICE_ADMIN'),
});

/**
 * POST /api/practice/ownership/transfer
 * Atomically transfers practice ownership.
 */
practiceMemberRouter.post(
  '/ownership/transfer',
  requirePracticePermission(PERMISSIONS.OWNERSHIP_TRANSFER),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const practiceId = getPracticeId(req);
      const actorUserId = getUserId(req);
      const { targetMemberId, previousOwnerRole } = transferOwnershipSchema.parse(req.body);

      const result = await MemberService.transferOwnership(
        actorUserId,
        practiceId,
        targetMemberId,
        previousOwnerRole
      );
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);
