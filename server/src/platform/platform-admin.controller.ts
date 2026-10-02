// ==============================================================================
// VetRx — Platform Super Admin Controller (Phase 14 Extension)
// Exposes SaaS-level administrative endpoints protected by requirePlatformPermission.
// ==============================================================================

import { Router } from 'express';
import { z } from 'zod';
import { Role, PracticeType, IssueCategory, IssuePriority, IssueStatus } from '@prisma/client';
import { requireAuth } from '../middleware/auth.js';
import { requirePlatformPermission } from '../middleware/authorization.js';
import { PlatformAdminService } from './platform-admin.service.js';
import { SubscriptionService } from '../commercial/subscription.service.js';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const platformAdminRouter = Router();

// Strictly enforce authentication and platform super admin authorization across all routes
platformAdminRouter.use(requireAuth, requirePlatformPermission());

// ==============================================================================
// 1. Dashboard & Global Search
// ==============================================================================

platformAdminRouter.get('/dashboard', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const dashboard = await PlatformAdminService.getDashboard(actorUserId);
    res.status(200).json(dashboard);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.get('/search', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const q = (req.query.q as string) || '';
    const results = await PlatformAdminService.globalSearch(actorUserId, q);
    res.status(200).json(results);
  } catch (err) {
    next(err);
  }
});

// ==============================================================================
// 2. Practices Management
// ==============================================================================

