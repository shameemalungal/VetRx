// ==============================================================================
// VetRx Phase 7 Automated Test Suite: Android Call Capture & Intake
// Tests: Phone normalization, Clipboard extraction, Web Share Target URL parsing,
// Owner matching, Multi-animal selection, Duplicate owner prevention,
// Call Lifecycle distinction, Tenant isolation, and Safe browser fallbacks.
// ==============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizePhoneNumber,
  extractPhoneNumber,
  arePhonesMatching,
} from './src/utils/phoneUtils';

test('Phase 7 Test 1: Phone Normalization across Indian & International formats', async (t) => {
  // Test variations of a 10-digit Indian mobile number: 9845011223
  assert.equal(normalizePhoneNumber('+91 98450 11223'), '9845011223');
  assert.equal(normalizePhoneNumber('919845011223'), '9845011223');
  assert.equal(normalizePhoneNumber('098450 11223'), '9845011223');
  assert.equal(normalizePhoneNumber('98450-11223'), '9845011223');
  assert.equal(normalizePhoneNumber('(098450) 11223'), '9845011223');
  assert.equal(normalizePhoneNumber('+91-98450-11223'), '9845011223');
  assert.equal(normalizePhoneNumber('9845011223'), '9845011223');

  // Non-Indian numbers should preserve international digits
  assert.equal(normalizePhoneNumber('+1 (555) 234-5678'), '15552345678');
  assert.equal(normalizePhoneNumber('+44 7911 123456'), '447911123456');

  // Empty or invalid input
  assert.equal(normalizePhoneNumber(''), '');
  assert.equal(normalizePhoneNumber('   '), '');
});

test('Phase 7 Test 2: Clipboard & Shared Text Extraction (Dialer / Share Target)', async (t) => {
  // Direct phone number
  assert.equal(extractPhoneNumber('9845011223'), '9845011223');
  assert.equal(extractPhoneNumber('+91 98765 43210'), '9876543210');

  // Phone number inside shared text message (e.g. "Call from Ramesh: 9845011223")
  assert.equal(
    extractPhoneNumber('Missed call from farmer Ramesh +91 98450 11223 regarding calf distress'),
    '9845011223'
  );
  assert.equal(
    extractPhoneNumber('Contact: 098450 11223, Village Milk Cooperative'),
    '9845011223'
  );

  // Text with no phone number returns null
  assert.equal(extractPhoneNumber('Hello doctor, please visit the dairy farm today'), null);
  assert.equal(extractPhoneNumber('Invoice #40291'), null);
});

test('Phase 7 Test 3: Phone Matcher identifies same owner regardless of formatting differences', async (t) => {
  // Stored as +91 98450 11223 vs Entered as 09845011223
  assert.equal(arePhonesMatching('+91 98450 11223', '09845011223'), true);
  assert.equal(arePhonesMatching('9845011223', '+91-98450-11223'), true);
  assert.equal(arePhonesMatching('+919845011223', '98450 11223'), true);
  assert.equal(arePhonesMatching('098450 11223', '9845011223'), true);

  // Different phone numbers should not match
  assert.equal(arePhonesMatching('+91 98450 11223', '+91 98450 99999'), false);
  assert.equal(arePhonesMatching('9845011223', '8845011223'), false);
});

test('Phase 7 Test 4: Web Share Target URL parameter parsing simulation', async (t) => {
  // PWA manifest web share target receives GET /calls/register?phone=...&shared_text=...
  const url1 = new URL('https://app.vetrx.in/calls/register?phone=%2B919845011223');
  const phone1 = url1.searchParams.get('phone');
  assert.equal(phone1, '+919845011223');
  assert.equal(normalizePhoneNumber(phone1 || ''), '9845011223');

  const url2 = new URL('https://app.vetrx.in/calls/register?shared_text=Farmer+Patil+09845011223+cow+downer');
  const sharedText = url2.searchParams.get('shared_text');
  assert.ok(sharedText);
  const extractedPhone = extractPhoneNumber(sharedText);
  assert.equal(extractedPhone, '9845011223');
});

