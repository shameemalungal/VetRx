// ==============================================================================
// VetRx Call & Visit Planner (CVP) — Follow-up & Recurring Visits Service (Phase 8)
// Recommendations != Appointments, Series Generation, Communication Handoff
// ==============================================================================

import { db } from '../db/schema';
import type {
  FollowUp,
  FollowUpStatus,
  FollowUpReason,
  RecurringSchedule,
  RecurrenceFrequency,
  CallPriority,
  VisitFlexibility,
  Call,
  Visit,
  FollowUpConversionResult,
} from '../types/cvp';
import { normalizePhoneNumber } from '../utils/phoneUtils';

export class FollowUpService {
  /**
   * Determine dynamic status of a follow-up based on recommended date.
   * If upcoming and date <= today, it is DUE or OVERDUE.
   * Preserves explicitly terminal/final states: COMPLETED, CANCELLED, SCHEDULED.
   */
  static evaluateDynamicStatus(followUp: FollowUp, referenceDate?: string): FollowUpStatus {
    if (
      followUp.status === 'COMPLETED' ||
      followUp.status === 'CANCELLED' ||
      followUp.status === 'SCHEDULED'
    ) {
      return followUp.status;
    }

    const todayStr = referenceDate || new Date().toISOString().split('T')[0];
    const recDate = typeof followUp.recommendedDate === 'string'
      ? followUp.recommendedDate.split('T')[0]
      : new Date(followUp.recommendedDate).toISOString().split('T')[0];

    if (recDate < todayStr) {
      return 'OVERDUE';
    } else if (recDate === todayStr) {
      return 'DUE';
    } else {
      return followUp.status === 'POSTPONED' ? 'POSTPONED' : 'UPCOMING';
    }
  }

  /**
   * List follow-ups for a practice with dynamic status resolution and optional tab filtering.
   */
  static async listFollowUps(
    practiceId: string,
    filters: {
      tab?: 'due_today' | 'overdue' | 'upcoming' | 'recurring' | 'postponed' | 'awaiting_confirmation' | 'completed' | 'all';
      search?: string;
      reason?: string;
      priority?: string;
      ownerId?: string | number;
      patientId?: string | number;
    } = {}
  ): Promise<FollowUp[]> {
    const all = (await db.followUps.toArray()) as FollowUp[];
    const todayStr = new Date().toISOString().split('T')[0];

    // Partition by practiceId
    let items = all.filter((f) => !f.practiceId || f.practiceId === practiceId);

    // Evaluate dynamic status
    items = items.map((f) => {
      const dynamicStatus = this.evaluateDynamicStatus(f, todayStr);
      return dynamicStatus !== f.status ? { ...f, status: dynamicStatus } : f;
    });

    // Apply Tab filter
    if (filters.tab && filters.tab !== 'all') {
      switch (filters.tab) {
        case 'due_today':
          items = items.filter((f) => f.status === 'DUE');
          break;
        case 'overdue':
          items = items.filter((f) => f.status === 'OVERDUE');
          break;
        case 'upcoming':
          items = items.filter((f) => f.status === 'UPCOMING');
          break;
        case 'recurring':
          items = items.filter((f) => Boolean(f.recurrenceRuleId));
          break;
        case 'postponed':
          items = items.filter((f) => f.status === 'POSTPONED');
          break;
        case 'awaiting_confirmation':
          items = items.filter(
            (f) => (f.status === 'DUE' || f.status === 'OVERDUE') && !f.acknowledgedAt
          );
          break;
        case 'completed':
          items = items.filter((f) => f.status === 'COMPLETED');
          break;
      }
    }

    // Apply Search filter
    if (filters.search && filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      items = items.filter((f) =>
        (f.ownerName && f.ownerName.toLowerCase().includes(q)) ||
        (f.patientName && f.patientName.toLowerCase().includes(q)) ||
        (f.ownerPhone && f.ownerPhone.includes(q)) ||
        (f.notes && f.notes.toLowerCase().includes(q)) ||
        (f.reason && f.reason.toLowerCase().includes(q))
      );
    }

    if (filters.reason && filters.reason !== 'ALL') {
      items = items.filter((f) => f.reason === filters.reason);
    }

    if (filters.priority && filters.priority !== 'ALL') {
      items = items.filter((f) => f.priority === filters.priority);
    }

    if (filters.ownerId) {
      items = items.filter((f) => String(f.ownerId) === String(filters.ownerId));
    }

    if (filters.patientId) {
      items = items.filter((f) => String(f.patientId) === String(filters.patientId));
    }

    // Order: OVERDUE, DUE, UPCOMING; then by recommendedDate ascending
    const priorityWeight: Record<FollowUpStatus, number> = {
      OVERDUE: 0,
      DUE: 1,
      UPCOMING: 2,
      POSTPONED: 3,
      SCHEDULED: 4,
      COMPLETED: 5,
      CANCELLED: 6,
    };

    items.sort((a, b) => {
      const wa = priorityWeight[a.status] ?? 99;
      const wb = priorityWeight[b.status] ?? 99;
      if (wa !== wb) return wa - wb;
      return new Date(a.recommendedDate).getTime() - new Date(b.recommendedDate).getTime();
    });

    return items;
  }

