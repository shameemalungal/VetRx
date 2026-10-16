// ==============================================================================
// VetRx Call & Visit Planner (CVP) — Core Service
// Multi-tenant, offline-first execution backed by Dexie IndexedDB
// ==============================================================================

import { db } from '../db/schema';
import type {
  Call,
  OwnerLocation,
  CallPriority,
  VisitFlexibility,
  CapacitySummary,
  Owner,
  Visit,
  DailyPlan,
  VisitProcedure,
  VisitMedicineUsage,
  VisitTimelineEvent,
} from '../types';
import { normalizePhoneNumber, arePhonesMatching } from '../utils/phoneUtils';
import { durationLearningService } from './durationLearningService';

export class CvpService {
  // ── Canonical ID Resolution Helpers (Dexie numeric ID <-> Server UUID) ────
  static async resolveOwnerServerUuid(ownerId?: number | string | null): Promise<string | null> {
    if (!ownerId) return null;
    if (typeof ownerId === 'string' && ownerId.includes('-')) return ownerId;
    const numId = typeof ownerId === 'string' ? parseInt(ownerId, 10) : ownerId;
    if (!isNaN(numId)) {
      const owner = await db.owners.get(numId);
      if (owner?.serverId && owner.serverId.includes('-')) {
        return owner.serverId;
      }
    }
    return null;
  }

  static async resolvePatientServerUuid(patientId?: number | string | null): Promise<string | null> {
    if (!patientId) return null;
    if (typeof patientId === 'string' && patientId.includes('-')) return patientId;
    const numId = typeof patientId === 'string' ? parseInt(patientId, 10) : patientId;
    if (!isNaN(numId)) {
      const pat = await db.patients.get(numId);
      if (pat?.serverId && pat.serverId.includes('-')) {
        return pat.serverId;
      }
    }
    return null;
  }

  static async resolveMedicineServerUuid(medicineId?: number | string | null): Promise<string | null> {
    if (!medicineId) return null;
    if (typeof medicineId === 'string' && medicineId.includes('-')) return medicineId;
    const numId = typeof medicineId === 'string' ? parseInt(medicineId, 10) : medicineId;
    if (!isNaN(numId)) {
      const med = await db.medicines.get(numId);
      if ((med as any)?.serverId && (med as any).serverId.includes('-')) {
        return (med as any).serverId;
      }
    }
    return null;
  }

  // ── Capacity & Summary ──────────────────────────────────────────────
  static async getTodayCapacitySummary(workingHoursTotal: number = 480): Promise<CapacitySummary> {
    const todayStr = new Date().toISOString().split('T')[0];
    const allCalls = await db.calls.toArray();

    // Filter calls for today
    const todayCalls = allCalls.filter((c) => {
      if (c.status === 'CANCELLED') return false;
      if (c.flexibility === 'MUST_ATTEND_TODAY' || c.priority === 'EMERGENCY') return true;
      if (c.preferredDate) {
        const dStr = typeof c.preferredDate === 'string'
          ? c.preferredDate.split('T')[0]
          : c.preferredDate.toISOString().split('T')[0];
        return dStr === todayStr;
      }
      return false;
    });

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

      // Estimate ~30 mins per visit (or ~45 mins for Emergency)
      const duration = call.priority === 'EMERGENCY' ? 45 : 30;
      allocatedVisitMinutes += duration;
    }

    // Estimate ~20 mins transit between stops
    const transitEstimatePerStop = 20;
    const allocatedTravelMinutes = todayCalls.length > 0 ? (todayCalls.length * transitEstimatePerStop) : 0;
    const totalAllocatedMinutes = allocatedVisitMinutes + allocatedTravelMinutes;
    const remainingMinutes = Math.max(0, workingHoursTotal - totalAllocatedMinutes);
    const isOverCapacity = totalAllocatedMinutes > workingHoursTotal;
    const overCapacityMinutes = isOverCapacity ? (totalAllocatedMinutes - workingHoursTotal) : 0;

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

  // ── Calls List Queries ──────────────────────────────────────────────
  static async getCallsByTab(tab: 'today' | 'upcoming' | 'postponed' | 'all'): Promise<Call[]> {
    const todayStr = new Date().toISOString().split('T')[0];
    const allCalls = await db.calls.toArray();

    // Enrich with owner information if missing
    const owners = await db.owners.toArray();
    const ownerMap = new Map<number | string, Owner>(owners.map((o) => [o.id!, o]));

    const enrichedCalls = allCalls.map((c) => {
      if (c.ownerId && ownerMap.has(c.ownerId)) {
        const o = ownerMap.get(c.ownerId)!;
        return {
          ...c,
          ownerName: c.ownerName || o.name,
          callerPhone: c.callerPhone || o.phone,
          locationAddress: c.locationAddress || o.address,
        };
      }
      return c;
    });

    if (tab === 'all') {
      return enrichedCalls.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    if (tab === 'today') {
      return enrichedCalls.filter((c) => {
        if (c.status === 'CANCELLED') return false;
        if (c.priority === 'EMERGENCY' || c.flexibility === 'MUST_ATTEND_TODAY') return true;
        if (c.preferredDate) {
          const dStr = typeof c.preferredDate === 'string'
            ? c.preferredDate.split('T')[0]
            : c.preferredDate.toISOString().split('T')[0];
          return dStr === todayStr;
        }
        return false;
      }).sort((a, b) => {
        // Sort: EMERGENCY (0) -> URGENT (1) -> COULD_NOT_ASSESS (2) -> PLANNED (3)
        const priorityOrder: Record<CallPriority, number> = {
          EMERGENCY: 0,
          URGENT: 1,
          COULD_NOT_ASSESS: 2,
          PLANNED: 3,
        };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      });
    }

    if (tab === 'upcoming') {
      return enrichedCalls.filter((c) => {
        if (c.status === 'CANCELLED') return false;
        if (!c.preferredDate) return false;
        const dStr = typeof c.preferredDate === 'string'
          ? c.preferredDate.split('T')[0]
          : c.preferredDate.toISOString().split('T')[0];
        return dStr > todayStr && c.flexibility !== 'CAN_POSTPONE_TODAY';
      }).sort((a, b) => new Date(a.preferredDate!).getTime() - new Date(b.preferredDate!).getTime());
    }

    if (tab === 'postponed') {
      return enrichedCalls.filter((c) => {
        if (c.status === 'CANCELLED') return false;
        return c.flexibility === 'CAN_POSTPONE_TODAY' || (c.notes && c.notes.toLowerCase().includes('postponed'));
      }).sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());
    }

    return enrichedCalls;
  }

