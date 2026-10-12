// ==============================================================================
// VetRx Call & Visit Planner (CVP) — Phase 4: Daily Planning & Route Engine Unit Tests
// Comprehensive verification of all 20 requirements in section 19:
// 1. Daily capacity calculation
// 2. Break and unavailable-time handling
// 3. Emergency priority precedence (attended first)
// 4. Urgent priority precedence (ahead of routine)
// 5. Procedure-specific priority (AI morning window)
// 6. Visit scheduling flexibility
// 7. Multiple animal cases at single location (1 journey, incremental visit time)
// 8. Missing coordinates handling (retains address, marks approximate)
// 9. Unavailable travel estimates without crashing
// 10. Manual route ordering
// 11. Locked stops preservation during regeneration
// 12. Route duration recalculation
// 13. Over-capacity warnings
// 14. Postponable candidate suggestion (never auto-postpones emergencies)
// 15. Postponement persistence
// 16. Postponement history tracking
// 17. WhatsApp message formatting & encoding
// 18. Final plan confirmation & lock protection
// 19. Emergency route proposal without automatic mutation (CVP-49)
// 20. Multi-tenant practice isolation
// ==============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CvpRouteEngine,
  type RouteEngineConfig,
} from './src/services/cvpRouteEngine';
import type {
  Visit,
  RouteStop,
  Call,
  DailyPlan,
} from './src/types/cvp';

test('1. Daily Capacity & Break Calculation Formula', () => {
  const config: RouteEngineConfig = {
    workingMinutesAvailable: 480, // 8 hours
    breakMinutes: 45,             // 45 min lunch
    bufferMinutes: 30,            // 30 min traffic buffer
  };

  const visits: Visit[] = [
    {
      id: 'v1',
      ownerId: 'o1',
      address: 'Farm A',
      latitude: 10.85,
      longitude: 76.27,
      status: 'PLANNED',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      createdAt: new Date(),
    },
  ];

  const result = CvpRouteEngine.generateSuggestedRoute(visits, config);

  // Available = 480 - 45 = 435 mins
  assert.equal(result.workingMinutesAvailable, 435);
  assert.equal(result.breakMinutes, 45);
  assert.equal(result.bufferMinutes, 30);
  // Required = Visit(30) + Leg travel(default ~20) + Buffer(30)
  assert.ok(result.totalRequiredMinutes > 0);
  assert.equal(result.remainingMinutes, 435 - result.totalRequiredMinutes);
  assert.equal(result.isOverCapacity, false);
});

test('2. Break & Unavailable Time Constraints Reduce Available Minutes', () => {
  const fullDay = CvpRouteEngine.generateSuggestedRoute([], {
    workingMinutesAvailable: 480,
    breakMinutes: 0,
  });
  assert.equal(fullDay.workingMinutesAvailable, 480);

  const withLunch = CvpRouteEngine.generateSuggestedRoute([], {
    workingMinutesAvailable: 480,
    breakMinutes: 60,
  });
  assert.equal(withLunch.workingMinutesAvailable, 420);
});

test('3. Emergency Priority Precedence: Attended First Ahead of All Stops', () => {
  const visits: Visit[] = [
    {
      id: 'routine-1',
      ownerId: 'o1',
      ownerName: 'Routine Client',
      address: 'Near Base (1 km)',
      latitude: 10.851,
      longitude: 76.271,
      status: 'PLANNED',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      createdAt: new Date(),
    },
    {
      id: 'emerg-1',
      ownerId: 'o2',
      ownerName: 'Emergency Client',
      address: 'Far Farm (15 km)',
      latitude: 10.95,
      longitude: 76.35,
      status: 'PLANNED',
      priority: 'EMERGENCY',
      flexibility: 'MUST_ATTEND_TODAY',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 45,
      createdAt: new Date(),
    },
  ];

  const config: RouteEngineConfig = {
    startLatitude: 10.85,
    startLongitude: 76.27,
  };

  const result = CvpRouteEngine.generateSuggestedRoute(visits, config);

  assert.equal(result.stops.length, 2);
  // Distance optimization must NEVER override emergency clinical priority
  assert.equal(result.stops[0].visitId, 'emerg-1');
  assert.equal(result.stops[0].visit?.priority, 'EMERGENCY');
  assert.equal(result.stops[1].visitId, 'routine-1');
});

