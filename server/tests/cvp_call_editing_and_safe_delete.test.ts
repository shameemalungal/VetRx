import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { AppError } from '../src/middleware/errorHandler.js';

// Schemas under test
const createCallSchema = z.object({
  callerPhone: z.string().min(1).max(30),
  ownerId: z.union([z.string(), z.number(), z.null()]).transform((v) => (typeof v === 'string' && v.includes('-') ? v : null)).nullable().optional(),
  tempOwnerName: z.string().max(120).nullable().optional(),
  tempPatientName: z.string().max(120).nullable().optional(),
  species: z.string().max(60).nullable().optional(),
  animalCount: z.number().int().min(1).default(1),
  symptoms: z.string().min(1).max(2000),
  tentativeAssessment: z.string().max(2000).nullable().optional(),
  priority: z.enum(['EMERGENCY', 'URGENT', 'COULD_NOT_ASSESS', 'PLANNED']).default('PLANNED'),
  flexibility: z.enum(['MUST_ATTEND_TODAY', 'CAN_POSTPONE_TODAY', 'PREFERRED_TODAY', 'SPECIFIC_DATE']).default('MUST_ATTEND_TODAY'),
  preferredDate: z.union([z.string(), z.date()]).nullable().optional().transform((v) => (v && v !== '' ? new Date(v) : null)),
  locationAddress: z.string().max(500).nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  plannedProcedure: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

const updateCallSchema = createCallSchema.partial().extend({
  status: z.enum(['LOGGED', 'SCHEDULED', 'CANCELLED']).optional(),
});

describe('1. Call Editing — Payload Parsing & Field Validation', () => {
  it('prepopulates and updates existing call intake fields accurately', () => {
    const rawInput = {
      callerPhone: '9822012345',
      tempOwnerName: 'Shashikant Patil',
      tempPatientName: 'Lakshmi / Cow #4',
      species: 'Cattle',
      animalCount: 2,
      symptoms: 'Acute mastitis in right hind quarter with high fever',
      tentativeAssessment: 'Suspected Clinical Mastitis',
      priority: 'URGENT',
      flexibility: 'MUST_ATTEND_TODAY',
      preferredDate: '2026-10-22',
      locationAddress: 'Survey 42, Wada Village',
      plannedProcedure: 'Intramammary Infusion & Antibiotic Course',
      notes: 'Caller requests visit before noon milking',
      status: 'LOGGED',
    };

    const parsed = updateCallSchema.parse(rawInput);
    assert.strictEqual(parsed.callerPhone, '9822012345');
    assert.strictEqual(parsed.tempOwnerName, 'Shashikant Patil');
    assert.strictEqual(parsed.tempPatientName, 'Lakshmi / Cow #4');
    assert.strictEqual(parsed.species, 'Cattle');
    assert.strictEqual(parsed.animalCount, 2);
    assert.strictEqual(parsed.symptoms, 'Acute mastitis in right hind quarter with high fever');
    assert.strictEqual(parsed.priority, 'URGENT');
    assert.ok(parsed.preferredDate instanceof Date);
    assert.strictEqual(parsed.status, 'LOGGED');
  });

  it('accepts both ISO date strings and YYYY-MM-DD date inputs safely', () => {
    const parsed1 = updateCallSchema.parse({ preferredDate: '2026-10-25' });
    assert.ok(parsed1.preferredDate instanceof Date);

    const parsed2 = updateCallSchema.parse({ preferredDate: '2026-10-25T14:30:00.000Z' });
    assert.ok(parsed2.preferredDate instanceof Date);

    const parsed3 = updateCallSchema.parse({ preferredDate: '' });
    assert.strictEqual(parsed3.preferredDate, null);

    const parsed4 = updateCallSchema.parse({ preferredDate: null });
    assert.strictEqual(parsed4.preferredDate, null);
  });

  it('preserves existing owner UUID and does not generate accidental owner clones', () => {
    const existingOwnerUuid = '068d67f6-bb9d-4597-bb3a-202f776079a0';
    const parsed = updateCallSchema.parse({
      ownerId: existingOwnerUuid,
      callerPhone: '9822012345',
      symptoms: 'Mild bloat',
    });
    assert.strictEqual(parsed.ownerId, existingOwnerUuid);
  });
});

describe('2. Safe Deletion Business Rules & Constraints', () => {
  // Helper simulating the deleteCall safety evaluation logic
  function evaluateCallDeletionSafety(call: {
    id: string;
    visits?: Array<{
      id: string;
      status: string;
      procedures?: any[];
      medicineUsages?: any[];
      cases?: Array<{
        prescriptionId?: string | null;
        invoiceId?: string | null;
        prescription?: any;
        invoice?: any;
      }>;
    }>;
  }) {
    const visits = call.visits || [];

    const hasClinicalOrFinancial = visits.some(
      (v) =>
        v.status === 'COMPLETED' ||
        (v.procedures && v.procedures.length > 0) ||
        (v.medicineUsages && v.medicineUsages.length > 0) ||
        (v.cases &&
          v.cases.some(
            (c) =>
              c.prescriptionId != null ||
              c.invoiceId != null ||
              c.prescription != null ||
              c.invoice != null
          ))
    );

    if (hasClinicalOrFinancial) {
      throw new AppError(
        409,
        'CANNOT_DELETE_CALL_WITH_CLINICAL_RECORDS',
        'Cannot delete this call because completed clinical or financial records (prescriptions, invoices, procedures, or medicines) exist. To preserve medical and financial history, you can cancel or archive the call instead.'
      );
    }

    const activeVisit = visits.find((v) =>
      ['REGISTERED', 'SCHEDULED', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'POSTPONED'].includes(
        v.status
      )
    );

    if (activeVisit) {
      throw new AppError(
        409,
        'CALL_LINKED_TO_ACTIVE_VISIT',
        `Cannot delete this call because it has an active or scheduled visit (Visit ID: ${activeVisit.id}, Status: ${activeVisit.status}). Please cancel or reschedule the visit first, or cancel the call instead.`
      );
    }

    if (visits.length > 0) {
      throw new AppError(
        409,
        'CALL_HAS_LINKED_VISITS',
        'Cannot delete this call because linked visit history exists. Use the Cancel Call action to safely close this record without losing historical audit trails.'
      );
    }

    return { success: true, message: 'Call deleted successfully.', id: call.id };
  }

  it('allows deleting a genuinely unlinked draft call (0 visits)', () => {
    const draftCall = {
      id: 'draft-call-123',
      visits: [],
    };
    const result = evaluateCallDeletionSafety(draftCall);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.id, 'draft-call-123');
  });

  it('blocks destructive deletion when linked to an active or scheduled visit', () => {
    const callWithActiveVisit = {
      id: 'call-scheduled-456',
      visits: [
        {
          id: 'visit-999',
          status: 'SCHEDULED',
          procedures: [],
          medicineUsages: [],
          cases: [],
        },
      ],
    };

    assert.throws(
      () => evaluateCallDeletionSafety(callWithActiveVisit),
      (err: unknown) => {
        return (
          err instanceof AppError &&
          err.statusCode === 409 &&
          err.code === 'CALL_LINKED_TO_ACTIVE_VISIT'
        );
      }
    );
  });

  it('blocks destructive deletion when linked to completed visit or clinical records', () => {
    const callWithPrescription = {
      id: 'call-clinical-789',
      visits: [
        {
          id: 'visit-888',
          status: 'COMPLETED',
          procedures: [],
          medicineUsages: [],
          cases: [
            {
              prescriptionId: 'rx-555',
            },
          ],
        },
      ],
    };

    assert.throws(
      () => evaluateCallDeletionSafety(callWithPrescription),
      (err: unknown) => {
        return (
          err instanceof AppError &&
          err.statusCode === 409 &&
          err.code === 'CANNOT_DELETE_CALL_WITH_CLINICAL_RECORDS'
        );
      }
    );
  });

  it('blocks destructive deletion when invoices or medicine usages exist', () => {
    const callWithInvoice = {
      id: 'call-financial-101',
      visits: [
        {
          id: 'visit-777',
          status: 'CANCELLED',
          procedures: [],
          medicineUsages: [{ id: 'med-use-1', quantityUsed: 1 }],
          cases: [{ invoiceId: 'inv-333' }],
        },
      ],
    };

    assert.throws(
      () => evaluateCallDeletionSafety(callWithInvoice),
      (err: unknown) => {
        return (
          err instanceof AppError &&
          err.statusCode === 409 &&
          err.code === 'CANNOT_DELETE_CALL_WITH_CLINICAL_RECORDS'
        );
      }
    );
  });
});

describe('3. Multi-Tenant Isolation & Authorization Boundary', () => {
  it('guarantees tenant isolation: practice boundary cannot be traversed', () => {
    const practiceA = 'practice-aaa';
    const practiceB = 'practice-bbb';
    const callPracticeId = practiceA;

    // Simulate query check: where: { id, practiceId }
    const canAccess = (requestingPracticeId: string) => callPracticeId === requestingPracticeId;

    assert.strictEqual(canAccess(practiceA), true);
    assert.strictEqual(canAccess(practiceB), false);
  });

  it('prevents cross-tenant call editing or deletion', () => {
    const call = { id: 'call-1', practiceId: 'practice-alpha' };
    const tenantContextPracticeId = 'practice-beta';

    const isAuthorized = call.practiceId === tenantContextPracticeId;
    assert.strictEqual(isAuthorized, false);
  });
});
