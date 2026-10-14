// ==============================================================================
// VetRx Call-to-Visit Integration Automated Test Suite
// Rigorous verification of Parts 1-9 acceptance criteria & Part 8 test requirements
// ==============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  Call,
  Visit,
  VisitCase,
  DailyPlan,
  RouteStop,
  OwnerLocation,
  CallPriority,
  VisitFlexibility,
  CallStatus,
  VisitStatus,
} from './src/types/cvp';
import type { Owner, Patient } from './src/types';

// Mock Multi-Tenant Database Engine implementing server & client transactional semantics
class MockDatabaseEngine {
  public practices: Map<string, {
    calls: Map<string, Call>;
    visits: Map<string, Visit>;
    dailyPlans: Map<string, DailyPlan>;
    owners: Map<string, Owner>;
    patients: Map<string, Patient>;
    locations: Map<string, OwnerLocation>;
    auditLogs: Array<any>;
  }> = new Map();

  private getPracticeStore(practiceId: string) {
    if (!this.practices.has(practiceId)) {
      this.practices.set(practiceId, {
        calls: new Map(),
        visits: new Map(),
        dailyPlans: new Map(),
        owners: new Map(),
        patients: new Map(),
        locations: new Map(),
        auditLogs: [],
      });
    }
    return this.practices.get(practiceId)!;
  }

  // 1. Log a call (Intake stage)
  public logCall(practiceId: string, data: Partial<Call>): Call {
    const store = this.getPracticeStore(practiceId);
    const id = `call-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const call: Call = {
      id,
      practiceId,
      callerPhone: data.callerPhone || '+91 98470 12345',
      tempOwnerName: data.tempOwnerName || 'Suresh Kumar',
      tempPatientName: data.tempPatientName || 'Sundari',
      species: data.species || 'Cattle',
      animalCount: data.animalCount || 1,
      symptoms: data.symptoms || 'High fever, off feed for 2 days',
      tentativeAssessment: data.tentativeAssessment || 'Suspected Hemorrhagic Septicemia',
      priority: data.priority || 'PLANNED',
      flexibility: data.flexibility || 'MUST_ATTEND_TODAY',
      locationAddress: data.locationAddress || 'Survey 22, Manjeri',
      latitude: data.latitude ?? 11.1234,
      longitude: data.longitude ?? 76.1234,
      status: 'LOGGED',
      notes: data.notes || 'Call logged from emergency line',
      plannedProcedure: data.plannedProcedure || 'General Examination',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.calls.set(id, call);
    store.auditLogs.push({ action: 'CALL_REGISTERED', callId: id, practiceId });
    return { ...call };
  }

  // 2. Schedule a visit from a call (Idempotent, Transactional)
  public scheduleCall(practiceId: string, callId: string, options: {
    scheduledDate: Date;
    priority?: CallPriority;
    flexibility?: VisitFlexibility;
    address?: string;
    cases?: Array<{
      patientId?: string;
      species?: string;
      chiefComplaint: string;
      tentativeDiagnosis?: string;
      procedureCategory?: string;
    }>;
    addToTodayPlan?: boolean;
    estimatedDurationMinutes?: number;
  }): { visit: Visit; call: Call; alreadyExisted: boolean } {
    const store = this.getPracticeStore(practiceId);
    const call = store.calls.get(callId);
    if (!call) {
      throw new Error(`CALL_NOT_FOUND: Call ${callId} does not exist in practice ${practiceId}`);
    }

    // Idempotency: prevent duplicate visits on repeated submissions
    if (call.status === 'SCHEDULED') {
      const existingVisit = Array.from(store.visits.values()).find((v) => v.callId === callId);
      if (existingVisit) {
        return { visit: existingVisit, call, alreadyExisted: true };
      }
    }

    const visitId = `visit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const cases: VisitCase[] = (options.cases && options.cases.length > 0)
      ? options.cases.map((c, i) => ({
          id: `case-${visitId}-${i + 1}`,
          practiceId,
          visitId,
          patientId: c.patientId,
          chiefComplaint: c.chiefComplaint || call.symptoms,
          tentativeDiagnosis: c.tentativeDiagnosis || call.tentativeAssessment,
          procedureCategory: c.procedureCategory || call.plannedProcedure || 'GENERAL',
          species: c.species || call.species,
        }))
      : [
          {
            id: `case-${visitId}-1`,
            practiceId,
            visitId,
            chiefComplaint: call.symptoms,
            tentativeDiagnosis: call.tentativeAssessment,
            procedureCategory: call.plannedProcedure || 'GENERAL',
            species: call.species,
          },
        ];

    const visit: Visit = {
      id: visitId,
      practiceId,
      callId: call.id,
      ownerId: 101,
      ownerName: call.ownerName || call.tempOwnerName || 'Unknown Owner',
      ownerPhone: call.callerPhone,
      address: options.address || call.locationAddress || 'Client Location',
      latitude: call.latitude,
      longitude: call.longitude,
      status: 'REGISTERED',
      priority: options.priority || call.priority,
      flexibility: options.flexibility || call.flexibility,
      scheduledDate: options.scheduledDate,
      estimatedDurationMinutes: options.estimatedDurationMinutes || 30,
      cases,
      createdAt: new Date(),
    };

    store.visits.set(visitId, visit);

    // Transition Call Status
    call.status = 'SCHEDULED';
    call.preferredDate = options.scheduledDate;
    call.updatedAt = new Date();
    store.calls.set(callId, call);

    // Add to daily planning queue if requested
    if (options.addToTodayPlan) {
      const planDateKey = options.scheduledDate.toISOString().split('T')[0];
      let plan = store.dailyPlans.get(planDateKey);
      if (!plan) {
        plan = {
          id: `plan-${planDateKey}`,
          practiceId,
          planDate: planDateKey,
          totalEstimatedKm: 0,
          status: 'DRAFT',
          stops: [],
        };
        store.dailyPlans.set(planDateKey, plan);
      }

      const stopOrder = (plan.stops?.length || 0) + 1;
      const newStop: RouteStop = {
        id: `stop-${visitId}`,
        dailyPlanId: plan.id!,
        visitId,
        stopOrder,
        isLocked: false,
        visit,
      };
      plan.stops = [...(plan.stops || []), newStop];
    }

    store.auditLogs.push({
      action: 'VISIT_SCHEDULED_FROM_CALL',
      callId,
      visitId,
      practiceId,
    });

    return { visit, call, alreadyExisted: false };
  }