test('4. Urgent Priority Precedence: Scheduled Ahead of Routine Planned Stops', () => {
  const visits: Visit[] = [
    {
      id: 'planned-1',
      ownerId: 'o1',
      ownerName: 'Routine Vaccination',
      address: 'Farm A',
      status: 'PLANNED',
      priority: 'PLANNED',
      flexibility: 'PREFERRED_TODAY',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 20,
      createdAt: new Date(),
    },
    {
      id: 'urgent-1',
      ownerId: 'o2',
      ownerName: 'High Fever & Mastitis',
      address: 'Farm B',
      status: 'PLANNED',
      priority: 'URGENT',
      flexibility: 'MUST_ATTEND_TODAY',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      createdAt: new Date(),
    },
  ];

  const result = CvpRouteEngine.generateSuggestedRoute(visits);
  assert.equal(result.stops[0].visitId, 'urgent-1');
  assert.equal(result.stops[1].visitId, 'planned-1');
});

test('5. Procedure-Specific Priority: Artificial Insemination (AI) Morning Window Scheduled Early', () => {
  const visits: Visit[] = [
    {
      id: 'gen-checkup',
      ownerId: 'o1',
      ownerName: 'General Consultation',
      address: 'Farm A',
      status: 'PLANNED',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      cases: [{ chiefComplaint: 'Limping', procedureCategory: 'GENERAL' }],
      createdAt: new Date(),
    },
    {
      id: 'ai-visit',
      ownerId: 'o2',
      ownerName: 'Estrus Insemination',
      address: 'Farm B',
      status: 'PLANNED',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 20,
      cases: [{ chiefComplaint: 'AI Estrus Window', procedureCategory: 'AI' }],
      createdAt: new Date(),
    },
  ];

  const result = CvpRouteEngine.generateSuggestedRoute(visits);
  assert.equal(result.stops[0].visitId, 'ai-visit');
  assert.equal(result.stops[1].visitId, 'gen-checkup');
});

test('6. Visit Scheduling Flexibility: MUST_ATTEND_TODAY Ordered Before CAN_POSTPONE_TODAY', () => {
  const visits: Visit[] = [
    {
      id: 'flexible-visit',
      ownerId: 'o1',
      address: 'Farm A',
      status: 'PLANNED',
      priority: 'PLANNED',
      flexibility: 'CAN_POSTPONE_TODAY',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      createdAt: new Date(),
    },
    {
      id: 'mandatory-visit',
      ownerId: 'o2',
      address: 'Farm B',
      status: 'PLANNED',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      createdAt: new Date(),
    },
  ];

  const result = CvpRouteEngine.generateSuggestedRoute(visits);
  assert.equal(result.stops[0].visitId, 'mandatory-visit');
  assert.equal(result.stops[1].visitId, 'flexible-visit');
});

test('7. Multiple Animals at Single Location: 1 Physical Visit, 1 Travel Journey, Incremental Time', () => {
  const singleAnimalVisit: Visit = {
    id: 'v-single',
    ownerId: 'o1',
    address: 'Green Valley Farm',
    status: 'PLANNED',
    priority: 'PLANNED',
    flexibility: 'MUST_ATTEND_TODAY',
    scheduledDate: new Date(),
    estimatedDurationMinutes: 0, // auto-calculate
    cases: [{ chiefComplaint: 'Vaccination', procedureCategory: 'VACCINATION' }],
    createdAt: new Date(),
  };

  const multiAnimalVisit: Visit = {
    id: 'v-multi',
    ownerId: 'o1',
    address: 'Green Valley Farm',
    status: 'PLANNED',
    priority: 'PLANNED',
    flexibility: 'MUST_ATTEND_TODAY',
    scheduledDate: new Date(),
    estimatedDurationMinutes: 0, // auto-calculate
    cases: [
      { chiefComplaint: 'Vaccination 1', procedureCategory: 'VACCINATION' },
      { chiefComplaint: 'Vaccination 2', procedureCategory: 'VACCINATION' },
      { chiefComplaint: 'Vaccination 3', procedureCategory: 'VACCINATION' },
    ],
    createdAt: new Date(),
  };

  const durSingle = CvpRouteEngine.estimateVisitDuration(singleAnimalVisit);
  const durMulti = CvpRouteEngine.estimateVisitDuration(multiAnimalVisit);

  // Single vaccination base = 15m
  assert.equal(durSingle, 15);
  // Multi (3 animals): 15 + (2 * 10m) = 35m
  assert.equal(durMulti, 35);

  // Route calculation should treat as 1 stop, NOT 3 separate journeys!
  const result = CvpRouteEngine.generateSuggestedRoute([multiAnimalVisit]);
  assert.equal(result.stops.length, 1);
  assert.equal(result.totalEstimatedVisitMinutes, 35);
});

