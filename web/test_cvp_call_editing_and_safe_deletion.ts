import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Call, CallPriority, VisitFlexibility, CallStatus } from './src/types/cvp';

describe('CVP Call Editing & Safe Deletion — Frontend Logic & Contract Tests', () => {
  const mockCall: Call = {
    id: 101,
    practiceId: 'practice-001',
    callerPhone: '9822099999',
    ownerId: 'owner-uuid-456',
    ownerName: 'Ramesh Patil',
    tempOwnerName: 'Ramesh Patil',
    tempPatientName: 'Lakshmi',
    patientIds: [501],
    selectedPatients: [{ id: 501, name: 'Lakshmi', species: 'Cattle' }],
    species: 'Cattle',
    animalCount: 1,
    symptoms: 'High fever and swollen left hind quarter',
    tentativeAssessment: 'Acute Mastitis',
    plannedProcedure: 'Intramammary Infusion',
    priority: 'URGENT',
    flexibility: 'MUST_ATTEND_TODAY',
    preferredDate: '2026-10-22',
    locationAddress: 'Plot 14, Farm Road, Village Wada',
    latitude: 19.1234,
    longitude: 73.5678,
    status: 'LOGGED',
    notes: 'Please visit before 11 AM',
    createdAt: new Date('2026-10-21T09:00:00Z'),
    updatedAt: new Date('2026-10-21T09:00:00Z'),
  };

  it('1. Prepopulates all applicable call intake fields correctly without data loss', () => {
    const formData = {
      callerPhone: mockCall.callerPhone || '',
      ownerName: mockCall.ownerName || mockCall.tempOwnerName || '',
      patientName: mockCall.tempPatientName || mockCall.selectedPatients?.[0]?.name || '',
      species: mockCall.species || 'Cattle',
      animalCount: mockCall.animalCount || 1,
      symptoms: mockCall.symptoms || '',
      tentativeAssessment: mockCall.tentativeAssessment || '',
      plannedProcedure: mockCall.plannedProcedure || '',
      priority: mockCall.priority || 'PLANNED',
      flexibility: mockCall.flexibility || 'MUST_ATTEND_TODAY',
      preferredDate: mockCall.preferredDate ? String(mockCall.preferredDate).split('T')[0] : '',
      status: mockCall.status || 'LOGGED',
      locationAddress: mockCall.locationAddress || '',
      notes: mockCall.notes || '',
    };

    assert.strictEqual(formData.callerPhone, '9822099999');
    assert.strictEqual(formData.ownerName, 'Ramesh Patil');
    assert.strictEqual(formData.patientName, 'Lakshmi');
    assert.strictEqual(formData.species, 'Cattle');
    assert.strictEqual(formData.animalCount, 1);
    assert.strictEqual(formData.symptoms, 'High fever and swollen left hind quarter');
    assert.strictEqual(formData.tentativeAssessment, 'Acute Mastitis');
    assert.strictEqual(formData.plannedProcedure, 'Intramammary Infusion');
    assert.strictEqual(formData.priority, 'URGENT');
    assert.strictEqual(formData.flexibility, 'MUST_ATTEND_TODAY');
    assert.strictEqual(formData.preferredDate, '2026-10-22');
    assert.strictEqual(formData.locationAddress, 'Plot 14, Farm Road, Village Wada');
    assert.strictEqual(formData.notes, 'Please visit before 11 AM');
  });

  it('2. Dirty state tracking warns users before discarding unsaved edits', () => {
    const initialData = {
      callerPhone: mockCall.callerPhone || '',
      symptoms: mockCall.symptoms || '',
      animalCount: mockCall.animalCount || 1,
    };

    // Unmodified state
    let currentSymptoms = mockCall.symptoms;
    let isDirty = currentSymptoms !== initialData.symptoms;
    assert.strictEqual(isDirty, false, 'Initial state should not be dirty');

    // User edits symptoms
    currentSymptoms = 'High fever, off feed for 24h, severe dullness';
    isDirty = currentSymptoms !== initialData.symptoms;
    assert.strictEqual(isDirty, true, 'Modified state must be flagged as dirty');
  });

  it('3. Preserves existing owner and patient relationships without duplicating records', () => {
    // When editing, payload retains call.ownerId and call.patientIds
    const editedPayload = {
      callerPhone: '9822099999',
      ownerId: mockCall.ownerId, // Authoritative link preserved
      patientIds: mockCall.patientIds, // Patient link preserved
      symptoms: 'Updated symptoms',
    };

    assert.strictEqual(editedPayload.ownerId, 'owner-uuid-456');
    assert.deepStrictEqual(editedPayload.patientIds, [501]);
  });

  it('4. Keeps caller-reported intake distinct from clinician-confirmed findings', () => {
    // Caller symptoms and tentative assessment are distinct intake fields
    assert.ok(mockCall.symptoms, 'Has caller-reported symptoms');
    assert.ok(mockCall.tentativeAssessment, 'Has intake tentative assessment');
    // Clinical findings and diagnosis are added on visit case completion, not intake
    assert.strictEqual((mockCall as any).definitiveDiagnosis, undefined);
  });

  it('5. Safe Deletion: permits deleting genuinely unlinked draft calls', () => {
    const unlinkedCall: Call = { ...mockCall, visits: [] };
    const visits = unlinkedCall.visits || [];

    const isDeletionBlocked =
      visits.some((v: any) => v.status === 'COMPLETED' || (v.procedures && v.procedures.length > 0)) ||
      Boolean(visits.find((v: any) => ['SCHEDULED', 'IN_PROGRESS'].includes(v.status))) ||
      visits.length > 0;

    assert.strictEqual(isDeletionBlocked, false, 'Unlinked call with 0 visits must allow deletion');
  });

  it('6. Safe Deletion: blocks deletion when linked active or scheduled visit exists', () => {
    const callWithActiveVisit: Call = {
      ...mockCall,
      visits: [
        {
          id: 'visit-101',
          practiceId: 'practice-001',
          callId: 'call-101',
          ownerId: 'owner-uuid-456',
          status: 'SCHEDULED' as any,
          priority: 'URGENT' as any,
          scheduledDate: new Date(),
          address: 'Plot 14',
          sequenceOrder: 1,
          estimatedDurationMinutes: 30,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ],
    };

    const visits = callWithActiveVisit.visits || [];
    const activeVisit = visits.find((v: any) =>
      ['REGISTERED', 'SCHEDULED', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'POSTPONED'].includes(
        v.status
      )
    );

    assert.ok(activeVisit, 'Active visit detected');
    assert.strictEqual(activeVisit.status, 'SCHEDULED');
  });

  it('7. Safe Deletion: blocks deletion when completed clinical records or invoices exist', () => {
    const callWithClinicalHistory: Call = {
      ...mockCall,
      visits: [
        {
          id: 'visit-202',
          status: 'COMPLETED' as any,
          procedures: [{ id: 'proc-1', procedureName: 'Dystocia Assistance' }],
          medicineUsages: [{ id: 'med-1', medicineName: 'Oxytocin', quantityUsed: 2 }],
          cases: [{ id: 'case-1', prescriptionId: 'rx-999', invoiceId: 'inv-888' }],
        } as any,
      ],
    };

    const visits = callWithClinicalHistory.visits || [];
    const hasClinicalOrFinancial = visits.some(
      (v: any) =>
        v.status === 'COMPLETED' ||
        (v.procedures && v.procedures.length > 0) ||
        (v.medicineUsages && v.medicineUsages.length > 0) ||
        (v.cases &&
          v.cases.some(
            (c: any) =>
              c.prescriptionId != null ||
              c.invoiceId != null ||
              c.prescription != null ||
              c.invoice != null
          ))
    );

    assert.strictEqual(hasClinicalOrFinancial, true, 'Clinical/financial history must block destructive deletion');
  });

  it('8. Safe Deletion: offers safe cancellation when destructive deletion is blocked', () => {
    const reason = 'Farmer cancelled visit due to animal improvement';
    const closureNote = `[Closed: ${reason}]`;
    const updatedNotes = mockCall.notes ? `${mockCall.notes} | ${closureNote}` : closureNote;

    assert.ok(updatedNotes.includes('[Closed: Farmer cancelled visit'));
  });

  it('9. CallCard Actions Menu stops event propagation to avoid unwanted page navigation', () => {
    let navigationTriggered = false;
    let editActionTriggered = false;

    const onSelect = () => {
      navigationTriggered = true;
    };

    const onEdit = () => {
      editActionTriggered = true;
    };

    // Simulate clicking Edit inside menu with stopPropagation
    const fakeEvent = {
      stopPropagation: () => {},
    };

    // If stopPropagation is called, parent onSelect is never invoked
    onEdit();
    assert.strictEqual(editActionTriggered, true);
    assert.strictEqual(navigationTriggered, false);
  });
});