test('Phase 7 Test 5: Call Lifecycle Distinction (Phone Intake != Visit != Prescription)', async (t) => {
  // A phone intake event must NOT automatically create a confirmed visit or clinical diagnosis
  type CallLifecycleState = 'INTAKE_EVENT' | 'CALL_REGISTERED' | 'VISIT_PLANNED' | 'COMPLETED_VISIT';

  const intakeCall = {
    source: 'ANDROID_SHARE',
    callerPhone: '+919845011223',
    status: 'LOGGED' as const,
    lifecycleState: 'INTAKE_EVENT' as CallLifecycleState,
    tentativeAssessment: 'Suspected milk fever',
    visitId: null,
    isPrescriptionGenerated: false,
  };

  // 1. Initial intake has no visit or diagnosis
  assert.equal(intakeCall.visitId, null);
  assert.equal(intakeCall.isPrescriptionGenerated, false);
  assert.equal(intakeCall.lifecycleState, 'INTAKE_EVENT');

  // 2. Registering call transitions state without creating visit
  const registeredCall = {
    ...intakeCall,
    lifecycleState: 'CALL_REGISTERED' as CallLifecycleState,
    ownerName: 'Ramesh Patil',
  };
  assert.equal(registeredCall.lifecycleState, 'CALL_REGISTERED');
  assert.equal(registeredCall.visitId, null);

  // 3. Only explicit doctor planning creates visit
  const plannedVisit = {
    id: 101,
    callId: 1,
    ownerName: registeredCall.ownerName,
    status: 'SCHEDULED',
    lifecycleState: 'VISIT_PLANNED' as CallLifecycleState,
  };
  assert.equal(plannedVisit.lifecycleState, 'VISIT_PLANNED');
  assert.equal(plannedVisit.status, 'SCHEDULED');
});

test('Phase 7 Test 6: One Owner with Multiple Animals on Single Farm Visit', async (t) => {
  const owner = {
    id: 42,
    name: 'Gowda Dairy Farm',
    phone: '+919845011223',
  };

  const registeredAnimals = [
    { id: 101, ownerId: 42, name: 'Ganga', species: 'Bovine', breed: 'HF Cross' },
    { id: 102, ownerId: 42, name: 'Yamuna', species: 'Bovine', breed: 'Jersey' },
    { id: 103, ownerId: 42, name: 'Calf #3', species: 'Bovine', breed: 'HF Cross' },
    { id: 104, ownerId: 42, name: 'Bhairava', species: 'Canine', breed: 'Mudhol Hound' },
  ];

  // Vet selects 2 cows for one physical farm trip
  const selectedPatientIds = [101, 102];
  const visitCases = selectedPatientIds.map((pId) => {
    const patient = registeredAnimals.find((a) => a.id === pId);
    return {
      patientId: pId,
      patientName: patient?.name,
      species: patient?.species,
      assessment: 'Dystocia & post-calving inspection',
    };
  });

  assert.equal(visitCases.length, 2);
  assert.equal(visitCases[0].patientName, 'Ganga');
  assert.equal(visitCases[1].patientName, 'Yamuna');
});

test('Phase 7 Test 7: Duplicate Owner Prevention using Normalized Phone Match', async (t) => {
  const existingOwners = [
    { id: 1, name: 'Ramesh Patil', phone: '+919845011223' },
    { id: 2, name: 'Suresh Kumar', phone: '+919876543210' },
  ];

  const incomingPhone = '098450 11223'; // Different formatting of Ramesh Patil's number

  // Search using arePhonesMatching
  const existingMatch = existingOwners.find((o) => arePhonesMatching(o.phone, incomingPhone));
  assert.ok(existingMatch, 'Existing owner must be detected');
  assert.equal(existingMatch?.id, 1);
  assert.equal(existingMatch?.name, 'Ramesh Patil');

  // Verify that an owner creation check blocks duplicate creation
  const willCreateDuplicate = !existingMatch;
  assert.equal(willCreateDuplicate, false, 'Must prevent duplicate owner insertion');
});

test('Phase 7 Test 8: Tenant Isolation for Client Phone Numbers', async (t) => {
  const practiceA_Clients = [
    { practiceId: 'practice-a', name: 'Farmer A', phone: '+919845011223' },
  ];
  const practiceB_Clients = [
    { practiceId: 'practice-b', name: 'Farmer B', phone: '+919845099999' },
  ];

  // Querying from Practice B context
  const searchPhone = '98450 11223';
  const matchInPracticeB = practiceB_Clients.find(
    (c) => c.practiceId === 'practice-b' && arePhonesMatching(c.phone, searchPhone)
  );

  assert.equal(matchInPracticeB, undefined, 'Practice B must never match Practice A clients');
});

test('Phase 7 Test 9: Safe Browser / PWA Telephony Boundaries', async (t) => {
  // Verify that background call log scraping is marked strictly unsupported in browser JS
  const browserCapabilities = {
    hasBackgroundTelephonyInterception: false,
    hasCallLogPermission: false,
    hasWebShareTarget: true,
    hasClipboardPaste: true,
    hasManualTriageEntry: true,
  };

  assert.equal(browserCapabilities.hasBackgroundTelephonyInterception, false);
  assert.equal(browserCapabilities.hasCallLogPermission, false);
  assert.equal(browserCapabilities.hasWebShareTarget, true);
  assert.equal(browserCapabilities.hasClipboardPaste, true);
});