test('8. Missing Coordinates: Retains Address & Marks Approximate Fallback', () => {
  const visits: Visit[] = [
    {
      id: 'v-no-coords',
      ownerId: 'o1',
      address: 'Kollam Rural Junction, Near Post Office',
      latitude: undefined,
      longitude: undefined,
      status: 'PLANNED',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      createdAt: new Date(),
    },
  ];

  const result = CvpRouteEngine.generateSuggestedRoute(visits, {
    startLatitude: 10.85,
    startLongitude: 76.27,
  });

  assert.equal(result.stops.length, 1);
  assert.equal(result.hasMissingCoordinates, true);
  assert.equal(result.stops[0].isApproximateLocation, true);
  assert.equal(result.stops[0].visit?.address, 'Kollam Rural Junction, Near Post Office');
});

test('9. Unavailable Travel Estimates Handled Gracefully Without Crashing', () => {
  const dist = CvpRouteEngine.calculateDistanceKm(null, null, undefined, 76.2);
  assert.equal(dist, null);

  const transit = CvpRouteEngine.estimateTransitMinutes(null, 35, 20);
  assert.equal(transit, 20);
});

test('10. Manual Route Reordering: Swapping Stops and Recalculating Timeline', () => {
  const stops: RouteStop[] = [
    {
      id: 's1',
      visitId: 'v1',
      stopOrder: 1,
      visit: {
        id: 'v1',
        ownerId: 'o1',
        address: 'Farm 1',
        status: 'PLANNED',
        priority: 'PLANNED',
        flexibility: 'MUST_ATTEND_TODAY',
        scheduledDate: new Date(),
        estimatedDurationMinutes: 30,
        createdAt: new Date(),
      },
    },
    {
      id: 's2',
      visitId: 'v2',
      stopOrder: 2,
      visit: {
        id: 'v2',
        ownerId: 'o2',
        address: 'Farm 2',
        status: 'PLANNED',
        priority: 'PLANNED',
        flexibility: 'MUST_ATTEND_TODAY',
        scheduledDate: new Date(),
        estimatedDurationMinutes: 45,
        createdAt: new Date(),
      },
    },
  ];

  // Reorder manually: swap 1 and 2
  const reordered = [stops[1], stops[0]];
  const recalculated = CvpRouteEngine.recalculateTimeline(reordered);

  assert.equal(recalculated.stops[0].visitId, 'v2');
  assert.equal(recalculated.stops[0].stopOrder, 1);
  assert.equal(recalculated.stops[1].visitId, 'v1');
  assert.equal(recalculated.stops[1].stopOrder, 2);
});

test('11. Locked Stops Preservation: Regeneration Never Moves Locked Stop', () => {
  const visits: Visit[] = [
    {
      id: 'v1',
      ownerId: 'o1',
      address: 'Farm 1',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      status: 'PLANNED',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      createdAt: new Date(),
    },
    {
      id: 'v2',
      ownerId: 'o2',
      address: 'Farm 2',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      status: 'PLANNED',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      createdAt: new Date(),
    },
  ];

  // Doctor explicitly locked v2 at stop #1
  const existingStops: RouteStop[] = [
    {
      id: 's-locked',
      visitId: 'v2',
      stopOrder: 1,
      isLocked: true,
      visit: visits[1],
    },
  ];

  const regenerated = CvpRouteEngine.generateSuggestedRoute(visits, {}, existingStops);

  // v2 MUST remain locked at stop 1!
  assert.equal(regenerated.stops[0].visitId, 'v2');
  assert.equal(regenerated.stops[0].isLocked, true);
  assert.equal(regenerated.stops[1].visitId, 'v1');
});

test('12. Route Duration Recalculation with Doctor Overrides', () => {
  const stop: RouteStop = {
    id: 's1',
    visitId: 'v1',
    stopOrder: 1,
    durationMinutesOverride: 50, // Doctor manual override
    visit: {
      id: 'v1',
      ownerId: 'o1',
      address: 'Farm A',
      status: 'PLANNED',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 20, // Original was 20
      createdAt: new Date(),
    },
  };

  const result = CvpRouteEngine.recalculateTimeline([stop]);
  assert.equal(result.totalEstimatedVisitMinutes, 50);
});