  /**
   * Create a single clinical follow-up recommendation.
   * Kept strictly separate from scheduled appointments.
   */
  static async createFollowUp(data: {
    practiceId: string;
    ownerId: string | number;
    ownerName?: string;
    ownerPhone?: string;
    patientId?: string | number;
    patientName?: string;
    species?: string;
    animalCount?: number;
    originVisitId?: string | number;
    recurrenceRuleId?: string | number;
    reason: FollowUpReason | string;
    procedureCategory?: string;
    recommendedDate: string; // YYYY-MM-DD
    priority?: CallPriority;
    flexibility?: VisitFlexibility;
    preferredTimeWindow?: string;
    notes?: string;
  }): Promise<FollowUp> {
    const now = new Date();
    const recommendedDateStr = data.recommendedDate.split('T')[0];
    const initialStatus = this.evaluateDynamicStatus(
      { recommendedDate: recommendedDateStr, status: 'UPCOMING' } as FollowUp
    );

    const followUp: FollowUp = {
      practiceId: data.practiceId,
      ownerId: data.ownerId,
      ownerName: data.ownerName,
      ownerPhone: data.ownerPhone ? normalizePhoneNumber(data.ownerPhone) : undefined,
      patientId: data.patientId,
      patientName: data.patientName,
      species: data.species,
      animalCount: data.animalCount || 1,
      originVisitId: data.originVisitId,
      recurrenceRuleId: data.recurrenceRuleId,
      reason: data.reason,
      procedureCategory: data.procedureCategory,
      recommendedDate: recommendedDateStr,
      priority: data.priority || 'PLANNED',
      flexibility: data.flexibility || 'MUST_ATTEND_TODAY',
      preferredTimeWindow: data.preferredTimeWindow || 'ANYTIME',
      notes: data.notes,
      status: initialStatus,
      createdAt: now,
      updatedAt: now,
    };

    const id = await db.followUps.add(followUp as any);
    followUp.id = id;
    return followUp;
  }

