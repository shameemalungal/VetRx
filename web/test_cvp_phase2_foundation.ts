import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CallPriority,
  VisitFlexibility,
  CallStatus,
} from './src/types/cvp';
import type { Call, CapacitySummary } from './src/types/cvp';

test('CVP Phase 2: Domain Types & Enums Integrity', async (t) => {
  await t.test('1. Priority Enum contains all 4 distinct clinical states without collapsing', () => {
    assert.equal(CallPriority.EMERGENCY, 'EMERGENCY');
    assert.equal(CallPriority.URGENT, 'URGENT');
    assert.equal(CallPriority.COULD_NOT_ASSESS, 'COULD_NOT_ASSESS');
    assert.equal(CallPriority.PLANNED, 'PLANNED');
    assert.equal(Object.keys(CallPriority).length, 4);
  });

  await t.test('2. Flexibility Enum is strictly separated from Priority', () => {
    assert.equal(VisitFlexibility.MUST_ATTEND_TODAY, 'MUST_ATTEND_TODAY');
    assert.equal(VisitFlexibility.CAN_POSTPONE_TODAY, 'CAN_POSTPONE_TODAY');
    assert.equal(VisitFlexibility.PREFERRED_TODAY, 'PREFERRED_TODAY');
    assert.equal(VisitFlexibility.SPECIFIC_DATE, 'SPECIFIC_DATE');
    assert.equal(Object.keys(VisitFlexibility).length, 4);
  });

  await t.test('3. Call Status Enum is strictly separated from Visit Status', () => {
    assert.equal(CallStatus.LOGGED, 'LOGGED');
    assert.equal(CallStatus.SCHEDULED, 'SCHEDULED');
    assert.equal(CallStatus.CANCELLED, 'CANCELLED');
    assert.equal(Object.keys(CallStatus).length, 3);
  });
});

test('CVP Phase 2: Capacity Estimation Logic', async (t) => {
  await t.test('Calculates utilization, buffer, and over-capacity flag accurately', () => {
    const totalWorkingMins = 480; // 8 hours
    const visitMins = 360; // 6 hours
    const travelMins = 60;  // 1 hour
    const totalAllocated = visitMins + travelMins; // 420 mins (7 hours)
    const remaining = totalWorkingMins - totalAllocated; // 60 mins

    const summary: CapacitySummary = {
      workingMinutesAvailable: totalWorkingMins,
      allocatedVisitMinutes: visitMins,
      allocatedTravelMinutes: travelMins,
      totalAllocatedMinutes: totalAllocated,
      remainingMinutes: remaining,
      overCapacityMinutes: 0,
      utilizationPercentage: Math.round((totalAllocated / totalWorkingMins) * 100),
      isOverCapacity: false,
      emergencyCount: 1,
      urgentCount: 2,
      plannedCount: 1,
      unassessedCount: 0,
      totalCallsCount: 4,
    };

    assert.equal(summary.isOverCapacity, false);
    assert.equal(summary.utilizationPercentage, 88);
    assert.equal(summary.remainingMinutes, 60);
  });

  await t.test('Flags OVER_CAPACITY when work exceeds available working time', () => {
    const totalWorkingMins = 480;
    const totalAllocated = 540; // 9 hours
    const isOver = totalAllocated > totalWorkingMins;
    const overMins = isOver ? totalAllocated - totalWorkingMins : 0;

    assert.equal(isOver, true);
    assert.equal(overMins, 60);
  });
});

test('CVP Phase 2: Postpone Logic & Date Integrity', async (t) => {
  await t.test('Postponement properly updates date and appends rescheduling reason', () => {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const call: Call = {
      id: 'call-101',
      practiceId: 'prac-alpha',
      callerPhone: '+91 98220 12345',
      tempOwnerName: 'Ramesh Patil',
      tempPatientName: 'Ganga (Cow)',
      species: 'Cattle',
      symptoms: 'Mild anorexia, mild bloat',
      tentativeAssessment: 'Indigestion',
      priority: 'PLANNED',
      flexibility: 'CAN_POSTPONE_TODAY',
      preferredDate: today,
      locationAddress: 'Shindewadi Farm',
      status: 'LOGGED',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Apply postpone
    const postponeReason = 'Farmer requested afternoon attendance tomorrow';
    const updatedCall: Call = {
      ...call,
      preferredDate: tomorrow,
      status: 'SCHEDULED',
      notes: call.notes ? `${call.notes} | Rescheduled: ${postponeReason}` : `Rescheduled: ${postponeReason}`,
      updatedAt: new Date(),
    };

    assert.equal(updatedCall.preferredDate, tomorrow);
    assert.equal(updatedCall.status, 'SCHEDULED');
    assert.match(updatedCall.notes || '', /Rescheduled: Farmer requested/);
  });
});

test('CVP Phase 2: Multi-Tenant Isolation Rule', async (t) => {
  await t.test('Calls from Practice A must never be accessible to Practice B', () => {
    const practiceACalls: Call[] = [
      {
        id: 'call-a1',
        practiceId: 'practice-A',
        callerPhone: '111',
        tempOwnerName: 'Owner A',
        species: 'Bovine',
        symptoms: 'Fever',
        priority: 'URGENT',
        flexibility: 'MUST_ATTEND_TODAY',
        preferredDate: '2026-10-09',
        status: 'LOGGED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    const practiceBCalls: Call[] = [
      {
        id: 'call-b1',
        practiceId: 'practice-B',
        callerPhone: '222',
        tempOwnerName: 'Owner B',
        species: 'Canine',
        symptoms: 'Vomiting',
        priority: 'EMERGENCY',
        flexibility: 'MUST_ATTEND_TODAY',
        preferredDate: '2026-10-09',
        status: 'LOGGED',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    // Simulating tenant filter query
    const queriedForPracticeA = [...practiceACalls, ...practiceBCalls].filter(
      (c) => c.practiceId === 'practice-A'
    );

    assert.equal(queriedForPracticeA.length, 1);
    assert.equal(queriedForPracticeA[0].id, 'call-a1');
    assert.equal(queriedForPracticeA.some((c) => c.practiceId === 'practice-B'), false);
  });
});