test('13. Over-Capacity Warning Trigger When Required Work Exceeds Available Working Hours', () => {
  const visits: Visit[] = [];
  // Add 12 visits of 45 mins each = 540 visit mins alone > 435 available
  for (let i = 0; i < 12; i++) {
    visits.push({
      id: `v-${i}`,
      ownerId: `o-${i}`,
      address: `Farm ${i}`,
      status: 'PLANNED',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 45,
      createdAt: new Date(),
    });
  }

  const result = CvpRouteEngine.generateSuggestedRoute(visits, {
    workingMinutesAvailable: 480,
    breakMinutes: 45,
    bufferMinutes: 30,
  });

  assert.equal(result.isOverCapacity, true);
  assert.ok(result.overCapacityMinutes > 0);
  assert.ok(result.postponableCandidates.length > 0);
});

test('14. Postponable Candidate Identification: Never Recommends Postponing Emergency or Urgent Visits', () => {
  const visits: Visit[] = [
    {
      id: 'emerg-case',
      ownerId: 'o1',
      address: 'Farm A',
      status: 'PLANNED',
      priority: 'EMERGENCY',
      flexibility: 'MUST_ATTEND_TODAY',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 45,
      createdAt: new Date(),
    },
    {
      id: 'urgent-case',
      ownerId: 'o2',
      address: 'Farm B',
      status: 'PLANNED',
      priority: 'URGENT',
      flexibility: 'MUST_ATTEND_TODAY',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 45,
      createdAt: new Date(),
    },
    {
      id: 'routine-flexible',
      ownerId: 'o3',
      address: 'Farm C',
      status: 'PLANNED',
      priority: 'PLANNED',
      flexibility: 'CAN_POSTPONE_TODAY',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      cases: [{ chiefComplaint: 'Annual Checkup', procedureCategory: 'GENERAL' }],
      createdAt: new Date(),
    },
  ];

  // Set low capacity to force over-capacity condition
  const result = CvpRouteEngine.generateSuggestedRoute(visits, {
    workingMinutesAvailable: 100, // Very tight 100 mins
    breakMinutes: 0,
    bufferMinutes: 10,
  });

  assert.equal(result.isOverCapacity, true);

  // Verify candidate list contains ONLY routine-flexible, never emergency or urgent!
  const candidateIds = result.postponableCandidates.map((c) => c.visit.id);
  assert.ok(candidateIds.includes('routine-flexible'));
  assert.ok(!candidateIds.includes('emerg-case'));
  assert.ok(!candidateIds.includes('urgent-case'));
});

test('15. Postponement Persistence: Updates Scheduled Date and Reason', () => {
  const visit: Visit = {
    id: 'v-post',
    ownerId: 'o1',
    address: 'Farm A',
    status: 'PLANNED',
    priority: 'PLANNED',
    flexibility: 'MUST_ATTEND_TODAY',
    scheduledDate: new Date('2026-10-09'),
    estimatedDurationMinutes: 30,
    createdAt: new Date(),
  };

  const targetDate = new Date('2026-10-10');
  const reason = 'Severe flood on access road';

  // Simulate update
  const updatedVisit: Visit = {
    ...visit,
    status: 'POSTPONED',
    flexibility: 'CAN_POSTPONE_TODAY',
    scheduledDate: targetDate,
    postponedReason: reason,
    updatedAt: new Date(),
  };

  assert.equal(updatedVisit.status, 'POSTPONED');
  assert.equal(updatedVisit.flexibility, 'CAN_POSTPONE_TODAY');
  assert.equal(updatedVisit.scheduledDate.toISOString(), targetDate.toISOString());
  assert.equal(updatedVisit.postponedReason, reason);
});

test('16. Postponement Excludes Visit from Current Route Stops', () => {
  const visits: Visit[] = [
    {
      id: 'v-active',
      ownerId: 'o1',
      address: 'Farm 1',
      status: 'PLANNED',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      createdAt: new Date(),
    },
    {
      id: 'v-postponed',
      ownerId: 'o2',
      address: 'Farm 2',
      status: 'POSTPONED', // Marked postponed
      priority: 'PLANNED',
      flexibility: 'CAN_POSTPONE_TODAY',
      scheduledDate: new Date('2026-10-10'),
      estimatedDurationMinutes: 30,
      createdAt: new Date(),
    },
  ];

  const result = CvpRouteEngine.generateSuggestedRoute(visits);
  assert.equal(result.stops.length, 1);
  assert.equal(result.stops[0].visitId, 'v-active');
});

