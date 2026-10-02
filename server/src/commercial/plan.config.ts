// ==============================================================================
// VetRx — Authoritative Commercial Plan Configuration (Phase 12)
// Strictly enforces integer paise INR monetary values. Floating point is forbidden.
// Authoritative prices:
// Individual: ₹599/mo (59900 paise), ₹5,999/yr (599900 paise) — Save ₹1,189/yr (16.6%)
// Clinic: ₹1,499/mo (149900 paise), ₹14,999/yr (1499900 paise) — Save ₹2,989/yr (16.6%)
// Enterprise: Custom
// Trial: 14 days, max 10 patients, max 5 records/patient, max 5 packages, max 10 medicines
// ==============================================================================

import type { BillingInterval } from './commercial.types.js';

export interface AuthoritativePlanConfig {
  code: string;
  name: string;
  description: string;
  interval: BillingInterval;
  intervalCount: number;
  pricePaisa: number;
  annualSavingsPaisa: number;
  savingsPercentage: number;
  currency: 'INR';
  trialPeriodDays: number;
  maxVeterinarianSeats: number; // Max doctors/veterinarians allowed
  maxStaffSeats: number | null; // null = unlimited administrative/staff seats
  maxPatients: number | null; // null = unlimited patients
  maxRecordsPerPatient: number | null; // null = unlimited records
  maxPackages: number | null; // null = unlimited treatment packages
  maxCustomMedicines: number | null; // null = unlimited custom formulary medicines
  features: {
    canCreatePatients: boolean;
    canCreatePrescriptions: boolean;
    canUseSmartDose: boolean;
    canUseTreatmentPackages: boolean;
    canCreateInvoices: boolean;
    canGeneratePdf: boolean;
    canExportData: boolean;
    multiUserCollaboration: boolean;
  };
  isActive: boolean;
  sortOrder: number;
}

export const TRIAL_LIMITS = {
  DURATION_DAYS: 14,
  MAX_PATIENTS: 10,
  MAX_RECORDS_PER_PATIENT: 5,
  MAX_PACKAGES: 5,
  MAX_CUSTOM_MEDICINES: 10,
  MAX_VETERINARIAN_SEATS: 1,
} as const;

