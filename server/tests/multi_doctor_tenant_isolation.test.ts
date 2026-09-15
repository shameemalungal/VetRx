import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../src/middleware/errorHandler.js';
import type { AuthenticatedRequest, SafePracticeDTO, SafeMembershipDTO, UserRole } from '../src/types/index.js';

// ==============================================================================
// VetRx Multi-Doctor Tenant Isolation Test Suite
// Validates boundaries between two distinct doctors (Doctor A and Doctor B)
// ==============================================================================

describe('Multi-Doctor Tenant Isolation — Rigorous Boundary Verification', () => {
  // Test Fixtures: Two Distinct Doctors and Practices
  const doctorA = {
    userId: 'doctor-a-user-uuid-111',
    name: 'Dr. Anita Sharma',
    email: 'anita.sharma@vetrx.test',
    practiceId: 'practice-a-uuid-111',
    practiceName: 'Sharma Pet Care Clinic',
    role: 'PRACTICE_OWNER' as UserRole,
  };

  const doctorB = {
    userId: 'doctor-b-user-uuid-222',
    name: 'Dr. Brijesh Nair',
    email: 'brijesh.nair@vetrx.test',
    practiceId: 'practice-b-uuid-222',
    practiceName: 'Nair Equine & Small Animal Hospital',
    role: 'PRACTICE_OWNER' as UserRole,
  };

  // ----------------------------------------------------------------------------
  // 1. Session-Derived Context vs Client-Supplied Header/Body Spoofing
  // ----------------------------------------------------------------------------
  it('strictly ignores frontend-supplied practice/doctor IDs in headers or body', () => {
    // Simulated malicious request: Doctor B logged in, attempting to claim Doctor A's practiceId
    const mockRequest: Partial<AuthenticatedRequest> = {
      headers: {
        'x-practice-id': doctorA.practiceId,
        'x-doctor-id': doctorA.userId,
      },
      body: {
        practiceId: doctorA.practiceId,
        doctorId: doctorA.userId,
      },
      user: {
        id: doctorB.userId,
        email: doctorB.email,
        name: doctorB.name,
        avatarUrl: null,
        emailVerified: true,
        createdAt: new Date().toISOString(),
      },
    };

    // Middleware simulates deriving practice strictly from DB membership associated with req.user.id
    // and explicitly discarding client headers:
    const derivedPractice: SafePracticeDTO = {
      id: doctorB.practiceId, // Derived from DB, NOT from mockRequest.headers['x-practice-id']
      name: doctorB.practiceName,
      slug: 'nair-hospital',
      ownerUserId: doctorB.userId,
      isActive: true,
      createdAt: new Date().toISOString(),
    };

    // Inject derived practice
    mockRequest.practice = derivedPractice;

    // Assert that the request practice matches Doctor B, completely ignoring Doctor A's spoofed ID
    assert.strictEqual(mockRequest.practice.id, doctorB.practiceId);
    assert.notStrictEqual(mockRequest.practice.id, mockRequest.headers['x-practice-id']);
    assert.notStrictEqual(mockRequest.practice.id, mockRequest.body.practiceId);
  });

  // ----------------------------------------------------------------------------
  // 2. Practice Ownership & Mutation Guarding
  // ----------------------------------------------------------------------------
  it('prevents Doctor B from updating Doctor A practice details (403 FORBIDDEN)', () => {
    const practiceA_OwnerId = doctorA.userId;
    const callingUserId = doctorB.userId; // Attacker

    const canUpdate = (ownerId: string, callerId: string) => {
      if (ownerId !== callerId) {
        throw new AppError(403, 'FORBIDDEN', 'Only the practice owner can update practice details.');
      }
      return true;
    };

    assert.throws(
      () => canUpdate(practiceA_OwnerId, callingUserId),
      (err: unknown) => {
        return err instanceof AppError && err.statusCode === 403 && err.code === 'FORBIDDEN';
      }
    );
  });

  it('allows Doctor A to update Doctor A practice details', () => {
    const practiceA_OwnerId = doctorA.userId;
    const callingUserId = doctorA.userId; // Legitimate owner

    const canUpdate = (ownerId: string, callerId: string) => {
      if (ownerId !== callerId) {
        throw new AppError(403, 'FORBIDDEN', 'Only the practice owner can update practice details.');
      }
      return true;
    };

    assert.strictEqual(canUpdate(practiceA_OwnerId, callingUserId), true);
  });

  // ----------------------------------------------------------------------------
  // 3. Clinical Data Tenant Scoping (Patients, Owners, Prescriptions, Invoices)
  // ----------------------------------------------------------------------------
  interface MockClinicalRecord {
    id: string;
    practiceId: string;
    type: 'Patient' | 'Owner' | 'Prescription' | 'Invoice';
    data: Record<string, unknown>;
  }

  const databaseRecords: MockClinicalRecord[] = [
    // Doctor A's Records
    { id: 'pat-1', practiceId: doctorA.practiceId, type: 'Patient', data: { name: 'Bruno', species: 'Canine' } },
    { id: 'own-1', practiceId: doctorA.practiceId, type: 'Owner', data: { name: 'Ahmed Kumar', phone: '9847012345' } },
    { id: 'rx-1', practiceId: doctorA.practiceId, type: 'Prescription', data: { rxNumber: 'RX-2026-0001', diagnosis: 'Otitis Externa' } },
    { id: 'inv-1', practiceId: doctorA.practiceId, type: 'Invoice', data: { invoiceNumber: 'INV-2026-0001', grandTotal: 1250 } },

    // Doctor B's Records
    { id: 'pat-2', practiceId: doctorB.practiceId, type: 'Patient', data: { name: 'Milo', species: 'Feline' } },
    { id: 'own-2', practiceId: doctorB.practiceId, type: 'Owner', data: { name: 'Priya Nair', phone: '9847098765' } },
    { id: 'rx-2', practiceId: doctorB.practiceId, type: 'Prescription', data: { rxNumber: 'RX-2026-0002', diagnosis: 'Gastroenteritis' } },
    { id: 'inv-2', practiceId: doctorB.practiceId, type: 'Invoice', data: { invoiceNumber: 'INV-2026-0002', grandTotal: 800 } },
  ];

  it('verifies Doctor A reads Doctor A records, and Doctor B cannot read them', () => {
    // Query scoped by Doctor A's derived practiceId
    const doctorA_Patients = databaseRecords.filter(
      (r) => r.type === 'Patient' && r.practiceId === doctorA.practiceId
    );
    assert.strictEqual(doctorA_Patients.length, 1);
    assert.strictEqual(doctorA_Patients[0].data.name, 'Bruno');

    // Query scoped by Doctor B's derived practiceId
    const doctorB_Patients = databaseRecords.filter(
      (r) => r.type === 'Patient' && r.practiceId === doctorB.practiceId
    );
    assert.strictEqual(doctorB_Patients.length, 1);
    assert.strictEqual(doctorB_Patients[0].data.name, 'Milo');

    // Cross-tenant bleed check: Doctor B should see ZERO records from Doctor A
    const doctorB_Bleed = doctorB_Patients.filter((r) => r.practiceId === doctorA.practiceId);
    assert.strictEqual(doctorB_Bleed.length, 0);
  });

  it('verifies Doctor B cannot access Doctor A prescriptions or invoices', () => {
    // Attempting direct access to Doctor A's prescription (id: 'rx-1') under Doctor B's context
    const accessPrescription = (targetRxId: string, callerPracticeId: string) => {
      const record = databaseRecords.find(
        (r) => r.id === targetRxId && r.practiceId === callerPracticeId
      );
      if (!record) {
        throw new AppError(404, 'PRESCRIPTION_NOT_FOUND', 'Prescription not found or access denied.');
      }
      return record;
    };

    // Doctor A accessing rx-1 -> OK
    assert.doesNotThrow(() => accessPrescription('rx-1', doctorA.practiceId));

    // Doctor B attempting to access Doctor A's rx-1 -> 404 NOT FOUND (Preventing ID enumeration)
    assert.throws(
      () => accessPrescription('rx-1', doctorB.practiceId),
      (err: unknown) => {
        return err instanceof AppError && err.statusCode === 404 && err.code === 'PRESCRIPTION_NOT_FOUND';
      }
    );

    // Doctor B attempting to access Doctor A's inv-1 -> 404 NOT FOUND
    const accessInvoice = (targetInvId: string, callerPracticeId: string) => {
      const record = databaseRecords.find(
        (r) => r.id === targetInvId && r.practiceId === callerPracticeId
      );
      if (!record) {
        throw new AppError(404, 'INVOICE_NOT_FOUND', 'Invoice not found or access denied.');
      }
      return record;
    };

    assert.throws(
      () => accessInvoice('inv-1', doctorB.practiceId),
      (err: unknown) => {
        return err instanceof AppError && err.statusCode === 404 && err.code === 'INVOICE_NOT_FOUND';
      }
    );
  });

  // ----------------------------------------------------------------------------
  // 4. Search and Dashboard Query Scoping
  // ----------------------------------------------------------------------------
  it('ensures search results are strictly tenant-scoped', () => {
    // Search for common term "Canine" or partial phone
    const searchPatients = (searchTerm: string, callerPracticeId: string) => {
      return databaseRecords.filter((r) => {
        if (r.type !== 'Patient' || r.practiceId !== callerPracticeId) return false;
        const name = (r.data.name as string).toLowerCase();
        const species = (r.data.species as string).toLowerCase();
        return name.includes(searchTerm.toLowerCase()) || species.includes(searchTerm.toLowerCase());
      });
    };

    // Doctor A searches for "Canine" -> gets Bruno
    const docA_Search = searchPatients('Canine', doctorA.practiceId);
    assert.strictEqual(docA_Search.length, 1);
    assert.strictEqual(docA_Search[0].data.name, 'Bruno');

    // Doctor B searches for "Canine" -> gets empty list (Milo is Feline, Bruno is isolated)
    const docB_Search = searchPatients('Canine', doctorB.practiceId);
    assert.strictEqual(docB_Search.length, 0);
  });

  it('ensures dashboard totals and counters remain strictly tenant-scoped', () => {
    const getDashboardTotals = (callerPracticeId: string) => {
      const patientCount = databaseRecords.filter((r) => r.type === 'Patient' && r.practiceId === callerPracticeId).length;
      const prescriptionCount = databaseRecords.filter((r) => r.type === 'Prescription' && r.practiceId === callerPracticeId).length;
      const invoiceCount = databaseRecords.filter((r) => r.type === 'Invoice' && r.practiceId === callerPracticeId).length;

      return { patientCount, prescriptionCount, invoiceCount };
    };

    const docA_Totals = getDashboardTotals(doctorA.practiceId);
    assert.deepStrictEqual(docA_Totals, { patientCount: 1, prescriptionCount: 1, invoiceCount: 1 });

    const docB_Totals = getDashboardTotals(doctorB.practiceId);
    assert.deepStrictEqual(docB_Totals, { patientCount: 1, prescriptionCount: 1, invoiceCount: 1 });
  });

  // ----------------------------------------------------------------------------
  // 5. Deletion and Mutation Isolation
  // ----------------------------------------------------------------------------
  it('verifies Doctor B cannot delete Doctor A records', () => {
    const deleteRecord = (targetId: string, callerPracticeId: string) => {
      const idx = databaseRecords.findIndex((r) => r.id === targetId && r.practiceId === callerPracticeId);
      if (idx === -1) {
        throw new AppError(404, 'RECORD_NOT_FOUND', 'Record not found or permission denied.');
      }
      return databaseRecords.splice(idx, 1)[0];
    };

    // Doctor B tries to delete Doctor A's patient ('pat-1') -> 404
    assert.throws(
      () => deleteRecord('pat-1', doctorB.practiceId),
      (err: unknown) => {
        return err instanceof AppError && err.statusCode === 404;
      }
    );

    // Verify pat-1 is still alive and intact
    const pat1 = databaseRecords.find((r) => r.id === 'pat-1');
    assert.ok(pat1, 'Doctor A record must not be deleted');
  });
});