platformAdminRouter.get('/practices', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const search = req.query.search as string | undefined;
    const type = req.query.type as string | undefined;
    const status = req.query.status as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;

    const data = await PlatformAdminService.listPractices(actorUserId, { search, type, status, page, pageSize });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.post('/practices', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');

    const schema = z.object({
      name: z.string().min(2).max(100),
      practiceType: z.nativeEnum(PracticeType).default(PracticeType.CLINIC),
      ownerName: z.string().min(2).max(100),
      ownerEmail: z.string().email(),
      ownerPhone: z.string().optional(),
      address: z.string().optional(),
      planCode: z.string().optional(),
      isClinicalApprover: z.boolean().optional(),
    });

    const body = schema.parse(req.body);
    const practice = await PlatformAdminService.createPractice(actorUserId, body);
    res.status(201).json(practice);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.get('/practices/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const id = req.params.id as string;
    const practice = await PlatformAdminService.getPracticeDetails(actorUserId, id);
    res.status(200).json(practice);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.patch('/practices/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const id = req.params.id as string;

    const schema = z.object({
      name: z.string().min(2).max(100).optional(),
      practiceType: z.nativeEnum(PracticeType).optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      email: z.string().email().optional(),
    });

    const body = schema.parse(req.body);
    const updated = await PlatformAdminService.updatePractice(actorUserId, id, body);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.post('/practices/:id/suspend', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const id = req.params.id as string;
    const schema = z.object({ reason: z.string().min(3) });
    const { reason } = schema.parse(req.body);

    const result = await PlatformAdminService.suspendPractice(actorUserId, id, reason);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.post('/practices/:id/reactivate', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const id = req.params.id as string;
    const schema = z.object({ reason: z.string().min(3) });
    const { reason } = schema.parse(req.body);

    const result = await PlatformAdminService.reactivatePractice(actorUserId, id, reason);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.post('/practices/:id/transfer-ownership', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const id = req.params.id as string;
    const schema = z.object({
      newOwnerUserId: z.string().optional(),
      targetMemberId: z.string().optional(),
      reason: z.string().optional(),
    });
    const body = schema.parse(req.body);
    const newOwnerUserId = body.newOwnerUserId || body.targetMemberId;
    if (!newOwnerUserId) {
      throw new AppError(400, 'BAD_REQUEST', 'newOwnerUserId or targetMemberId is required');
    }

    const result = await PlatformAdminService.transferPracticeOwnership(actorUserId, id, newOwnerUserId, body.reason);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

const getPracticeUsersHandler = async (req: AuthenticatedRequest, res: any, next: any) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const id = req.params.id as string;
    const practice = await PlatformAdminService.getPracticeDetails(actorUserId, id);
    res.status(200).json(practice.members || []);
  } catch (err) {
    next(err);
  }
};
platformAdminRouter.get('/practices/:id/users', getPracticeUsersHandler);
platformAdminRouter.get('/practices/:id/members', getPracticeUsersHandler);

const addPracticeUserHandler = async (req: AuthenticatedRequest, res: any, next: any) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const practiceId = req.params.id as string;

    const schema = z.object({
      userId: z.string().min(1),
      role: z.nativeEnum(Role),
      isClinicalApprover: z.boolean().optional(),
    });

    const body = schema.parse(req.body);
    const member = await PlatformAdminService.addUserToPractice(actorUserId, practiceId, body);
    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
};
platformAdminRouter.post('/practices/:id/users', addPracticeUserHandler);
platformAdminRouter.post('/practices/:id/members', addPracticeUserHandler);

// Direct practice member removal and role/status modification
platformAdminRouter.delete('/practices/:practiceId/members/:memberId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const practiceId = req.params.practiceId as string;
    const memberId = req.params.memberId as string;
    const reason = req.query.reason as string | undefined;

    const result = await PlatformAdminService.removeUserFromPractice(actorUserId, practiceId, memberId, reason);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.patch('/practices/:practiceId/members/:memberId/role', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const practiceId = req.params.practiceId as string;
    const memberId = req.params.memberId as string;

    const schema = z.object({
      role: z.nativeEnum(Role),
      isClinicalApprover: z.boolean().optional(),
    });
    const { role, isClinicalApprover } = schema.parse(req.body);

    const updated = await PlatformAdminService.updateUserPracticeRole(
      actorUserId,
      practiceId,
      memberId,
      role,
      isClinicalApprover
    );
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.patch('/practices/:practiceId/members/:memberId/clinical-status', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const practiceId = req.params.practiceId as string;
    const memberId = req.params.memberId as string;

    const schema = z.object({
      isClinicalApprover: z.boolean(),
    });
    const { isClinicalApprover } = schema.parse(req.body);

    const updated = await PlatformAdminService.updateUserClinicalStatus(
      actorUserId,
      practiceId,
      memberId,
      isClinicalApprover
    );
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.post('/practices/:id/invitations', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const practiceId = req.params.id as string;

    const schema = z.object({
      email: z.string().email(),
      role: z.nativeEnum(Role).default(Role.STAFF),
    });

    const { email, role } = schema.parse(req.body);
    const invite = await PlatformAdminService.createPracticeInvitation(actorUserId, practiceId, email, role);
    res.status(201).json(invite);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.delete('/practices/:id/invitations/:invitationId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const practiceId = req.params.id as string;
    const invitationId = req.params.invitationId as string;

    const result = await PlatformAdminService.cancelPracticeInvitation(actorUserId, practiceId, invitationId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// ==============================================================================
// 3. Global User Administration & Security
// ==============================================================================

platformAdminRouter.get('/users', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const role = req.query.role as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;

    const data = await PlatformAdminService.listUsers(actorUserId, { search, status, role, page, pageSize });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.post('/users', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');

    const schema = z.object({
      name: z.string().min(2).max(100),
      email: z.string().email(),
      phone: z.string().optional(),
      password: z.string().min(8).optional(),
      practiceId: z.string().optional(),
      role: z.nativeEnum(Role).optional(),
      isClinicalApprover: z.boolean().optional(),
    });

    const body = schema.parse(req.body);
    const user = await PlatformAdminService.createUser(actorUserId, body);
    res.status(201).json(user);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.get('/users/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const userId = req.params.id as string;
    const user = await PlatformAdminService.getUserDetails(actorUserId, userId);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
});

const updateUserHandler = async (req: AuthenticatedRequest, res: any, next: any) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const userId = req.params.id as string;

    const schema = z.object({
      name: z.string().min(2).max(100).optional(),
      email: z.string().email().optional(),
      phone: z.string().optional(),
    });

    const body = schema.parse(req.body);
    const updated = await PlatformAdminService.updateUser(actorUserId, userId, body);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};
platformAdminRouter.patch('/users/:id', updateUserHandler);
platformAdminRouter.put('/users/:id', updateUserHandler);

platformAdminRouter.post('/users/:id/activate', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const userId = req.params.id as string;
    const result = await PlatformAdminService.activateUser(actorUserId, userId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.post('/users/:id/deactivate', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const userId = req.params.id as string;
    const schema = z.object({ reason: z.string().optional() });
    const { reason } = schema.parse(req.body || {});

    const result = await PlatformAdminService.deactivateUser(actorUserId, userId, reason);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.post('/users/:id/reset-password', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const userId = req.params.id as string;

    const result = await PlatformAdminService.resetUserPassword(actorUserId, userId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.post('/users/:id/force-password-change', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const userId = req.params.id as string;

    const result = await PlatformAdminService.forcePasswordChange(actorUserId, userId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

const revokeSessionsHandler = async (req: AuthenticatedRequest, res: any, next: any) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const userId = req.params.id as string;

    const result = await PlatformAdminService.revokeUserSessions(actorUserId, userId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};
platformAdminRouter.post('/users/:id/revoke-sessions', revokeSessionsHandler);
platformAdminRouter.post('/users/:id/force-logout', revokeSessionsHandler);

platformAdminRouter.post('/users/:id/practices', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const userId = req.params.id as string;

    const schema = z.object({
      practiceId: z.string().min(1),
      role: z.nativeEnum(Role),
      isClinicalApprover: z.boolean().optional(),
    });

    const body = schema.parse(req.body);
    const member = await PlatformAdminService.addUserToPractice(actorUserId, body.practiceId, {
      userId,
      role: body.role,
      isClinicalApprover: body.isClinicalApprover,
    });
    res.status(201).json(member);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.delete('/users/:id/practices/:practiceId', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const userId = req.params.id as string;
    const practiceId = req.params.practiceId as string;
    const reason = req.query.reason as string | undefined;

    // Resolve membership ID
    const member = await prisma.practiceMember.findUnique({
      where: { practiceId_userId: { practiceId, userId } },
    });
    if (!member) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Membership not found.');

    const result = await PlatformAdminService.removeUserFromPractice(actorUserId, practiceId, member.id, reason);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.patch('/users/:id/practices/:practiceId/role', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const userId = req.params.id as string;
    const practiceId = req.params.practiceId as string;

    const schema = z.object({
      role: z.nativeEnum(Role),
      isClinicalApprover: z.boolean().optional(),
    });
    const { role, isClinicalApprover } = schema.parse(req.body);

    const member = await prisma.practiceMember.findUnique({
      where: { practiceId_userId: { practiceId, userId } },
    });
    if (!member) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Membership not found.');

    const updated = await PlatformAdminService.updateUserPracticeRole(
      actorUserId,
      practiceId,
      member.id,
      role,
      isClinicalApprover
    );
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.patch('/users/:id/practices/:practiceId/clinical-status', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const userId = req.params.id as string;
    const practiceId = req.params.practiceId as string;

    const schema = z.object({
      isClinicalApprover: z.boolean(),
    });
    const { isClinicalApprover } = schema.parse(req.body);

    const member = await prisma.practiceMember.findUnique({
      where: { practiceId_userId: { practiceId, userId } },
    });
    if (!member) throw new AppError(404, 'MEMBER_NOT_FOUND', 'Membership not found.');

    const updated = await PlatformAdminService.updateUserClinicalStatus(
      actorUserId,
      practiceId,
      member.id,
      isClinicalApprover
    );
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

// ==============================================================================
// 4. Commercial Subscriptions & Payments
// ==============================================================================

platformAdminRouter.get('/subscriptions', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;

    const data = await PlatformAdminService.listSubscriptions(actorUserId, { search, status, page, pageSize });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.get('/payments', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const search = req.query.search as string | undefined;
    const status = req.query.status as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;

    const data = await PlatformAdminService.listPayments(actorUserId, { search, status, page, pageSize });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});

// ==============================================================================
// 5. Issues & Support System
// ==============================================================================

platformAdminRouter.get('/issues', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const category = req.query.category as string | undefined;
    const priority = req.query.priority as string | undefined;
    const status = req.query.status as string | undefined;
    const practiceId = req.query.practiceId as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;

    const data = await PlatformAdminService.listIssues(actorUserId, { category, priority, status, practiceId, page, pageSize });
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.post('/issues', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');

    const schema = z.object({
      title: z.string().min(2).max(200),
      description: z.string().min(5),
      category: z.nativeEnum(IssueCategory).default(IssueCategory.OTHER),
      priority: z.nativeEnum(IssuePriority).default(IssuePriority.NORMAL),
      practiceId: z.string().optional(),
      userId: z.string().optional(),
    });

    const body = schema.parse(req.body);
    const issue = await PlatformAdminService.createIssue(actorUserId, body);
    res.status(201).json(issue);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.get('/issues/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const id = req.params.id as string;
    const issue = await PlatformAdminService.getIssueDetails(actorUserId, id);
    res.status(200).json(issue);
  } catch (err) {
    next(err);
  }
});

const updateIssueHandler = async (req: AuthenticatedRequest, res: any, next: any) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const id = req.params.id as string;

    const schema = z.object({
      status: z.nativeEnum(IssueStatus).optional(),
      priority: z.nativeEnum(IssuePriority).optional(),
      assignedToUserId: z.string().nullable().optional(),
    });

    const body = schema.parse(req.body);
    const updated = await PlatformAdminService.updateIssue(actorUserId, id, body);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};
platformAdminRouter.patch('/issues/:id', updateIssueHandler);
platformAdminRouter.put('/issues/:id', updateIssueHandler);

platformAdminRouter.post('/issues/:id/notes', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const id = req.params.id as string;

    const schema = z.object({ note: z.string().min(1) });
    const { note } = schema.parse(req.body);

    const updated = await PlatformAdminService.addIssueNote(actorUserId, id, note);
    res.status(201).json(updated);
  } catch (err) {
    next(err);
  }
});

// ==============================================================================
// 6. Support Sessions
// ==============================================================================

platformAdminRouter.get('/support-sessions', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const sessions = await PlatformAdminService.listSupportSessions(actorUserId);
    res.status(200).json(sessions);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.post('/support-sessions', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');

    const schema = z.object({
      targetPracticeId: z.string().min(1),
      targetUserId: z.string().optional(),
      reason: z.string().min(3),
      durationMinutes: z.number().int().min(15).max(120).optional(),
    });

    const body = schema.parse(req.body);
    const session = await PlatformAdminService.startSupportSession(actorUserId, body);
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.post('/support-sessions/:id/end', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const id = req.params.id as string;
    const result = await PlatformAdminService.endSupportSession(actorUserId, id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// ==============================================================================
// 7. Roles & Permissions Matrix and Member Overrides
// ==============================================================================

const getMatrixHandler = async (req: AuthenticatedRequest, res: any, next: any) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const matrix = await PlatformAdminService.getGlobalPermissionMatrix(actorUserId);
    res.status(200).json(matrix);
  } catch (err) {
    next(err);
  }
};
platformAdminRouter.get('/permission-matrix', getMatrixHandler);
platformAdminRouter.get('/roles-permissions', getMatrixHandler);
platformAdminRouter.get('/matrix', getMatrixHandler);

platformAdminRouter.get(
  '/practices/:practiceId/members/:memberId/permissions',
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
      const practiceId = req.params.practiceId as string;
      const memberId = req.params.memberId as string;

      const result = await PlatformAdminService.getMemberPermissions(actorUserId, practiceId, memberId);
      res.status(200).json(result);
    } catch (err) {
      next(err);
    }
  }
);

platformAdminRouter.post(
  '/practices/:practiceId/members/:memberId/permissions',
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
      const practiceId = req.params.practiceId as string;
      const memberId = req.params.memberId as string;

      const body = z
        .object({
          permission: z.string().min(1),
          effect: z.enum(['ALLOW', 'DENY']),
          reason: z.string().max(500).optional(),
        })
        .parse(req.body);

      const override = await PlatformAdminService.setMemberPermissionOverride(actorUserId, practiceId, memberId, body);
      res.status(200).json(override);
    } catch (err) {
      next(err);
    }
  }
);

platformAdminRouter.delete(
  '/practices/:practiceId/members/:memberId/permissions/:permission',
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const actorUserId = req.user?.id;
      if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
      const practiceId = req.params.practiceId as string;
      const memberId = req.params.memberId as string;
      const permission = req.params.permission as string;

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

// ==============================================================================
// 8. Platform Audit & Security Logs
// ==============================================================================

const listAuditHandler = async (req: AuthenticatedRequest, res: any, next: any) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const action = req.query.action as string | undefined;
    const practiceId = req.query.practiceId as string | undefined;
    const userId = req.query.userId as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 25;

    const logs = await PlatformAdminService.listAuditLogs(actorUserId, { action, practiceId, userId, page, pageSize });
    res.status(200).json(logs);
  } catch (err) {
    next(err);
  }
};
platformAdminRouter.get('/audit', listAuditHandler);
platformAdminRouter.get('/audit-logs', listAuditHandler);

// ==============================================================================
// 9. Subscriptions Management & Complimentary Access (Super Admin Only)
// ==============================================================================

platformAdminRouter.get('/subscriptions', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const subscriptions = await SubscriptionService.listAllPlatformSubscriptions();
    res.status(200).json(subscriptions);
  } catch (err) {
    next(err);
  }
});

const complimentaryAccessSchema = z.object({
  email: z.string().email('Valid recipient email address is required'),
  accessType: z.enum(['INDIVIDUAL', 'CLINIC']),
  interval: z.enum(['MONTHLY', 'ANNUAL']).optional(),
  durationMonths: z.number().int().min(0).max(36).optional(),
  isUnlimited: z.boolean().optional(),
  reason: z.string().min(1, 'Internal reason or note is required'),
});

platformAdminRouter.post('/subscriptions/complimentary', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const { email, accessType, interval, durationMonths, isUnlimited, reason } = complimentaryAccessSchema.parse(req.body);
    const subscription = await SubscriptionService.grantComplimentarySubscription({
      email,
      accessType,
      interval,
      durationMonths: durationMonths === 0 ? undefined : durationMonths,
      isUnlimited: isUnlimited === true || durationMonths === 0,
      reason,
      actorUserId,
    });
    res.status(201).json({
      message: 'Complimentary access granted successfully.',
      subscription,
    });
  } catch (err) {
    next(err);
  }
});

const revokeComplimentarySchema = z.object({
  reason: z.string().optional(),
});

platformAdminRouter.post('/subscriptions/:id/revoke', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const { reason } = revokeComplimentarySchema.parse(req.body || {});
    const subscription = await SubscriptionService.revokeComplimentarySubscription(
      String(req.params.id),
      actorUserId,
      reason
    );
    res.status(200).json({
      message: 'Complimentary access revoked successfully.',
      subscription,
    });
  } catch (err) {
    next(err);
  }
});

// ==============================================================================
// 10. Inventory Add-on Management (Platform Super Admin Only)
// ==============================================================================

const addonActionSchema = z.object({
  reason: z.string().optional(),
});

// Helper to resolve practice ID whether passed practiceId or subscriptionId
async function resolvePracticeIdFromParam(paramId: string): Promise<string> {
  if (process.env.VETRX_FAST_TEST === '1') {
    return paramId;
  }
  // Check if paramId matches a subscription
  const sub = await prisma.subscription.findUnique({
    where: { id: paramId },
    select: { practiceId: true },
  });
  if (sub) {
    return sub.practiceId;
  }
  return paramId;
}

// GET /practices/:id/addons/inventory - Query Inventory Add-on state
platformAdminRouter.get('/practices/:id/addons/inventory', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const practiceId = await resolvePracticeIdFromParam(String(req.params.id));
    const status = await SubscriptionService.getPracticeAddonStatus(practiceId);
    res.status(200).json(status);
  } catch (err) {
    next(err);
  }
});

// POST /practices/:id/addons/inventory/grant - Grant Inventory Add-on
platformAdminRouter.post('/practices/:id/addons/inventory/grant', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const practiceId = await resolvePracticeIdFromParam(String(req.params.id));
    const { reason } = addonActionSchema.parse(req.body || {});
    const result = await SubscriptionService.grantInventoryAddon({
      practiceId,
      actorUserId,
      reason,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// POST /practices/:id/addons/inventory/revoke - Revoke Inventory Add-on
platformAdminRouter.post('/practices/:id/addons/inventory/revoke', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const practiceId = await resolvePracticeIdFromParam(String(req.params.id));
    const { reason } = addonActionSchema.parse(req.body || {});
    const result = await SubscriptionService.revokeInventoryAddon({
      practiceId,
      actorUserId,
      reason,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// Subscription aliases for convenience
platformAdminRouter.post('/subscriptions/:id/addons/inventory/grant', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const practiceId = await resolvePracticeIdFromParam(String(req.params.id));
    const { reason } = addonActionSchema.parse(req.body || {});
    const result = await SubscriptionService.grantInventoryAddon({
      practiceId,
      actorUserId,
      reason,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

platformAdminRouter.post('/subscriptions/:id/addons/inventory/revoke', async (req: AuthenticatedRequest, res, next) => {
  try {
    const actorUserId = req.user?.id;
    if (!actorUserId) throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    const practiceId = await resolvePracticeIdFromParam(String(req.params.id));
    const { reason } = addonActionSchema.parse(req.body || {});
    const result = await SubscriptionService.revokeInventoryAddon({
      practiceId,
      actorUserId,
      reason,
    });
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