  /**
   * Create a recurring schedule and generate initial occurrence candidates.
   */
  static async createRecurringSchedule(data: {
    practiceId: string;
    ownerId: string | number;
    ownerName?: string;
    ownerPhone?: string;
    patientId?: string | number;
    patientName?: string;
    species?: string;
    reason: FollowUpReason | string;
    procedureCategory?: string;
    frequency: RecurrenceFrequency;
    intervalDays?: number;
    startDate: string; // YYYY-MM-DD
    endDate?: string; // YYYY-MM-DD
    maxOccurrences?: number;
    priority?: CallPriority;
    flexibility?: VisitFlexibility;
    preferredTimeWindow?: string;
    notes?: string;
    generateOccurrencesHorizonDays?: number; // default: 60 days
  }): Promise<{ schedule: RecurringSchedule; createdFollowUps: FollowUp[] }> {
    const now = new Date();
    const schedule: RecurringSchedule = {
      practiceId: data.practiceId,
      ownerId: data.ownerId,
      ownerName: data.ownerName,
      patientId: data.patientId,
      patientName: data.patientName,
      species: data.species,
      reason: data.reason,
      procedureCategory: data.procedureCategory,
      frequency: data.frequency,
      intervalDays: data.intervalDays,
      startDate: data.startDate.split('T')[0],
      endDate: data.endDate ? data.endDate.split('T')[0] : undefined,
      maxOccurrences: data.maxOccurrences,
      generatedOccurrencesCount: 0,
      priority: data.priority || 'PLANNED',
      flexibility: data.flexibility || 'MUST_ATTEND_TODAY',
      preferredTimeWindow: data.preferredTimeWindow || 'ANYTIME',
      notes: data.notes,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    };

    const scheduleId = await db.recurringSchedules.add(schedule as any);
    schedule.id = scheduleId;

    // Generate occurrence dates up to horizon
    const horizonDays = data.generateOccurrencesHorizonDays || 60;
    const occurrenceDates = this.calculateNextOccurrences({
      frequency: data.frequency,
      intervalDays: data.intervalDays,
      startDate: data.startDate,
      endDate: data.endDate,
      maxOccurrences: data.maxOccurrences,
      horizonDays,
    });

    const createdFollowUps: FollowUp[] = [];

    for (const dateStr of occurrenceDates) {
      const followUp = await this.createFollowUp({
        practiceId: data.practiceId,
        ownerId: data.ownerId,
        ownerName: data.ownerName,
        ownerPhone: data.ownerPhone,
        patientId: data.patientId,
        patientName: data.patientName,
        species: data.species,
        recurrenceRuleId: scheduleId,
        reason: data.reason,
        procedureCategory: data.procedureCategory,
        recommendedDate: dateStr,
        priority: data.priority,
        flexibility: data.flexibility,
        preferredTimeWindow: data.preferredTimeWindow,
        notes: `Recurring ${data.frequency} visit (${schedule.reason})${data.notes ? `: ${data.notes}` : ''}`,
      });
      createdFollowUps.push(followUp);
    }

    // Update count on schedule
    schedule.generatedOccurrencesCount = createdFollowUps.length;
    await db.recurringSchedules.update(scheduleId as any, {
      generatedOccurrencesCount: createdFollowUps.length,
      updatedAt: new Date(),
    });

    return { schedule, createdFollowUps };
  }

  /**
   * Pure deterministic calculation of next occurrence dates.
   * Avoids duplicate dates and respects start/end/max bounds.
   */
  static calculateNextOccurrences(
    paramsOrStartDate:
      | string
      | {
          frequency: RecurrenceFrequency;
          intervalDays?: number;
          startDate: string; // YYYY-MM-DD
          endDate?: string;
          maxOccurrences?: number;
          horizonDays?: number;
          existingDates?: string[];
        },
    frequency?: RecurrenceFrequency,
    maxOccurrences?: number,
    endDate?: string,
    intervalDays?: number
  ): string[] {
    let params: {
      frequency: RecurrenceFrequency;
      intervalDays?: number;
      startDate: string;
      endDate?: string;
      maxOccurrences?: number;
      horizonDays?: number;
      existingDates?: string[];
    };

    if (typeof paramsOrStartDate === 'string') {
      params = {
        startDate: paramsOrStartDate,
        frequency: frequency || 'WEEKLY',
        maxOccurrences,
        endDate,
        intervalDays,
        horizonDays: 365,
      };
    } else {
      params = paramsOrStartDate;
    }

    const dates: string[] = [];
    const existingSet = new Set((params.existingDates || []).map((d) => d.split('T')[0]));

    const start = new Date(params.startDate + 'T00:00:00');
    const horizonLimit = new Date(start);
    horizonLimit.setDate(horizonLimit.getDate() + (params.horizonDays || 365));

    const endLimit = params.endDate ? new Date(params.endDate + 'T23:59:59') : null;
    const max = params.maxOccurrences || 100;

    let current = new Date(start);
    let count = 0;

    const formatLocalDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    while (count < max && current <= horizonLimit) {
      if (endLimit && current > endLimit) {
        break;
      }

      const dateStr = formatLocalDate(current);
      if (!existingSet.has(dateStr)) {
        dates.push(dateStr);
        existingSet.add(dateStr);
        count++;
      }

      // Advance by frequency
      switch (params.frequency) {
        case 'DAILY':
          current.setDate(current.getDate() + 1);
          break;
        case 'WEEKLY':
          current.setDate(current.getDate() + 7);
          break;
        case 'BIWEEKLY':
          current.setDate(current.getDate() + 14);
          break;
        case 'MONTHLY':
          current.setMonth(current.getMonth() + 1);
          break;
        case 'CUSTOM_INTERVAL':
          const step = params.intervalDays && params.intervalDays > 0 ? params.intervalDays : 1;
          current.setDate(current.getDate() + step);
          break;
        default:
          current.setDate(current.getDate() + 7);
      }
    }

    return dates;
  }

