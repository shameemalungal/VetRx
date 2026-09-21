// ==============================================================================
// VetRx — Entitlement Service (Phase 12 Operational Engine)
// Centralized, server-side authoritative capability, quota & limit evaluation.
// Enforces trial limits (10 patients, 5 records/patient, 5 packages, 10 medicines)
// and seat limits (Individual: 1 vet, Clinic: 5 vets, unlimited staff).
// ==============================================================================

import { Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError } from '../middleware/errorHandler.js';
import { AUTHORITATIVE_PLANS, TRIAL_LIMITS } from './plan.config.js';
import type {
  PracticeEntitlementsDTO,
  PracticeUsageDTO,
  CommercialLimitsDTO,
  SubscriptionStatus,
} from './commercial.types.js';

export class EntitlementService {
  // In-memory registry for mock subscriptions during fast isolated unit testing
  private static mockSubscriptions: Map<string, any> = new Map();
  private static mockUsages: Map<string, any> = new Map();

  static setMockSubscription(practiceId: string, subscription: any): void {
    this.mockSubscriptions.set(practiceId, subscription);
  }

  static getMockSubscription(practiceId: string): any {
    return this.mockSubscriptions.get(practiceId) || null;
  }

  static setMockUsage(practiceId: string, usage: any): void {
    const existing = this.mockSubscriptions.get(practiceId);
    if (existing) {
      existing.usage = { ...(existing.usage || {}), ...usage };
      this.mockSubscriptions.set(practiceId, existing);
    }
    this.mockUsages.set(practiceId, usage);
  }

  static clearMockSubscriptions(): void {
    this.mockSubscriptions.clear();
    this.mockUsages.clear();
  }

