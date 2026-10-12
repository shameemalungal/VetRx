// ==============================================================================
// VetRx Call & Visit Planner (CVP) — Express Router & Controller
// Strictly scoped to Practice boundary via requireAuth and requirePractice.
// ==============================================================================

import { Router } from 'express';
import { z } from 'zod';
import { CvpBackendService } from './cvp.service.js';
import { requireAuth } from '../middleware/auth.js';
import { requirePractice } from '../middleware/tenant.js';
import { AppError } from '../middleware/errorHandler.js';
import type { AuthenticatedRequest } from '../types/index.js';

export const cvpRouter = Router();

// Enforce strict authentication and tenant derivation
cvpRouter.use(requireAuth, requirePractice);

function getPracticeId(req: AuthenticatedRequest): string {
  if (!req.practice?.id) {
    throw new AppError(401, 'UNAUTHORIZED', 'Tenant practice context required.');
  }
  return req.practice.id;
}

function getId(req: AuthenticatedRequest): string {
  const id = req.params.id;
  if (!id) {
    throw new AppError(400, 'BAD_REQUEST', 'Missing resource ID.');
  }
  return Array.isArray(id) ? id[0] : id;
}

const createCallSchema = z.object({
  callerPhone: z.string().min(1).max(30),
  ownerId: z.string().uuid().nullable().optional(),
  tempOwnerName: z.string().max(120).nullable().optional(),
  tempPatientName: z.string().max(120).nullable().optional(),
  species: z.string().max(60).nullable().optional(),
  animalCount: z.number().int().min(1).default(1),
  symptoms: z.string().min(1).max(2000),
  tentativeAssessment: z.string().max(2000).nullable().optional(),
  priority: z.enum(['EMERGENCY', 'URGENT', 'COULD_NOT_ASSESS', 'PLANNED']).default('PLANNED'),
  flexibility: z.enum(['MUST_ATTEND_TODAY', 'CAN_POSTPONE_TODAY', 'PREFERRED_TODAY', 'SPECIFIC_DATE']).default('MUST_ATTEND_TODAY'),
  preferredDate: z.string().datetime().nullable().optional().transform((v) => (v ? new Date(v) : null)),
  locationAddress: z.string().max(500).nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  plannedProcedure: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const updateCallSchema = createCallSchema.partial().extend({
  status: z.enum(['LOGGED', 'SCHEDULED', 'CANCELLED']).optional(),
});

// ── GET /api/calls ────────────────────────────────────────────────────────────
cvpRouter.get('/calls', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const tab = req.query.tab as 'today' | 'upcoming' | 'postponed' | 'all' | undefined;
    const search = req.query.search as string | undefined;
    const priority = req.query.priority as any;
    const status = req.query.status as any;

    const calls = await CvpBackendService.listCalls(practiceId, {
      tab,
      search,
      priority,
      status,
    });
    res.status(200).json(calls);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/calls/capacity ───────────────────────────────────────────────────
cvpRouter.get('/calls/capacity', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const workingHours = req.query.workingMinutes
      ? parseInt(req.query.workingMinutes as string, 10)
      : 480;

    const metrics = await CvpBackendService.getTodayCapacityMetrics(practiceId, workingHours);
    res.status(200).json(metrics);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/calls/:id ────────────────────────────────────────────────────────
cvpRouter.get('/calls/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const call = await CvpBackendService.getCallById(getId(req), practiceId);
    res.status(200).json(call);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/calls ───────────────────────────────────────────────────────────
cvpRouter.post('/calls', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const parsed = createCallSchema.parse(req.body);
    const call = await CvpBackendService.createCall(practiceId, parsed);
    res.status(201).json(call);
  } catch (err) {
    next(err);
  }
});

// ── PATCH /api/calls/:id ──────────────────────────────────────────────────────
cvpRouter.patch('/calls/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const parsed = updateCallSchema.parse(req.body);
    const updated = await CvpBackendService.updateCall(getId(req), practiceId, parsed);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/calls/:id/postpone ──────────────────────────────────────────────
cvpRouter.post('/calls/:id/postpone', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const schema = z.object({
      targetDate: z.string().datetime().transform((d) => new Date(d)),
      reason: z.string().max(500).optional(),
    });
    const { targetDate, reason } = schema.parse(req.body);
    const postponed = await CvpBackendService.postponeCall(getId(req), practiceId, targetDate, reason);
    res.status(200).json(postponed);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/daily-plans ──────────────────────────────────────────────────────
cvpRouter.get('/daily-plans', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const dateQuery = req.query.date as string | undefined;
    const planDate = dateQuery ? new Date(dateQuery) : new Date();
    const plan = await CvpBackendService.getDailyPlan(practiceId, planDate);
    res.status(200).json(plan || null);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/daily-plans ─────────────────────────────────────────────────────
const upsertPlanSchema = z.object({
  planDate: z.string().transform((v) => new Date(v)),
  doctorUserId: z.string().nullable().optional(),
  startLocationAddress: z.string().max(500).nullable().optional(),
  startLatitude: z.number().nullable().optional(),
  startLongitude: z.number().nullable().optional(),
  endLocationAddress: z.string().max(500).nullable().optional(),
  totalEstimatedKm: z.number().default(0),
  totalEstimatedTravelMinutes: z.number().int().default(0),
  totalEstimatedVisitMinutes: z.number().int().default(0),
  workingMinutesAvailable: z.number().int().default(480),
  status: z.enum(['DRAFT', 'CONFIRMED', 'ACTIVE', 'COMPLETED']).default('DRAFT'),
  stops: z
    .array(
      z.object({
        visitId: z.string(),
        stopOrder: z.number().int(),
        estimatedArrival: z.string().datetime().nullable().optional().transform((v) => (v ? new Date(v) : null)),
        estimatedDeparture: z.string().datetime().nullable().optional().transform((v) => (v ? new Date(v) : null)),
        isLocked: z.boolean().default(false),
      })
    )
    .optional(),
});

cvpRouter.post('/daily-plans', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const parsed = upsertPlanSchema.parse(req.body);
    const saved = await CvpBackendService.upsertDailyPlan(practiceId, parsed);
    res.status(200).json(saved);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/daily-plans/:id/confirm ─────────────────────────────────────────
cvpRouter.post('/daily-plans/:id/confirm', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const confirmed = await CvpBackendService.confirmDailyPlan(practiceId, getId(req));
    res.status(200).json(confirmed);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/visits/:id/postpone ─────────────────────────────────────────────
cvpRouter.post('/visits/:id/postpone', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const schema = z.object({
      targetDate: z.string().datetime().transform((d) => new Date(d)),
      reason: z.string().max(500).optional(),
    });
    const { targetDate, reason } = schema.parse(req.body);
    const postponed = await CvpBackendService.postponeVisit(practiceId, getId(req), targetDate, reason);
    res.status(200).json(postponed);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/visits/:id ───────────────────────────────────────────────────────
cvpRouter.get('/visits/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const visit = await CvpBackendService.getVisitById(practiceId, getId(req));
    res.status(200).json(visit);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/visits/:id/arrive ───────────────────────────────────────────────
const arriveSchema = z.object({
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  accuracy: z.number().nullable().optional(),
});

cvpRouter.post('/visits/:id/arrive', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const locationData = arriveSchema.parse(req.body);
    const arrived = await CvpBackendService.recordArrival(practiceId, getId(req), locationData);
    res.status(200).json(arrived);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/visits/:id/start ────────────────────────────────────────────────
cvpRouter.post('/visits/:id/start', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const started = await CvpBackendService.startVisit(practiceId, getId(req));
    res.status(200).json(started);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/visits/:id/procedures ───────────────────────────────────────────
const recordProcedureSchema = z.object({
  patientId: z.string().nullable().optional(),
  patientName: z.string().max(120).nullable().optional(),
  procedureCategory: z.string().min(1).max(120),
  procedureName: z.string().min(1).max(200),
  notes: z.string().max(2000).nullable().optional(),
  standardFee: z.number().nonnegative().optional(),
});

cvpRouter.post('/visits/:id/procedures', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const parsed = recordProcedureSchema.parse(req.body);
    const procedure = await CvpBackendService.recordProcedure(practiceId, getId(req), parsed);
    res.status(201).json(procedure);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/visits/:id/medicine-usage ───────────────────────────────────────
const recordMedicineUsageSchema = z.object({
  patientId: z.string().nullable().optional(),
  patientName: z.string().max(120).nullable().optional(),
  medicineId: z.string().nullable().optional(),
  medicineName: z.string().min(1).max(200),
  batchNumber: z.string().max(100).nullable().optional(),
  quantityUsed: z.number().positive(),
  unit: z.string().max(50).nullable().optional(),
  route: z.string().max(100).nullable().optional(),
  instructions: z.string().max(1000).nullable().optional(),
  idempotencyKey: z.string().max(100).nullable().optional(),
  locationId: z.string().nullable().optional(),
});

cvpRouter.post('/visits/:id/medicine-usage', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const parsed = recordMedicineUsageSchema.parse(req.body);
    const usage = await CvpBackendService.recordMedicineUsage(practiceId, getId(req), {
      ...parsed,
      userId: req.user?.id || null,
    });
    res.status(201).json(usage);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/visits/:id/complete ─────────────────────────────────────────────
const completeVisitSchema = z.object({
  actualDurationMinutes: z.number().int().positive().optional(),
  completionNotes: z.string().max(4000).nullable().optional(),
});

cvpRouter.post('/visits/:id/complete', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const parsed = completeVisitSchema.parse(req.body);
    const completed = await CvpBackendService.completeVisit(practiceId, getId(req), parsed);
    res.status(200).json(completed);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/visits/:id/resume ───────────────────────────────────────────────
cvpRouter.post('/visits/:id/resume', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const resumed = await CvpBackendService.resumeVisit(practiceId, getId(req));
    res.status(200).json(resumed);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/visits/:id/timeline ──────────────────────────────────────────────
cvpRouter.get('/visits/:id/timeline', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const timeline = await CvpBackendService.getVisitTimeline(practiceId, getId(req));
    res.status(200).json(timeline);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/follow-ups (Phase 8) ─────────────────────────────────────────────
cvpRouter.get('/follow-ups', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const list = await CvpBackendService.listFollowUps(practiceId, req.query as any);
    res.status(200).json(list);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/follow-ups (Phase 8) ────────────────────────────────────────────
cvpRouter.post('/follow-ups', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const created = await CvpBackendService.createFollowUp(practiceId, req.body);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// ── POST /api/recurring-schedules (Phase 8) ───────────────────────────────────
cvpRouter.post('/recurring-schedules', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const created = await CvpBackendService.createRecurringSchedule(practiceId, req.body);
    res.status(201).json(created);
  } catch (err) {
    next(err);
  }
});

// ── GET /api/duration-estimates (Phase 8) ─────────────────────────────────────
cvpRouter.get('/duration-estimates', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const estimates = await CvpBackendService.getDurationEstimates(practiceId);
    res.status(200).json(estimates);
  } catch (err) {
    next(err);
  }
});

// ── PUT /api/duration-estimates/:category (Phase 8) ───────────────────────────
cvpRouter.put('/duration-estimates/:category', async (req: AuthenticatedRequest, res, next) => {
  try {
    const practiceId = getPracticeId(req);
    const category = String(req.params.category);
    const overrideMinutes = req.body.overrideMinutes != null ? Number(req.body.overrideMinutes) : null;
    const updated = await CvpBackendService.setDurationEstimateOverride(practiceId, category, overrideMinutes);
    res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
});