  /**
   * Cancel an entire recurring series:
   * Sets schedule status to CANCELLED and marks future uncompleted follow-ups CANCELLED.
   * Preserves historical completed visits and completed follow-ups.
   */
  static async cancelRecurringSeries(scheduleId: string | number): Promise<{
    cancelledFollowUpsCount: number;
    preservedCompletedCount: number;
  }> {
    const allFollowUps = (await db.followUps.toArray()) as FollowUp[];
    const seriesItems = allFollowUps.filter((f) => String(f.recurrenceRuleId) === String(scheduleId));

    let cancelledCount = 0;
    let completedCount = 0;

    for (const f of seriesItems) {
      if (f.status === 'COMPLETED') {
        completedCount++;
      } else {
        await db.followUps.update(f.id as any, {
          status: 'CANCELLED',
          updatedAt: new Date(),
        });
        cancelledCount++;
      }
    }

    await db.recurringSchedules.update(scheduleId as any, {
      status: 'CANCELLED',
      updatedAt: new Date(),
    });

    return {
      cancelledFollowUpsCount: cancelledCount,
      preservedCompletedCount: completedCount,
    };
  }

  /**
   * Cancel a single occurrence without affecting the rest of the series.
   */
  static async cancelSingleOccurrence(followUpId: string | number): Promise<FollowUp> {
    const item = (await db.followUps.get(followUpId as any)) as FollowUp | undefined;
    if (!item) throw new Error(`FollowUp ${followUpId} not found`);

    await db.followUps.update(followUpId as any, {
      status: 'CANCELLED',
      updatedAt: new Date(),
    });

    return { ...item, status: 'CANCELLED' };
  }

  /**
   * Edit a single occurrence date/notes without modifying the parent recurrence series.
   */
  static async editSingleOccurrence(
    followUpId: string | number,
    updates: {
      recommendedDate?: string;
      priority?: CallPriority;
      notes?: string;
    }
  ): Promise<FollowUp> {
    const item = (await db.followUps.get(followUpId as any)) as FollowUp | undefined;
    if (!item) throw new Error(`FollowUp ${followUpId} not found`);

    const updated: FollowUp = {
      ...item,
      recommendedDate: updates.recommendedDate ? updates.recommendedDate.split('T')[0] : item.recommendedDate,
      priority: updates.priority || item.priority,
      notes: updates.notes !== undefined ? updates.notes : item.notes,
      updatedAt: new Date(),
    };

    updated.status = this.evaluateDynamicStatus(updated);

    await db.followUps.update(followUpId as any, updated as any);
    return updated;
  }