  // ── Call CRUD ───────────────────────────────────────────────────────
  static async createCall(data: Omit<Call, 'id' | 'createdAt' | 'updatedAt'>): Promise<Call> {
    const now = new Date();
    const newCall: Call = {
      ...data,
      animalCount: data.animalCount || (data.patientIds && data.patientIds.length > 0 ? data.patientIds.length : 1),
      createdAt: now,
      updatedAt: now,
    };

    // 1. Local Dexie persistence (offline-first foundation)
    const id = await db.calls.add(newCall as any);
    newCall.id = id;

    // 2. Auto-save location if address provided and ownerId known
    if (data.ownerId && data.locationAddress) {
      const existingLoc = await db.ownerLocations
        .where('ownerId')
        .equals(data.ownerId as any)
        .and((l) => l.address.toLowerCase() === (data.locationAddress || '').toLowerCase())
        .first();

      if (!existingLoc) {
        await db.ownerLocations.add({
          ownerId: data.ownerId,
          label: 'Farm',
          address: data.locationAddress,
          latitude: data.latitude,
          longitude: data.longitude,
          locationSource: data.latitude && data.longitude ? 'GPS' : 'MANUAL',
          isDefault: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    // 3. Online sync attempt if network available
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const resolvedOwnerUuid = await this.resolveOwnerServerUuid(data.ownerId);
        const res = await fetch('/api/calls', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            callerPhone: data.callerPhone,
            ownerId: resolvedOwnerUuid,
            tempOwnerName: data.tempOwnerName || data.ownerName || null,
            tempPatientName: data.tempPatientName || null,
            species: data.species || null,
            animalCount: newCall.animalCount,
            symptoms: data.symptoms,
            tentativeAssessment: data.tentativeAssessment || null,
            priority: data.priority,
            flexibility: data.flexibility,
            preferredDate: data.preferredDate ? new Date(data.preferredDate).toISOString() : null,
            locationAddress: data.locationAddress || null,
            latitude: data.latitude || null,
            longitude: data.longitude || null,
            plannedProcedure: data.plannedProcedure || null,
            notes: data.notes || null,
          }),
        });
        if (res.ok) {
          const serverCall = await res.json();
          if (serverCall?.id) {
            newCall.id = id;
            (newCall as any).serverId = serverCall.id;
            await db.calls.update(id, { serverId: serverCall.id, updatedAt: new Date() } as any);
          }
        }
      } catch (err) {
        console.warn('Backend sync failed, call saved offline in Dexie:', err);
      }
    }