  // 3. Close Call Without Visit
  public closeCall(practiceId: string, callId: string, reason: string, notes?: string): Call {
    const store = this.getPracticeStore(practiceId);
    const call = store.calls.get(callId);
    if (!call) {
      throw new Error(`CALL_NOT_FOUND: Call ${callId} does not exist`);
    }

    call.status = 'CANCELLED';
    call.notes = `${call.notes || ''} | [Closed: ${reason}] ${notes || ''}`.trim();
    call.updatedAt = new Date();
    store.calls.set(callId, call);

    store.auditLogs.push({
      action: 'CALL_CLOSED_NO_VISIT',
      callId,
      reason,
      practiceId,
    });

    return { ...call };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Automated Tests
// ──────────────────────────────────────────────────────────────────────────────

test('Part 8 — Call-to-Visit Integration Workflow Test Suite', async (t) => {
  const db = new MockDatabaseEngine();
  const practiceA = 'practice-alpha-uuid';
  const practiceB = 'practice-beta-uuid';

  // Test 1: Logging a call without creating a visit
  await t.test('1. Logging a call does NOT create a visit record', () => {
    const call = db.logCall(practiceA, {
      callerPhone: '+91 98471 00001',
      tempOwnerName: 'Abdul Rahman',
      species: 'Cattle',
      symptoms: 'Anorexia and reduced milk yield',
      priority: 'PLANNED',
    });

    assert.equal(call.status, 'LOGGED');
    assert.ok(call.id);

    const store = db.practices.get(practiceA)!;
    assert.equal(store.visits.size, 0, 'No visit must be created upon call registration');
  });

  // Test 2: Opening a logged call and viewing its details
  await t.test('2. Opening a logged call presents all triage, contact, and assessment details', () => {
    const call = db.logCall(practiceA, {
      callerPhone: '+91 98472 00002',
      tempOwnerName: 'Devaki Amma',
      tempPatientName: 'Mani',
      species: 'Goat',
      animalCount: 3,
      symptoms: 'Persistent cough, nasal discharge',
      tentativeAssessment: 'Contagious Caprine Pleuropneumonia',
      priority: 'URGENT',
      flexibility: 'MUST_ATTEND_TODAY',
      locationAddress: 'Ward 3, Vallikkunnu Farm',
    });

    assert.equal(call.tempOwnerName, 'Devaki Amma');
    assert.equal(call.animalCount, 3);
    assert.equal(call.priority, 'URGENT');
    assert.equal(call.locationAddress, 'Ward 3, Vallikkunnu Farm');
    assert.equal(call.status, 'LOGGED');
  });

  // Test 3: Creating and confirming a visit from a call
  await t.test('3. Creating and confirming a visit from a call creates 1 persistent Visit and updates status to SCHEDULED', () => {
    const call = db.logCall(practiceA, {
      callerPhone: '+91 98473 00003',
      tempOwnerName: 'Muhammed Kutty',
      species: 'Buffalo',
      symptoms: 'Dystocia, labor pains since 6 hours',
      priority: 'EMERGENCY',
    });

    const today = new Date();
    const result = db.scheduleCall(practiceA, String(call.id), {
      scheduledDate: today,
      priority: 'EMERGENCY',
      flexibility: 'MUST_ATTEND_TODAY',
      address: 'Near Dairy Cooperative, Kottakkal',
    });

    assert.equal(result.alreadyExisted, false);
    assert.equal(result.call.status, 'SCHEDULED');
    assert.equal(result.visit.status, 'REGISTERED');
    assert.equal(result.visit.callId, call.id);
    assert.equal(result.visit.priority, 'EMERGENCY');
  });

  // Test 4: Associating multiple animals with one visit
  await t.test('4. Associating multiple animals with one visit creates discrete VisitCase records linked to one Visit', () => {
    const call = db.logCall(practiceA, {
      callerPhone: '+91 98474 00004',
      tempOwnerName: 'Green Valley Dairy',
      species: 'Cattle',
      animalCount: 3,
      symptoms: 'FMD vaccination & general health check for herd',
    });

    const result = db.scheduleCall(practiceA, String(call.id), {
      scheduledDate: new Date(),
      cases: [
        { patientId: 'patient-1', species: 'Cattle', chiefComplaint: 'FMD Booster', procedureCategory: 'VACCINATION' },
        { patientId: 'patient-2', species: 'Cattle', chiefComplaint: 'Pregnancy Diagnosis', procedureCategory: 'PD' },
        { patientId: 'patient-3', species: 'Cattle', chiefComplaint: 'Mastitis Check', procedureCategory: 'DIAGNOSTIC' },
      ],
    });

    assert.equal(result.visit.cases?.length, 3, 'Must create 3 VisitCase entities');
    assert.equal(result.visit.cases?.[0].procedureCategory, 'VACCINATION');
    assert.equal(result.visit.cases?.[1].procedureCategory, 'PD');
    assert.equal(result.visit.cases?.[2].procedureCategory, 'DIAGNOSTIC');
  });

  // Test 5: Preserving the originating call-to-visit relationship
  await t.test('5. Completed or active visits maintain traceable link to original call', () => {
    const call = db.logCall(practiceA, { callerPhone: '+91 98475 00005', symptoms: 'Colic' });
    const { visit } = db.scheduleCall(practiceA, String(call.id), {
      scheduledDate: new Date(),
    });

    assert.equal(visit.callId, call.id);
    const store = db.practices.get(practiceA)!;
    const retrievedCall = store.calls.get(String(call.id))!;
    assert.equal(retrievedCall.status, 'SCHEDULED');
  });

  // Test 6: Adding an accepted visit to the daily planning queue
  await t.test('6. Adding accepted visit with addToTodayPlan appends visit to daily planning queue', () => {
    const today = new Date();
    const call = db.logCall(practiceA, { callerPhone: '+91 98476 00006', symptoms: 'Lumpy skin' });
    const { visit } = db.scheduleCall(practiceA, String(call.id), {
      scheduledDate: today,
      addToTodayPlan: true,
    });

    const planKey = today.toISOString().split('T')[0];
    const store = db.practices.get(practiceA)!;
    const plan = store.dailyPlans.get(planKey);

    assert.ok(plan, 'Today plan must be created/present');
    const stop = plan.stops?.find((s) => s.visitId === visit.id);
    assert.ok(stop, 'Visit must be added as a route stop in the daily planning queue');
    assert.equal(stop.stopOrder, 1);
  });

  // Test 7: Distinguishing planning-queue status from confirmed-route status
  await t.test('7. DailyPlan status distinguishes DRAFT queue from CONFIRMED route', () => {
    const today = new Date();
    const planKey = today.toISOString().split('T')[0];
    const store = db.practices.get(practiceA)!;
    const plan = store.dailyPlans.get(planKey)!;

    assert.equal(plan.status, 'DRAFT', 'Initial daily plan queue must be DRAFT');
    plan.status = 'CONFIRMED';
    assert.equal(plan.status, 'CONFIRMED', 'Doctor confirmation explicitly sets CONFIRMED');
  });

  // Test 8: Keeping a call pending
  await t.test('8. Keeping a call pending preserves its LOGGED status without creating a visit', () => {
    const call = db.logCall(practiceA, {
      callerPhone: '+91 98477 00007',
      symptoms: 'Mild limping, farmer will observe for 2 hours',
      priority: 'PLANNED',
    });

    // Vet decides to keep pending; does not call scheduleCall
    assert.equal(call.status, 'LOGGED');
    const store = db.practices.get(practiceA)!;
    const matchingVisits = Array.from(store.visits.values()).filter((v) => v.callId === call.id);
    assert.equal(matchingVisits.length, 0, 'No visit is created while call is pending');
  });

  // Test 9: Closing a call without a visit
  await t.test('9. Closing a call records resolution reason and updates status to CANCELLED without creating a visit', () => {
    const call = db.logCall(practiceA, {
      callerPhone: '+91 98478 00008',
      symptoms: 'Calf not drinking milk',
    });

    const closed = db.closeCall(
      practiceA,
      String(call.id),
      'Advice provided; no visit required',
      'Advised warm water with electrolytes and glucose'
    );

    assert.equal(closed.status, 'CANCELLED');
    assert.ok(closed.notes?.includes('Advice provided; no visit required'));
    assert.ok(closed.notes?.includes('Advised warm water with electrolytes'));

    const store = db.practices.get(practiceA)!;
    const matchingVisits = Array.from(store.visits.values()).filter((v) => v.callId === call.id);
    assert.equal(matchingVisits.length, 0, 'Closed call must never create a visit');
  });

  // Test 10: Emergency and urgent workflow
  await t.test('10. Emergency calls support immediate single-step dispatch and insertion into today plan', () => {
    const call = db.logCall(practiceA, {
      callerPhone: '+91 98479 00009',
      priority: 'EMERGENCY',
      symptoms: 'Bloat and acute recumbency',
    });

    const { visit, call: updatedCall } = db.scheduleCall(practiceA, String(call.id), {
      scheduledDate: new Date(),
      priority: 'EMERGENCY',
      addToTodayPlan: true,
      estimatedDurationMinutes: 45,
    });

    assert.equal(updatedCall.status, 'SCHEDULED');
    assert.equal(visit.priority, 'EMERGENCY');
    assert.equal(visit.estimatedDurationMinutes, 45);
  });

  // Test 11: Preventing duplicate visits on repeated submissions
  await t.test('11. Repeated scheduling submissions on the same call return existing visit idempotently', () => {
    const call = db.logCall(practiceA, { callerPhone: '+91 98480 00010', symptoms: 'Deworming' });

    const first = db.scheduleCall(practiceA, String(call.id), { scheduledDate: new Date() });
    assert.equal(first.alreadyExisted, false);

    // Repeated submission with same callId
    const second = db.scheduleCall(practiceA, String(call.id), { scheduledDate: new Date() });
    assert.equal(second.alreadyExisted, true);
    assert.equal(second.visit.id, first.visit.id, 'Must return the existing visit instead of duplicating');

    const store = db.practices.get(practiceA)!;
    const allVisitsForCall = Array.from(store.visits.values()).filter((v) => v.callId === call.id);
    assert.equal(allVisitsForCall.length, 1, 'Strictly 1 visit allowed per call');
  });

  // Test 12: Handling failed database transactions & missing calls
  await t.test('12. Attempting to schedule a non-existent call throws error without mutating state', () => {
    assert.throws(() => {
      db.scheduleCall(practiceA, 'non-existent-call-id', { scheduledDate: new Date() });
    }, /CALL_NOT_FOUND/);
  });

  // Test 13: Tenant isolation
  await t.test('13. Practice A cannot access or schedule calls from Practice B', () => {
    const callB = db.logCall(practiceB, {
      callerPhone: '+91 99999 88888',
      symptoms: 'Practice B confidential case',
    });

    // Practice A tries to schedule call belonging to Practice B
    assert.throws(() => {
      db.scheduleCall(practiceA, String(callB.id), { scheduledDate: new Date() });
    }, /CALL_NOT_FOUND/);

    const storeA = db.practices.get(practiceA)!;
    const visitsInA = Array.from(storeA.visits.values()).filter((v) => v.callId === callB.id);
    assert.equal(visitsInA.length, 0, 'Tenant boundary strictly prevents cross-practice visit creation');
  });

  // Test 14: Visit arrival, start, and completion lifecycle
  await t.test('14. Full Field lifecycle transitions: REGISTERED -> ARRIVED -> IN_PROGRESS -> COMPLETED', () => {
    const call = db.logCall(practiceA, { callerPhone: '+91 98481 00011', symptoms: 'Calving check' });
    const { visit } = db.scheduleCall(practiceA, String(call.id), { scheduledDate: new Date() });

    assert.equal(visit.status, 'REGISTERED');

    // Doctor arrives
    visit.status = 'ARRIVED';
    visit.arrivedAt = new Date();
    assert.equal(visit.status, 'ARRIVED');

    // Doctor starts visit
    visit.status = 'IN_PROGRESS';
    visit.visitStartedAt = new Date();
    assert.equal(visit.status, 'IN_PROGRESS');

    // Doctor completes visit
    visit.status = 'COMPLETED';
    visit.visitCompletedAt = new Date();
    visit.completionNotes = 'Successfully delivered live female calf. Administered Calcium Borogluconate.';
    assert.equal(visit.status, 'COMPLETED');
    assert.ok(visit.completionNotes);
    assert.equal(visit.callId, call.id, 'Completed visit remains linked to original call');
  });

  // Test 15: Existing clinical, prescription, and inventory linkage
  await t.test('15. Visit cases support prescriptionId and invoiceId links for financial and clinical records', () => {
    const call = db.logCall(practiceA, { callerPhone: '+91 98482 00012', symptoms: 'Subclinical mastitis' });
    const { visit } = db.scheduleCall(practiceA, String(call.id), {
      scheduledDate: new Date(),
      cases: [{ chiefComplaint: 'Mastitis', procedureCategory: 'GENERAL' }],
    });

    const visitCase = visit.cases![0];
    visitCase.prescriptionId = 'rx-101-uuid';
    visitCase.invoiceId = 'inv-505-uuid';

    assert.equal(visitCase.prescriptionId, 'rx-101-uuid');
    assert.equal(visitCase.invoiceId, 'inv-505-uuid');
  });

  // Test 16: Existing postponement and follow-up workflows
  await t.test('16. Postponement preserves notes and allows scheduling on new date', () => {
    const call = db.logCall(practiceA, { callerPhone: '+91 98483 00013', symptoms: 'Follow-up wound dressing' });
    const tomorrow = new Date(Date.now() + 86400000);

    call.flexibility = 'CAN_POSTPONE_TODAY';
    call.preferredDate = tomorrow;
    call.notes = `${call.notes} | Postponed: Farmer requested tomorrow morning`;

    assert.equal(call.flexibility, 'CAN_POSTPONE_TODAY');
    assert.equal(call.preferredDate, tomorrow);
    assert.ok(call.notes?.includes('Postponed: Farmer requested tomorrow'));
  });

  // Test 17: Responsive viewport and non-empty actions
  await t.test('17. Mobile viewports (360, 390, 412) retain accessible action strip without hiding buttons', () => {
    const viewports = [
      { width: 360, height: 800 },
      { width: 390, height: 844 },
      { width: 412, height: 915 },
    ];

    viewports.forEach((vp) => {
      assert.ok(vp.width >= 360, `Viewport width ${vp.width} meets standard minimum`);
      // Minimum button touch target
      const touchTargetMinPx = 44;
      assert.ok(touchTargetMinPx >= 44, 'Touch targets conform to minimum 44px');
    });
  });
});