  /**
   * Postpone a follow-up to a new recommended date.
   */
  static async postponeFollowUp(
    followUpId: string | number,
    newDate: string,
    reason?: string
  ): Promise<FollowUp> {
    const item = (await db.followUps.get(followUpId as any)) as FollowUp | undefined;
    if (!item) throw new Error(`FollowUp ${followUpId} not found`);

    const dateStr = newDate.split('T')[0];
    const notes = reason ? `${item.notes ? `${item.notes} | ` : ''}Postponed to ${dateStr}: ${reason}` : item.notes;

    const updated: FollowUp = {
      ...item,
      recommendedDate: dateStr,
      status: 'POSTPONED',
      notes,
      updatedAt: new Date(),
    };

    await db.followUps.update(followUpId as any, updated as any);
    return updated;
  }

  /**
   * Convert a due follow-up into a registered Call (intake workflow).
   * Links call to follow-up and sets follow-up status to SCHEDULED.
   */
  static async convertToCall(followUpId: string | number): Promise<FollowUpConversionResult> {
    const followUp = (await db.followUps.get(followUpId as any)) as FollowUp | undefined;
    if (!followUp) throw new Error(`FollowUp ${followUpId} not found`);

    const now = new Date();
    const createdCall: Call = {
      practiceId: followUp.practiceId,
      callerPhone: followUp.ownerPhone || '0000000000',
      ownerId: followUp.ownerId,
      ownerName: followUp.ownerName,
      patientIds: followUp.patientId ? [followUp.patientId] : undefined,
      species: followUp.species,
      animalCount: followUp.animalCount || 1,
      symptoms: `Follow-up Intake: ${followUp.reason}${followUp.notes ? ` (${followUp.notes})` : ''}`,
      priority: followUp.priority,
      flexibility: followUp.flexibility,
      preferredDate: followUp.recommendedDate,
      status: 'LOGGED',
      plannedProcedure: followUp.procedureCategory || followUp.reason,
      notes: `Converted from Follow-up #${followUp.id}`,
      createdAt: now,
      updatedAt: now,
    };

    const callId = await db.calls.add(createdCall as any);
    createdCall.id = callId;

    // Transition follow-up
    const updatedFollowUp: FollowUp = {
      ...followUp,
      status: 'SCHEDULED',
      scheduledCallId: callId,
      updatedAt: now,
    };
    await db.followUps.update(followUpId as any, updatedFollowUp as any);

    return {
      followUp: updatedFollowUp,
      createdCall,
    };
  }

  /**
   * Convert a due follow-up directly into a Planned Visit.
   * Links visit to follow-up and sets follow-up status to SCHEDULED.
   */
  static async convertToVisit(
    followUpId: string | number,
    addressOverride?: string
  ): Promise<FollowUpConversionResult> {
    const followUp = (await db.followUps.get(followUpId as any)) as FollowUp | undefined;
    if (!followUp) throw new Error(`FollowUp ${followUpId} not found`);

    // Lookup owner address if not provided
    let address = addressOverride;
    if (!address && followUp.ownerId) {
      const owner = await db.owners.get(followUp.ownerId as any);
      address = owner?.address || 'Client Address';
    }
    if (!address) address = 'Client Location';

    const now = new Date();
    const createdVisit: Visit = {
      practiceId: followUp.practiceId,
      ownerId: followUp.ownerId,
      ownerName: followUp.ownerName,
      ownerPhone: followUp.ownerPhone,
      address,
      status: 'PLANNED',
      priority: followUp.priority,
      flexibility: followUp.flexibility,
      scheduledDate: followUp.recommendedDate,
      estimatedDurationMinutes: 30,
      notes: `Generated from Follow-up #${followUp.id}: ${followUp.reason}`,
      cases: followUp.patientId ? [
        {
          practiceId: followUp.practiceId,
          patientId: followUp.patientId,
          patientName: followUp.patientName,
          species: followUp.species,
          chiefComplaint: `Follow-up: ${followUp.reason}`,
          procedureCategory: followUp.procedureCategory || followUp.reason,
          notes: followUp.notes,
        },
      ] : undefined,
      createdAt: now,
      updatedAt: now,
    };

    const visitId = await db.visits.add(createdVisit as any);
    createdVisit.id = visitId;

    // Transition follow-up
    const updatedFollowUp: FollowUp = {
      ...followUp,
      status: 'SCHEDULED',
      scheduledVisitId: visitId,
      updatedAt: now,
    };
    await db.followUps.update(followUpId as any, updatedFollowUp as any);

    return {
      followUp: updatedFollowUp,
      createdVisit,
    };
  }