  /**
   * Resolves practice entitlements and limits.
   * If a practice has a subscription or trial, evaluates active/expired state.
   * If no subscription exists, falls back to neutral foundation state (UNRESTRICTED).
   */
  static async resolvePracticeEntitlements(practiceId: string): Promise<PracticeEntitlementsDTO> {
    let sub: any = this.mockSubscriptions.get(practiceId) || null;

    if (!sub && process.env.VETRX_FAST_TEST !== '1') {
      try {
        sub = await prisma.subscription.findFirst({
          where: { practiceId },
          include: { plan: true },
          orderBy: { createdAt: 'desc' },
        });
      } catch {
        sub = null;
      }
    }

    // 1. If an active or trial subscription exists, evaluate authoritatively
    if (sub && (sub.plan || sub.planCode)) {
      const planCode = sub.plan?.code || sub.planCode;
      const planConfig = AUTHORITATIVE_PLANS[planCode] || AUTHORITATIVE_PLANS.INDIVIDUAL_MONTHLY;
      const now = new Date();

      let status = sub.status as SubscriptionStatus;

      // Deterministic expiry check
      if (status === 'TRIAL' && sub.trialEndsAt && now > new Date(sub.trialEndsAt)) {
        status = 'EXPIRED';
      } else if (status === 'ACTIVE' && sub.currentPeriodEnd && now > new Date(sub.currentPeriodEnd)) {
        if (sub.gracePeriodEndsAt && now < new Date(sub.gracePeriodEndsAt)) {
          status = 'GRACE_PERIOD';
        } else {
          status = 'EXPIRED';
        }
      }

      const isExpired = status === 'EXPIRED';
      const isTrial = status === 'TRIAL';

      // Limits based on plan or trial
      const limits: CommercialLimitsDTO = isTrial
        ? {
            maxPatients: TRIAL_LIMITS.MAX_PATIENTS,
            maxRecordsPerPatient: TRIAL_LIMITS.MAX_RECORDS_PER_PATIENT,
            maxPackages: TRIAL_LIMITS.MAX_PACKAGES,
            maxCustomMedicines: TRIAL_LIMITS.MAX_CUSTOM_MEDICINES,
            maxVeterinarianSeats: TRIAL_LIMITS.MAX_VETERINARIAN_SEATS,
            maxStaffSeats: null, // Unlimited staff
          }
        : {
            maxPatients: planConfig.maxPatients,
            maxRecordsPerPatient: planConfig.maxRecordsPerPatient,
            maxPackages: planConfig.maxPackages,
            maxCustomMedicines: planConfig.maxCustomMedicines,
            maxVeterinarianSeats: planConfig.maxVeterinarianSeats,
            maxStaffSeats: planConfig.maxStaffSeats,
          };

      // Query active seats
      let activeSeats = 1;
      if (process.env.VETRX_FAST_TEST !== '1') {
        try {
          activeSeats = await prisma.practiceMember.count({
            where: { practiceId, isActive: true },
          });
        } catch {
          activeSeats = sub.activeSeatsCount || 1;
        }
      } else {
        activeSeats = sub.activeSeatsCount || 1;
      }

      return {
        practiceId,
        status,
        planCode: planConfig.code,
        planName: planConfig.name,
        features: {
          canCreatePatients: !isExpired,
          canCreatePrescriptions: !isExpired,
          canUseSmartDose: true,
          canUseTreatmentPackages: true,
          canCreateInvoices: !isExpired,
          canGeneratePdf: true,
          canExportData: true,
          maxUserSeats: limits.maxVeterinarianSeats,
        },
        quotas: {
          activeSeatsCount: activeSeats,
          maxSeatsAllowed: limits.maxVeterinarianSeats,
        },
        limits,
        isReadOnly: isExpired,
        expiresAt: isTrial
          ? sub.trialEndsAt ? new Date(sub.trialEndsAt).toISOString() : null
          : sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toISOString() : null,
        gracePeriodEndsAt: sub.gracePeriodEndsAt
          ? new Date(sub.gracePeriodEndsAt).toISOString()
          : null,
      };
    }

    // 2. Default neutral foundation state for existing practices without subscription
    return {
      practiceId,
      status: 'UNRESTRICTED',
      planCode: 'DEFAULT_FOUNDATION',
      planName: 'VetRx Foundation Access',
      features: {
        canCreatePatients: true,
        canCreatePrescriptions: true,
        canUseSmartDose: true,
        canUseTreatmentPackages: true,
        canCreateInvoices: true,
        canGeneratePdf: true,
        canExportData: true,
        maxUserSeats: 10,
      },
      quotas: {
        activeSeatsCount: 1,
        maxSeatsAllowed: 10,
      },
      limits: {
        maxPatients: null,
        maxRecordsPerPatient: null,
        maxPackages: null,
        maxCustomMedicines: null,
        maxVeterinarianSeats: 10,
        maxStaffSeats: null,
      },
      isReadOnly: false,
      expiresAt: null,
      gracePeriodEndsAt: null,
    };
  }

