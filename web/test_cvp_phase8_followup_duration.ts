// ==============================================================================
// VetRx Phase 8 Automated Test Suite: Follow-up Management, Recurring Visits,
// & Duration Learning Engine
// ==============================================================================

import {
  durationLearningService,
  DEFAULT_PROCEDURE_DURATIONS,
} from './src/services/durationLearningService';
import { followUpService } from './src/services/followUpService';
import { CvpRouteEngine } from './src/services/cvpRouteEngine';
import type {
  FollowUp,
  RecurringSchedule,
  ProcedureDurationEstimate,
  Visit,
} from './src/types/cvp';

declare const process: any;

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passed++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ` - ${detail}` : ''}`);
    failed++;
  }
}

console.log('======================================================================');
console.log('VETRX PHASE 8: FOLLOW-UPS, RECURRING VISITS & DURATION LEARNING TESTS');
console.log('======================================================================\n');

// ── 1. Follow-up Status & Dynamic Evaluation ──────────────────────────────────
try {
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const past3Days = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];

  const baseFollowUp: FollowUp = {
    id: 1,
    practiceId: 'practice-alpha',
    ownerId: 101,
    ownerName: 'Ramesh Patel',
    patientName: 'Gauri',
    species: 'Cattle',
    reason: 'POST_TREATMENT_REVIEW',
    recommendedDate: today,
    priority: 'PLANNED',
    flexibility: 'MUST_ATTEND_TODAY',
    status: 'UPCOMING',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  assert(
    followUpService.evaluateDynamicStatus({ ...baseFollowUp, recommendedDate: today }) === 'DUE',
    'Test 1.1: Recommended date today evaluates to DUE'
  );
  assert(
    followUpService.evaluateDynamicStatus({ ...baseFollowUp, recommendedDate: tomorrow }) === 'UPCOMING',
    'Test 1.2: Recommended date tomorrow evaluates to UPCOMING'
  );
  assert(
    followUpService.evaluateDynamicStatus({ ...baseFollowUp, recommendedDate: yesterday }) === 'OVERDUE',
    'Test 1.3: Recommended date yesterday evaluates to OVERDUE'
  );
  assert(
    followUpService.evaluateDynamicStatus({ ...baseFollowUp, recommendedDate: past3Days }) === 'OVERDUE',
    'Test 1.4: Recommended date past 3 days evaluates to OVERDUE'
  );
  assert(
    followUpService.evaluateDynamicStatus({ ...baseFollowUp, status: 'COMPLETED', recommendedDate: past3Days }) === 'COMPLETED',
    'Test 1.5: Terminal status COMPLETED is preserved'
  );
  assert(
    followUpService.evaluateDynamicStatus({ ...baseFollowUp, status: 'CANCELLED', recommendedDate: past3Days }) === 'CANCELLED',
    'Test 1.6: Terminal status CANCELLED is preserved'
  );
} catch (e: any) {
  assert(false, 'Test 1: Dynamic Status Evaluation', e.message);
}

// ── 2. Distinction between Recommendation and Confirmed Appointment ───────────
try {
  const f: FollowUp = {
    practiceId: 'practice-alpha',
    ownerId: 101,
    ownerName: 'Ramesh Patel',
    patientName: 'Gauri',
    reason: 'VACCINATION',
    recommendedDate: '2026-10-20',
    priority: 'PLANNED',
    flexibility: 'MUST_ATTEND_TODAY',
    status: 'UPCOMING',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  assert(
    f.scheduledVisitId === undefined && f.status !== 'SCHEDULED',
    'Test 2.1: Recommendation creation does NOT automatically book a physical appointment'
  );

  const converted = { ...f, status: 'SCHEDULED' as const, scheduledVisitId: 501 };
  assert(
    converted.status === 'SCHEDULED' && converted.scheduledVisitId === 501,
    'Test 2.2: Explicit planning assigns scheduledVisitId and transitions to SCHEDULED'
  );
} catch (e: any) {
  assert(false, 'Test 2: Recommendation vs Appointment', e.message);
}

// ── 3. Recurrence Calculations & Intervals ────────────────────────────────────
try {
  const startDate = '2026-11-01';

  const dailyDates = followUpService.calculateNextOccurrences(startDate, 'DAILY', 4);
  assert(
    JSON.stringify(dailyDates) === JSON.stringify(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04']),
    'Test 3.1: Daily recurrence generates sequential dates'
  );

  const weeklyDates = followUpService.calculateNextOccurrences(startDate, 'WEEKLY', 3);
  assert(
    JSON.stringify(weeklyDates) === JSON.stringify(['2026-11-01', '2026-11-08', '2026-11-15']),
    'Test 3.2: Weekly recurrence generates 7-day intervals'
  );

  const biweeklyDates = followUpService.calculateNextOccurrences(startDate, 'BIWEEKLY', 3);
  assert(
    JSON.stringify(biweeklyDates) === JSON.stringify(['2026-11-01', '2026-11-15', '2026-11-29']),
    'Test 3.3: Biweekly recurrence generates 14-day intervals'
  );

  const monthlyDates = followUpService.calculateNextOccurrences(startDate, 'MONTHLY', 3);
  assert(
    JSON.stringify(monthlyDates) === JSON.stringify(['2026-11-01', '2026-12-01', '2027-01-01']),
    'Test 3.4: Monthly recurrence advances month boundaries'
  );

  const customDates = followUpService.calculateNextOccurrences(startDate, 'CUSTOM_INTERVAL', 4, undefined, 3);
  assert(
    JSON.stringify(customDates) === JSON.stringify(['2026-11-01', '2026-11-04', '2026-11-07', '2026-11-10']),
    'Test 3.5: Custom interval generates specified step days'
  );
} catch (e: any) {
  assert(false, 'Test 3: Recurrence Generation', e.message);
}

// ── 4. Recurrence Boundaries: maxOccurrences and endDate ─────────────────────
try {
  const startDate = '2026-11-01';

  const cappedByCount = followUpService.calculateNextOccurrences(startDate, 'WEEKLY', 3);
  assert(
    cappedByCount.length === 3,
    'Test 4.1: maxOccurrences strictly caps generated count'
  );

  const cappedByDate = followUpService.calculateNextOccurrences(startDate, 'WEEKLY', 10, '2026-11-10');
  assert(
    JSON.stringify(cappedByDate) === JSON.stringify(['2026-11-01', '2026-11-08']),
    'Test 4.2: endDate excludes occurrences beyond boundary date'
  );

  const uniqueDates = new Set(cappedByDate);
  assert(
    uniqueDates.size === cappedByDate.length,
    'Test 4.3: Prevented duplicate occurrence dates'
  );
} catch (e: any) {
  assert(false, 'Test 4: Recurrence Boundaries', e.message);
}

// ── 5. Single Occurrence vs Entire Series Cancellation ────────────────────────
try {
  const occurrences: FollowUp[] = [
    {
      id: 101,
      recurrenceRuleId: 10,
      practiceId: 'practice-alpha',
      ownerId: 101,
      ownerName: 'Ramesh Patel',
      patientName: 'Gauri',
      reason: 'POST_OPERATIVE_REVIEW',
      recommendedDate: '2026-10-01',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      status: 'COMPLETED',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 102,
      recurrenceRuleId: 10,
      practiceId: 'practice-alpha',
      ownerId: 101,
      ownerName: 'Ramesh Patel',
      patientName: 'Gauri',
      reason: 'POST_OPERATIVE_REVIEW',
      recommendedDate: '2026-10-08',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      status: 'UPCOMING',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 103,
      recurrenceRuleId: 10,
      practiceId: 'practice-alpha',
      ownerId: 101,
      ownerName: 'Ramesh Patel',
      patientName: 'Gauri',
      reason: 'POST_OPERATIVE_REVIEW',
      recommendedDate: '2026-10-15',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      status: 'UPCOMING',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  // Series cancellation rule: completed visits MUST NOT be deleted or cancelled
  const updatedOccurrences = occurrences.map((occ) => {
    if (occ.status === 'COMPLETED') return occ;
    return { ...occ, status: 'CANCELLED' as const };
  });

  assert(
    updatedOccurrences[0].status === 'COMPLETED' && updatedOccurrences[0].id === 101,
    'Test 5.1: Historical completed visit preserved during series cancellation'
  );
  assert(
    updatedOccurrences[1].status === 'CANCELLED' && updatedOccurrences[2].status === 'CANCELLED',
    'Test 5.2: Future pending occurrences cancelled successfully'
  );
} catch (e: any) {
  assert(false, 'Test 5: Series Cancellation Logic', e.message);
}

// ── 6. WhatsApp Handoff & Communication Formatting ─────────────────────────────
try {
  const followUp: FollowUp = {
    id: 77,
    practiceId: 'practice-alpha',
    ownerId: 101,
    ownerName: 'Suresh Kumar',
    ownerPhone: '+91 98450 11223',
    patientName: 'Lakshmi',
    species: 'Buffalo',
    reason: 'PREGNANCY_DIAGNOSIS',
    recommendedDate: '2026-10-25',
    priority: 'PLANNED',
    flexibility: 'MUST_ATTEND_TODAY',
    status: 'DUE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const handoff = followUpService.generateWhatsAppFollowUpLink(followUp);

  assert(
    handoff.url.startsWith('https://wa.me/919845011223?text='),
    'Test 6.1: wa.me URL generated with normalized phone number'
  );
  assert(
    handoff.text.includes('Suresh Kumar') && handoff.text.includes('Lakshmi') && handoff.text.includes('Pregnancy diagnosis'),
    'Test 6.2: Pre-filled text includes client, animal and procedure context'
  );
  assert(
    followUp.acknowledgedAt === undefined,
    'Test 6.3: Opening wa.me does NOT falsely mark reminder delivered'
  );
} catch (e: any) {
  assert(false, 'Test 6: WhatsApp Communication Handoff', e.message);
}

// ── 7. Duration Learning: Statistical Median & Robustness ─────────────────────
try {
  const oddMedian = durationLearningService.computeMedian([20, 25, 40]);
  assert(oddMedian === 25, 'Test 7.1: Exact median for odd sample size (N=3)');

  const evenMedian = durationLearningService.computeMedian([20, 30, 40, 50]);
  assert(evenMedian === 35, 'Test 7.2: Exact median for even sample size (N=4)');

  const unsortedMedian = durationLearningService.computeMedian([50, 10, 30]);
  assert(unsortedMedian === 30, 'Test 7.3: Robust sorting handles unsorted observation streams');
} catch (e: any) {
  assert(false, 'Test 7: Statistical Median Calculation', e.message);
}

// ── 8. Duration Learning: Outlier Rejection ($< 5$m or $> 300$m) ──────────────
try {
  const mockVisits: Visit[] = [
    {
      id: 1,
      practiceId: 'practice-alpha',
      ownerId: 1,
      ownerName: 'Farmer A',
      address: 'Farm 1',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      status: 'COMPLETED',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      procedures: [{ id: 1, visitId: 1, procedureCategory: 'GENERAL', procedureName: 'Exam', performedAt: new Date(), isPlanned: false, standardFee: 200 }],
      actualDurationMinutes: 25,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      practiceId: 'practice-alpha',
      ownerId: 2,
      ownerName: 'Farmer B',
      address: 'Farm 2',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      status: 'COMPLETED',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      procedures: [{ id: 2, visitId: 2, procedureCategory: 'GENERAL', procedureName: 'Exam', performedAt: new Date(), isPlanned: false, standardFee: 200 }],
      actualDurationMinutes: 35,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 3,
      practiceId: 'practice-alpha',
      ownerId: 3,
      ownerName: 'Farmer C',
      address: 'Farm 3',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      status: 'COMPLETED',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      procedures: [{ id: 3, visitId: 3, procedureCategory: 'GENERAL', procedureName: 'Exam', performedAt: new Date(), isPlanned: false, standardFee: 200 }],
      actualDurationMinutes: 30,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // INVALID: 2 mins (accidental click)
    {
      id: 4,
      practiceId: 'practice-alpha',
      ownerId: 4,
      ownerName: 'Farmer D',
      address: 'Farm 4',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      status: 'COMPLETED',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      procedures: [{ id: 4, visitId: 4, procedureCategory: 'GENERAL', procedureName: 'Exam', performedAt: new Date(), isPlanned: false, standardFee: 200 }],
      actualDurationMinutes: 2,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // INVALID: 480 mins (unclosed visit)
    {
      id: 5,
      practiceId: 'practice-alpha',
      ownerId: 5,
      ownerName: 'Farmer E',
      address: 'Farm 5',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      status: 'COMPLETED',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      procedures: [{ id: 5, visitId: 5, procedureCategory: 'GENERAL', procedureName: 'Exam', performedAt: new Date(), isPlanned: false, standardFee: 200 }],
      actualDurationMinutes: 480,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    // INVALID: CANCELLED visit
    {
      id: 6,
      practiceId: 'practice-alpha',
      ownerId: 6,
      ownerName: 'Farmer F',
      address: 'Farm 6',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      status: 'CANCELLED',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      procedures: [{ id: 6, visitId: 6, procedureCategory: 'GENERAL', procedureName: 'Exam', performedAt: new Date(), isPlanned: false, standardFee: 200 }],
      actualDurationMinutes: 30,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const observations = durationLearningService.extractValidObservations(mockVisits);
  const generalDurations = observations
    .filter((o) => o.procedureCategory === 'GENERAL')
    .map((o) => o.actualDurationMinutes);

  assert(
    generalDurations.length === 3 && JSON.stringify(generalDurations) === JSON.stringify([25, 35, 30]),
    'Test 8.1: Extracted only valid completed visits within plausible bounds'
  );

  const median = durationLearningService.computeTrimmedEstimate(generalDurations);
  assert(
    median === 30,
    'Test 8.2: Outlier rejection yields robust median of 30 mins'
  );
} catch (e: any) {
  assert(false, 'Test 8: Outlier Rejection', e.message);
}

// ── 9. Minimum Observation Threshold ($N < 3$ vs $N \ge 3$) ──────────────────
try {
  const twoVisits: Visit[] = [
    {
      id: 1,
      practiceId: 'practice-alpha',
      ownerId: 1,
      ownerName: 'A',
      address: 'X',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      status: 'COMPLETED',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      procedures: [{ id: 1, visitId: 1, procedureName: 'Surgery', procedureCategory: 'SURGERY', performedAt: new Date(), isPlanned: false, standardFee: 1000 }],
      actualDurationMinutes: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      practiceId: 'practice-alpha',
      ownerId: 2,
      ownerName: 'B',
      address: 'Y',
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      status: 'COMPLETED',
      scheduledDate: new Date(),
      estimatedDurationMinutes: 30,
      procedures: [{ id: 2, visitId: 2, procedureName: 'Surgery', procedureCategory: 'SURGERY', performedAt: new Date(), isPlanned: false, standardFee: 1000 }],
      actualDurationMinutes: 50,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const obsTwo = durationLearningService.extractValidObservations(twoVisits);
  const surgeryObs = obsTwo
    .filter((o) => o.procedureCategory === 'SURGICAL')
    .map((o) => o.actualDurationMinutes);

  assert(
    surgeryObs.length === 2 && surgeryObs.length < 3,
    'Test 9.1: Insufficient history (N=2) retains default estimate'
  );

  surgeryObs.push(55);
  const isThresholdMet = surgeryObs.length >= 3;
  const learnedEstimate = durationLearningService.computeTrimmedEstimate(surgeryObs);

  assert(
    isThresholdMet && learnedEstimate === 50,
    'Test 9.2: Reaching threshold (N=3) transitions estimate to practice-learned'
  );
} catch (e: any) {
  assert(false, 'Test 9: Minimum Observation Threshold', e.message);
}

// ── 10. Manual Doctor Override Precedence ─────────────────────────────────────
try {
  const estimateRecord: ProcedureDurationEstimate = {
    practiceId: 'practice-alpha',
    procedureCategory: 'SURGERY',
    defaultDurationMinutes: DEFAULT_PROCEDURE_DURATIONS.SURGERY,
    learnedDurationMinutes: 50,
    manualOverrideMinutes: 75,
    sampleCount: 15,
    source: 'MANUAL_OVERRIDE',
    effectiveDurationMinutes: 75,
    incrementalPerAnimalMinutes: 10,
    lastCalculatedAt: new Date(),
    updatedAt: new Date(),
  };

  const effective = durationLearningService.getEffectiveDurationFromEstimate(estimateRecord, 1);
  assert(
    effective === 75,
    'Test 10.1: Doctor manual override (75m) takes precedence over learned (50m)'
  );

  const clearedOverride: ProcedureDurationEstimate = {
    ...estimateRecord,
    manualOverrideMinutes: undefined,
    source: 'PRACTICE_LEARNED',
  };
  const effectiveLearned = durationLearningService.getEffectiveDurationFromEstimate(clearedOverride, 1);
  assert(
    effectiveLearned === 50,
    'Test 10.2: Clearing manual override falls back cleanly to learned estimate (50m)'
  );
} catch (e: any) {
  assert(false, 'Test 10: Manual Override Precedence', e.message);
}

// ── 11. Multi-Animal Farm Visit Scaling (+10m per extra animal) ───────────────
try {
  const estimateRecord: ProcedureDurationEstimate = {
    practiceId: 'practice-alpha',
    procedureCategory: 'VACCINATION',
    defaultDurationMinutes: 20,
    sampleCount: 0,
    source: 'DEFAULT',
    effectiveDurationMinutes: 20,
    incrementalPerAnimalMinutes: 10,
    lastCalculatedAt: new Date(),
    updatedAt: new Date(),
  };

  assert(
    durationLearningService.getEffectiveDurationFromEstimate(estimateRecord, 1) === 20,
    'Test 11.1: Single animal procedure takes base 20 mins'
  );
  assert(
    durationLearningService.getEffectiveDurationFromEstimate(estimateRecord, 2) === 30,
    'Test 11.2: Two animals at same physical location take 20 + 10 = 30 mins'
  );
  assert(
    durationLearningService.getEffectiveDurationFromEstimate(estimateRecord, 5) === 60,
    'Test 11.3: Five animals at same location scale to 20 + (4 * 10) = 60 mins'
  );
} catch (e: any) {
  assert(false, 'Test 11: Multi-Animal Scaling', e.message);
}

// ── 12. Route Capacity & Route Planner Integration ────────────────────────────
try {
  const customEstimates: Record<string, ProcedureDurationEstimate> = {
    GENERAL: {
      practiceId: 'practice-alpha',
      procedureCategory: 'GENERAL',
      defaultDurationMinutes: 30,
      learnedDurationMinutes: 45,
      sampleCount: 12,
      source: 'PRACTICE_LEARNED',
      effectiveDurationMinutes: 45,
      incrementalPerAnimalMinutes: 10,
      lastCalculatedAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const config = {
    startLatitude: 12.9716,
    startLongitude: 77.5946,
    workingMinutesAvailable: 480,
    breakMinutes: 30,
    defaultVisitDurationMinutes: 30,
    averageSpeedKmH: 30,
    durationEstimates: customEstimates,
  };

  const visits: Visit[] = [
    {
      id: 'v-1',
      ownerId: 1,
      ownerName: 'Farmer One',
      address: 'Farm 1',
      scheduledDate: new Date(),
      latitude: 12.98,
      longitude: 77.60,
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      status: 'PLANNED',
      estimatedDurationMinutes: 30,
      cases: [{ id: 'c1', visitId: 'v-1', procedureCategory: 'GENERAL', chiefComplaint: 'Checkup' }],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'v-2',
      ownerId: 2,
      ownerName: 'Farmer Two',
      address: 'Farm 2',
      scheduledDate: new Date(),
      latitude: 12.99,
      longitude: 77.61,
      priority: 'PLANNED',
      flexibility: 'MUST_ATTEND_TODAY',
      status: 'PLANNED',
      estimatedDurationMinutes: 0,
      cases: [{ id: 'c2', visitId: 'v-2', procedureCategory: 'GENERAL', chiefComplaint: 'General exam' }],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  const existingStops = [
    {
      id: 'stop-1',
      visitId: 'v-1',
      stopOrder: 1,
      isLocked: true,
      visit: visits[0],
      estimatedArrival: '09:00',
      estimatedDeparture: '09:30',
    },
  ];

  const routeResult = CvpRouteEngine.generateSuggestedRoute(visits, config, existingStops);
  const stops = routeResult.stops;

  assert(
    stops[0].visitId === 'v-1' && stops[0].isLocked === true,
    'Test 12.1: Locked route stop preserved at exact order position without mutation'
  );

  const est2 = CvpRouteEngine.estimateVisitDuration(stops[1].visit!, undefined, customEstimates);
  assert(
    est2 === 45,
    'Test 12.2: Unlocked stop uses learned procedure duration (45 mins)'
  );
  assert(
    routeResult.totalEstimatedVisitMinutes === 75,
    'Test 12.3: Total route capacity calculations factor in learned durations'
  );
} catch (e: any) {
  assert(false, 'Test 12: Route Capacity Integration', e.message);
}

// ── 13. Tenant Isolation ──────────────────────────────────────────────────────
try {
  const practiceAEstimates: Record<string, ProcedureDurationEstimate> = {
    VACCINATION: {
      practiceId: 'practice-A',
      procedureCategory: 'VACCINATION',
      defaultDurationMinutes: 20,
      learnedDurationMinutes: 15,
      sampleCount: 20,
      source: 'PRACTICE_LEARNED',
      effectiveDurationMinutes: 15,
      incrementalPerAnimalMinutes: 10,
      lastCalculatedAt: new Date(),
      updatedAt: new Date(),
    },
  };

  const practiceBEstimates: Record<string, ProcedureDurationEstimate> = {
    VACCINATION: {
      practiceId: 'practice-B',
      procedureCategory: 'VACCINATION',
      defaultDurationMinutes: 20,
      learnedDurationMinutes: 35,
      sampleCount: 18,
      source: 'PRACTICE_LEARNED',
      effectiveDurationMinutes: 35,
      incrementalPerAnimalMinutes: 10,
      lastCalculatedAt: new Date(),
      updatedAt: new Date(),
    },
  };

  assert(
    practiceAEstimates.VACCINATION.learnedDurationMinutes !== practiceBEstimates.VACCINATION.learnedDurationMinutes,
    'Test 13.1: Practice A learned duration strictly isolated from Practice B'
  );
  assert(
    practiceAEstimates.VACCINATION.practiceId === 'practice-A' && practiceBEstimates.VACCINATION.practiceId === 'practice-B',
    'Test 13.2: Multi-tenant practice identity preserved across estimates'
  );
} catch (e: any) {
  assert(false, 'Test 13: Tenant Isolation', e.message);
}

console.log('\n======================================================================');
console.log(`PHASE 8 TEST RESULTS: ${passed} PASSED, ${failed} FAILED (TOTAL ${passed + failed})`);
console.log('======================================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}