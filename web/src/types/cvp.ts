// ==============================================================================
// VetRx Call & Visit Planner (CVP) — Domain Types
// Canonical Models for Field Practice, Multi-Animal Visits, Routing & Triage
// ==============================================================================

export const CallPriority = {
  EMERGENCY: 'EMERGENCY',
  URGENT: 'URGENT',
  COULD_NOT_ASSESS: 'COULD_NOT_ASSESS',
  PLANNED: 'PLANNED',
} as const;
export type CallPriority = (typeof CallPriority)[keyof typeof CallPriority];

export const VisitFlexibility = {
  MUST_ATTEND_TODAY: 'MUST_ATTEND_TODAY',
  CAN_POSTPONE_TODAY: 'CAN_POSTPONE_TODAY',
  PREFERRED_TODAY: 'PREFERRED_TODAY',
  SPECIFIC_DATE: 'SPECIFIC_DATE',
} as const;
export type VisitFlexibility = (typeof VisitFlexibility)[keyof typeof VisitFlexibility];

export const CallStatus = {
  LOGGED: 'LOGGED',
  SCHEDULED: 'SCHEDULED',
  CANCELLED: 'CANCELLED',
} as const;
export type CallStatus = (typeof CallStatus)[keyof typeof CallStatus];

export const VisitStatus = {
  REGISTERED: 'REGISTERED',
  PLANNED: 'PLANNED',
  EN_ROUTE: 'EN_ROUTE',
  ARRIVED: 'ARRIVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  POSTPONED: 'POSTPONED',
  CANCELLED: 'CANCELLED',
} as const;
export type VisitStatus = (typeof VisitStatus)[keyof typeof VisitStatus];

export type LocationSource =
  | 'MANUAL'
  | 'GPS'
  | 'MAP'
  | 'SAVED';