    return newCall;
  }

  static async updateCall(id: number | string, updates: Partial<Call>): Promise<void> {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(numId)) return;
    await db.calls.update(numId, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  static async postponeCall(
    id: number | string,
    targetDate: Date | string,
    reason: string = 'Postponed by Doctor'
  ): Promise<void> {
    const numId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(numId)) return;

    const existing = await db.calls.get(numId);
    const existingNotes = existing?.notes || '';
    const newNotes = existingNotes
      ? `${existingNotes} | Postponed to ${typeof targetDate === 'string' ? targetDate : targetDate.toISOString().split('T')[0]}: ${reason}`
      : `Postponed: ${reason}`;

    await db.calls.update(numId, {
      flexibility: 'CAN_POSTPONE_TODAY',
      preferredDate: targetDate,
      notes: newNotes,
      updatedAt: new Date(),
    });

    // Try backend sync if online
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const dateIso = typeof targetDate === 'string' ? new Date(targetDate).toISOString() : targetDate.toISOString();
        await fetch(`/api/calls/${id}/postpone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ targetDate: dateIso, reason }),
        });
      } catch (err) {
        console.warn('Backend postpone sync failed, updated locally in Dexie:', err);
      }
    }
  }

  // ── Get Call by ID (enriched with owner and visits) ─────────────────
  static async getCallById(id: number | string): Promise<Call | null> {
    const numId = typeof id === 'string' && /^\d+$/.test(id) ? parseInt(id, 10) : id;
    let localCall = typeof numId === 'number' ? await db.calls.get(numId) : null;

    // Try backend if online or if localCall not found
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const res = await fetch(`/api/calls/${id}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const remoteCall = await res.json();
          if (remoteCall) {
            const visits = remoteCall.visits || [];
            const linkedVisit = visits.length > 0 ? visits[0] : undefined;
            const fullCall: Call = {
              ...remoteCall,
              ownerName: remoteCall.owner?.name || remoteCall.tempOwnerName,
              callerPhone: remoteCall.owner?.phone || remoteCall.callerPhone,
              locationAddress: remoteCall.locationAddress || remoteCall.owner?.address,
              visits,
              linkedVisit,
            };
            if (typeof numId === 'number') {
              await db.calls.put({ ...fullCall, id: numId } as any);
            }
            return fullCall;
          }
        }
      } catch (err) {
        console.warn('Backend fetch for call failed, falling back to local Dexie:', err);
      }
    }

    if (!localCall) {
      const all = await db.calls.toArray();
      localCall = all.find((c) => String(c.id) === String(id)) || null;
    }

    if (localCall) {
      const allVisits = await db.visits.toArray();
      const linked = allVisits.find(
        (v) => String(v.callId) === String(id) || (localCall?.id && String(v.callId) === String(localCall.id))
      );
      return {
        ...localCall,
        linkedVisit: linked,
        visits: linked ? [linked] : [],
      };
    }

    return null;
  }

  // ── Schedule Visit from Call (Call-to-Visit Workflow) ─────────────────
  static async scheduleCall(
    id: number | string,
    data: {
      scheduledDate: Date | string;
      priority?: CallPriority;
      flexibility?: VisitFlexibility;
      preferredTime?: string;
      locationId?: string;
      address?: string;
      latitude?: number;
      longitude?: number;
      estimatedDurationMinutes?: number;
      notes?: string;
      cases?: Array<{
        patientId?: number | string;
        patientName?: string;
        species?: string;
        chiefComplaint: string;
        tentativeDiagnosis?: string;
        procedureCategory?: string;
      }>;
      addToTodayPlan?: boolean;
    }
  ): Promise<{ visit: Visit; call: Call }> {
    const scheduledDateIso =
      typeof data.scheduledDate === 'string'
        ? new Date(data.scheduledDate).toISOString()
        : data.scheduledDate.toISOString();

    const numId = typeof id === 'string' && /^\d+$/.test(id) ? parseInt(id, 10) : id;
    let existingCall = typeof numId === 'number' ? await db.calls.get(numId) : null;
    if (!existingCall) {
      const all = await db.calls.toArray();
      existingCall = all.find((c) => String(c.id) === String(id)) || null;
    }

    // Retain all patient-specific cases from intake or argument
    let casesToSchedule: Array<{
      patientId?: number | string;
      patientName?: string;
      species?: string;
      chiefComplaint: string;
      tentativeDiagnosis?: string;
      procedureCategory?: string;
    }> = [];

    if (data.cases && data.cases.length > 0) {
      casesToSchedule = data.cases.map((c) => ({
        patientId: c.patientId,
        patientName: c.patientName,
        species: c.species,
        chiefComplaint: c.chiefComplaint,
        tentativeDiagnosis: c.tentativeDiagnosis,
        procedureCategory: c.procedureCategory || 'GENERAL',
      }));
    } else if (existingCall?.selectedPatients && existingCall.selectedPatients.length > 0) {
      casesToSchedule = existingCall.selectedPatients.map((sp) => ({
        patientId: sp.id,
        patientName: sp.name,
        species: sp.species || existingCall?.species || 'Bovine',
        chiefComplaint: existingCall?.symptoms || 'Field Consultation',
        tentativeDiagnosis: existingCall?.tentativeAssessment,
        procedureCategory: existingCall?.plannedProcedure || (existingCall?.priority === 'EMERGENCY' ? 'EMERGENCY' : 'GENERAL'),
      }));
    } else if (existingCall?.patientIds && existingCall.patientIds.length > 0) {
      for (const pId of existingCall.patientIds) {
        const numPId = typeof pId === 'string' ? parseInt(pId, 10) : pId;
        const pRecord = !isNaN(numPId) ? await db.patients.get(numPId) : null;
        casesToSchedule.push({
          patientId: pId,
          patientName: pRecord?.name || existingCall.tempPatientName,
          species: pRecord?.species || existingCall.species || 'Bovine',
          chiefComplaint: existingCall.symptoms || 'Field Consultation',
          tentativeDiagnosis: existingCall.tentativeAssessment,
          procedureCategory: existingCall.plannedProcedure || (existingCall.priority === 'EMERGENCY' ? 'EMERGENCY' : 'GENERAL'),
        });
      }
    } else {
      casesToSchedule = [
        {
          chiefComplaint: existingCall?.symptoms || 'Field Consultation',
          tentativeDiagnosis: existingCall?.tentativeAssessment,
          procedureCategory: existingCall?.plannedProcedure || (existingCall?.priority === 'EMERGENCY' ? 'EMERGENCY' : 'GENERAL'),
          species: existingCall?.species || 'Bovine',
          patientName: existingCall?.tempPatientName,
        },
      ];
    }

    let remoteResult: { visit: Visit; call: Call } | null = null;
    const serverCallId = (existingCall as any)?.serverId || (typeof id === 'string' && id.includes('-') ? id : null);

    if (serverCallId && typeof window !== 'undefined' && navigator.onLine) {
      try {
        const remoteCases = await Promise.all(
          casesToSchedule.map(async (c) => ({
            ...c,
            patientId: await this.resolvePatientServerUuid(c.patientId),
          }))
        );

        const res = await fetch(`/api/calls/${serverCallId}/schedule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...data,
            cases: remoteCases,
            scheduledDate: scheduledDateIso,
          }),
        });

        if (res.ok) {
          remoteResult = await res.json();
        } else if (res.status === 404 || res.status >= 500) {
          console.warn('Backend server returned', res.status, '- continuing offline in Dexie');
        } else {
          const errData = await res.json().catch(() => ({}));
          console.warn('Backend schedule call returned error:', errData.message);
        }
      } catch (err: any) {
        console.warn('Backend schedule call failed, recording locally:', err);
      }
    }

    const callRecord: Call = remoteResult?.call || {
      ...(existingCall || ({} as Call)),
      id: existingCall?.id ?? id,
      status: 'SCHEDULED',
      preferredDate: data.scheduledDate,
      updatedAt: new Date(),
    };

    if (existingCall?.id) {
      await db.calls.update(existingCall.id as any, {
        status: 'SCHEDULED',
        preferredDate: data.scheduledDate,
        updatedAt: new Date(),
      });
    }

    const visitToSave: Visit = remoteResult?.visit || {
      callId: id,
      ownerId: existingCall?.ownerId || 0,
      ownerName: existingCall?.ownerName || existingCall?.tempOwnerName || 'Client',
      ownerPhone: existingCall?.callerPhone,
      address: data.address || existingCall?.locationAddress || 'Client Location',
      latitude: data.latitude ?? existingCall?.latitude,
      longitude: data.longitude ?? existingCall?.longitude,
      status: 'REGISTERED',
      priority: data.priority || existingCall?.priority || 'PLANNED',
      flexibility: data.flexibility || existingCall?.flexibility || 'MUST_ATTEND_TODAY',
      scheduledDate: new Date(data.scheduledDate),
      estimatedDurationMinutes: data.estimatedDurationMinutes || (data.priority === 'EMERGENCY' ? 45 : 30),
      notes: data.notes || existingCall?.notes,
      createdAt: new Date(),
      cases: casesToSchedule as any,
    };

    const existingVisit = (await db.visits.toArray()).find(
      (v) => String(v.callId) === String(id) || (existingCall?.id && String(v.callId) === String(existingCall.id))
    );
    let vId = existingVisit?.id;
    if (!existingVisit) {
      vId = await db.visits.add(visitToSave as any);
      visitToSave.id = vId;
    } else {
      visitToSave.id = existingVisit.id;
      await db.visits.update(existingVisit.id as number, visitToSave as any);
    }

    // Persist each patient case into db.visitCases table
    for (const c of casesToSchedule) {
      const existingCase = await db.visitCases
        .where('visitId')
        .equals(vId as any)
        .and((vc) => (c.patientId ? String(vc.patientId) === String(c.patientId) : vc.chiefComplaint === c.chiefComplaint))
        .first();
      if (!existingCase) {
        await db.visitCases.add({
          visitId: vId!,
          patientId: c.patientId,
          patientName: c.patientName,
          species: c.species,
          chiefComplaint: c.chiefComplaint,
          tentativeDiagnosis: c.tentativeDiagnosis,
          procedureCategory: c.procedureCategory,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any);
      }
    }

    return {
      visit: visitToSave,
      call: callRecord,
    };
  }

  // ── Update / Correct Priority Classification ──────────────────────────
  static async updatePriority(
    id: number | string,
    newPriority: CallPriority,
    options?: { reason?: string; isVisit?: boolean }
  ): Promise<{ call?: Call; visit?: Visit }> {
    const isVisitId = Boolean(options?.isVisit);
    let targetCall: Call | null = null;
    let targetVisit: Visit | null = null;

    if (isVisitId) {
      targetVisit = await this.getVisitById(id);
      if (targetVisit?.callId) {
        targetCall = await this.getCallById(targetVisit.callId);
      }
    } else {
      targetCall = await this.getCallById(id);
      if (targetCall) {
        const visits = await db.visits.toArray();
        targetVisit = visits.find((v) => String(v.callId) === String(targetCall?.id)) || null;
      }
    }

    if (!targetCall && !targetVisit) {
      throw new Error(`Record ${id} not found.`);
    }

    if (targetVisit && (targetVisit.status === 'COMPLETED' || targetVisit.status === 'CANCELLED')) {
      throw new Error(`Cannot change priority of a ${targetVisit.status} visit.`);
    }

    const now = new Date();
    const oldPriority = targetCall?.priority || targetVisit?.priority || 'PLANNED';

    // Update Call if found
    if (targetCall?.id) {
      const updatedNotes = options?.reason
        ? `${targetCall.notes ? targetCall.notes + ' | ' : ''}[Priority changed ${oldPriority} -> ${newPriority}: ${options.reason}]`.trim()
        : targetCall.notes;

      await db.calls.update(targetCall.id as any, {
        priority: newPriority,
        notes: updatedNotes,
        updatedAt: now,
      });
      targetCall.priority = newPriority;
      targetCall.notes = updatedNotes;
      targetCall.updatedAt = now;
    }

    // Update Visit if found
    if (targetVisit?.id) {
      let duration = targetVisit.estimatedDurationMinutes;
      if (newPriority === 'EMERGENCY' && duration < 45) {
        duration = 45;
      } else if (oldPriority === 'EMERGENCY' && newPriority !== 'EMERGENCY' && duration === 45) {
        duration = 30;
      }

      await db.visits.update(targetVisit.id as any, {
        priority: newPriority,
        estimatedDurationMinutes: duration,
        updatedAt: now,
      });

      // Record timeline event for audit trail
      await db.visitTimelineEvents.add({
        visitId: targetVisit.id,
        eventType: 'PRIORITY_CHANGED',
        title: `Priority Classification Changed: ${newPriority}`,
        description: `Operational priority updated from ${oldPriority} to ${newPriority}.${options?.reason ? ` Reason: ${options.reason}` : ''}`,
        occurredAt: now,
        metadata: {
          oldPriority,
          newPriority,
          reason: options?.reason,
        },
        syncStatus: 'LOCAL_PENDING',
      } as any);

      targetVisit.priority = newPriority;
      targetVisit.estimatedDurationMinutes = duration;
      targetVisit.updatedAt = now;
    }

    // Backend sync if online
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const serverCallId = (targetCall as any)?.serverId || (targetCall?.id && String(targetCall.id).includes('-') ? targetCall.id : null);
        if (serverCallId) {
          await fetch(`/api/calls/${serverCallId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              priority: newPriority,
              notes: options?.reason ? `Priority updated: ${options.reason}` : undefined,
            }),
          });
        }
      } catch (syncErr) {
        console.warn('Backend priority sync failed, updated locally in Dexie:', syncErr);
      }
    }

    return { call: targetCall || undefined, visit: targetVisit || undefined };
  }

  // ── Close Call Without Visit ──────────────────────────────────────────
  static async closeCall(
    id: number | string,
    reason: string,
    reasonDetails?: string,
    clinicalNotes?: string
  ): Promise<Call> {
    const numId = typeof id === 'string' && /^\d+$/.test(id) ? parseInt(id, 10) : id;
    let existing = typeof numId === 'number' ? await db.calls.get(numId) : null;
    if (!existing) {
      const all = await db.calls.toArray();
      existing = all.find((c) => String(c.id) === String(id)) || null;
    }

    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const res = await fetch(`/api/calls/${id}/close`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ reason, reasonDetails, clinicalNotes }),
        });
        if (res.ok) {
          const updated = await res.json();
          if (existing?.id) {
            await db.calls.update(existing.id as any, {
              status: 'CANCELLED',
              notes: updated.notes,
              updatedAt: new Date(),
            });
          }
          return updated;
        }
      } catch (err) {
        console.warn('Backend close call failed, updating local Dexie:', err);
      }
    }

    const closureNote = `[Closed: ${reason}]${reasonDetails ? ` ${reasonDetails}` : ''}${clinicalNotes ? ` | Notes: ${clinicalNotes}` : ''}`;
    const newNotes = existing?.notes ? `${existing.notes} | ${closureNote}` : closureNote;

    if (existing?.id) {
      await db.calls.update(existing.id as any, {
        status: 'CANCELLED',
        notes: newNotes,
        updatedAt: new Date(),
      });
    }

    return {
      ...(existing || ({} as Call)),
      id,
      status: 'CANCELLED',
      notes: newNotes,
      updatedAt: new Date(),
    } as Call;
  }

  // ── Owner & Patient Matching (CVP-46, CVP-05, CVP-07) ─────────────────
  static async findMatchingOwners(phoneOrQuery: string): Promise<Array<{
    owner: any;
    patients: any[];
    locations: OwnerLocation[];
  }>> {
    const raw = phoneOrQuery.trim();
    if (!raw) return [];

    const digitsOnly = raw.replace(/\D/g, '');
    const searchLower = raw.toLowerCase();

    const allOwners = await db.owners.toArray();
    const matchedOwners = allOwners.filter((o) => {
      // 1. Match phone using robust normalization and matching (with/without spaces, +91, 0, local prefix)
      if (o.phone && arePhonesMatching(o.phone, raw)) {
        return true;
      }
      if (Array.isArray(o.alternatePhones)) {
        for (const alt of o.alternatePhones) {
          if (alt && arePhonesMatching(alt, raw)) {
            return true;
          }
        }
      }
      if (digitsOnly.length >= 4) {
        if (o.phone) {
          const ownerDigits = o.phone.replace(/\D/g, '');
          if (ownerDigits.includes(digitsOnly) || digitsOnly.includes(ownerDigits)) {
            return true;
          }
        }
        if (Array.isArray(o.alternatePhones)) {
          for (const alt of o.alternatePhones) {
            const altDigits = alt.replace(/\D/g, '');
            if (altDigits.includes(digitsOnly) || digitsOnly.includes(altDigits)) {
              return true;
            }
          }
        }
      }
      // 2. Match name or address
      if (o.name && o.name.toLowerCase().includes(searchLower)) {
        return true;
      }
      if (o.address && o.address.toLowerCase().includes(searchLower)) {
        return true;
      }
      return false;
    }).slice(0, 8);

    // Enrich each matched owner with their associated patients and saved locations
    const enriched = await Promise.all(
      matchedOwners.map(async (owner) => {
        const patients = await db.patients.where('ownerId').equals(owner.id!).toArray();
        const locations = await db.ownerLocations.where('ownerId').equals(owner.id!).toArray();
        return {
          owner,
          patients,
          locations,
        };
      })
    );

    return enriched;
  }

  // ── Link Alternate Phone to Existing Owner (Stage 1.3) ──────────────────
  static async linkAlternatePhoneToOwner(
    ownerId: number | string,
    phone: string
  ): Promise<{ success: boolean; owner: any; message?: string }> {
    const raw = phone.trim();
    const cleanPhone = normalizePhoneNumber(raw) || raw.replace(/\D/g, '');
    const numId = typeof ownerId === 'string' && /^\d+$/.test(ownerId) ? parseInt(ownerId, 10) : ownerId;
    let localOwner = typeof numId === 'number' ? await db.owners.get(numId) : null;
    if (!localOwner) {
      const allOwners = await db.owners.toArray();
      localOwner = allOwners.find((o) => String(o.id) === String(ownerId) || o.serverId === String(ownerId)) || null;
    }

    if (!localOwner) {
      throw new Error(`Owner ${ownerId} not found.`);
    }

    // Check duplicate on this owner
    const existingAlts = localOwner.alternatePhones || [];
    if (localOwner.phone === cleanPhone || existingAlts.includes(cleanPhone)) {
      return { success: true, owner: localOwner };
    }

    // Check conflict with other owners in local DB
    const allOwners = await db.owners.toArray();
    const conflict = allOwners.find(
      (o) =>
        o.id !== localOwner?.id &&
        (arePhonesMatching(o.phone, cleanPhone) ||
          (o.alternatePhones || []).some((alt) => arePhonesMatching(alt, cleanPhone)))
    );
    if (conflict) {
      throw new Error(`This phone number is already registered to client "${conflict.name}".`);
    }

    // Update local Dexie record
    const updatedAlts = [...existingAlts, cleanPhone];
    if (localOwner.id) {
      await db.owners.update(localOwner.id, {
        alternatePhones: updatedAlts,
        updatedAt: new Date(),
      } as any);
      localOwner.alternatePhones = updatedAlts;
    }

    // If serverId or online, sync with backend endpoint
    const serverUuid = localOwner.serverId || (typeof ownerId === 'string' && ownerId.includes('-') ? ownerId : null);
    if (serverUuid && typeof window !== 'undefined' && navigator.onLine) {
      try {
        const res = await fetch(`/api/clinical/owners/${serverUuid}/link-phone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ phone: cleanPhone }),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          console.warn('Backend link-phone returned error:', errData.message);
        }
      } catch (err) {
        console.warn('Backend link-phone sync failed, saved locally:', err);
      }
    }

    return { success: true, owner: localOwner };
  }

  static async getOwnerPatients(ownerId: number | string): Promise<any[]> {
    const numId = typeof ownerId === 'string' ? parseInt(ownerId, 10) : ownerId;
    if (isNaN(numId)) return [];
    return db.patients.where('ownerId').equals(numId).toArray();
  }

  static async quickCreateOwner(data: {
    name: string;
    phone: string;
    address?: string;
    email?: string;
    notes?: string;
  }): Promise<any> {
    const cleanPhone = normalizePhoneNumber(data.phone.trim());
    const digitsOnly = cleanPhone.replace(/\D/g, '');

    // Prevent duplicate owner creation if phone match already exists (supporting country code / local prefix)
    if (digitsOnly.length >= 7) {
      const allOwners = await db.owners.toArray();
      const existing = allOwners.find((o) => {
        if (!o.phone) return false;
        if (arePhonesMatching(o.phone, cleanPhone)) return true;
        if (Array.isArray(o.alternatePhones) && o.alternatePhones.some((alt) => arePhonesMatching(alt, cleanPhone))) {
          return true;
        }
        return false;
      });
      if (existing) {
        return existing;
      }
    }

    const now = new Date();
    const ownerId = await db.owners.add({
      name: data.name.trim(),
      phone: cleanPhone,
      address: data.address?.trim() || '',
      email: data.email?.trim() || '',
      notes: data.notes?.trim() || '',
      createdAt: now,
      updatedAt: now,
    });

    const newOwner = await db.owners.get(ownerId);

    // Save default location if address provided
    if (data.address?.trim()) {
      await db.ownerLocations.add({
        ownerId,
        label: 'Farm',
        address: data.address.trim(),
        locationSource: 'MANUAL',
        isDefault: true,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Online sync to backend
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const res = await fetch('/api/owners', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            name: data.name.trim(),
            phone: cleanPhone,
            address: data.address?.trim() || null,
            email: data.email?.trim() || null,
          }),
        });
        if (res.ok) {
          const serverOwner = await res.json();
          if (serverOwner?.id && newOwner) {
            await db.owners.update(ownerId, { serverId: serverOwner.id } as any);
          }
        }
      } catch (err) {
        console.warn('Backend owner sync failed, saved locally in Dexie:', err);
      }
    }

    return newOwner;
  }

  static async quickCreatePatient(data: {
    ownerId: number;
    name: string;
    species: string;
    breed?: string;
    sex?: string;
    ageNote?: string;
  }): Promise<any> {
    // Prevent duplicate patient under same owner
    const existing = await db.patients
      .where('ownerId')
      .equals(data.ownerId)
      .and((p) => p.name.trim().toLowerCase() === data.name.trim().toLowerCase())
      .first();

    if (existing) {
      return existing;
    }

    const now = new Date();
    const patientId = await db.patients.add({
      ownerId: data.ownerId,
      name: data.name.trim(),
      species: data.species as any,
      breed: data.breed?.trim() || '',
      sex: (data.sex || 'Unknown') as any,
      ageNote: data.ageNote?.trim() || '',
      createdAt: now,
      updatedAt: now,
    });

    const newPatient = await db.patients.get(patientId);

    // Online sync to backend
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const ownerRecord = await db.owners.get(data.ownerId);
        const serverOwnerId = (ownerRecord as any)?.serverId;
        if (serverOwnerId) {
          const res = await fetch('/api/patients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              ownerId: serverOwnerId,
              name: data.name.trim(),
              species: data.species,
              breed: data.breed?.trim() || null,
              sex: data.sex || null,
              notes: data.ageNote?.trim() || null,
            }),
          });
          if (res.ok) {
            const serverPatient = await res.json();
            if (serverPatient?.id) {
              await db.patients.update(patientId, { serverId: serverPatient.id } as any);
            }
          }
        }
      } catch (err) {
        console.warn('Backend patient sync failed, saved locally in Dexie:', err);
      }
    }

    return newPatient;
  }

  // ── Global Search ───────────────────────────────────────────────────
  static async searchAll(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return null;

    // 1. Owners
    const allOwners = await db.owners.toArray();
    const matchingOwners = allOwners.filter((o) =>
      o.name.toLowerCase().includes(q) ||
      (o.phone && o.phone.toLowerCase().includes(q)) ||
      (o.address && o.address.toLowerCase().includes(q))
    ).slice(0, 5);

    // 2. Patients
    const allPatients = await db.patients.toArray();
    const matchingPatients = allPatients.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.species && p.species.toLowerCase().includes(q)) ||
      (p.breed && p.breed.toLowerCase().includes(q))
    ).slice(0, 5);

    // 3. Calls
    const allCalls = await db.calls.toArray();
    const matchingCalls = allCalls.filter((c) =>
      (c.callerPhone && c.callerPhone.toLowerCase().includes(q)) ||
      (c.ownerName && c.ownerName.toLowerCase().includes(q)) ||
      (c.tempOwnerName && c.tempOwnerName.toLowerCase().includes(q)) ||
      (c.symptoms && c.symptoms.toLowerCase().includes(q)) ||
      (c.locationAddress && c.locationAddress.toLowerCase().includes(q))
    ).slice(0, 5);

    // 4. Locations
    const allLocations = await db.ownerLocations.toArray();
    const matchingLocations = allLocations.filter((l) =>
      l.address.toLowerCase().includes(q) ||
      (l.label && l.label.toLowerCase().includes(q))
    ).slice(0, 5);

    return {
      owners: matchingOwners,
      patients: matchingPatients,
      calls: matchingCalls,
      locations: matchingLocations,
    };
  }

  // ── Owner Locations ─────────────────────────────────────────────────
  static async getOwnerLocations(ownerId: number | string): Promise<OwnerLocation[]> {
    const numId = typeof ownerId === 'string' ? parseInt(ownerId, 10) : ownerId;
    return db.ownerLocations.where('ownerId').equals(numId as any).toArray();
  }

  static async saveOwnerLocation(location: Omit<OwnerLocation, 'id' | 'createdAt' | 'updatedAt'>): Promise<OwnerLocation> {
    const now = new Date();
    const newLoc: OwnerLocation = {
      ...location,
      createdAt: now,
      updatedAt: now,
    };
    const id = await db.ownerLocations.add(newLoc as any);
    newLoc.id = id;
    return newLoc;
  }

  // ── Daily Plan & Visit Preparation (Phase 4) ──────────────────────
  static async listVisits(filters?: { date?: string; callId?: string; status?: string }): Promise<Visit[]> {
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const params = new URLSearchParams();
        if (filters?.date) params.set('date', filters.date);
        if (filters?.callId) params.set('callId', filters.callId);
        if (filters?.status) params.set('status', filters.status);
        const res = await fetch(`/api/visits?${params.toString()}`, { credentials: 'include' });
        if (res.ok) {
          const remoteVisits: Visit[] = await res.json();
          if (Array.isArray(remoteVisits)) {
            for (const rv of remoteVisits) {
              const existing = (await db.visits.toArray()).find((v) => String(v.id) === String(rv.id));
              if (!existing) {
                await db.visits.add(rv as any);
              }
            }
            return remoteVisits;
          }
        }
      } catch (err) {
        console.warn('Backend listVisits failed, reading Dexie:', err);
      }
    }

    const allVisits = await db.visits.toArray();
    return allVisits.filter((v) => {
      if (filters?.status && v.status !== filters.status) return false;
      if (filters?.callId && String(v.callId) !== String(filters.callId)) return false;
      if (filters?.date) {
        const dStr = typeof v.scheduledDate === 'string'
          ? v.scheduledDate.split('T')[0]
          : new Date(v.scheduledDate).toISOString().split('T')[0];
        if (dStr !== filters.date) return false;
      }
      return true;
    });
  }

  static async getTodayVisits(): Promise<Visit[]> {
    const todayStr = new Date().toISOString().split('T')[0];

    // Try backend if online
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const res = await fetch(`/api/visits?date=${todayStr}`, {
          credentials: 'include',
        });
        if (res.ok) {
          const remoteVisits: Visit[] = await res.json();
          if (Array.isArray(remoteVisits) && remoteVisits.length > 0) {
            for (const rv of remoteVisits) {
              const existing = (await db.visits.toArray()).find((v) => String(v.id) === String(rv.id));
              if (!existing) {
                await db.visits.add(rv as any);
              }
            }
          }
        }
      } catch (err) {
        console.warn('Backend fetch for today visits failed:', err);
      }
    }

    // Return confirmed, scheduled visits for today that are not cancelled/postponed
    const allVisits = await db.visits.toArray();
    return allVisits.filter((v) => {
      if (v.status === 'CANCELLED' || v.status === 'POSTPONED') return false;
      const dStr = typeof v.scheduledDate === 'string'
        ? v.scheduledDate.split('T')[0]
        : new Date(v.scheduledDate).toISOString().split('T')[0];
      return dStr === todayStr;
    });
  }

  static async getDailyPlan(planDate: string): Promise<DailyPlan | null> {
    const dStr = planDate.split('T')[0];
    const allPlans = await db.dailyPlans.toArray();
    const plan = allPlans.find((p) => {
      const pDateStr = typeof p.planDate === 'string'
        ? p.planDate.split('T')[0]
        : new Date(p.planDate).toISOString().split('T')[0];
      return pDateStr === dStr;
    });

    return plan || null;
  }

  static async saveDraftDailyPlan(plan: DailyPlan): Promise<DailyPlan> {
    const now = new Date();
    const dStr = plan.planDate.split('T')[0];
    const existing = await this.getDailyPlan(dStr);

    const planToSave: DailyPlan = {
      ...plan,
      planDate: dStr,
      status: plan.status || 'DRAFT',
      updatedAt: now,
    };

    if (existing?.id) {
      planToSave.id = existing.id;
      await db.dailyPlans.update(existing.id as any, planToSave as any);
    } else {
      planToSave.createdAt = now;
      const id = await db.dailyPlans.add(planToSave as any);
      planToSave.id = id;
    }

    // Try backend sync if online
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        await fetch('/api/daily-plans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(planToSave),
        });
      } catch (err) {
        console.warn('Backend draft plan sync failed, saved locally in Dexie:', err);
      }
    }

    return planToSave;
  }

  static async confirmDailyPlan(plan: DailyPlan): Promise<DailyPlan> {
    const now = new Date();
    const confirmedPlan: DailyPlan = {
      ...plan,
      status: 'CONFIRMED',
      confirmedAt: now,
      updatedAt: now,
    };

    const saved = await this.saveDraftDailyPlan(confirmedPlan);

    // Update visits with assigned sequence order and PLANNED status
    if (plan.stops && plan.stops.length > 0) {
      for (const stop of plan.stops) {
        if (stop.visitId) {
          await db.visits.update(stop.visitId as any, {
            status: 'PLANNED',
            sequenceOrder: stop.stopOrder,
            updatedAt: now,
          });
        }
      }
    }

    // Try backend confirmation sync if online
    if (typeof window !== 'undefined' && navigator.onLine && saved.id) {
      try {
        await fetch(`/api/daily-plans/${saved.id}/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(saved),
        });
      } catch (err) {
        console.warn('Backend plan confirm sync failed, confirmed locally in Dexie:', err);
      }
    }

    return saved;
  }

  static async postponeVisit(
    visitId: number | string,
    targetDate: Date | string,
    reason: string = 'Postponed by Doctor'
  ): Promise<void> {
    const numId = typeof visitId === 'string' ? parseInt(visitId, 10) : visitId;
    const now = new Date();
    const visit = await db.visits.get(numId as any);

    if (visit) {
      await db.visits.update(numId as any, {
        status: 'POSTPONED',
        flexibility: 'CAN_POSTPONE_TODAY',
        scheduledDate: targetDate,
        postponedReason: reason,
        updatedAt: now,
      });

      // Also update linked call if present
      if (visit.callId) {
        await this.postponeCall(visit.callId, targetDate, reason);
      }
    }

    // Try backend sync if online
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const dateIso = typeof targetDate === 'string' ? new Date(targetDate).toISOString() : targetDate.toISOString();
        await fetch(`/api/visits/${visitId}/postpone`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ targetDate: dateIso, reason }),
        });
      } catch (err) {
        console.warn('Backend visit postpone sync failed, postponed locally:', err);
      }
    }
  }

  // ── Phase 5 Field Execution & Active Visit ─────────────────────────────────

  // 1. Get Visit by ID with cases, procedures, medicine usage, and timeline
  static async getVisitById(visitId: number | string): Promise<Visit | null> {
    const numId = typeof visitId === 'string' ? parseInt(visitId, 10) : visitId;
    let visit: Visit | null = null;
    if (!isNaN(numId as number)) {
      visit = (await db.visits.get(numId as any)) || null;
    }

    if (!visit) {
      // If not in Dexie by numeric id, try string/serverId match
      const allVisits = await db.visits.toArray();
      visit = allVisits.find((v) => String(v.id) === String(visitId) || (v as any).serverId === String(visitId)) || null;
    }

    // Authoritative Server Fallback if not found locally or if online
    if (typeof window !== 'undefined' && navigator.onLine && (!visit || !visit.ownerName || !visit.cases || visit.cases.length === 0)) {
      try {
        const res = await fetch(`/api/visits/${visitId}`, {
          credentials: 'include',
          headers: { 'Accept': 'application/json' },
        });
        if (res.ok) {
          const serverVisit = await res.json();
          if (serverVisit && serverVisit.id) {
            // Map server visit and cache in Dexie
            const mappedVisit: any = {
              ...serverVisit,
              serverId: serverVisit.id,
              ownerId: serverVisit.ownerId || serverVisit.owner?.id,
              ownerName: serverVisit.owner?.name || serverVisit.ownerName,
              ownerPhone: serverVisit.owner?.phone || serverVisit.ownerPhone,
              address: serverVisit.owner?.address || serverVisit.address || '',
              cases: serverVisit.cases?.map((c: any) => ({
                id: c.id,
                visitId: serverVisit.id,
                patientId: c.patientId,
                patientName: c.patient?.name || (c.notes && c.notes.startsWith('Patient: ') ? c.notes.replace('Patient: ', '') : undefined),
                species: c.species || c.patient?.species,
                chiefComplaint: c.chiefComplaint,
                tentativeDiagnosis: c.tentativeDiagnosis,
                procedureCategory: c.procedureCategory,
                prescriptionId: c.prescription?.id || c.prescriptionId,
                notes: c.notes,
              })) || [],
            };

            // Cache owner into Dexie if present
            if (serverVisit.owner) {
              const allOwners = await db.owners.toArray();
              const existingOwner = allOwners.find((o) => o.serverId === serverVisit.owner.id || String(o.id) === String(serverVisit.owner.id));
              if (!existingOwner) {
                const newOwnerId = await db.owners.add({
                  serverId: serverVisit.owner.id,
                  name: serverVisit.owner.name,
                  phone: serverVisit.owner.phone,
                  address: serverVisit.owner.address,
                  createdAt: new Date(),
                } as any);
                mappedVisit.localOwnerId = newOwnerId;
              } else {
                mappedVisit.localOwnerId = existingOwner.id;
              }

              // Cache patients
              if (serverVisit.owner.patients && Array.isArray(serverVisit.owner.patients)) {
                const allPatients = await db.patients.toArray();
                for (const pat of serverVisit.owner.patients) {
                  const exists = allPatients.find((p) => p.serverId === pat.id || String(p.id) === String(pat.id));
                  if (!exists) {
                    await db.patients.add({
                      serverId: pat.id,
                      ownerId: mappedVisit.localOwnerId || serverVisit.owner.id,
                      name: pat.name,
                      species: pat.species,
                      breed: pat.breed,
                      ageYears: pat.ageYears,
                      ageMonths: pat.ageMonths,
                      weightKg: pat.weightKg,
                      tagNumber: pat.tagNumber,
                      microchipNumber: pat.microchipNumber,
                      createdAt: new Date(),
                    } as any);
                  }
                }
              }
            }

            // Cache cases into Dexie visitCases table
            if (mappedVisit.cases && mappedVisit.cases.length > 0) {
              const allCases = await db.visitCases.toArray();
              for (const cs of mappedVisit.cases) {
                const existingCase = allCases.find((c) => String(c.id) === String(cs.id) || (c as any).serverId === String(cs.id));
                if (!existingCase) {
                  await db.visitCases.add({
                    ...cs,
                    serverId: cs.id,
                    syncStatus: 'SYNCED',
                  } as any);
                }
              }
            }

            visit = mappedVisit;
          }
        }
      } catch (err) {
        console.warn('Authoritative fetch /api/visits/:id failed, falling back to local Dexie cache:', err);
      }
    }

    if (!visit) return null;

    // Load child collections from Dexie safely matching both string and number IDs
    const allCases = await db.visitCases.toArray();
    const cases = allCases.filter((c) => String(c.visitId) === String(visit!.id) || (visit as any).serverId && String(c.visitId) === String((visit as any).serverId));

    const allProcs = await db.visitProcedures.toArray();
    const procedures = allProcs.filter((p) => String(p.visitId) === String(visit!.id) || (visit as any).serverId && String(p.visitId) === String((visit as any).serverId));

    const allUsages = await db.visitMedicineUsages.toArray();
    const medicineUsages = allUsages.filter((m) => String(m.visitId) === String(visit!.id) || (visit as any).serverId && String(m.visitId) === String((visit as any).serverId));

    const allEvents = await db.visitTimelineEvents.toArray();
    const timelineEvents = allEvents.filter((e) => String(e.visitId) === String(visit!.id) || (visit as any).serverId && String(e.visitId) === String((visit as any).serverId));

    // Sort timeline chronologically
    timelineEvents.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

    // Enrich with owner information if missing from visit record
    let ownerName = visit.ownerName;
    let ownerPhone = visit.ownerPhone;
    let address = visit.address || '';
    if (visit.ownerId && (!ownerName || !ownerPhone || !address)) {
      const allOwners = await db.owners.toArray();
      const owner = allOwners.find((o) => String(o.id) === String(visit!.ownerId) || o.serverId === String(visit!.ownerId));
      if (owner) {
        ownerName = ownerName || owner.name;
        ownerPhone = ownerPhone || owner.phone;
        if (owner.address) address = address || owner.address;
      }
    }

    // Enrich cases with patient name/species if missing
    const rawCases = cases.length > 0 ? cases : (visit.cases || []);
    const allPatients = await db.patients.toArray();
    const resolvedCases = await Promise.all(
      rawCases.map(async (c) => {
        if (!c.patientName && c.patientId) {
          const pat = allPatients.find((p) => String(p.id) === String(c.patientId) || p.serverId === String(c.patientId));
          if (pat) {
            return {
              ...c,
              patientName: pat.name,
              species: c.species || pat.species,
            };
          }
        }
        return c;
      })
    );

    return {
      ...visit,
      ownerName,
      ownerPhone,
      address: address || visit.address || '',
      cases: resolvedCases,
      procedures,
      medicineUsages,
      timelineEvents,
    };
  }

  // 2. Record Arrival (CVP-20)
  static async recordArrival(
    visitId: number | string,
    locationData?: {
      latitude?: number | null;
      longitude?: number | null;
      accuracy?: number | null;
    }
  ): Promise<Visit> {
    const now = new Date();

    const visit = await this.getVisitById(visitId);
    if (!visit) {
      throw new Error(`Visit ${visitId} not found.`);
    }

    // Idempotent: If already arrived or in-progress/completed, return
    if (['ARRIVED', 'IN_PROGRESS', 'COMPLETED'].includes(visit.status)) {
      return visit;
    }

    const updates: Partial<Visit> = {
      status: 'ARRIVED',
      arrivedAt: visit.arrivedAt || now,
      updatedAt: now,
    };

    if (locationData?.latitude != null && locationData?.longitude != null) {
      updates.arrivalLatitude = locationData.latitude;
      updates.arrivalLongitude = locationData.longitude;
      updates.arrivalAccuracy = locationData.accuracy || undefined;
    }

    await db.visits.update(visit.id as any, updates as any);

    // Record timeline event
    await db.visitTimelineEvents.add({
      visitId: visit.id!,
      eventType: 'ARRIVAL_RECORDED',
      title: 'Arrived at Location',
      description: locationData?.latitude
        ? `Arrived with GPS: (${locationData.latitude.toFixed(5)}, ${locationData.longitude?.toFixed(5)})`
        : 'Arrived at client location.',
      occurredAt: now,
      syncStatus: 'LOCAL_PENDING',
    } as any);

    // Online background sync
    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        await fetch(`/api/visits/${visit.id}/arrive`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(locationData || {}),
        });
      } catch (err) {
        console.warn('Backend arrival sync failed, saved locally in Dexie:', err);
      }
    }

    return (await this.getVisitById(visit.id!))!;
  }

  // 3. Start Visit (CVP-22)
  static async startVisit(visitId: number | string): Promise<Visit> {
    const now = new Date();

    const visit = await this.getVisitById(visitId);
    if (!visit) {
      throw new Error(`Visit ${visitId} not found.`);
    }

    if (visit.status === 'COMPLETED' || visit.status === 'CANCELLED') {
      throw new Error(`Cannot start visit in ${visit.status} state.`);
    }

    // Idempotent: If already in-progress, return current visit
    if (visit.status === 'IN_PROGRESS') {
      return visit;
    }

    await db.visits.update(visit.id as any, {
      status: 'IN_PROGRESS',
      visitStartedAt: visit.visitStartedAt || now,
      updatedAt: now,
    });

    await db.visitTimelineEvents.add({
      visitId: visit.id!,
      eventType: 'VISIT_STARTED',
      title: 'Active Visit Started',
      description: 'Veterinarian began clinical examination & procedures.',
      occurredAt: now,
      syncStatus: 'LOCAL_PENDING',
    } as any);

    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        await fetch(`/api/visits/${visit.id}/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
      } catch (err) {
        console.warn('Backend start visit sync failed, saved locally:', err);
      }
    }

    return (await this.getVisitById(visit.id!))!;
  }

  // 4. Record Procedure Actually Performed (CVP-23)
  static async recordProcedure(
    visitId: number | string,
    procedureData: Partial<VisitProcedure>
  ): Promise<VisitProcedure> {
    const visit = await this.getVisitById(visitId);
    if (!visit) throw new Error(`Visit ${visitId} not found.`);

    const now = new Date();
    const newProc: VisitProcedure = {
      visitId: visit.id!,
      patientId: procedureData.patientId,
      patientName: procedureData.patientName,
      procedureCategory: procedureData.procedureCategory || 'GENERAL',
      procedureName: procedureData.procedureName || 'Clinical Examination',
      notes: procedureData.notes,
      standardFee: procedureData.standardFee ?? 0,
      performedAt: now,
      isPlanned: false,
    };

    const procId = await db.visitProcedures.add(newProc as any);
    newProc.id = procId;

    await db.visitTimelineEvents.add({
      visitId: visit.id!,
      eventType: 'PROCEDURE_RECORDED',
      title: `Procedure Performed: ${newProc.procedureName}`,
      description: newProc.notes || `Category: ${newProc.procedureCategory}`,
      occurredAt: now,
      syncStatus: 'LOCAL_PENDING',
    } as any);

    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        await fetch(`/api/visits/${visit.id}/procedures`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(newProc),
        });
      } catch (err) {
        console.warn('Backend procedure record sync failed, saved locally:', err);
      }
    }

    return newProc;
  }

  // 5. Record Actual Medicine Usage (CVP-24)
  static async recordMedicineUsage(
    visitId: number | string,
    usageData: Partial<VisitMedicineUsage>
  ): Promise<VisitMedicineUsage> {
    const visit = await this.getVisitById(visitId);
    if (!visit) throw new Error(`Visit ${visitId} not found.`);

    const now = new Date();
    const idempotencyKey = usageData.idempotencyKey || `use_${visit.id}_${usageData.medicineName}_${Date.now()}`;

    // Check existing usage by idempotencyKey to prevent duplicate entry
    if (usageData.idempotencyKey) {
      const allUsages = await db.visitMedicineUsages.toArray();
      const existing = allUsages.find((m) => m.idempotencyKey === usageData.idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    const newUsage: VisitMedicineUsage = {
      visitId: visit.id!,
      visitCaseId: usageData.visitCaseId,
      patientId: usageData.patientId,
      patientName: usageData.patientName,
      medicineId: usageData.medicineId || 0,
      medicineName: usageData.medicineName || 'Medicine',
      batchNumber: usageData.batchNumber,
      quantityUsed: usageData.quantityUsed || 1,
      unit: usageData.unit || 'dose',
      route: usageData.route || 'Oral',
      instructions: usageData.instructions,
      isStockDeducted: false,
      administeredAt: now,
      idempotencyKey,
    };

    const usageId = await db.visitMedicineUsages.add(newUsage as any);
    newUsage.id = usageId;

    await db.visitTimelineEvents.add({
      visitId: visit.id!,
      eventType: 'MEDICINE_USAGE_RECORDED',
      title: `Medicine Administered: ${newUsage.medicineName}`,
      description: `Quantity: ${newUsage.quantityUsed} ${newUsage.unit} | Route: ${newUsage.route}${newUsage.batchNumber ? ` | Batch: ${newUsage.batchNumber}` : ''}`,
      occurredAt: now,
      syncStatus: 'LOCAL_PENDING',
    } as any);

    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        const serverPatientId = await this.resolvePatientServerUuid(newUsage.patientId);
        const serverMedicineId = await this.resolveMedicineServerUuid(newUsage.medicineId);

        const res = await fetch(`/api/visits/${visit.id}/medicine-usage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            ...newUsage,
            patientId: serverPatientId,
            medicineId: serverMedicineId,
          }),
        });
        if (res.ok) {
          const resData = await res.json();
          if (resData?.usage?.isStockDeducted) {
            newUsage.isStockDeducted = true;
            (newUsage as any).stockDeductionId = resData.usage.stockDeductionId;
            await db.visitMedicineUsages.update(usageId as any, {
              isStockDeducted: true,
              stockDeductionId: resData.usage.stockDeductionId,
            } as any);
          }
        }
      } catch (err) {
        console.warn('Backend medicine usage sync failed, saved locally:', err);
      }
    }

    return newUsage;
  }

  // 6. Complete Visit (CVP-25)
  static async completeVisit(
    visitId: number | string,
    summary: {
      actualDurationMinutes?: number;
      completionNotes?: string;
    }
  ): Promise<Visit> {
    const visit = await this.getVisitById(visitId);
    if (!visit) throw new Error(`Visit ${visitId} not found.`);

    if (visit.status === 'COMPLETED') {
      return visit;
    }

    const now = new Date();
    let duration = summary.actualDurationMinutes;
    if (!duration && visit.visitStartedAt) {
      const startMs = new Date(visit.visitStartedAt).getTime();
      duration = Math.max(1, Math.round((now.getTime() - startMs) / 60000));
    }

    await db.visits.update(visit.id as any, {
      status: 'COMPLETED',
      visitCompletedAt: now,
      actualDurationMinutes: duration || visit.estimatedDurationMinutes,
      completionNotes: summary.completionNotes,
      updatedAt: now,
    });

    await db.visitTimelineEvents.add({
      visitId: visit.id!,
      eventType: 'VISIT_COMPLETED',
      title: 'Visit Successfully Finalized',
      description: summary.completionNotes || `Visit concluded in ${duration || visit.estimatedDurationMinutes} minutes.`,
      occurredAt: now,
      syncStatus: 'LOCAL_PENDING',
    } as any);

    // Auto-complete linked follow-up if present
    try {
      const allFollowUps = await db.followUps.toArray();
      for (const f of allFollowUps) {
        if (String(f.scheduledVisitId) === String(visit.id)) {
          await db.followUps.update(f.id as any, {
            status: 'COMPLETED',
            updatedAt: now,
          });
        }
      }
    } catch (err) {
      console.warn('Failed to auto-complete linked follow-up:', err);
    }

    // Refresh practice duration estimates in background
    try {
      const practiceId = visit.practiceId || 'default-practice';
      await durationLearningService.calculateEstimatesForPractice(practiceId);
    } catch (err) {
      console.warn('Background duration estimate update failed:', err);
    }

    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        await fetch(`/api/visits/${visit.id}/complete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(summary),
        });
      } catch (err) {
        console.warn('Backend complete visit sync failed, saved locally:', err);
      }
    }

    return (await this.getVisitById(visit.id!))!;
  }

  // 7. Resume Visit
  static async resumeVisit(visitId: number | string): Promise<Visit> {
    const visit = await this.getVisitById(visitId);
    if (!visit) throw new Error(`Visit ${visitId} not found.`);

    if (visit.status === 'IN_PROGRESS') {
      return visit;
    }

    const now = new Date();
    await db.visits.update(visit.id as any, {
      status: 'IN_PROGRESS',
      updatedAt: now,
    });

    await db.visitTimelineEvents.add({
      visitId: visit.id!,
      eventType: 'VISIT_RESUMED',
      title: 'Visit Resumed',
      description: 'Doctor resumed active visit mode.',
      occurredAt: now,
      syncStatus: 'LOCAL_PENDING',
    } as any);

    if (typeof window !== 'undefined' && navigator.onLine) {
      try {
        await fetch(`/api/visits/${visit.id}/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });
      } catch (err) {
        console.warn('Backend resume visit sync failed, saved locally:', err);
      }
    }

    return (await this.getVisitById(visit.id!))!;
  }

  // 8. Get Visit Timeline (CVP-45)
  static async getVisitTimeline(visitId: number | string): Promise<VisitTimelineEvent[]> {
    const allEvents = await db.visitTimelineEvents.toArray();
    const events = allEvents.filter((e) => String(e.visitId) === String(visitId));
    events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
    return events;
  }
}

export const cvpService = CvpService;