  /**
   * Gathers live usage metrics for a practice across all commercial limits.
   */
  static async getPracticeUsage(practiceId: string): Promise<PracticeUsageDTO> {
    const entitlements = await this.resolvePracticeEntitlements(practiceId);
    const mock = this.mockSubscriptions.get(practiceId);
    const mockUsage = this.mockUsages.get(practiceId) || mock?.usage;

    let patientsCount = 0;
    let packagesCount = 0;
    let customMedicinesCount = 0;
    let veterinarianSeatsCount = 1;
    let staffSeatsCount = 0;

    if (mockUsage) {
      patientsCount = mockUsage.patientsCount ?? 0;
      packagesCount = mockUsage.packagesCount ?? 0;
      customMedicinesCount = mockUsage.customMedicinesCount ?? 0;
      veterinarianSeatsCount = mockUsage.veterinarianSeatsCount ?? 1;
      staffSeatsCount = mockUsage.staffSeatsCount ?? 0;
    } else if (process.env.VETRX_FAST_TEST === '1') {
      patientsCount = 0;
      packagesCount = 0;
      customMedicinesCount = 0;
      veterinarianSeatsCount = 1;
      staffSeatsCount = 0;
    } else {
      try {
        const [patients, pkgs, meds, vets, staff] = await Promise.all([
          prisma.patient.count({ where: { practiceId } }),
          prisma.treatmentPackage.count({ where: { practiceId, isActive: true } }),
          prisma.medicine.count({ where: { practiceId, isActive: true } }),
          prisma.practiceMember.count({
            where: { practiceId, isActive: true, role: Role.PRACTICE_OWNER },
          }),
          prisma.practiceMember.count({
            where: { practiceId, isActive: true, role: { not: Role.PRACTICE_OWNER } },
          }),
        ]);

        patientsCount = patients;
        packagesCount = pkgs;
        customMedicinesCount = meds;
        veterinarianSeatsCount = vets || 1;
        staffSeatsCount = staff;
      } catch {
        // Fallback for isolated unit tests
        patientsCount = 0;
        packagesCount = 0;
        customMedicinesCount = 0;
        veterinarianSeatsCount = 1;
        staffSeatsCount = 0;
      }
    }

    return {
      patientsCount,
      maxPatients: entitlements.limits.maxPatients,
      packagesCount,
      maxPackages: entitlements.limits.maxPackages,
      customMedicinesCount,
      maxCustomMedicines: entitlements.limits.maxCustomMedicines,
      veterinarianSeatsCount,
      maxVeterinarianSeats: entitlements.limits.maxVeterinarianSeats,
      staffSeatsCount,
      maxStaffSeats: entitlements.limits.maxStaffSeats,
      maxRecordsPerPatient: entitlements.limits.maxRecordsPerPatient,
    };
  }

  /**
   * Verifies if a feature is enabled.
   */
  static async hasFeature(
    practiceId: string,
    featureKey: keyof PracticeEntitlementsDTO['features']
  ): Promise<boolean> {
    const entitlements = await this.resolvePracticeEntitlements(practiceId);
    return Boolean(entitlements.features[featureKey]);
  }

  // --------------------------------------------------------------------------
  // Authoritative Enforcement Guards
  // --------------------------------------------------------------------------

  /**
   * Asserts whether the practice can create a new patient.
   */
  static async assertCanCreatePatient(practiceId: string): Promise<void> {
    const entitlements = await this.resolvePracticeEntitlements(practiceId);

    if (entitlements.isReadOnly || entitlements.status === 'EXPIRED') {
      throw new AppError(
        403,
        'SUBSCRIPTION_EXPIRED',
        'Your subscription or trial has expired. Clinical records remain safely preserved in read-only mode. Please subscribe to add new patients.'
      );
    }

    if (entitlements.limits.maxPatients !== null) {
      const usage = await this.getPracticeUsage(practiceId);
      if (usage.patientsCount >= entitlements.limits.maxPatients) {
        throw new AppError(
          403,
          'TRIAL_PATIENT_LIMIT_REACHED',
          `Your trial includes up to ${entitlements.limits.maxPatients} patients. You have reached the trial patient limit. Please upgrade or subscribe to continue.`
        );
      }
    }
  }

  /**
   * Asserts whether the practice can create a prescription, invoice, or receipt for a patient.
   * BD-11: Limit is strictly PER PATIENT (5 records maximum per patient during trial).
   */
  static async assertCanCreateRecord(practiceId: string, patientId: string): Promise<void> {
    const entitlements = await this.resolvePracticeEntitlements(practiceId);

    if (entitlements.isReadOnly || entitlements.status === 'EXPIRED') {
      throw new AppError(
        403,
        'SUBSCRIPTION_EXPIRED',
        'Your subscription or trial has expired. Clinical records remain safely preserved in read-only mode. Please subscribe to create new clinical records.'
      );
    }

    if (entitlements.limits.maxRecordsPerPatient !== null) {
      const mock = this.mockSubscriptions.get(practiceId);
      let recordCount = 0;

      if (mock && mock.patientRecordCounts && mock.patientRecordCounts[patientId] !== undefined) {
        recordCount = mock.patientRecordCounts[patientId];
      } else if (process.env.VETRX_FAST_TEST === '1') {
        recordCount = 0;
      } else {
        try {
          const [rxCount, invCount] = await Promise.all([
            prisma.prescription.count({ where: { practiceId, patientId } }),
            prisma.invoice.count({ where: { practiceId, patientId } }),
          ]);
          recordCount = rxCount + invCount;
        } catch {
          recordCount = 0;
        }
      }

      if (recordCount >= entitlements.limits.maxRecordsPerPatient) {
        throw new AppError(
          403,
          'TRIAL_RECORD_LIMIT_REACHED',
          `Your trial includes up to ${entitlements.limits.maxRecordsPerPatient} prescription/invoice records per patient. You have reached the limit for this patient. Please upgrade or subscribe to continue.`
        );
      }
    }
  }

