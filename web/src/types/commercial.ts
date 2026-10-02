// ==============================================================================
// VetRx — Commercial Client Types (Phase 10 Foundation)
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

export interface CommercialAccountStatus {
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
  daysRemainingInPeriod: number | null;
  periodEnd: string | null;
}

export interface PracticeEntitlements {
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
  isReadOnly: boolean;
  expiresAt: string | null;
  gracePeriodEndsAt: string | null;
}

export interface CommercialSubscription {
  id: string;
  practiceId: string;
  planId: string;
  plan?: {
    id: string;
    code: string;
    name: string;
    pricePaisa: number;
    currency: string;
    interval: BillingInterval;
    maxUserSeats: number;
  };
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  gracePeriodEndsAt: string | null;
}

export interface CommercialPayment {
  id: string;
  practiceId: string;
  amountPaisa: number;
  currency: string;
  status: PaymentStatus;
  paymentProvider: string;
  internalReference: string;
  gatewayTransactionId: string | null;
  paymentMethod: string | null;
  createdAt: string;
}