export interface OwnerLocation {
  id?: number | string;
  practiceId?: string;
  ownerId: number | string;
  label: string; // e.g. "Farm", "Home", "Shed", "Barn #2"
  address: string;
  latitude?: number;
  longitude?: number;
  locationSource: LocationSource;
  accuracy?: number;
  isDefault?: boolean;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Call {
  id?: number | string;
  practiceId?: string;
  callerPhone: string;
  ownerId?: number | string;
  ownerName?: string;
  tempOwnerName?: string;
  patientIds?: (number | string)[];
  selectedPatients?: { id?: number | string; name: string; species: string }[];
  tempPatientName?: string;
  species?: string;
  animalCount?: number;
  symptoms: string;
  tentativeAssessment?: string;
  priority: CallPriority;
  flexibility: VisitFlexibility;
  preferredDate?: Date | string;
  preferredTimeWindow?: string; // 'MORNING' | 'AFTERNOON' | 'EVENING' | 'ANYTIME'
  specialInstructions?: string;
  locationAddress?: string;
  locationId?: number | string;
  latitude?: number;
  longitude?: number;
  status: CallStatus;
  notes?: string;
  plannedProcedure?: string;
  visits?: Visit[];
  linkedVisit?: Visit;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export interface VisitCase {
  id?: number | string;
  practiceId?: string;
  visitId?: number | string;
  patientId?: number | string;
  patientName?: string;
  species?: string;
  chiefComplaint: string;
  tentativeDiagnosis?: string;
  procedureCategory?: string; // 'AI' | 'VACCINATION' | 'PD' | 'EMERGENCY_TREATMENT' | 'GENERAL'
  notes?: string;
  prescriptionId?: number | string;
  invoiceId?: number | string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface VisitProcedure {
  id?: number | string;
  practiceId?: string;
  visitId: number | string;
  visitCaseId?: number | string;
  patientId?: number | string;
  patientName?: string;
  procedureCategory: string; // 'AI' | 'VACCINATION' | 'PD' | 'EMERGENCY_TREATMENT' | 'SURGERY' | 'GENERAL' | 'DEWORMING' | 'WOUND_CARE'
  procedureName: string;
  notes?: string;
  standardFee?: number;
  performedAt: Date | string;
  isPlanned?: boolean;
}

export interface VisitMedicineUsage {
  id?: number | string;
  practiceId?: string;
  visitId: number | string;
  visitCaseId?: number | string;
  patientId?: number | string;
  patientName?: string;
  medicineId: number | string;
  medicineName: string;
  batchNumber?: string;
  quantityUsed: number;
  unit?: string;
  route?: string; // 'Oral' | 'IM' | 'IV' | 'SC' | 'Topical' | 'Intramammary'
  instructions?: string;
  locationId?: string;
  locationName?: string;
  isStockDeducted?: boolean;
  stockDeductionId?: string;
  administeredAt: Date | string;
  idempotencyKey?: string;
}

export type VisitTimelineEventType =
  | 'VISIT_SCHEDULED'
  | 'ARRIVAL_RECORDED'
  | 'VISIT_STARTED'
  | 'PROCEDURE_RECORDED'
  | 'MEDICINE_USAGE_RECORDED'
  | 'PRESCRIPTION_LINKED'
  | 'INVOICE_GENERATED'
  | 'VISIT_COMPLETED'
  | 'VISIT_RESUMED';

export interface VisitTimelineEvent {
  id?: number | string;
  practiceId?: string;
  visitId: number | string;
  eventType: VisitTimelineEventType;
  title: string;
  description?: string;
  occurredAt: Date | string;
  recordedBy?: string;
  metadata?: Record<string, any>;
  syncStatus?: 'SYNCED' | 'LOCAL_PENDING';
}

export interface Visit {
  id?: number | string;
  practiceId?: string;
  callId?: number | string;
  ownerId: number | string;
  ownerName?: string;
  ownerPhone?: string;
  locationId?: number | string;
  address: string;
  latitude?: number;
  longitude?: number;
  status: VisitStatus;
  priority: CallPriority;
  flexibility: VisitFlexibility;
  scheduledDate: Date | string;
  sequenceOrder?: number;
  estimatedDurationMinutes: number;
  actualDurationMinutes?: number;
  callRegisteredAt?: Date | string;
  scheduledAt?: Date | string;
  routeStartedAt?: Date | string;
  arrivedAt?: Date | string;
  arrivalLatitude?: number;
  arrivalLongitude?: number;
  arrivalAccuracy?: number;
  visitStartedAt?: Date | string;
  visitCompletedAt?: Date | string;
  completionNotes?: string;
  postponedReason?: string;
  notes?: string;
  cases?: VisitCase[];
  procedures?: VisitProcedure[];
  medicineUsages?: VisitMedicineUsage[];
  timelineEvents?: VisitTimelineEvent[];
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export interface DailyPlan {
  id?: number | string;
  practiceId?: string;
  planDate: string; // YYYY-MM-DD
  doctorUserId?: string;
  doctorName?: string;
  startLocationAddress?: string;
  startLatitude?: number;
  startLongitude?: number;
  endLocationAddress?: string;
  totalEstimatedKm: number;
  breakMinutes?: number; // default: 45 mins
  bufferMinutes?: number; // default: 30 mins
  startTime?: string; // default: "08:30"
  confirmedAt?: Date | string;
  totalEstimatedTravelMinutes: number;
  totalEstimatedVisitMinutes: number;
  workingMinutesAvailable: number; // default: 480 mins (8 hours)
  isLocked: boolean;
  status: 'DRAFT' | 'CONFIRMED' | 'ACTIVE' | 'COMPLETED';
  stops?: RouteStop[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface RouteStop {
  id?: number | string;
  practiceId?: string;
  dailyPlanId?: number | string;
  visitId: number | string;
  stopOrder: number;
  visit?: Visit;
  estimatedArrival?: Date | string;
  estimatedDeparture?: Date | string;
  isLocked?: boolean;
  transitMinutesFromPrevious?: number;
  distanceKmFromPrevious?: number;
  isApproximateLocation?: boolean;
  suggestedReason?: string;
  durationMinutesOverride?: number;
}

export interface CapacitySummary {
  workingMinutesAvailable: number;
  breakMinutes?: number;
  bufferMinutes?: number;
  allocatedVisitMinutes: number;
  allocatedTravelMinutes: number;
  totalAllocatedMinutes: number;
  remainingMinutes: number;
  isOverCapacity: boolean;
  overCapacityMinutes: number;
  totalCallsCount: number;
  emergencyCount: number;
  urgentCount: number;
  couldNotAssessCount: number;
  plannedCount: number;
}

export interface PostponableCandidate {
  visit: Visit;
  reason: string;
  savedMinutes: number;
  procedureCategory?: string;
}

export interface RouteCalculationResult {
  stops: RouteStop[];
  totalEstimatedKm: number;
  totalEstimatedTravelMinutes: number;
  totalEstimatedVisitMinutes: number;
  workingMinutesAvailable: number;
  breakMinutes: number;
  bufferMinutes: number;
  totalRequiredMinutes: number;
  remainingMinutes: number;
  isOverCapacity: boolean;
  overCapacityMinutes: number;
  hasMissingCoordinates: boolean;
  postponableCandidates: PostponableCandidate[];
}

export interface EmergencyProposal {
  emergencyCall: Call;
  emergencyVisit?: Visit;
  currentStops: RouteStop[];
  proposedStops: RouteStop[];
  insertedAtOrder: number;
  affectedStopsCount: number;
  travelMinutesDelta: number;
  visitMinutesDelta: number;
  newRequiredMinutes: number;
  newOverCapacity: boolean;
  newOverCapacityMinutes: number;
  suggestedPostponements: PostponableCandidate[];
  explanation: string;
}

// ==============================================================================
// Phase 8: Follow-up Management, Recurring Visits & Duration Learning Types
// ==============================================================================

export const FollowUpReason = {
  POST_TREATMENT_REVIEW: 'POST_TREATMENT_REVIEW',
  RECHECK: 'RECHECK',
  VACCINATION: 'VACCINATION',
  DEWORMING: 'DEWORMING',
  PREGNANCY_DIAGNOSIS: 'PREGNANCY_DIAGNOSIS',
  ARTIFICIAL_INSEMINATION: 'ARTIFICIAL_INSEMINATION',
  POST_OPERATIVE_REVIEW: 'POST_OPERATIVE_REVIEW',
  OTHER: 'OTHER',
} as const;
export type FollowUpReason = (typeof FollowUpReason)[keyof typeof FollowUpReason];

export const FollowUpStatus = {
  UPCOMING: 'UPCOMING',
  DUE: 'DUE',
  SCHEDULED: 'SCHEDULED',
  COMPLETED: 'COMPLETED',
  POSTPONED: 'POSTPONED',
  CANCELLED: 'CANCELLED',
  OVERDUE: 'OVERDUE',
} as const;
export type FollowUpStatus = (typeof FollowUpStatus)[keyof typeof FollowUpStatus];

export const RecurrenceFrequency = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  BIWEEKLY: 'BIWEEKLY',
  MONTHLY: 'MONTHLY',
  CUSTOM_INTERVAL: 'CUSTOM_INTERVAL',
} as const;
export type RecurrenceFrequency = (typeof RecurrenceFrequency)[keyof typeof RecurrenceFrequency];

export const DurationEstimateSource = {
  DEFAULT: 'DEFAULT',
  PRACTICE_LEARNED: 'PRACTICE_LEARNED',
  MANUAL_OVERRIDE: 'MANUAL_OVERRIDE',
} as const;
export type DurationEstimateSource = (typeof DurationEstimateSource)[keyof typeof DurationEstimateSource];

export interface FollowUp {
  id?: number | string;
  practiceId?: string;
  ownerId: number | string;
  ownerName?: string;
  ownerPhone?: string;
  patientId?: number | string;
  patientName?: string;
  species?: string;
  animalCount?: number;
  originVisitId?: number | string;
  recurrenceRuleId?: number | string;
  reason: FollowUpReason | string;
  procedureCategory?: string;
  recommendedDate: string; // YYYY-MM-DD
  priority: CallPriority;
  flexibility: VisitFlexibility;
  preferredTimeWindow?: string;
  notes?: string;
  status: FollowUpStatus;
  scheduledVisitId?: number | string;
  scheduledCallId?: number | string;
  reminderSentAt?: Date | string;
  acknowledgedAt?: Date | string;
  acknowledgedBy?: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export interface RecurringSchedule {
  id?: number | string;
  practiceId?: string;
  ownerId: number | string;
  ownerName?: string;
  patientId?: number | string;
  patientName?: string;
  species?: string;
  reason: FollowUpReason | string;
  procedureCategory?: string;
  frequency: RecurrenceFrequency;
  intervalDays?: number; // Used when frequency is CUSTOM_INTERVAL
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  maxOccurrences?: number;
  generatedOccurrencesCount: number;
  priority: CallPriority;
  flexibility: VisitFlexibility;
  preferredTimeWindow?: string;
  notes?: string;
  status: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'COMPLETED';
  createdAt: Date | string;
  updatedAt?: Date | string;
}

export interface ProcedureDurationEstimate {
  id?: number | string;
  practiceId: string;
  procedureCategory: string; // e.g. 'GENERAL', 'SURGICAL', 'AI', 'PREGNANCY_DIAGNOSIS', 'VACCINATION', 'EMERGENCY'
  defaultDurationMinutes: number;
  learnedDurationMinutes?: number;
  manualOverrideMinutes?: number;
  sampleCount: number;
  source: DurationEstimateSource;
  effectiveDurationMinutes: number;
  incrementalPerAnimalMinutes: number; // additional minutes per extra animal
  lastCalculatedAt?: Date | string;
  updatedAt?: Date | string;
}

export interface FollowUpConversionResult {
  followUp: FollowUp;
  createdCall?: Call;
  createdVisit?: Visit;
}

