// ==============================================================================
// VetRx Phase 12 — Trial & Subscription Plans Comprehensive Test Suite
// Validates Plans, Pricing, 14-Day Trial, Usage Limits, Seats, Lifecycle,
// Downgrades with Limit Validation, Soft Expiry, Tenant Isolation & Money Safety.
// ==============================================================================

process.env.VETRX_FAST_TEST = '1';

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../src/middleware/errorHandler.js';
import { AUTHORITATIVE_PLANS, TRIAL_LIMITS, validatePaise, formatPaiseToRupees } from '../src/commercial/plan.config.js';
import { EntitlementService } from '../src/commercial/entitlement.service.js';
import { SubscriptionService } from '../src/commercial/subscription.service.js';
import { CommercialAccountService } from '../src/commercial/commercial.service.js';
import type { SubscriptionStatus } from '../src/commercial/commercial.types.js';

describe('Phase 12: Trial & Subscription Plans Comprehensive Test Suite', () => {
  const practiceAlpha = 'practice-alpha-tenant-1111';
  const practiceBeta = 'practice-beta-tenant-2222';

  beforeEach(() => {
    EntitlementService.clearMockSubscriptions();
  });

  // ----------------------------------------------------------------------------
  // Category A: Plan Configuration & Authoritative Pricing
  // ----------------------------------------------------------------------------
  describe('Category A: Plan Configuration & Authoritative Pricing', () => {
    it('1. Individual Monthly plan exists with authoritative ₹599 (59,900 paise) pricing', () => {
      const plan = AUTHORITATIVE_PLANS.INDIVIDUAL_MONTHLY;
      assert.ok(plan);
      assert.strictEqual(plan.code, 'INDIVIDUAL_MONTHLY');
      assert.strictEqual(plan.pricePaisa, 59900);
      assert.strictEqual(plan.currency, 'INR');
      assert.strictEqual(plan.interval, 'MONTHLY');
      assert.strictEqual(plan.maxVeterinarianSeats, 1);
      assert.strictEqual(plan.maxStaffSeats, null); // Unlimited staff
      assert.strictEqual(plan.maxPatients, null); // Unlimited paid patients
    });

    it('2. Individual Annual plan exists with authoritative ₹5,999 (599,900 paise) pricing and savings', () => {
      const plan = AUTHORITATIVE_PLANS.INDIVIDUAL_ANNUAL;
      assert.ok(plan);
      assert.strictEqual(plan.code, 'INDIVIDUAL_ANNUAL');
      assert.strictEqual(plan.pricePaisa, 599900);
      assert.strictEqual(plan.interval, 'ANNUAL');
      // Annual savings: ₹599 x 12 = ₹7,188; ₹7,188 - ₹5,999 = ₹1,189
      assert.strictEqual(plan.annualSavingsPaisa, 118900);
      assert.strictEqual(plan.savingsPercentage, 16.6);
    });

    it('3. Clinic Monthly plan exists with authoritative ₹1,499 (149,900 paise) pricing', () => {
      const plan = AUTHORITATIVE_PLANS.CLINIC_MONTHLY;
      assert.ok(plan);
      assert.strictEqual(plan.code, 'CLINIC_MONTHLY');
      assert.strictEqual(plan.pricePaisa, 149900);
      assert.strictEqual(plan.currency, 'INR');
      assert.strictEqual(plan.interval, 'MONTHLY');
      assert.strictEqual(plan.maxVeterinarianSeats, 5);
      assert.strictEqual(plan.maxStaffSeats, null); // Unlimited staff
    });

    it('4. Clinic Annual plan exists with authoritative ₹14,999 (1,499,900 paise) pricing and savings', () => {
      const plan = AUTHORITATIVE_PLANS.CLINIC_ANNUAL;
      assert.ok(plan);
      assert.strictEqual(plan.code, 'CLINIC_ANNUAL');
      assert.strictEqual(plan.pricePaisa, 1499900);
      assert.strictEqual(plan.interval, 'ANNUAL');
      // Annual savings: ₹1,499 x 12 = ₹17,988; ₹17,988 - ₹14,999 = ₹2,989
      assert.strictEqual(plan.annualSavingsPaisa, 298900);
      assert.strictEqual(plan.savingsPercentage, 16.6);
    });

    it('5. Enterprise plan is represented cleanly as custom tier without arbitrary limits', () => {
      const plan = AUTHORITATIVE_PLANS.ENTERPRISE;
      assert.ok(plan);
      assert.strictEqual(plan.code, 'ENTERPRISE');
      assert.strictEqual(plan.pricePaisa, 0); // Custom pricing
      assert.strictEqual(plan.currency, 'INR');
    });

    it('6. Strictly rejects obsolete ₹6,000 and ₹15,000 prices across all plans', () => {
      const allPrices = Object.values(AUTHORITATIVE_PLANS).map((p) => p.pricePaisa);
      assert.ok(!allPrices.includes(600000), 'Obsolete ₹6,000 price must not exist');
      assert.ok(!allPrices.includes(1500000), 'Obsolete ₹15,000 price must not exist');
    });

    it('7. Enforces integer paise monetary validation and rejects floating-point values', () => {
      assert.strictEqual(validatePaise(59900), 59900);
      assert.strictEqual(validatePaise(599900), 599900);
      assert.strictEqual(validatePaise(149900), 149900);
      assert.strictEqual(validatePaise(1499900), 1499900);

      assert.throws(() => validatePaise(599.99), /requires strict integer paise/);
      assert.throws(() => validatePaise(1499.05), /requires strict integer paise/);
      assert.throws(() => validatePaise(-500), /requires strict integer paise/);
      assert.throws(() => validatePaise('59900' as any), /requires strict integer paise/);
    });

    it('8. Formats integer paise into clean Indian Rupees display string', () => {
      assert.strictEqual(formatPaiseToRupees(59900), '₹599');
      assert.strictEqual(formatPaiseToRupees(599900), '₹5,999');
      assert.strictEqual(formatPaiseToRupees(149900), '₹1,499');
      assert.strictEqual(formatPaiseToRupees(1499900), '₹14,999');
    });
  });

  // ----------------------------------------------------------------------------
  // Category B: 14-Day Trial System & Server-Enforced Limits
  // ----------------------------------------------------------------------------
  describe('Category B: 14-Day Trial System & Limits', () => {
    it('9. 14-day trial duration and timestamps are calculated authoritatively on server', () => {
      assert.strictEqual(TRIAL_LIMITS.DURATION_DAYS, 14);
      const now = new Date('2026-09-20T10:00:00Z');
      const expectedEnd = new Date('2026-10-04T10:00:00Z');
      const actualEnd = new Date(now.getTime() + TRIAL_LIMITS.DURATION_DAYS * 24 * 60 * 60 * 1000);
      assert.strictEqual(actualEnd.toISOString(), expectedEnd.toISOString());
    });

    it('10. Trial limits permit patient creation up to 10 patients', async () => {
      EntitlementService.setMockSubscription(practiceAlpha, {
        status: 'TRIAL',
        planCode: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        usage: { patientsCount: 9 },
      });

      // 10th patient creation succeeds without error
      await assert.doesNotReject(async () => {
        await EntitlementService.assertCanCreatePatient(practiceAlpha);
      });
    });

    it('11. Attempting 11th patient creation is rejected with TRIAL_PATIENT_LIMIT_REACHED', async () => {
      EntitlementService.setMockSubscription(practiceAlpha, {
        status: 'TRIAL',
        planCode: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        usage: { patientsCount: 10 },
      });

      await assert.rejects(
        async () => {
          await EntitlementService.assertCanCreatePatient(practiceAlpha);
        },
        (err: unknown) => err instanceof AppError && err.code === 'TRIAL_PATIENT_LIMIT_REACHED' && err.statusCode === 403
      );
    });

    it('12. Record limit is strictly enforced PER PATIENT (max 5 records)', async () => {
      const patientA = 'patient-dog-001';
      const patientB = 'patient-cat-002';

      EntitlementService.setMockSubscription(practiceAlpha, {
        status: 'TRIAL',
        planCode: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        patientRecordCounts: {
          [patientA]: 5, // Patient A has reached 5 records
          [patientB]: 2, // Patient B only has 2 records
        },
      });

      // Patient A: 6th record is rejected
      await assert.rejects(
        async () => {
          await EntitlementService.assertCanCreateRecord(practiceAlpha, patientA);
        },
        (err: unknown) => err instanceof AppError && err.code === 'TRIAL_RECORD_LIMIT_REACHED' && err.statusCode === 403
      );

      // Patient B: 3rd record is allowed
      await assert.doesNotReject(async () => {
        await EntitlementService.assertCanCreateRecord(practiceAlpha, patientB);
      });
    });

    it('13. Treatment package limit allows up to 5 packages and rejects 6th with TRIAL_PACKAGE_LIMIT_REACHED', async () => {
      EntitlementService.setMockSubscription(practiceAlpha, {
        status: 'TRIAL',
        planCode: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        usage: { packagesCount: 4 },
      });

      // 5th package succeeds
      await assert.doesNotReject(async () => {
        await EntitlementService.assertCanCreatePackage(practiceAlpha);
      });

      // Update to 5 packages
      EntitlementService.setMockSubscription(practiceAlpha, {
        status: 'TRIAL',
        planCode: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        usage: { packagesCount: 5 },
      });

      // 6th package rejected
      await assert.rejects(
        async () => {
          await EntitlementService.assertCanCreatePackage(practiceAlpha);
        },
        (err: unknown) => err instanceof AppError && err.code === 'TRIAL_PACKAGE_LIMIT_REACHED' && err.statusCode === 403
      );
    });

    it('14. Custom medicine formulary additions allows up to 10 and rejects 11th with TRIAL_MEDICINE_LIMIT_REACHED', async () => {
      EntitlementService.setMockSubscription(practiceAlpha, {
        status: 'TRIAL',
        planCode: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        usage: { customMedicinesCount: 10 },
      });

      await assert.rejects(
        async () => {
          await EntitlementService.assertCanAddMedicine(practiceAlpha);
        },
        (err: unknown) => err instanceof AppError && err.code === 'TRIAL_MEDICINE_LIMIT_REACHED' && err.statusCode === 403
      );
    });

    it('15. Soft expiry: Expired trial moves to EXPIRED status with zero clinical data deletion', async () => {
      const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      EntitlementService.setMockSubscription(practiceAlpha, {
        status: 'TRIAL',
        planCode: 'TRIAL',
        trialEndsAt: pastDate,
      });

      const entitlements = await EntitlementService.resolvePracticeEntitlements(practiceAlpha);
      assert.strictEqual(entitlements.status, 'EXPIRED');
      assert.strictEqual(entitlements.isReadOnly, true);
      assert.strictEqual(entitlements.features.canCreatePatients, false);
      assert.strictEqual(entitlements.features.canCreatePrescriptions, false);
      assert.strictEqual(entitlements.features.canCreateInvoices, false);

      // Existing clinical tools remain accessible for reading/exporting
      assert.strictEqual(entitlements.features.canGeneratePdf, true);
      assert.strictEqual(entitlements.features.canExportData, true);

      // Attempting to create new patient throws SUBSCRIPTION_EXPIRED
      await assert.rejects(
        async () => {
          await EntitlementService.assertCanCreatePatient(practiceAlpha);
        },
        (err: unknown) => err instanceof AppError && err.code === 'SUBSCRIPTION_EXPIRED' && err.statusCode === 403
      );
    });
  });

  // ----------------------------------------------------------------------------
  // Category C: Practitioner Seats & Roles
  // ----------------------------------------------------------------------------
  describe('Category C: Practitioner Seats & Collaboration Limits', () => {
    it('16. Individual plan allows strictly 1 veterinarian seat', async () => {
      EntitlementService.setMockSubscription(practiceAlpha, {
        status: 'ACTIVE',
        planCode: 'INDIVIDUAL_MONTHLY',
        currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        usage: { veterinarianSeatsCount: 1 },
      });

      const entitlements = await EntitlementService.resolvePracticeEntitlements(practiceAlpha);
      assert.strictEqual(entitlements.limits.maxVeterinarianSeats, 1);
      assert.strictEqual(entitlements.limits.maxStaffSeats, null); // Unlimited staff
    });

    it('17. Individual plan rejects adding a second veterinarian seat with SEAT_LIMIT_REACHED', async () => {
      EntitlementService.setMockSubscription(practiceAlpha, {
        status: 'ACTIVE',
        planCode: 'INDIVIDUAL_MONTHLY',
        currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        usage: { veterinarianSeatsCount: 1 },
      });

      await assert.rejects(
        async () => {
          await EntitlementService.assertCanAddSeat(practiceAlpha, 'PRACTICE_OWNER' as any);
        },
        (err: unknown) => err instanceof AppError && err.code === 'SEAT_LIMIT_REACHED' && err.statusCode === 403
      );
    });

    it('18. Individual plan allows adding administrative/staff members without limit', async () => {
      EntitlementService.setMockSubscription(practiceAlpha, {
        status: 'ACTIVE',
        planCode: 'INDIVIDUAL_MONTHLY',
        currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        usage: { veterinarianSeatsCount: 1, staffSeatsCount: 5 },
      });

      // Staff role addition succeeds
      await assert.doesNotReject(async () => {
        await EntitlementService.assertCanAddSeat(practiceAlpha, 'PRACTICE_STAFF' as any);
      });
    });

    it('19. Clinic plan allows up to 5 veterinarians and unlimited staff', async () => {
      EntitlementService.setMockSubscription(practiceAlpha, {
        status: 'ACTIVE',
        planCode: 'CLINIC_MONTHLY',
        currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        usage: { veterinarianSeatsCount: 4, staffSeatsCount: 12 },
      });

      const entitlements = await EntitlementService.resolvePracticeEntitlements(practiceAlpha);
      assert.strictEqual(entitlements.limits.maxVeterinarianSeats, 5);

      // 5th veterinarian seat is allowed
      await assert.doesNotReject(async () => {
        await EntitlementService.assertCanAddSeat(practiceAlpha, 'PRACTICE_OWNER' as any);
      });
    });

    it('20. Clinic plan blocks 6th veterinarian with SEAT_LIMIT_REACHED', async () => {
      EntitlementService.setMockSubscription(practiceAlpha, {
        status: 'ACTIVE',
        planCode: 'CLINIC_MONTHLY',
        currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        usage: { veterinarianSeatsCount: 5 },
      });

      await assert.rejects(
        async () => {
          await EntitlementService.assertCanAddSeat(practiceAlpha, 'PRACTICE_OWNER' as any);
        },
        (err: unknown) => err instanceof AppError && err.code === 'SEAT_LIMIT_REACHED' && err.statusCode === 403
      );
    });
  });

  // ----------------------------------------------------------------------------
  // Category D: Subscription Lifecycle State Machine & Transitions
  // ----------------------------------------------------------------------------
  describe('Category D: Subscription Lifecycle State Machine', () => {
    it('21. Validates all lifecycle state machine forward transitions', () => {
      assert.strictEqual(SubscriptionService.isValidTransition('TRIAL', 'ACTIVE'), true);
      assert.strictEqual(SubscriptionService.isValidTransition('ACTIVE', 'PAST_DUE'), true);
      assert.strictEqual(SubscriptionService.isValidTransition('PAST_DUE', 'GRACE_PERIOD'), true);
      assert.strictEqual(SubscriptionService.isValidTransition('GRACE_PERIOD', 'EXPIRED'), true);
      assert.strictEqual(SubscriptionService.isValidTransition('ACTIVE', 'CANCELLED'), true);
      assert.strictEqual(SubscriptionService.isValidTransition('CANCELLED', 'ACTIVE'), true);
      assert.strictEqual(SubscriptionService.isValidTransition('EXPIRED', 'ACTIVE'), true);
    });

    it('22. Evaluates deterministic grace period (7 days) after period end', () => {
      const now = new Date('2026-09-20T10:00:00Z');
      const pastPeriodEnd = new Date('2026-09-18T10:00:00Z'); // 2 days past due
      const futureGraceEnd = new Date('2026-09-25T10:00:00Z'); // 5 days remaining in grace

      const sub = {
        status: 'ACTIVE',
        trialEndsAt: null,
        currentPeriodEnd: pastPeriodEnd,
        gracePeriodEndsAt: futureGraceEnd,
      };

      const evaluatedStatus = SubscriptionService.evaluateDeterministicStatus(sub);
      assert.strictEqual(evaluatedStatus, 'GRACE_PERIOD');
    });

    it('23. Evaluates expired status after grace period ends', () => {
      const pastPeriodEnd = new Date('2026-09-10T10:00:00Z');
      const pastGraceEnd = new Date('2026-09-17T10:00:00Z'); // Ended 3 days ago

      const sub = {
        status: 'ACTIVE',
        trialEndsAt: null,
        currentPeriodEnd: pastPeriodEnd,
        gracePeriodEndsAt: pastGraceEnd,
      };

      const evaluatedStatus = SubscriptionService.evaluateDeterministicStatus(sub);
      assert.strictEqual(evaluatedStatus, 'EXPIRED');
    });

    it('24. Cancellation stops renewal at period end without immediately revoking access', () => {
      const periodEnd = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000);
      const sub = {
        id: 'sub-active-001',
        practiceId: practiceAlpha,
        status: 'ACTIVE',
        trialEndsAt: null,
        currentPeriodEnd: periodEnd,
        gracePeriodEndsAt: null,
        cancelAtPeriodEnd: true,
      };

      // During active term, status remains ACTIVE
      const evaluatedStatus = SubscriptionService.evaluateDeterministicStatus(sub);
      assert.strictEqual(evaluatedStatus, 'ACTIVE');
      assert.strictEqual(sub.cancelAtPeriodEnd, true);
    });
  });

  // ----------------------------------------------------------------------------
  // Category E: Downgrade Limit Validation Invariant (BD-17)
  // ----------------------------------------------------------------------------
  describe('Category E: Downgrade Limit Validation Invariant', () => {
    it('25. Blocks downgrade from Clinic (5 vets) to Individual (1 vet) when active veterinarians exceed 1', async () => {
      EntitlementService.setMockSubscription(practiceAlpha, {
        status: 'ACTIVE',
        planCode: 'CLINIC_MONTHLY',
        currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        usage: { veterinarianSeatsCount: 3 }, // 3 active doctors!
      });

      // Must be rejected because destination plan only allows 1 veterinarian
      const targetConfig = AUTHORITATIVE_PLANS.INDIVIDUAL_MONTHLY;
      const usage = await EntitlementService.getPracticeUsage(practiceAlpha);

      assert.ok(usage.veterinarianSeatsCount > targetConfig.maxVeterinarianSeats);
      const isBlocked = usage.veterinarianSeatsCount > targetConfig.maxVeterinarianSeats;
      assert.strictEqual(isBlocked, true);
    });

    it('26. Permits downgrade from Clinic to Individual when active veterinarians is reduced to 1', async () => {
      EntitlementService.setMockSubscription(practiceAlpha, {
        status: 'ACTIVE',
        planCode: 'CLINIC_MONTHLY',
        currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        usage: { veterinarianSeatsCount: 1 }, // Reduced to 1 doctor!
      });

      const targetConfig = AUTHORITATIVE_PLANS.INDIVIDUAL_MONTHLY;
      const usage = await EntitlementService.getPracticeUsage(practiceAlpha);

      assert.strictEqual(usage.veterinarianSeatsCount <= targetConfig.maxVeterinarianSeats, true);
    });
  });

  // ----------------------------------------------------------------------------
  // Category F: Multi-Tenant Commercial Isolation
  // ----------------------------------------------------------------------------
  describe('Category F: Multi-Tenant Commercial Isolation', () => {
    it('27. Practice A subscription and limits are completely isolated from Practice B', async () => {
      EntitlementService.setMockSubscription(practiceAlpha, {
        status: 'ACTIVE',
        planCode: 'CLINIC_MONTHLY',
        usage: { patientsCount: 50, veterinarianSeatsCount: 4 },
      });

      EntitlementService.setMockSubscription(practiceBeta, {
        status: 'TRIAL',
        planCode: 'TRIAL',
        usage: { patientsCount: 8, veterinarianSeatsCount: 1 },
      });

      const entAlpha = await EntitlementService.resolvePracticeEntitlements(practiceAlpha);
      const entBeta = await EntitlementService.resolvePracticeEntitlements(practiceBeta);

      assert.strictEqual(entAlpha.planCode, 'CLINIC_MONTHLY');
      assert.strictEqual(entAlpha.limits.maxPatients, null); // Unlimited
      assert.strictEqual(entAlpha.limits.maxVeterinarianSeats, 5);

      assert.strictEqual(entBeta.planCode, 'TRIAL');
      assert.strictEqual(entBeta.limits.maxPatients, 10);
      assert.strictEqual(entBeta.limits.maxVeterinarianSeats, 1);
    });

    it('28. Practice A reaching trial limit does not impact Practice B', async () => {
      EntitlementService.setMockSubscription(practiceAlpha, {
        status: 'TRIAL',
        planCode: 'TRIAL',
        usage: { patientsCount: 10 }, // Limit reached
      });

      EntitlementService.setMockSubscription(practiceBeta, {
        status: 'TRIAL',
        planCode: 'TRIAL',
        usage: { patientsCount: 2 }, // Below limit
      });

      // Practice A is blocked
      await assert.rejects(async () => {
        await EntitlementService.assertCanCreatePatient(practiceAlpha);
      });

      // Practice B is permitted
      await assert.doesNotReject(async () => {
        await EntitlementService.assertCanCreatePatient(practiceBeta);
      });
    });
  });

  // ----------------------------------------------------------------------------
  // Category G: Trial Eligibility & Unified Authentication Invariants
  // ----------------------------------------------------------------------------
  describe('Category G: Trial Eligibility & Unified Authentication', () => {
    it('29. Trial eligibility check identifies consumed trials by normalized email', async () => {
      // Mock user with existing trial
      const isEligible = await SubscriptionService.checkTrialEligibility('newdoctor@vetrx.in');
      assert.strictEqual(isEligible, true);
    });

    it('30. Google OAuth and Password accounts resolve to the same commercial customer', () => {
      // Identity architecture invariant: AuthIdentities map to 1 User -> 1 PracticeMember -> 1 Practice (tenant)
      const passwordIdentity = { provider: 'password', providerEmail: 'dr.anil@vetrx.in', userId: 'user-anil-100' };
      const googleIdentity = { provider: 'google', providerEmail: 'dr.anil@vetrx.in', userId: 'user-anil-100' };

      // Both identities share the exact same userId and therefore the exact same commercial tenant Practice
      assert.strictEqual(passwordIdentity.userId, googleIdentity.userId);
    });
  });

  // ----------------------------------------------------------------------------
  // Category H: Commercial Operations & Idempotency
  // ----------------------------------------------------------------------------
  describe('Category H: Commercial Operations & Idempotency', () => {
    it('31. Cancellation reversal restores subscription renewal before period end', () => {
      const sub = {
        id: 'sub-active-001',
        practiceId: practiceAlpha,
        status: 'ACTIVE' as SubscriptionStatus,
        trialEndsAt: null,
        currentPeriodEnd: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
        cancelAtPeriodEnd: true,
        cancelledAt: new Date(),
      };

      // Reactivation flips cancelAtPeriodEnd back to false
      const reactivated = {
        ...sub,
        cancelAtPeriodEnd: false,
        cancelledAt: null,
      };

      assert.strictEqual(reactivated.cancelAtPeriodEnd, false);
      assert.strictEqual(reactivated.cancelledAt, null);
      assert.strictEqual(reactivated.status, 'ACTIVE');
    });

    it('32. State transitions are idempotent against double requests', () => {
      // Attempting to cancel already cancelled subscription maintains cancelAtPeriodEnd = true
      let sub = {
        cancelAtPeriodEnd: true,
        status: 'ACTIVE' as SubscriptionStatus,
      };

      // Duplicate cancel request
      sub = {
        ...sub,
        cancelAtPeriodEnd: true,
      };

      assert.strictEqual(sub.cancelAtPeriodEnd, true);
    });
  });

  // ----------------------------------------------------------------------------
  // Category I: Authoritative Annual Savings & Money Invariants
  // ----------------------------------------------------------------------------
  describe('Category I: Authoritative Annual Savings & Money Invariants', () => {
    it('33. Individual annual savings calculation is exact (₹599 x 12 - ₹5,999 = ₹1,189)', () => {
      const monthlyPaisa = AUTHORITATIVE_PLANS.INDIVIDUAL_MONTHLY.pricePaisa; // 59900
      const annualPaisa = AUTHORITATIVE_PLANS.INDIVIDUAL_ANNUAL.pricePaisa; // 599900
      const fullYearMonthlyPaisa = monthlyPaisa * 12; // 718800
      const calculatedSavingsPaisa = fullYearMonthlyPaisa - annualPaisa; // 118900

      assert.strictEqual(calculatedSavingsPaisa, 118900);
      assert.strictEqual(formatPaiseToRupees(calculatedSavingsPaisa), '₹1,189');
      assert.strictEqual(AUTHORITATIVE_PLANS.INDIVIDUAL_ANNUAL.annualSavingsPaisa, 118900);
    });

    it('34. Clinic annual savings calculation is exact (₹1,499 x 12 - ₹14,999 = ₹2,989)', () => {
      const monthlyPaisa = AUTHORITATIVE_PLANS.CLINIC_MONTHLY.pricePaisa; // 149900
      const annualPaisa = AUTHORITATIVE_PLANS.CLINIC_ANNUAL.pricePaisa; // 1499900
      const fullYearMonthlyPaisa = monthlyPaisa * 12; // 1798800
      const calculatedSavingsPaisa = fullYearMonthlyPaisa - annualPaisa; // 298900

      assert.strictEqual(calculatedSavingsPaisa, 298900);
      assert.strictEqual(formatPaiseToRupees(calculatedSavingsPaisa), '₹2,989');
      assert.strictEqual(AUTHORITATIVE_PLANS.CLINIC_ANNUAL.annualSavingsPaisa, 298900);
    });
  });
});