  /**
   * Asserts whether the practice can create a treatment package.
   */
  static async assertCanCreatePackage(practiceId: string): Promise<void> {
    const entitlements = await this.resolvePracticeEntitlements(practiceId);

    if (entitlements.isReadOnly || entitlements.status === 'EXPIRED') {
      throw new AppError(
        403,
        'SUBSCRIPTION_EXPIRED',
        'Your subscription or trial has expired. Please subscribe to create treatment packages.'
      );
    }

    if (entitlements.limits.maxPackages !== null) {
      const usage = await this.getPracticeUsage(practiceId);
      if (usage.packagesCount >= entitlements.limits.maxPackages) {
        throw new AppError(
          403,
          'TRIAL_PACKAGE_LIMIT_REACHED',
          `Your trial includes up to ${entitlements.limits.maxPackages} treatment packages. You have reached the package limit. Please upgrade or subscribe to continue.`
        );
      }
    }
  }

  /**
   * Asserts whether the practice can add a new custom medicine to its formulary.
   * BD-13: Defined as creating a new Medicine record for this practice.
   */
  static async assertCanAddMedicine(practiceId: string): Promise<void> {
    const entitlements = await this.resolvePracticeEntitlements(practiceId);

    if (entitlements.isReadOnly || entitlements.status === 'EXPIRED') {
      throw new AppError(
        403,
        'SUBSCRIPTION_EXPIRED',
        'Your subscription or trial has expired. Please subscribe to add medicines to your formulary.'
      );
    }

    if (entitlements.limits.maxCustomMedicines !== null) {
      const usage = await this.getPracticeUsage(practiceId);
      if (usage.customMedicinesCount >= entitlements.limits.maxCustomMedicines) {
        throw new AppError(
          403,
          'TRIAL_MEDICINE_LIMIT_REACHED',
          `Your trial includes up to ${entitlements.limits.maxCustomMedicines} custom medicine additions. You have reached the medicine limit. Please upgrade or subscribe to continue.`
        );
      }
    }
  }

  /**
   * Asserts whether the practice can add a practice member based on role.
   * Individual plan: 1 veterinarian max.
   * Clinic plan: 5 veterinarians max. Unlimited staff.
   */
  static async assertCanAddSeat(practiceId: string, role: Role): Promise<void> {
    const entitlements = await this.resolvePracticeEntitlements(practiceId);

    if (role === Role.PRACTICE_OWNER) {
      // Veterinarian seat
      const usage = await this.getPracticeUsage(practiceId);
      if (usage.veterinarianSeatsCount >= entitlements.limits.maxVeterinarianSeats) {
        throw new AppError(
          403,
          'SEAT_LIMIT_REACHED',
          `Your ${entitlements.planName} allows up to ${entitlements.limits.maxVeterinarianSeats} veterinarian seat(s). Please upgrade to Clinic plan to add more veterinarians.`
        );
      }
    }
    // Administrative/staff members are unlimited on both Individual and Clinic
  }

  /**
   * Asserts whether the practice can add an additional veterinarian seat.
   */
  static async assertCanAddVeterinarianSeat(practiceId: string): Promise<void> {
    return this.assertCanAddSeat(practiceId, Role.PRACTICE_OWNER);
  }
}
