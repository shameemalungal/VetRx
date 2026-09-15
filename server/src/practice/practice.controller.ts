import { Router } from 'express';
import { z } from 'zod';
import { PracticeService } from './practice.service.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePractice } from '../middleware/tenant.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const practiceRouter = Router();

// Require both authentication and tenant derivation for all practice routes
practiceRouter.use(requireAuth, requirePractice);

const updatePracticeSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens').optional(),
});

const updateSettingsSchema = z.object({
  clinicName: z.string().max(120).nullable().optional(),
  address: z.string().max(300).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal('')),
  registrationNumber: z.string().max(60).nullable().optional(),
  doctorName: z.string().max(120).nullable().optional(),
  doctorRegistrationNumber: z.string().max(60).nullable().optional(),
  doctorPhotoUrl: z.string().nullable().optional(),
  doctorSignatureUrl: z.string().nullable().optional(),
  clinicLogoUrl: z.string().nullable().optional(),
  ownerSpecialInstructionEnabled: z.boolean().optional(),
  mykgvoaMemberId: z.string().max(50).nullable().optional(),
});

/**
 * GET /api/practice
 * Returns active practice info.
 */
practiceRouter.get('/', (req: AuthenticatedRequest, res) => {
  res.status(200).json(req.practice);
});

/**
 * PATCH /api/practice
 * Updates practice name or slug.
 */
practiceRouter.patch('/', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.practice || !req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication and practice required.');
    }

    const updates = updatePracticeSchema.parse(req.body);
    const updated = await PracticeService.updatePractice(req.practice.id, req.user.id, updates);
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/practice/settings
 * Returns practice settings.
 */
practiceRouter.get('/settings', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.practice) {
      throw new AppError(401, 'UNAUTHORIZED', 'Practice context required.');
    }

    const settings = await PracticeService.getSettings(req.practice.id);
    res.status(200).json(settings);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/practice/settings
 * Updates practice settings.
 */
practiceRouter.patch('/settings', async (req: AuthenticatedRequest, res, next) => {
  try {
    if (!req.practice) {
      throw new AppError(401, 'UNAUTHORIZED', 'Practice context required.');
    }

    const updates = updateSettingsSchema.parse(req.body);
    const sanitizedUpdates = {
      ...updates,
      email: updates.email === '' ? null : updates.email,
    };

    const updated = await PracticeService.updateSettings(req.practice.id, sanitizedUpdates);
    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
});
