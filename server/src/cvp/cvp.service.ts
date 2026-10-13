// ==============================================================================
// VetRx Call & Visit Planner (CVP) — Backend Service
// Strictly enforces tenant isolation on all CVP queries by practiceId.
// ==============================================================================

import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { AuditService } from '../lib/audit.service.js';
import { InventoryService } from '../inventory/inventory.service.js';
import type { CallPriority, VisitFlexibility, CallStatus, VisitStatus } from '@prisma/client';

export class CvpBackendService {
  // ── List Calls ────────────────────────────────────────────────────────
  static async listCalls(
    practiceId: string,
    filters: {
      tab?: 'today' | 'upcoming' | 'postponed' | 'all';
      search?: string;
      priority?: CallPriority;
      status?: CallStatus;
    } = {}
  ) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where: any = { practiceId };

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.priority) {
      where.priority = filters.priority;
    }

    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim();
      where.OR = [
        { callerPhone: { contains: q } },
        { symptoms: { contains: q, mode: 'insensitive' } },
        { locationAddress: { contains: q, mode: 'insensitive' } },
        { tempOwnerName: { contains: q, mode: 'insensitive' } },
        { owner: { name: { contains: q, mode: 'insensitive' } } },
      ];
    }

    if (filters.tab === 'today') {
      where.status = { not: 'CANCELLED' };
      where.OR = [
        { priority: 'EMERGENCY' },
        { flexibility: 'MUST_ATTEND_TODAY' },
        {
          preferredDate: {
            gte: today,
            lt: tomorrow,
          },
        },
      ];
    } else if (filters.tab === 'upcoming') {
      where.status = { not: 'CANCELLED' };
      where.flexibility = { not: 'CAN_POSTPONE_TODAY' };
      where.preferredDate = { gte: tomorrow };
    } else if (filters.tab === 'postponed') {
      where.status = { not: 'CANCELLED' };
      where.flexibility = 'CAN_POSTPONE_TODAY';
    }

    return prisma.call.findMany({
      where,
      orderBy: [
        { priority: 'asc' }, // EMERGENCY (0) first
        { createdAt: 'desc' },
      ],
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            patients: {
              select: {
                id: true,
                name: true,
                species: true,
              },
            },
          },
        },
      },
    });
  }

  // ── Get Call by ID ────────────────────────────────────────────────────
  static async getCallById(id: string, practiceId: string) {
    const call = await prisma.call.findFirst({
      where: { id, practiceId },
      include: {
        owner: {
          include: {
            patients: true,
            locations: true,
          },
        },
        visits: {
          include: {
            cases: true,
          },
        },
      },
    });

    if (!call) {
      throw new AppError(404, 'CALL_NOT_FOUND', 'Call record not found.');
    }

    return call;
  }

  // ── Create Call ───────────────────────────────────────────────────────
  static async createCall(
    practiceId: string,
    data: {
      callerPhone: string;
      ownerId?: string | null;
      tempOwnerName?: string | null;
      tempPatientName?: string | null;
      species?: string | null;
      animalCount?: number;
      symptoms: string;
      tentativeAssessment?: string | null;
      priority?: CallPriority;
      flexibility?: VisitFlexibility;
      preferredDate?: Date | null;
      locationAddress?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      plannedProcedure?: string | null;
      notes?: string | null;
    }
  ) {
    const call = await prisma.call.create({
      data: {
        practiceId,
        callerPhone: data.callerPhone.trim(),
        ownerId: data.ownerId || null,
        tempOwnerName: data.tempOwnerName?.trim() || null,
        tempPatientName: data.tempPatientName?.trim() || null,
        species: data.species?.trim() || null,
        animalCount: data.animalCount || 1,
        symptoms: data.symptoms.trim(),
        tentativeAssessment: data.tentativeAssessment?.trim() || null,
        priority: data.priority || 'PLANNED',
        flexibility: data.flexibility || 'MUST_ATTEND_TODAY',
        preferredDate: data.preferredDate || null,
        locationAddress: data.locationAddress?.trim() || null,
        latitude: data.latitude || null,
        longitude: data.longitude || null,
        plannedProcedure: data.plannedProcedure?.trim() || null,
        notes: data.notes?.trim() || null,
        status: 'LOGGED',
      },
      include: {
        owner: true,
      },
    });

    void AuditService.record({
      practiceId,
      action: 'CALL_REGISTERED',
      resource: 'Call',
      resourceId: call.id,
      details: {
        callerPhone: call.callerPhone,
        priority: call.priority,
        ownerId: call.ownerId,
      },
    });

    return call;
  }

  // ── Update Call ───────────────────────────────────────────────────────
  static async updateCall(
    id: string,
    practiceId: string,
    data: Partial<{
      callerPhone: string;
      ownerId: string | null;
      tempOwnerName: string | null;
      tempPatientName: string | null;
      species: string | null;
      animalCount: number;
      symptoms: string;
      tentativeAssessment: string | null;
      priority: CallPriority;
      flexibility: VisitFlexibility;
      preferredDate: Date | null;
      locationAddress: string | null;
      latitude: number | null;
      longitude: number | null;
      status: CallStatus;
      plannedProcedure: string | null;
      notes: string | null;
    }>
  ) {
    await this.getCallById(id, practiceId);

    const updated = await prisma.call.update({
      where: { id },
      data,
      include: {
        owner: true,
      },
    });

    void AuditService.record({
      practiceId,
      action: 'CALL_UPDATED',
      resource: 'Call',
      resourceId: id,
      details: data,
    });

    return updated;
  }

  // ── Postpone Call ─────────────────────────────────────────────────────
  static async postponeCall(
    id: string,
    practiceId: string,
    targetDate: Date,
    reason: string = 'Postponed by Doctor'
  ) {
    return this.updateCall(id, practiceId, {
      flexibility: 'CAN_POSTPONE_TODAY',
      preferredDate: targetDate,
      notes: reason,
    });
  }

  // ── Schedule Visit from Call (Call-to-Visit Workflow) ─────────────────
  static async scheduleCall(
    id: string,
    practiceId: string,
    data: {
      scheduledDate: Date;
      priority?: CallPriority;
      flexibility?: VisitFlexibility;
      preferredTime?: string | null;
      locationId?: string | null;
      address?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      estimatedDurationMinutes?: number;
      notes?: string | null;
      cases?: Array<{
        patientId?: string | null;
        patientName?: string | null;
        species?: string | null;
        chiefComplaint: string;
        tentativeDiagnosis?: string | null;
        procedureCategory?: string | null;
      }>;
      addToTodayPlan?: boolean;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Verify Call belongs to practice
      const call = await tx.call.findFirst({
        where: { id, practiceId },
        include: {
          owner: true,
          visits: {
            include: { cases: true },
          },
        },
      });

      if (!call) {
        throw new AppError(404, 'CALL_NOT_FOUND', 'Call record not found.');
      }

      // Idempotency: If this call already has a visit scheduled, return existing visit and call
      if (call.visits && call.visits.length > 0) {
        const existingVisit = call.visits[0];
        return {
          visit: existingVisit,
          call,
          alreadyExisted: true,
        };
      }

      // 2. Resolve or create Owner if not present
      let resolvedOwnerId = call.ownerId;
      if (!resolvedOwnerId) {
        let owner = await tx.owner.findFirst({
          where: { practiceId, phone: call.callerPhone },
        });

        if (!owner) {
          owner = await tx.owner.create({
            data: {
              practiceId,
              name: call.tempOwnerName?.trim() || 'Client (Direct Caller)',
              phone: call.callerPhone.trim(),
              address: data.address?.trim() || call.locationAddress?.trim() || null,
            },
          });
        }
        resolvedOwnerId = owner.id;

        // Associate owner with the call
        await tx.call.update({
          where: { id: call.id },
          data: { ownerId: resolvedOwnerId },
        });
      }

      // 3. Resolve Location & Metadata
      const resolvedAddress =
        data.address?.trim() ||
        call.locationAddress?.trim() ||
        call.owner?.address ||
        'Client Location';

      const resolvedLat = data.latitude ?? call.latitude ?? null;
      const resolvedLng = data.longitude ?? call.longitude ?? null;
      const resolvedPriority = data.priority || call.priority || 'PLANNED';
      const resolvedFlexibility = data.flexibility || call.flexibility || 'MUST_ATTEND_TODAY';

      // 4. Create Visit
      const visit = await tx.visit.create({
        data: {
          practiceId,
          callId: call.id,
          ownerId: resolvedOwnerId,
          locationId: data.locationId || null,
          address: resolvedAddress,
          latitude: resolvedLat,
          longitude: resolvedLng,
          priority: resolvedPriority,
          flexibility: resolvedFlexibility,
          scheduledDate: data.scheduledDate,
          estimatedDurationMinutes: data.estimatedDurationMinutes || (resolvedPriority === 'EMERGENCY' ? 45 : 30),
          notes: data.notes?.trim() || call.notes?.trim() || null,
          status: 'REGISTERED',
          scheduledAt: new Date(),
        },
      });

      // 5. Create VisitCase(s)
      const inputCases = data.cases && data.cases.length > 0 ? data.cases : null;
      if (inputCases) {
        for (const c of inputCases) {
          await tx.visitCase.create({
            data: {
              practiceId,
              visitId: visit.id,
              patientId: c.patientId || null,
              chiefComplaint: c.chiefComplaint.trim() || call.symptoms,
              tentativeDiagnosis: c.tentativeDiagnosis?.trim() || call.tentativeAssessment || null,
              procedureCategory: c.procedureCategory?.trim() || call.plannedProcedure || (resolvedPriority === 'EMERGENCY' ? 'EMERGENCY' : 'GENERAL'),
              notes: c.patientName ? `Patient: ${c.patientName}` : null,
            },
          });
        }
      } else {
        // Create default case from call symptoms
        await tx.visitCase.create({
          data: {
            practiceId,
            visitId: visit.id,
            chiefComplaint: call.symptoms,
            tentativeDiagnosis: call.tentativeAssessment || null,
            procedureCategory: call.plannedProcedure || (resolvedPriority === 'EMERGENCY' ? 'EMERGENCY' : 'GENERAL'),
            notes: call.species ? `Species: ${call.species}${call.tempPatientName ? ` (${call.tempPatientName})` : ''}` : null,
          },
        });
      }

      // 6. Update Call status to SCHEDULED
      const updatedCall = await tx.call.update({
        where: { id: call.id },
        data: {
          status: 'SCHEDULED',
          preferredDate: data.scheduledDate,
        },
        include: {
          owner: true,
        },
      });

      // 7. Add to Today's Plan if requested
      if (data.addToTodayPlan) {
        const planDate = new Date(data.scheduledDate);
        planDate.setHours(0, 0, 0, 0);

        let plan = await tx.dailyPlan.findFirst({
          where: { practiceId, planDate },
          include: {
            routeStops: {
              orderBy: { stopOrder: 'desc' },
              take: 1,
            },
          },
        });

        if (!plan) {
          plan = await tx.dailyPlan.create({
            data: {
              practiceId,
              planDate,
              status: 'DRAFT',
            },
            include: {
              routeStops: true,
            },
          });
        }

        const maxStopOrder = plan.routeStops[0]?.stopOrder ?? -1;
        await tx.routeStop.create({
          data: {
            dailyPlanId: plan.id,
            visitId: visit.id,
            stopOrder: maxStopOrder + 1,
            isLocked: false,
          },
        });
      }

      // 8. Fetch complete visit with cases
      const completeVisit = await tx.visit.findUnique({
        where: { id: visit.id },
        include: {
          owner: true,
          cases: {
            include: {
              patient: true,
            },
          },
          routeStops: true,
        },
      });

      void AuditService.record({
        practiceId,
        action: 'VISIT_SCHEDULED_FROM_CALL',
        resource: 'Visit',
        resourceId: visit.id,
        details: {
          callId: call.id,
          priority: visit.priority,
          scheduledDate: visit.scheduledDate,
          addToTodayPlan: Boolean(data.addToTodayPlan),
        },
      });

      return {
        visit: completeVisit!,
        call: updatedCall,
        alreadyExisted: false,
      };
    });
  }

  // ── Close Call Without Visit ──────────────────────────────────────────
  static async closeCall(
    id: string,
    practiceId: string,
    data: {
      reason: string;
      reasonDetails?: string;
      clinicalNotes?: string;
    }
  ) {
    const call = await this.getCallById(id, practiceId);
    const closureNote = `[Closed: ${data.reason}]${data.reasonDetails ? ` ${data.reasonDetails}` : ''}${data.clinicalNotes ? ` | Notes: ${data.clinicalNotes}` : ''}`;
    const updatedNotes = call.notes ? `${call.notes} | ${closureNote}` : closureNote;

    const updated = await prisma.call.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        notes: updatedNotes,
      },
      include: {
        owner: true,
        visits: true,
      },
    });

    void AuditService.record({
      practiceId,
      action: 'CALL_CLOSED_NO_VISIT',
      resource: 'Call',
      resourceId: id,
      details: {
        reason: data.reason,
        callerPhone: call.callerPhone,
      },
    });

    return updated;
  }

  // ── List Visits ───────────────────────────────────────────────────────
  static async listVisits(
    practiceId: string,
    filters?: {
      date?: string;
      callId?: string;
      status?: string;
    }
  ) {
    const where: any = { practiceId };
    if (filters?.callId) {
      where.callId = filters.callId;
    }
    if (filters?.status) {
      where.status = filters.status as VisitStatus;
    }
    if (filters?.date) {
      const d = new Date(filters.date);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(nextDay.getDate() + 1);
      where.scheduledDate = {
        gte: d,
        lt: nextDay,
      };
    }

    return prisma.visit.findMany({
      where,
      orderBy: [{ scheduledDate: 'asc' }, { sequenceOrder: 'asc' }, { createdAt: 'desc' }],
      include: {
        owner: true,
        call: true,
        cases: {
          include: {
            patient: true,
          },
        },
        routeStops: true,
      },
    });
  }

  // ── Today Capacity Metrics ───────────────────────────────────────────
  static async getTodayCapacityMetrics(practiceId: string, workingHoursTotal: number = 480) {
    const todayCalls = await this.listCalls(practiceId, { tab: 'today' });

    let emergencyCount = 0;
    let urgentCount = 0;
    let couldNotAssessCount = 0;
    let plannedCount = 0;
    let allocatedVisitMinutes = 0;

    for (const call of todayCalls) {
      if (call.priority === 'EMERGENCY') emergencyCount++;
      else if (call.priority === 'URGENT') urgentCount++;
      else if (call.priority === 'COULD_NOT_ASSESS') couldNotAssessCount++;
      else plannedCount++;

      const duration = call.priority === 'EMERGENCY' ? 45 : 30;
      allocatedVisitMinutes += duration;
    }

    const transitPerStop = 20;
    const allocatedTravelMinutes = todayCalls.length > 0 ? todayCalls.length * transitPerStop : 0;
    const totalAllocatedMinutes = allocatedVisitMinutes + allocatedTravelMinutes;
    const remainingMinutes = Math.max(0, workingHoursTotal - totalAllocatedMinutes);
    const isOverCapacity = totalAllocatedMinutes > workingHoursTotal;
    const overCapacityMinutes = isOverCapacity ? totalAllocatedMinutes - workingHoursTotal : 0;

    return {
      workingMinutesAvailable: workingHoursTotal,
      allocatedVisitMinutes,
      allocatedTravelMinutes,
      totalAllocatedMinutes,
      remainingMinutes,
      isOverCapacity,
      overCapacityMinutes,
      totalCallsCount: todayCalls.length,
      emergencyCount,
      urgentCount,
      couldNotAssessCount,
      plannedCount,
    };
  }

  // ── Daily Plan Management (Phase 4) ──────────────────────────────────
  static async getDailyPlan(practiceId: string, planDate: Date) {
    const d = new Date(planDate);
    d.setHours(0, 0, 0, 0);

    return prisma.dailyPlan.findFirst({
      where: {
        practiceId,
        planDate: d,
      },
      include: {
        routeStops: {
          orderBy: { stopOrder: 'asc' },
          include: {
            visit: {
              include: {
                owner: true,
                cases: true,
              },
            },
          },
        },
      },
    });
  }

  static async upsertDailyPlan(
    practiceId: string,
    data: {
      planDate: Date;
      doctorUserId?: string | null;
      startLocationAddress?: string | null;
      startLatitude?: number | null;
      startLongitude?: number | null;
      endLocationAddress?: string | null;
      totalEstimatedKm?: number;
      totalEstimatedTravelMinutes?: number;
      totalEstimatedVisitMinutes?: number;
      workingMinutesAvailable?: number;
      status?: string;
      stops?: Array<{
        visitId: string;
        stopOrder: number;
        estimatedArrival?: Date | null;
        estimatedDeparture?: Date | null;
        isLocked?: boolean;
      }>;
    }
  ) {
    const d = new Date(data.planDate);
    d.setHours(0, 0, 0, 0);

    return prisma.$transaction(async (tx) => {
      let plan = await tx.dailyPlan.findFirst({
        where: { practiceId, planDate: d },
      });

      if (!plan) {
        plan = await tx.dailyPlan.create({
          data: {
            practiceId,
            planDate: d,
            doctorUserId: data.doctorUserId || null,
            startLocationAddress: data.startLocationAddress || null,
            startLatitude: data.startLatitude || null,
            startLongitude: data.startLongitude || null,
            endLocationAddress: data.endLocationAddress || null,
            totalEstimatedKm: data.totalEstimatedKm || 0,
            totalEstimatedTravelMinutes: data.totalEstimatedTravelMinutes || 0,
            totalEstimatedVisitMinutes: data.totalEstimatedVisitMinutes || 0,
            workingMinutesAvailable: data.workingMinutesAvailable || 480,
            status: data.status || 'DRAFT',
          },
        });
      } else {
        plan = await tx.dailyPlan.update({
          where: { id: plan.id },
          data: {
            doctorUserId: data.doctorUserId || plan.doctorUserId,
            startLocationAddress: data.startLocationAddress || plan.startLocationAddress,
            startLatitude: data.startLatitude ?? plan.startLatitude,
            startLongitude: data.startLongitude ?? plan.startLongitude,
            endLocationAddress: data.endLocationAddress || plan.endLocationAddress,
            totalEstimatedKm: data.totalEstimatedKm ?? plan.totalEstimatedKm,
            totalEstimatedTravelMinutes: data.totalEstimatedTravelMinutes ?? plan.totalEstimatedTravelMinutes,
            totalEstimatedVisitMinutes: data.totalEstimatedVisitMinutes ?? plan.totalEstimatedVisitMinutes,
            workingMinutesAvailable: data.workingMinutesAvailable ?? plan.workingMinutesAvailable,
            status: data.status || plan.status,
          },
        });
      }

      // Upsert Route Stops if provided
      if (data.stops && data.stops.length > 0) {
        // Delete previous stops for this plan and recreate
        await tx.routeStop.deleteMany({
          where: { dailyPlanId: plan.id },
        });

        for (const s of data.stops) {
          // Verify visit belongs to same practice
          const visit = await tx.visit.findFirst({
            where: { id: s.visitId, practiceId },
          });

          if (visit) {
            await tx.routeStop.create({
              data: {
                dailyPlanId: plan.id,
                visitId: s.visitId,
                stopOrder: s.stopOrder,
                estimatedArrival: s.estimatedArrival || null,
                estimatedDeparture: s.estimatedDeparture || null,
                isLocked: s.isLocked || false,
              },
            });

            // Update visit sequence order and status
            await tx.visit.update({
              where: { id: s.visitId },
              data: {
                sequenceOrder: s.stopOrder,
                status: plan.status === 'CONFIRMED' ? 'PLANNED' : visit.status,
              },
            });
          }
        }
      }

      void AuditService.record({
        practiceId,
        action: 'DAILY_PLAN_SAVED',
        resource: 'DailyPlan',
        resourceId: plan.id,
        details: {
          planDate: d.toISOString(),
          status: plan.status,
          stopsCount: data.stops?.length || 0,
        },
      });

      return tx.dailyPlan.findUnique({
        where: { id: plan.id },
        include: {
          routeStops: {
            orderBy: { stopOrder: 'asc' },
            include: {
              visit: {
                include: {
                  owner: true,
                  cases: true,
                },
              },
            },
          },
        },
      });
    });
  }

  static async confirmDailyPlan(practiceId: string, id: string) {
    const plan = await prisma.dailyPlan.findFirst({
      where: { id, practiceId },
      include: { routeStops: true },
    });

    if (!plan) {
      throw new AppError(404, 'PLAN_NOT_FOUND', 'Daily plan not found.');
    }

    const confirmed = await prisma.$transaction(async (tx) => {
      const updated = await tx.dailyPlan.update({
        where: { id },
        data: {
          status: 'CONFIRMED',
        },
      });

      // Mark all stops' visits as PLANNED
      for (const stop of plan.routeStops) {
        await tx.visit.update({
          where: { id: stop.visitId },
          data: { status: 'PLANNED', sequenceOrder: stop.stopOrder },
        });
      }

      return updated;
    });

    void AuditService.record({
      practiceId,
      action: 'DAILY_PLAN_CONFIRMED',
      resource: 'DailyPlan',
      resourceId: id,
      details: {
        confirmedAt: new Date().toISOString(),
        stopsCount: plan.routeStops.length,
      },
    });

    return confirmed;
  }

  static async postponeVisit(
    practiceId: string,
    visitId: string,
    targetDate: Date,
    reason: string = 'Postponed by Doctor'
  ) {
    const visit = await prisma.visit.findFirst({
      where: { id: visitId, practiceId },
    });

    if (!visit) {
      throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit record not found.');
    }

    return prisma.$transaction(async (tx) => {
      // 1. Update visit
      const updatedVisit = await tx.visit.update({
        where: { id: visitId },
        data: {
          status: 'POSTPONED',
          flexibility: 'CAN_POSTPONE_TODAY',
          scheduledDate: targetDate,
          postponedReason: reason,
        },
      });

      // 2. Remove from active route stops if present
      await tx.routeStop.deleteMany({
        where: { visitId },
      });

      // 3. Update associated call if present
      if (visit.callId) {
        await tx.call.update({
          where: { id: visit.callId },
          data: {
            flexibility: 'CAN_POSTPONE_TODAY',
            preferredDate: targetDate,
            notes: reason,
          },
        });
      }

      void AuditService.record({
        practiceId,
        action: 'VISIT_POSTPONED',
        resource: 'Visit',
        resourceId: visitId,
        details: {
          previousDate: visit.scheduledDate.toISOString(),
          newDate: targetDate.toISOString(),
          reason,
        },
      });

      return updatedVisit;
    });
  }

  // ── Phase 5 Field Execution ────────────────────────────────────────────────

  // 1. Get Visit with full eager loading
  static async getVisitById(practiceId: string, visitId: string) {
    const visit = await prisma.visit.findFirst({
      where: { id: visitId, practiceId },
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            patients: true,
          },
        },
        call: true,
        cases: {
          include: {
            prescription: {
              include: {
                items: true,
              },
            },
          },
        },
        procedures: {
          orderBy: { performedAt: 'asc' },
        },
        medicineUsages: {
          orderBy: { administeredAt: 'asc' },
        },
        timelineEvents: {
          orderBy: { occurredAt: 'asc' },
        },
      },
    });

    if (!visit) {
      throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit record not found.');
    }

    return visit;
  }

  // 2. Record Arrival (CVP-20)
  static async recordArrival(
    practiceId: string,
    visitId: string,
    locationData?: {
      latitude?: number | null;
      longitude?: number | null;
      accuracy?: number | null;
    }
  ) {
    const visit = await prisma.visit.findFirst({
      where: { id: visitId, practiceId },
    });

    if (!visit) {
      throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit record not found.');
    }

    // Idempotent: If already ARRIVED or further in the lifecycle, do not re-transition
    if (['ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(visit.status)) {
      return visit;
    }

    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const updated = await tx.visit.update({
        where: { id: visitId },
        data: {
          status: 'ARRIVED',
          arrivedAt: visit.arrivedAt ?? now,
          arrivalLatitude: locationData?.latitude ?? visit.arrivalLatitude,
          arrivalLongitude: locationData?.longitude ?? visit.arrivalLongitude,
          arrivalAccuracy: locationData?.accuracy ?? visit.arrivalAccuracy,
        },
      });

      await tx.visitTimelineEvent.create({
        data: {
          practiceId,
          visitId,
          eventType: 'ARRIVAL_RECORDED',
          title: 'Arrived at Location',
          description: locationData?.latitude
            ? `Arrived with GPS coordinates: (${locationData.latitude.toFixed(5)}, ${locationData.longitude?.toFixed(5)})`
            : 'Arrived at client location.',
          metadata: locationData ? JSON.stringify(locationData) : undefined,
          occurredAt: now,
        },
      });

      void AuditService.record({
        practiceId,
        action: 'VISIT_ARRIVED',
        resource: 'Visit',
        resourceId: visitId,
        details: { arrivedAt: now.toISOString(), ...locationData },
      });

      return updated;
    });
  }

  // 3. Start Visit (CVP-22)
  static async startVisit(practiceId: string, visitId: string) {
    const visit = await prisma.visit.findFirst({
      where: { id: visitId, practiceId },
    });

    if (!visit) {
      throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit record not found.');
    }

    if (visit.status === 'COMPLETED' || visit.status === 'CANCELLED') {
      throw new AppError(400, 'INVALID_STATE_TRANSITION', `Cannot start visit in ${visit.status} status.`);
    }

    // Idempotent: If already IN_PROGRESS, return current record
    if (visit.status === 'IN_PROGRESS') {
      return visit;
    }

    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const updated = await tx.visit.update({
        where: { id: visitId },
        data: {
          status: 'IN_PROGRESS',
          visitStartedAt: visit.visitStartedAt ?? now,
        },
      });

      await tx.visitTimelineEvent.create({
        data: {
          practiceId,
          visitId,
          eventType: 'VISIT_STARTED',
          title: 'Active Visit Started',
          description: 'Veterinarian began clinical examination & procedures.',
          occurredAt: now,
        },
      });

      void AuditService.record({
        practiceId,
        action: 'VISIT_STARTED',
        resource: 'Visit',
        resourceId: visitId,
        details: { startedAt: now.toISOString() },
      });

      return updated;
    });
  }

  // 4. Record Procedure Actually Performed (CVP-23)
  static async recordProcedure(
    practiceId: string,
    visitId: string,
    data: {
      patientId?: string | null;
      patientName?: string | null;
      procedureCategory: string;
      procedureName: string;
      notes?: string | null;
      standardFee?: number;
    }
  ) {
    const visit = await prisma.visit.findFirst({
      where: { id: visitId, practiceId },
    });

    if (!visit) {
      throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit record not found.');
    }

    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const procedure = await tx.visitProcedure.create({
        data: {
          practiceId,
          visitId,
          patientId: data.patientId || null,
          patientName: data.patientName?.trim() || null,
          procedureCategory: data.procedureCategory.trim(),
          procedureName: data.procedureName.trim(),
          notes: data.notes?.trim() || null,
          standardFee: data.standardFee ?? 0,
          performedAt: now,
        },
      });

      await tx.visitTimelineEvent.create({
        data: {
          practiceId,
          visitId,
          eventType: 'PROCEDURE_RECORDED',
          title: `Procedure Performed: ${data.procedureName}`,
          description: data.notes || `Category: ${data.procedureCategory}`,
          occurredAt: now,
        },
      });

      return procedure;
    });
  }

  // 5. Record Actual Medicine Usage (CVP-24)
  static async recordMedicineUsage(
    practiceId: string,
    visitId: string,
    data: {
      patientId?: string | null;
      patientName?: string | null;
      medicineId?: string | null;
      medicineName: string;
      batchNumber?: string | null;
      quantityUsed: number;
      unit?: string | null;
      route?: string | null;
      instructions?: string | null;
      idempotencyKey?: string | null;
      locationId?: string | null;
      userId?: string | null;
    }
  ) {
    const visit = await prisma.visit.findFirst({
      where: { id: visitId, practiceId },
    });

    if (!visit) {
      throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit record not found.');
    }

    // Check idempotencyKey to prevent duplicate requests & double deductions
    if (data.idempotencyKey) {
      const existing = await prisma.visitMedicineUsage.findUnique({
        where: { idempotencyKey: data.idempotencyKey },
      });
      if (existing) {
        return existing;
      }
    }

    // Attempt field kit / practice bag stock deduction
    const deduction = await InventoryService.deductFieldUsage(
      practiceId,
      {
        visitId,
        patientId: data.patientId || null,
        patientName: data.patientName || null,
        medicineId: data.medicineId || null,
        medicineName: data.medicineName.trim(),
        batchNumber: data.batchNumber?.trim() || null,
        quantity: data.quantityUsed,
        unit: data.unit || null,
        route: data.route || null,
        idempotencyKey: data.idempotencyKey || null,
        locationId: data.locationId || null,
      },
      data.userId || null
    );

    const isStockDeducted = deduction.success;
    const stockDeductionId = deduction.transactionId || null;
    const now = new Date();

    return prisma.$transaction(async (tx) => {
      const usage = await tx.visitMedicineUsage.create({
        data: {
          practiceId,
          visitId,
          patientId: data.patientId || null,
          patientName: data.patientName?.trim() || null,
          medicineId: data.medicineId || null,
          medicineName: data.medicineName.trim(),
          batchNumber: deduction.batchNumber || data.batchNumber?.trim() || null,
          quantityUsed: data.quantityUsed,
          unit: data.unit?.trim() || null,
          route: data.route?.trim() || null,
          instructions: data.instructions?.trim() || null,
          isStockDeducted,
          stockDeductionId,
          idempotencyKey: data.idempotencyKey || null,
          administeredAt: now,
        },
      });

      const timelineDesc = isStockDeducted
        ? `Quantity: ${data.quantityUsed} ${data.unit || ''} | Route: ${data.route || 'N/A'}${usage.batchNumber ? ` | Batch: ${usage.batchNumber}` : ''} [Practice Bag Stock Deducted]`
        : `Quantity: ${data.quantityUsed} ${data.unit || ''} | Route: ${data.route || 'N/A'} [⚠️ Stock Not Deducted: ${deduction.reason || 'Insufficient Bag Stock'}]`;

      await tx.visitTimelineEvent.create({
        data: {
          practiceId,
          visitId,
          eventType: 'MEDICINE_USAGE_RECORDED',
          title: `Medicine Administered: ${data.medicineName}`,
          description: timelineDesc,
          occurredAt: now,
        },
      });

      return {
        ...usage,
        stockDeduction: deduction,
      };
    });
  }

  // 6. Complete Visit (CVP-25)
  static async completeVisit(
    practiceId: string,
    visitId: string,
    data: {
      actualDurationMinutes?: number;
      completionNotes?: string | null;
    }
  ) {
    const visit = await prisma.visit.findFirst({
      where: { id: visitId, practiceId },
    });

    if (!visit) {
      throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit record not found.');
    }

    // Idempotent: If already completed, return existing
    if (visit.status === 'COMPLETED') {
      return visit;
    }

    const now = new Date();
    let duration = data.actualDurationMinutes;
    if (!duration && visit.visitStartedAt) {
      duration = Math.max(1, Math.round((now.getTime() - visit.visitStartedAt.getTime()) / 60000));
    }

    // Inspect medicine usages and stock deduction status for audit trail
    const usages = await prisma.visitMedicineUsage.findMany({
      where: { visitId, practiceId },
    });
    const totalUsages = usages.length;
    const deductedUsages = usages.filter((u) => u.isStockDeducted).length;
    const unverifiedStock = totalUsages - deductedUsages;

    return prisma.$transaction(async (tx) => {
      const updated = await tx.visit.update({
        where: { id: visitId },
        data: {
          status: 'COMPLETED',
          visitCompletedAt: now,
          actualDurationMinutes: duration ?? visit.estimatedDurationMinutes,
          completionNotes: data.completionNotes?.trim() || null,
        },
      });

      const stockStatusNote = totalUsages > 0
        ? ` | Field Stock: ${deductedUsages}/${totalUsages} bag movements confirmed${unverifiedStock > 0 ? ` (${unverifiedStock} shortages/unverified)` : ''}`
        : '';

      await tx.visitTimelineEvent.create({
        data: {
          practiceId,
          visitId,
          eventType: 'VISIT_COMPLETED',
          title: 'Visit Successfully Finalized',
          description: `${data.completionNotes ? `${data.completionNotes} | ` : ''}Duration: ${duration || visit.estimatedDurationMinutes} mins${stockStatusNote}`,
          occurredAt: now,
        },
      });

      void AuditService.record({
        practiceId,
        action: 'VISIT_COMPLETED',
        resource: 'Visit',
        resourceId: visitId,
        details: {
          completedAt: now.toISOString(),
          durationMinutes: duration,
          notes: data.completionNotes,
          medicinesRecorded: totalUsages,
          stockMovementsConfirmed: deductedUsages,
          stockMovementsPending: unverifiedStock,
        },
      });

      return updated;
    });
  }

  // 7. Resume Visit
  static async resumeVisit(practiceId: string, visitId: string) {
    const visit = await prisma.visit.findFirst({
      where: { id: visitId, practiceId },
    });

    if (!visit) {
      throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit record not found.');
    }

    if (visit.status === 'IN_PROGRESS') {
      return visit;
    }

    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const updated = await tx.visit.update({
        where: { id: visitId },
        data: {
          status: 'IN_PROGRESS',
        },
      });

      await tx.visitTimelineEvent.create({
        data: {
          practiceId,
          visitId,
          eventType: 'VISIT_RESUMED',
          title: 'Visit Resumed',
          description: 'Doctor resumed active visit mode.',
          occurredAt: now,
        },
      });

      return updated;
    });
  }

  // 8. Get Status Timeline (CVP-45)
  static async getVisitTimeline(practiceId: string, visitId: string) {
    const visit = await prisma.visit.findFirst({
      where: { id: visitId, practiceId },
      select: { id: true },
    });

    if (!visit) {
      throw new AppError(404, 'VISIT_NOT_FOUND', 'Visit record not found.');
    }

    return prisma.visitTimelineEvent.findMany({
      where: { visitId, practiceId },
      orderBy: { occurredAt: 'asc' },
    });
  }

  // ── 9. Phase 8: List Follow-ups ──────────────────────────────────────
  static async listFollowUps(
    practiceId: string,
    filters: {
      status?: any;
      reason?: any;
      priority?: any;
      ownerId?: string;
      patientId?: string;
    } = {}
  ) {
    const where: any = { practiceId };
    if (filters.status) where.status = filters.status;
    if (filters.reason) where.reason = filters.reason;
    if (filters.priority) where.priority = filters.priority;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.patientId) where.patientId = filters.patientId;

    return prisma.followUp.findMany({
      where,
      orderBy: [{ recommendedDate: 'asc' }, { createdAt: 'desc' }],
      include: {
        owner: { select: { id: true, name: true, phone: true } },
        patient: { select: { id: true, name: true, species: true } },
      },
    });
  }

  // ── 10. Phase 8: Create Follow-up ────────────────────────────────────
  static async createFollowUp(
    practiceId: string,
    data: {
      ownerId: string;
      patientId?: string;
      species?: string;
      animalCount?: number;
      originVisitId?: string;
      recurrenceRuleId?: string;
      reason: any;
      procedureCategory?: string;
      recommendedDate: Date | string;
      priority?: any;
      flexibility?: any;
      preferredTimeWindow?: string;
      notes?: string;
    }
  ) {
    return prisma.followUp.create({
      data: {
        practiceId,
        ownerId: data.ownerId,
        patientId: data.patientId,
        species: data.species,
        animalCount: data.animalCount || 1,
        originVisitId: data.originVisitId,
        recurrenceRuleId: data.recurrenceRuleId,
        reason: data.reason,
        procedureCategory: data.procedureCategory,
        recommendedDate: new Date(data.recommendedDate),
        priority: data.priority || 'PLANNED',
        flexibility: data.flexibility || 'MUST_ATTEND_TODAY',
        preferredTimeWindow: data.preferredTimeWindow,
        notes: data.notes,
        status: 'UPCOMING',
      },
    });
  }

  // ── 11. Phase 8: Create Recurring Schedule ───────────────────────────
  static async createRecurringSchedule(
    practiceId: string,
    data: {
      ownerId: string;
      patientId?: string;
      species?: string;
      reason: any;
      procedureCategory?: string;
      frequency: any;
      intervalDays?: number;
      startDate: Date | string;
      endDate?: Date | string;
      maxOccurrences?: number;
      priority?: any;
      flexibility?: any;
      preferredTimeWindow?: string;
      notes?: string;
    }
  ) {
    return prisma.recurringSchedule.create({
      data: {
        practiceId,
        ownerId: data.ownerId,
        patientId: data.patientId,
        species: data.species,
        reason: data.reason,
        procedureCategory: data.procedureCategory,
        frequency: data.frequency,
        intervalDays: data.intervalDays,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        maxOccurrences: data.maxOccurrences,
        priority: data.priority || 'PLANNED',
        flexibility: data.flexibility || 'MUST_ATTEND_TODAY',
        preferredTimeWindow: data.preferredTimeWindow,
        notes: data.notes,
        status: 'ACTIVE',
      },
    });
  }

  // ── 12. Phase 8: Duration Estimates ─────────────────────────────────
  static async getDurationEstimates(practiceId: string) {
    return prisma.procedureDurationEstimate.findMany({
      where: { practiceId },
      orderBy: { procedureCategory: 'asc' },
    });
  }

  static async setDurationEstimateOverride(
    practiceId: string,
    procedureCategory: string,
    overrideMinutes: number | null
  ) {
    const existing = await prisma.procedureDurationEstimate.findUnique({
      where: {
        practiceId_procedureCategory: {
          practiceId,
          procedureCategory,
        },
      },
    });

    if (existing) {
      return prisma.procedureDurationEstimate.update({
        where: { id: existing.id },
        data: {
          manualOverrideMinutes: overrideMinutes,
          source: overrideMinutes != null ? 'MANUAL_OVERRIDE' : existing.sampleCount >= 3 ? 'PRACTICE_LEARNED' : 'DEFAULT',
          effectiveDurationMinutes: overrideMinutes != null ? overrideMinutes : existing.learnedDurationMinutes || existing.defaultDurationMinutes,
        },
      });
    }

    return prisma.procedureDurationEstimate.create({
      data: {
        practiceId,
        procedureCategory,
        defaultDurationMinutes: 30,
        manualOverrideMinutes: overrideMinutes,
        source: overrideMinutes != null ? 'MANUAL_OVERRIDE' : 'DEFAULT',
        effectiveDurationMinutes: overrideMinutes != null ? overrideMinutes : 30,
        incrementalPerAnimalMinutes: 10,
        sampleCount: 0,
      },
    });
  }
}

