import { apiClient } from './apiClient';
import type { Call, Visit, DailyPlan, CapacitySummary, VisitProcedure, VisitMedicineUsage, VisitTimelineEvent } from '../../types';

export interface ListCallsParams {
  tab?: 'today' | 'upcoming' | 'postponed' | 'all';
  search?: string;
  priority?: string;
  status?: string;
}

export interface CreateCallPayload {
  callerPhone: string;
  ownerId?: string | number | null;
  tempOwnerName?: string | null;
  tempPatientName?: string | null;
  species?: string | null;
  animalCount?: number;
  symptoms: string;
  tentativeAssessment?: string | null;
  priority?: 'EMERGENCY' | 'URGENT' | 'COULD_NOT_ASSESS' | 'PLANNED';
  flexibility?: 'MUST_ATTEND_TODAY' | 'CAN_POSTPONE_TODAY' | 'PREFERRED_TODAY' | 'SPECIFIC_DATE';
  preferredDate?: string | null;
  locationAddress?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  plannedProcedure?: string | null;
  notes?: string | null;
}

export interface ScheduleCallPayload {
  scheduledDate: string;
  priority?: string;
  flexibility?: string;
  preferredTime?: string | null;
  locationId?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  estimatedDurationMinutes?: number;
  notes?: string | null;
  cases?: Array<{
    patientId?: string | number | null;
    patientName?: string | null;
    species?: string | null;
    chiefComplaint: string;
    tentativeDiagnosis?: string | null;
    procedureCategory?: string | null;
  }>;
  addToTodayPlan?: boolean;
}

export interface ListVisitsParams {
  date?: string;
  callId?: string;
  status?: string;
}

export interface RecordArrivalPayload {
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
}

export interface RecordProcedurePayload {
  patientId?: string | null;
  patientName?: string | null;
  procedureCategory: string;
  procedureName: string;
  notes?: string | null;
  standardFee?: number;
}

export interface RecordMedicineUsagePayload {
  patientId?: string | number | null;
  patientName?: string | null;
  medicineId?: string | number | null;
  medicineName: string;
  batchNumber?: string | null;
  quantityUsed: number;
  unit?: string | null;
  route?: string | null;
  instructions?: string | null;
  idempotencyKey?: string | null;
  locationId?: string | null;
}

export interface CompleteVisitPayload {
  actualDurationMinutes?: number;
  completionNotes?: string | null;
}

export interface UpsertDailyPlanPayload {
  planDate: string;
  doctorUserId?: string | null;
  startLocationAddress?: string | null;
  startLatitude?: number | null;
  startLongitude?: number | null;
  endLocationAddress?: string | null;
  totalEstimatedKm?: number;
  totalEstimatedTravelMinutes?: number;
  totalEstimatedVisitMinutes?: number;
  workingMinutesAvailable?: number;
  status?: 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED';
  stops?: Array<{
    visitId: string;
    stopOrder: number;
    estimatedArrival?: string | null;
    estimatedDeparture?: string | null;
    isLocked?: boolean;
  }>;
}

export const cvpApi = {
  // Calls
  async listCalls(params?: ListCallsParams): Promise<Call[]> {
    return apiClient.get<Call[]>('/calls', params as Record<string, string | number | boolean | undefined>);
  },

  async getCall(id: string): Promise<Call> {
    return apiClient.get<Call>(`/calls/${id}`);
  },

  async getTodayCapacity(workingMinutes: number = 480): Promise<CapacitySummary> {
    return apiClient.get<CapacitySummary>('/calls/capacity', { workingMinutes });
  },

  async createCall(payload: CreateCallPayload): Promise<Call> {
    return apiClient.post<Call>('/calls', payload);
  },

  async updateCall(id: string, payload: Partial<CreateCallPayload> & { status?: string }): Promise<Call> {
    return apiClient.patch<Call>(`/calls/${id}`, payload);
  },

  async postponeCall(id: string, targetDate: string, reason?: string): Promise<Call> {
    return apiClient.post<Call>(`/calls/${id}/postpone`, { targetDate, reason });
  },

  async scheduleCall(id: string, payload: ScheduleCallPayload): Promise<{ call: Call; visit: Visit }> {
    return apiClient.post<{ call: Call; visit: Visit }>(`/calls/${id}/schedule`, payload);
  },

  async closeCall(id: string, payload: { reason: string; reasonDetails?: string; clinicalNotes?: string }): Promise<Call> {
    return apiClient.post<Call>(`/calls/${id}/close`, payload);
  },

  async deleteCall(id: string): Promise<{ success: boolean; message?: string }> {
    return apiClient.delete<{ success: boolean; message?: string }>(`/calls/${id}`);
  },

  // Visits
  async listVisits(params?: ListVisitsParams): Promise<Visit[]> {
    return apiClient.get<Visit[]>('/visits', params as Record<string, string | number | boolean | undefined>);
  },

  async getVisit(id: string): Promise<Visit> {
    return apiClient.get<Visit>(`/visits/${id}`);
  },

  async recordArrival(id: string, payload: RecordArrivalPayload): Promise<Visit> {
    return apiClient.post<Visit>(`/visits/${id}/arrive`, payload);
  },

  async startVisit(id: string): Promise<Visit> {
    return apiClient.post<Visit>(`/visits/${id}/start`);
  },

  async recordProcedure(id: string, payload: RecordProcedurePayload): Promise<VisitProcedure> {
    return apiClient.post<VisitProcedure>(`/visits/${id}/procedures`, payload);
  },

  async recordMedicineUsage(id: string, payload: RecordMedicineUsagePayload): Promise<VisitMedicineUsage> {
    return apiClient.post<VisitMedicineUsage>(`/visits/${id}/medicine-usage`, payload);
  },

  async completeVisit(id: string, payload: CompleteVisitPayload): Promise<Visit> {
    return apiClient.post<Visit>(`/visits/${id}/complete`, payload);
  },

  async resumeVisit(id: string): Promise<Visit> {
    return apiClient.post<Visit>(`/visits/${id}/resume`);
  },

  async getVisitTimeline(id: string): Promise<VisitTimelineEvent[]> {
    return apiClient.get<VisitTimelineEvent[]>(`/visits/${id}/timeline`);
  },

  async postponeVisit(id: string, targetDate: string, reason?: string): Promise<Visit> {
    return apiClient.post<Visit>(`/visits/${id}/postpone`, { targetDate, reason });
  },

  // Daily Plans
  async getDailyPlan(date?: string): Promise<DailyPlan | null> {
    return apiClient.get<DailyPlan | null>('/daily-plans', date ? { date } : undefined);
  },

  async upsertDailyPlan(payload: UpsertDailyPlanPayload): Promise<DailyPlan> {
    return apiClient.post<DailyPlan>('/daily-plans', payload);
  },

  async confirmDailyPlan(id: string): Promise<DailyPlan> {
    return apiClient.post<DailyPlan>(`/daily-plans/${id}/confirm`);
  },

  // Duration Estimates
  async getDurationEstimates(): Promise<Array<{ category: string; averageMinutes: number; sampleCount: number; overrideMinutes: number | null }>> {
    return apiClient.get('/duration-estimates');
  },

  async setDurationEstimateOverride(category: string, overrideMinutes: number | null): Promise<any> {
    return apiClient.put(`/duration-estimates/${encodeURIComponent(category)}`, { overrideMinutes });
  },
};