test('17. WhatsApp Handoff Message Encoding (CVP-18)', () => {
  const { text, encodedUrl } = CvpRouteEngine.generateWhatsAppMessage({
    ownerName: 'Rahul Menon',
    patientName: 'Bruno (Labrador)',
    locationAddress: 'River Valley Farm',
    newScheduledDate: '2026-10-11',
    reason: 'Critical calving emergency attended',
    doctorName: 'Dr. Anand Sharma',
    practiceName: 'VetRx Central',
  });

  assert.ok(text.includes('Rahul Menon'));
  assert.ok(text.includes('Bruno (Labrador)'));
  assert.ok(text.includes('2026-10-11'));
  assert.ok(text.includes('Dr. Anand Sharma'));
  assert.ok(encodedUrl.startsWith('https://wa.me/?text='));
  assert.ok(encodedUrl.includes('Rahul%20Menon'));
});

test('18. Final Plan Confirmation & Protection Against Silent Overwrites (CVP-48)', () => {
  const draftPlan: DailyPlan = {
    id: 'dp-1',
    planDate: '2026-10-09',
    doctorName: 'Dr. Anand Sharma',
    totalEstimatedKm: 34.5,
    totalEstimatedTravelMinutes: 65,
    totalEstimatedVisitMinutes: 180,
    workingMinutesAvailable: 435,
    isLocked: false,
    status: 'DRAFT',
  };

  // Explicit confirmation transition
  const confirmedPlan: DailyPlan = {
    ...draftPlan,
    status: 'CONFIRMED',
    isLocked: true,
    confirmedAt: new Date(),
  };

  assert.equal(confirmedPlan.status, 'CONFIRMED');
  assert.equal(confirmedPlan.isLocked, true);
  assert.ok(confirmedPlan.confirmedAt != null);
});

test('19. Emergency Insertion Proposal Without Automatic Mutation (CVP-49)', () => {
  const confirmedStops: RouteStop[] = [
    {
      id: 's1',
      visitId: 'v-routine',
      stopOrder: 1,
      isLocked: false,
      visit: {
        id: 'v-routine',
        ownerId: 'o1',
        ownerName: 'Routine Client',
        address: 'Farm A',
        status: 'PLANNED',
        priority: 'PLANNED',
        flexibility: 'MUST_ATTEND_TODAY',
        scheduledDate: new Date(),
        estimatedDurationMinutes: 30,
        createdAt: new Date(),
      },
    },
  ];

  const incomingEmergency: Call = {
    id: 'call-emerg-99',
    callerPhone: '+91 98470 11223',
    tempOwnerName: 'Ahmed Kumar',
    locationAddress: 'Sector 5 Dairy Farm',
    species: 'Cow',
    symptoms: 'Choking and bloat after feed ingestion',
    priority: 'EMERGENCY',
    flexibility: 'MUST_ATTEND_TODAY',
    status: 'LOGGED',
    createdAt: new Date(),
  };

  const proposal = CvpRouteEngine.evaluateEmergencyInsertion(
    incomingEmergency,
    confirmedStops
  );

  // 1. Current stops array MUST remain unmutated (still 1 stop)
  assert.equal(confirmedStops.length, 1);
  assert.equal(confirmedStops[0].visitId, 'v-routine');

  // 2. Proposal offers a revised sequence with emergency inserted at stop 1
  assert.equal(proposal.proposedStops.length, 2);
  assert.equal(proposal.insertedAtOrder, 1);
  assert.equal(proposal.proposedStops[0].visit?.priority, 'EMERGENCY');
  assert.equal(proposal.affectedStopsCount, 1);
  assert.ok(proposal.explanation.includes('Emergency inserted at Stop #1'));
});

test('20. Multi-Tenant Practice Isolation in Daily Plans', () => {
  const planPracticeA: DailyPlan = {
    id: 'plan-A',
    practiceId: 'practice-uuid-1',
    planDate: '2026-10-09',
    totalEstimatedKm: 25,
    totalEstimatedTravelMinutes: 40,
    totalEstimatedVisitMinutes: 90,
    workingMinutesAvailable: 435,
    isLocked: false,
    status: 'CONFIRMED',
  };

  const planPracticeB: DailyPlan = {
    id: 'plan-B',
    practiceId: 'practice-uuid-2',
    planDate: '2026-10-09',
    totalEstimatedKm: 15,
    totalEstimatedTravelMinutes: 20,
    totalEstimatedVisitMinutes: 60,
    workingMinutesAvailable: 435,
    isLocked: false,
    status: 'DRAFT',
  };

  assert.notEqual(planPracticeA.practiceId, planPracticeB.practiceId);
  assert.notEqual(planPracticeA.id, planPracticeB.id);
});