export const AUTHORITATIVE_PLANS: Record<string, AuthoritativePlanConfig> = {
  TRIAL: {
    code: 'TRIAL',
    name: '14-Day Free Trial',
    description: 'Full-featured 14-day evaluation with introductory practice limits.',
    interval: 'MONTHLY',
    intervalCount: 1,
    pricePaisa: 0,
    annualSavingsPaisa: 0,
    savingsPercentage: 0,
    currency: 'INR',
    trialPeriodDays: 14,
    maxVeterinarianSeats: 1,
    maxStaffSeats: null, // Unlimited staff
    maxPatients: 10,
    maxRecordsPerPatient: 5,
    maxPackages: 5,
    maxCustomMedicines: 10,
    features: {
      canCreatePatients: true,
      canCreatePrescriptions: true,
      canUseSmartDose: true,
      canUseTreatmentPackages: true,
      canCreateInvoices: true,
      canGeneratePdf: true,
      canExportData: true,
      multiUserCollaboration: false,
    },
    isActive: true,
    sortOrder: 0,
  },
  INDIVIDUAL_MONTHLY: {
    code: 'INDIVIDUAL_MONTHLY',
    name: 'Individual (Monthly)',
    description: 'Designed for a single veterinarian private practice with unlimited patients.',
    interval: 'MONTHLY',
    intervalCount: 1,
    pricePaisa: 59900, // ₹599.00
    annualSavingsPaisa: 0,
    savingsPercentage: 0,
    currency: 'INR',
    trialPeriodDays: 0,
    maxVeterinarianSeats: 1,
    maxStaffSeats: null, // Unlimited staff
    maxPatients: null, // Unlimited
    maxRecordsPerPatient: null, // Unlimited
    maxPackages: null, // Unlimited
    maxCustomMedicines: null, // Unlimited
    features: {
      canCreatePatients: true,
      canCreatePrescriptions: true,
      canUseSmartDose: true,
      canUseTreatmentPackages: true,
      canCreateInvoices: true,
      canGeneratePdf: true,
      canExportData: true,
      multiUserCollaboration: false,
    },
    isActive: true,
    sortOrder: 1,
  },
  INDIVIDUAL_ANNUAL: {
    code: 'INDIVIDUAL_ANNUAL',
    name: 'Individual (Annual)',
    description: 'Single veterinarian private practice. Save ₹1,189/year with annual billing.',
    interval: 'ANNUAL',
    intervalCount: 1,
    pricePaisa: 599900, // ₹5,999.00 (₹599 x 12 = ₹7,188; Savings: ₹1,189 ~16.6%)
    annualSavingsPaisa: 118900, // ₹1,189.00
    savingsPercentage: 16.6,
    currency: 'INR',
    trialPeriodDays: 0,
    maxVeterinarianSeats: 1,
    maxStaffSeats: null, // Unlimited staff
    maxPatients: null, // Unlimited
    maxRecordsPerPatient: null, // Unlimited
    maxPackages: null, // Unlimited
    maxCustomMedicines: null, // Unlimited
    features: {
      canCreatePatients: true,
      canCreatePrescriptions: true,
      canUseSmartDose: true,
      canUseTreatmentPackages: true,
      canCreateInvoices: true,
      canGeneratePdf: true,
      canExportData: true,
      multiUserCollaboration: false,
    },
    isActive: true,
    sortOrder: 2,
  },
  CLINIC_MONTHLY: {
    code: 'CLINIC_MONTHLY',
    name: 'Clinic (Monthly)',
    description: 'Multi-doctor clinic supporting up to 5 veterinarians and unlimited staff.',
    interval: 'MONTHLY',
    intervalCount: 1,
    pricePaisa: 149900, // ₹1,499.00
    annualSavingsPaisa: 0,
    savingsPercentage: 0,
    currency: 'INR',
    trialPeriodDays: 0,
    maxVeterinarianSeats: 5,
    maxStaffSeats: null, // Unlimited staff
    maxPatients: null, // Unlimited
    maxRecordsPerPatient: null, // Unlimited
    maxPackages: null, // Unlimited
    maxCustomMedicines: null, // Unlimited
    features: {
      canCreatePatients: true,
      canCreatePrescriptions: true,
      canUseSmartDose: true,
      canUseTreatmentPackages: true,
      canCreateInvoices: true,
      canGeneratePdf: true,
      canExportData: true,
      multiUserCollaboration: true,
    },
    isActive: true,
    sortOrder: 3,
  },
  CLINIC_ANNUAL: {
    code: 'CLINIC_ANNUAL',
    name: 'Clinic (Annual)',
    description: 'Multi-doctor clinic for up to 5 veterinarians. Save ₹2,989/year with annual billing.',
    interval: 'ANNUAL',
    intervalCount: 1,
    pricePaisa: 1499900, // ₹14,999.00 (₹1,499 x 12 = ₹17,988; Savings: ₹2,989 ~16.6%)
    annualSavingsPaisa: 298900, // ₹2,989.00
    savingsPercentage: 16.6,
    currency: 'INR',
    trialPeriodDays: 0,
    maxVeterinarianSeats: 5,
    maxStaffSeats: null, // Unlimited staff
    maxPatients: null, // Unlimited
    maxRecordsPerPatient: null, // Unlimited
    maxPackages: null, // Unlimited
    maxCustomMedicines: null, // Unlimited
    features: {
      canCreatePatients: true,
      canCreatePrescriptions: true,
      canUseSmartDose: true,
      canUseTreatmentPackages: true,
      canCreateInvoices: true,
      canGeneratePdf: true,
      canExportData: true,
      multiUserCollaboration: true,
    },
    isActive: true,
    sortOrder: 4,
  },
  ENTERPRISE: {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Custom solutions for veterinary hospitals, multi-location networks, and specialty centers.',
    interval: 'ANNUAL',
    intervalCount: 1,
    pricePaisa: 0, // Custom pricing
    annualSavingsPaisa: 0,
    savingsPercentage: 0,
    currency: 'INR',
    trialPeriodDays: 0,
    maxVeterinarianSeats: 999, // Custom
    maxStaffSeats: null,
    maxPatients: null,
    maxRecordsPerPatient: null,
    maxPackages: null,
    maxCustomMedicines: null,
    features: {
      canCreatePatients: true,
      canCreatePrescriptions: true,
      canUseSmartDose: true,
      canUseTreatmentPackages: true,
      canCreateInvoices: true,
      canGeneratePdf: true,
      canExportData: true,
      multiUserCollaboration: true,
    },
    isActive: true,
    sortOrder: 5,
  },
};

/**
 * Validates that an amount is a strict non-negative integer representing paise.
 */
export function validatePaise(paise: unknown): number {
  if (typeof paise !== 'number' || !Number.isInteger(paise) || paise < 0) {
    throw new Error(`Invalid monetary unit: ${String(paise)}. VetRx requires strict integer paise.`);
  }
  return paise;
}

/**
 * Returns formatted Indian Rupees display string (e.g. 59900 -> "₹599" or "₹5,999")
 */
export function formatPaiseToRupees(paise: number): string {
  const rupees = Math.floor(paise / 100);
  return '₹' + rupees.toLocaleString('en-IN');
}
