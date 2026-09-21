// ==============================================================================
// VetRx — Commercial Domain Types & Interfaces (Phase 10 Foundation)
// ==============================================================================

export type SubscriptionStatus =
  | 'TRIAL'
  | 'ACTIVE'
  | 'PAST_DUE'
  | 'GRACE_PERIOD'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'UNRESTRICTED';

export type BillingInterval = 'MONTHLY' | 'THREE_MONTHS' | 'ANNUAL' | 'ONE_TIME';

export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'SUCCESS'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'CANCELLED';

export interface SubscriptionPlanDTO {
  id: string;
  code: string;
  name: string;
  description: string | null;
  interval: BillingInterval;
  intervalCount: number;
  pricePaisa: number;
  currency: string;
  trialPeriodDays: number;
  maxUserSeats: number;
  features: Record<string, unknown>;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SubscriptionDTO {
  id: string;
  practiceId: string;
  planId: string;
  plan?: SubscriptionPlanDTO;
  status: SubscriptionStatus;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelledAt: string | null;
  cancelAtPeriodEnd: boolean;
  gracePeriodEndsAt: string | null;
  gatewayCustomerId: string | null;
  gatewaySubscriptionId: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentDTO {
  id: string;
  practiceId: string;
  subscriptionId: string | null;
  amountPaisa: number;
  currency: string;
  status: PaymentStatus;
  paymentProvider: string;
  internalReference: string;
  gatewayTransactionId: string | null;
  paymentMethod: string | null;
  gatewayResponseRaw?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentEventDTO {
  id: string;
  paymentId: string | null;
  provider: string;
  eventId: string;
  eventType: string;
  payloadHash: string | null;
  rawPayload: Record<string, unknown> | null;
  processingStatus: string;
  errorMessage: string | null;
  receivedAt: string;
  processedAt: string | null;
}

export interface PracticeUsageDTO {
  patientsCount: number;
  maxPatients: number | null;
  packagesCount: number;
  maxPackages: number | null;
  customMedicinesCount: number;
  maxCustomMedicines: number | null;
  veterinarianSeatsCount: number;
  maxVeterinarianSeats: number;
  staffSeatsCount: number;
  maxStaffSeats: number | null;
  maxRecordsPerPatient: number | null;
}

export interface CommercialLimitsDTO {
  maxPatients: number | null;
  maxRecordsPerPatient: number | null;
  maxPackages: number | null;
  maxCustomMedicines: number | null;
  maxVeterinarianSeats: number;
  maxStaffSeats: number | null;
}

export interface PracticeEntitlementsDTO {
  practiceId: string;
  status: SubscriptionStatus;
  planCode: string;
  planName: string;
  features: {
    canCreatePatients: boolean;
    canCreatePrescriptions: boolean;
    canUseSmartDose: boolean;
    canUseTreatmentPackages: boolean;
    canCreateInvoices: boolean;
    canGeneratePdf: boolean;
    canExportData: boolean;
    maxUserSeats: number;
  };
  quotas: {
    activeSeatsCount: number;
    maxSeatsAllowed: number;
  };
  limits: CommercialLimitsDTO;
  usage?: PracticeUsageDTO;
  isReadOnly: boolean;
  expiresAt: string | null;
  gracePeriodEndsAt: string | null;
}

export interface CommercialAccountStatusDTO {
  practiceId: string;
  status: SubscriptionStatus;
  activePlan: {
    code: string;
    name: string;
    billingInterval: BillingInterval;
  };
  isPastDue: boolean;
  isInGracePeriod: boolean;
  isExpired: boolean;
  isTrial: boolean;
  trialStartsAt: string | null;
  trialEndsAt: string | null;
  daysRemainingInPeriod: number | null;
  periodEnd: string | null;
  paymentMethodStatus: 'REQUIRED' | 'PENDING' | 'CONFIGURED';
  cancelAtPeriodEnd: boolean;
  usage?: PracticeUsageDTO;
}

export interface InitiatePaymentRequestDTO {
  planCode: string;
  billingInterval?: BillingInterval;
}

export interface InitiatePaymentResponseDTO {
  payment: PaymentDTO;
  checkoutUrl: string;
  formParameters: Record<string, string>;
}

export interface PaymentVerificationResponseDTO {
  isVerified: boolean;
  status: PaymentStatus;
  payment: PaymentDTO;
  subscription?: SubscriptionDTO | null;
  message: string;
}