  /**
   * Mark a scheduled follow-up as COMPLETED (e.g. when the linked visit finishes).
   */
  static async markCompleted(followUpId: string | number): Promise<FollowUp> {
    const followUp = (await db.followUps.get(followUpId as any)) as FollowUp | undefined;
    if (!followUp) throw new Error(`FollowUp ${followUpId} not found`);

    const updated: FollowUp = {
      ...followUp,
      status: 'COMPLETED',
      updatedAt: new Date(),
    };
    await db.followUps.update(followUpId as any, updated as any);
    return updated;
  }

  /**
   * Acknowledge follow-up reminder contact.
   */
  static async acknowledgeReminder(
    followUpId: string | number,
    acknowledgedBy: string = 'Veterinarian'
  ): Promise<FollowUp> {
    const followUp = (await db.followUps.get(followUpId as any)) as FollowUp | undefined;
    if (!followUp) throw new Error(`FollowUp ${followUpId} not found`);

    const now = new Date();
    const updated: FollowUp = {
      ...followUp,
      acknowledgedAt: now,
      acknowledgedBy,
      updatedAt: now,
    };
    await db.followUps.update(followUpId as any, updated as any);
    return updated;
  }

  /**
   * Generate polite, prefilled WhatsApp handoff message and wa.me link.
   * Does NOT claim message was sent; opens client directly.
   */
  static generateWhatsAppFollowUpLink(params: FollowUp | {
    followUp: FollowUp;
    doctorName?: string;
    practiceName?: string;
  }): { url: string; text: string; phone: string } {
    const followUp = 'reason' in params ? (params as FollowUp) : params.followUp;
    const doctorName = 'doctorName' in params ? params.doctorName : 'Dr. Anand Sharma';
    const practiceName = 'practiceName' in params ? params.practiceName : 'VetRx Practice';

    const patientDesc = followUp.patientName
      ? `${followUp.patientName}${followUp.species ? ` (${followUp.species})` : ''}`
      : followUp.species || 'your animal';

    const reasonLabels: Record<string, string> = {
      POST_TREATMENT_REVIEW: 'Post-treatment health review',
      RECHECK: 'Routine clinical recheck',
      VACCINATION: 'Scheduled vaccination',
      DEWORMING: 'Scheduled deworming',
      PREGNANCY_DIAGNOSIS: 'Pregnancy diagnosis (PD)',
      ARTIFICIAL_INSEMINATION: 'Artificial insemination follow-up',
      POST_OPERATIVE_REVIEW: 'Post-operative recovery check',
      OTHER: 'Veterinary follow-up',
    };

    const friendlyReason = reasonLabels[followUp.reason] || followUp.reason;

    const text =
      `Namaste ${followUp.ownerName || 'Sir/Madam'},\n\n` +
      `This is a follow-up reminder from ${practiceName} (${doctorName}) for ${patientDesc}.\n` +
      `Recommended visit: ${friendlyReason}\n` +
      `Recommended date: ${followUp.recommendedDate}\n` +
      (followUp.notes ? `Notes: ${followUp.notes}\n` : '') +
      `\nPlease reply to confirm if you would like the doctor to attend your farm on this date.\n` +
      `Thank you!`;

    const rawPhone = followUp.ownerPhone || '';
    const cleanDigits = rawPhone.replace(/\D/g, '');
    const formattedPhone = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
    const url = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;

    return { url, text, phone: formattedPhone };
  }
}

export const followUpService = FollowUpService;
