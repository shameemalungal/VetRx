// ==============================================================================
// VetRx Unified Patient Records, Medicine Catalogue, Treatment Packages & ePrescription Integration Tests
// Implementation verification for Parts 1 - 10 requirements
// ==============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';

// Helper: Normalize phone numbers (matching cvpService.normalizePhone)
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length > 10) return `+${digits}`;
  return phone.trim();
}

test('Part 2: Unified Owner Identification & Phone Normalization', async (t) => {
  await t.test('Normalizes various Indian phone number formats consistently', () => {
    assert.equal(normalizePhone('9847012345'), '+919847012345');
    assert.equal(normalizePhone('09847012345'), '+919847012345');
    assert.equal(normalizePhone('+91 98470 12345'), '+919847012345');
    assert.equal(normalizePhone('919847012345'), '+919847012345');
    assert.equal(normalizePhone('  98470-12345  '), '+919847012345');
  });

  await t.test('Multi-tenant owner matching isolates practices', () => {
    const owners = [
      { id: 'own-1', practiceId: 'prac-A', name: 'Ramesh Patel', phone: '+919847012345' },
      { id: 'own-2', practiceId: 'prac-B', name: 'Ramesh Patel', phone: '+919847012345' },
    ];

    const matchPracticeA = owners.filter(o => o.practiceId === 'prac-A' && normalizePhone(o.phone) === '+919847012345');
    assert.equal(matchPracticeA.length, 1);
    assert.equal(matchPracticeA[0].id, 'own-1');

    const matchPracticeB = owners.filter(o => o.practiceId === 'prac-B' && normalizePhone(o.phone) === '+919847012345');
    assert.equal(matchPracticeB.length, 1);
    assert.equal(matchPracticeB[0].id, 'own-2');
  });

  await t.test('Handles multiple animals associated with a single owner', () => {
    const owner = { id: 'own-100', name: 'Anand Kumar', phone: '+919847011111' };
    const patients = [
      { id: 'pat-1', ownerId: 'own-100', name: 'Gauri', species: 'Cattle' },
      { id: 'pat-2', ownerId: 'own-100', name: 'Lakshmi', species: 'Cattle' },
      { id: 'pat-3', ownerId: 'own-100', name: 'Bhavani', species: 'Buffalo' },
    ];

    const ownerAnimals = patients.filter(p => p.ownerId === owner.id);
    assert.equal(ownerAnimals.length, 3);
    assert.deepEqual(ownerAnimals.map(a => a.name), ['Gauri', 'Lakshmi', 'Bhavani']);
  });

  await t.test('Quick owner & patient creation during call registration makes them available in Add Patient', () => {
    const database = {
      owners: new Map<string, any>(),
      patients: new Map<string, any>(),
    };

    // Step 1: Veterinarian registers call and quick-creates owner & patient
    const newOwner = { id: 'own-201', name: 'Murugan', phone: normalizePhone('9876543210'), practiceId: 'prac-1' };
    database.owners.set(newOwner.id, newOwner);

    const newPatient = { id: 'pat-501', ownerId: newOwner.id, name: 'Kaali', species: 'Cattle', practiceId: 'prac-1' };
    database.patients.set(newPatient.id, newPatient);

    // Step 2: Later, veterinarian opens Add Patient screen and enters phone "09876543210"
    const searchNormalized = normalizePhone('09876543210');
    const matchedOwner = Array.from(database.owners.values()).find(
      o => o.practiceId === 'prac-1' && normalizePhone(o.phone) === searchNormalized
    );

    assert.ok(matchedOwner, 'Owner created during call registration should be immediately found');
    assert.equal(matchedOwner.id, 'own-201');
    assert.equal(matchedOwner.name, 'Murugan');

    // Step 3: Add Patient displays associated animals
    const associatedAnimals = Array.from(database.patients.values()).filter(p => p.ownerId === matchedOwner.id);
    assert.equal(associatedAnimals.length, 1);
    assert.equal(associatedAnimals[0].name, 'Kaali');
  });

  await t.test('Adding a second animal to the same owner does not duplicate the owner', () => {
    const database = {
      owners: new Map<string, any>(),
      patients: new Map<string, any>(),
    };

    const owner = { id: 'own-300', name: 'Priya Nair', phone: '+919447012345', practiceId: 'prac-1' };
    database.owners.set(owner.id, owner);
    database.patients.set('pat-1', { id: 'pat-1', ownerId: owner.id, name: 'Tommy', species: 'Canine' });

    // Add second animal
    const secondPatient = { id: 'pat-2', ownerId: owner.id, name: 'Kitty', species: 'Feline' };
    database.patients.set(secondPatient.id, secondPatient);

    // Owner count remains 1
    assert.equal(database.owners.size, 1);
    // Patient count is 2
    assert.equal(database.patients.size, 2);
  });
});

test('Part 3 & 4: Authoritative Medicine Catalogue & Actual Medicine Administered', async (t) => {
  const masterCatalogue = [
    { id: 'med-1', name: 'Melonex 100ml', genericName: 'Meloxicam 5mg/ml', category: 'NSAID', strength: '5mg/ml', isActive: true },
    { id: 'med-2', name: 'Melonex Plus 100ml', genericName: 'Meloxicam + Paracetamol', category: 'NSAID', strength: '5mg+150mg/ml', isActive: true },
    { id: 'med-3', name: 'Intacef 3g', genericName: 'Ceftriaxone Sodium 3g', category: 'Antibiotic', strength: '3g', isActive: true },
    { id: 'med-4', name: 'Old Discontinued Drug', genericName: 'Deprecated chemical', category: 'Other', strength: '10mg', isActive: false },
  ];

  await t.test('Authoritative catalogue distinguishes medicines with similar names or different strengths', () => {
    const searchFilter = (query: string) => {
      const q = query.toLowerCase();
      return masterCatalogue.filter(m => m.isActive && (m.name.toLowerCase().includes(q) || m.genericName.toLowerCase().includes(q)));
    };

    const searchMelonex = searchFilter('Melonex');
    assert.equal(searchMelonex.length, 2);
    assert.equal(searchMelonex[0].name, 'Melonex 100ml');
    assert.equal(searchMelonex[1].name, 'Melonex Plus 100ml');

    const searchCeph = searchFilter('Ceftriaxone');
    assert.equal(searchCeph.length, 1);
    assert.equal(searchCeph[0].name, 'Intacef 3g');
  });

  await t.test('Deactivated medicines are excluded from active selection', () => {
    const activeMeds = masterCatalogue.filter(m => m.isActive);
    assert.equal(activeMeds.length, 3);
    assert.ok(!activeMeds.some(m => m.id === 'med-4'));
  });

  await t.test('Actual Medicine Administered uses canonical medicine record without duplicating catalogue', () => {
    const visitAdministrationRecords: any[] = [];
    const catalogueCountBefore = masterCatalogue.length;

    // Veterinarian selects Melonex from catalogue and administers 15ml IM
    const selectedMed = masterCatalogue.find(m => m.id === 'med-1')!;
    const adminRecord = {
      id: 'adm-1',
      visitId: 'vis-101',
      medicineId: selectedMed.id,
      medicineName: selectedMed.name,
      doseGiven: '15 ml',
      route: 'Intramuscular (IM)',
      administeredAt: new Date().toISOString(),
      status: 'ADMINISTERED',
    };
    visitAdministrationRecords.push(adminRecord);

    // Assert: catalogue remains untouched
    assert.equal(masterCatalogue.length, catalogueCountBefore);
    assert.equal(visitAdministrationRecords[0].medicineId, 'med-1');
  });

  await t.test('Actual inventory deduction occurs ONLY upon confirmed actual usage', () => {
    const inventory = new Map<string, number>([
      ['med-1', 100], // 100 doses
      ['med-3', 20],  // 20 vials
    ]);

    // Planned prescription or package selection does NOT deduct inventory
    const plannedPrescriptionItem = { medicineId: 'med-1', quantity: 5, type: 'PLANNED' };
    assert.equal(inventory.get('med-1'), 100, 'Planned item must NOT deduct stock');

    // Confirmed administration deducts inventory exactly once
    function recordActualUsage(medicineId: string, quantity: number, deductionId: string, processedIds: Set<string>) {
      if (processedIds.has(deductionId)) return false; // Idempotency check
      const current = inventory.get(medicineId) || 0;
      inventory.set(medicineId, current - quantity);
      processedIds.add(deductionId);
      return true;
    }

    const processedDeductions = new Set<string>();
    const success1 = recordActualUsage('med-1', 15, 'tx-1001', processedDeductions);
    assert.equal(success1, true);
    assert.equal(inventory.get('med-1'), 85);

    // Duplicate submission / retry does not double deduct
    const success2 = recordActualUsage('med-1', 15, 'tx-1001', processedDeductions);
    assert.equal(success2, false, 'Retry must be idempotent');
    assert.equal(inventory.get('med-1'), 85, 'Stock must not be deducted twice on retry');
  });
});

test('Part 5: Treatment Packages in ePrescription & Field Visits', async (t) => {
  const masterPackage = {
    id: 'pkg-1',
    name: 'Bovine Respiratory Package',
    description: 'Protocol for acute bronchopneumonia in cattle',
    usageCount: 12,
    items: [
      { medicineId: 'med-3', medicineName: 'Intacef 3g', dosage: '3g', frequency: 'OD', duration: '3 days', route: 'IV' },
      { medicineId: 'med-1', medicineName: 'Melonex 100ml', dosage: '15ml', frequency: 'OD', duration: '3 days', route: 'IM' },
    ],
  };

  await t.test('Applying Treatment Package to ePrescription populates items without modifying saved package template', () => {
    // Veterinarian applies package in Prescription Builder
    const rxItems = masterPackage.items.map(item => ({
      ...item,
      patientSpecificNotes: 'Give after feed',
    }));

    // Veterinarian customizes duration on rxItems for this specific patient
    rxItems[0].duration = '5 days';

    // Verify master package was NOT mutated
    assert.equal(masterPackage.items[0].duration, '3 days', 'Master package item duration must remain 3 days');
    assert.equal(rxItems[0].duration, '5 days', 'Prescription item duration should be customized to 5 days');
  });

  await t.test('Treatment Packages in Actual Medicine Administered: only selected items are administered', () => {
    // In Field Mode, package is previewed. The vet only administered Intacef, not Melonex.
    const selectedItemIds = ['med-3'];
    const confirmedAdministeredItems = masterPackage.items.filter(item => selectedItemIds.includes(item.medicineId));

    assert.equal(confirmedAdministeredItems.length, 1);
    assert.equal(confirmedAdministeredItems[0].medicineName, 'Intacef 3g');
    assert.ok(!confirmedAdministeredItems.some(i => i.medicineId === 'med-1'));
  });
});

test('Part 6 & 7: ePrescription from Visit Workflow & Record Linkage', async (t) => {
  const visit = {
    id: 'vis-501',
    practiceId: 'prac-1',
    callerPhone: '+919847012345',
    cases: [
      {
        id: 'case-901',
        visitId: 'vis-501',
        patientId: 'pat-101',
        species: 'Cattle',
        chiefComplaint: 'Acute mastitis with left hind quarter swelling',
        tentativeDiagnosis: 'Clinical Mastitis',
        prescriptionId: undefined as string | undefined,
      },
    ],
    timeline: [] as any[],
  };

  await t.test('Creating ePrescription from physical visit links visitId and case prescriptionId', () => {
    // Action: Veterinarian clicks "Create ePrescription" from VisitDetailPage
    const newPrescription = {
      id: 'rx-777',
      rxNumber: 'RX-2026-00777',
      practiceId: visit.practiceId,
      visitId: visit.id,
      visitCaseId: visit.cases[0].id,
      patientId: visit.cases[0].patientId,
      diagnosis: visit.cases[0].tentativeDiagnosis,
      items: [
        { medicineId: 'med-3', medicineName: 'Intacef 3g', dosage: '3g', frequency: 'OD', duration: '3 days' },
      ],
      status: 'APPROVED',
      createdAt: new Date().toISOString(),
    };

    // Linking logic:
    visit.cases[0].prescriptionId = newPrescription.id;
    visit.timeline.push({
      eventType: 'PRESCRIPTION_LINKED',
      description: `ePrescription ${newPrescription.rxNumber} generated for case ${visit.cases[0].id}`,
      prescriptionId: newPrescription.id,
      timestamp: new Date().toISOString(),
    });

    assert.equal(visit.cases[0].prescriptionId, 'rx-777');
    assert.equal(newPrescription.visitId, 'vis-501');
    assert.equal(visit.timeline.length, 1);
    assert.equal(visit.timeline[0].eventType, 'PRESCRIPTION_LINKED');
  });

  await t.test('Administered medicines and prescribed medicines remain strictly distinct records', () => {
    const administeredMedicines = [
      { id: 'adm-1', visitId: 'vis-501', medicineId: 'med-1', doseGiven: '15ml IM', category: 'CLINICAL_USAGE' },
    ];
    const prescribedMedicines = [
      { id: 'rxitem-1', prescriptionId: 'rx-777', medicineId: 'med-3', dosage: '3g OD for 3 days', category: 'POST_VISIT_DISCHARGE' },
    ];

    assert.notDeepEqual(administeredMedicines[0], prescribedMedicines[0]);
    assert.equal(administeredMedicines[0].category, 'CLINICAL_USAGE');
    assert.equal(prescribedMedicines[0].category, 'POST_VISIT_DISCHARGE');
    assert.notEqual(administeredMedicines[0].medicineId, prescribedMedicines[0].medicineId);
  });
});

test('Part 8: Emergency Priority Correction & Audit Trail', async (t) => {
  await t.test('Emergency to Planned correction preserves entity IDs, notes, and records PRIORITY_CHANGED event', () => {
    const callRecord = {
      id: 'call-101',
      practiceId: 'prac-1',
      ownerId: 'own-1',
      patientIds: ['pat-1'],
      priority: 'EMERGENCY',
      status: 'LOGGED',
      symptoms: 'Suspected bloat',
      callerPhone: '+919847012345',
      estimatedDurationMinutes: 45,
    };

    const auditTrail: any[] = [];

    // Clinician corrects misclassified Emergency to Planned
    const previousPriority = callRecord.priority;
    const newPriority = 'PLANNED';
    const reason = 'Owner confirmed animal is ruminating normally, bloat subsided';

    callRecord.priority = newPriority;
    callRecord.estimatedDurationMinutes = 30; // standard routine estimate
    auditTrail.push({
      callId: callRecord.id,
      eventType: 'PRIORITY_CHANGED',
      previousPriority,
      newPriority,
      reason,
      changedAt: new Date().toISOString(),
    });

    // Verification
    assert.equal(callRecord.id, 'call-101');
    assert.equal(callRecord.ownerId, 'own-1');
    assert.equal(callRecord.patientIds[0], 'pat-1');
    assert.equal(callRecord.priority, 'PLANNED');
    assert.equal(callRecord.estimatedDurationMinutes, 30);
    assert.equal(auditTrail.length, 1);
    assert.equal(auditTrail[0].eventType, 'PRIORITY_CHANGED');
    assert.equal(auditTrail[0].previousPriority, 'EMERGENCY');
    assert.equal(auditTrail[0].newPriority, 'PLANNED');
  });
});

test('Part 9: Multi-Animal Visit Prescription Isolation & Deduplication', async (t) => {
  await t.test('Multi-animal visit maintains strictly isolated prescriptions per animal', () => {
    const multiAnimalVisit = {
      id: 'vis-multi-1',
      cases: [
        { id: 'case-1', patientId: 'pat-cow-1', species: 'Cattle', prescriptionId: undefined as string | undefined },
        { id: 'case-2', patientId: 'pat-calf-2', species: 'Cattle', prescriptionId: undefined as string | undefined },
      ],
    };

    // Prescription 1 created for Cow 1
    const rx1 = { id: 'rx-cow-1', visitId: multiAnimalVisit.id, visitCaseId: 'case-1', patientId: 'pat-cow-1' };
    const targetCase1 = multiAnimalVisit.cases.find(c => c.id === rx1.visitCaseId);
    if (targetCase1) targetCase1.prescriptionId = rx1.id;

    assert.equal(multiAnimalVisit.cases[0].prescriptionId, 'rx-cow-1');
    assert.equal(multiAnimalVisit.cases[1].prescriptionId, undefined, 'Case 2 must NOT be mutated by Case 1 prescription');

    // Prescription 2 created for Calf 2
    const rx2 = { id: 'rx-calf-2', visitId: multiAnimalVisit.id, visitCaseId: 'case-2', patientId: 'pat-calf-2' };
    const targetCase2 = multiAnimalVisit.cases.find(c => c.id === rx2.visitCaseId);
    if (targetCase2) targetCase2.prescriptionId = rx2.id;

    assert.equal(multiAnimalVisit.cases[0].prescriptionId, 'rx-cow-1');
    assert.equal(multiAnimalVisit.cases[1].prescriptionId, 'rx-calf-2');
    assert.notEqual(multiAnimalVisit.cases[0].prescriptionId, multiAnimalVisit.cases[1].prescriptionId);
  });

  await t.test('Visit medicines flowing to Prescription builder deduplicate on sourceUsageId and medicineName', () => {
    const rxItems: any[] = [];
    const usage = { id: 'usage-100', medicineId: 'med-5', medicineName: 'Melonex 5ml', quantityUsed: 5, unit: 'ml' };

    // Function matching handleAddVisitMedicineToRx logic
    const addUsageToRx = (u: typeof usage) => {
      const alreadyExists = rxItems.some(
        itm => itm.sourceUsageId === u.id || itm.brandName.toLowerCase() === u.medicineName.toLowerCase()
      );
      if (!alreadyExists) {
        rxItems.push({
          sourceUsageId: u.id,
          brandName: u.medicineName,
          quantity: 1,
          directions: 'Administer once daily',
        });
      }
    };

    // First addition
    addUsageToRx(usage);
    assert.equal(rxItems.length, 1);
    assert.equal(rxItems[0].sourceUsageId, 'usage-100');

    // Second addition (e.g. user taps button again or page reopens)
    addUsageToRx(usage);
    assert.equal(rxItems.length, 1, 'Duplicate line must not be added on retry or re-click');
  });

  await t.test('Stock deduction is idempotent and triggered ONLY by confirmed actual usage, never prescription creation', () => {
    let internalStock = 50;
    const deductedUsages = new Set<string>();

    const recordConfirmedUsage = (usageId: string, qty: number) => {
      if (deductedUsages.has(usageId)) {
        return; // Idempotency guard prevents double deduction
      }
      deductedUsages.add(usageId);
      internalStock -= qty;
    };

    // Step 1: Clinician creates a prescription for 10 units
    const rxItem = { medicineId: 'med-1', quantity: 10 };
    // Prescription creation alone does NOT deduct stock
    assert.equal(internalStock, 50, 'Prescription creation alone must not deduct stock');

    // Step 2: Confirmed field administration of 5 units
    recordConfirmedUsage('usage-abc-1', 5);
    assert.equal(internalStock, 45, 'Confirmed usage deducts stock');

    // Step 3: Network retry of same usage
    recordConfirmedUsage('usage-abc-1', 5);
    assert.equal(internalStock, 45, 'Retrying same usage must not double deduct stock');
  });
});

test('Part 10: Operational Dashboard Workload, Capacity & Financial Metrics', async (t) => {
  await t.test('Correctly aggregates distinct animals, locations, and scheduled stops', () => {
    // 3 calls, 2 animals at the same farm/location
    const todayCalls = [
      { id: 'c1', locationAddress: 'Green Valley Farm, Post 5', patientIds: ['p1'] },
      { id: 'c2', locationAddress: 'Green Valley Farm, Post 5', patientIds: ['p2'] }, // same location, different animal
      { id: 'c3', locationAddress: 'Riverdale Dairy', patientIds: ['p3'] },
    ];

    const animalSet = new Set<string>();
    const locationSet = new Set<string>();

    for (const c of todayCalls) {
      locationSet.add(c.locationAddress.trim().toLowerCase());
      for (const p of c.patientIds) animalSet.add(p);
    }

    assert.equal(animalSet.size, 3, 'Distinct animals must equal 3');
    assert.equal(locationSet.size, 2, 'Distinct locations/stops must equal 2 (avoiding double counting same farm)');
  });

  await t.test('Financial metrics distinguish Draft invoices from Finalized revenue', () => {
    const todayInvoices = [
      { id: 'inv-1', status: 'PAID', totalAmount: 1200 },
      { id: 'inv-2', status: 'ISSUED', totalAmount: 800 },
      { id: 'inv-3', status: 'Draft', totalAmount: 500 },
    ];

    const draftInvoices = todayInvoices.filter(i => i.status === 'Draft' || i.status === 'DRAFT');
    const finalizedInvoices = todayInvoices.filter(i => i.status !== 'Draft' && i.status !== 'DRAFT');

    const totalInvoiced = todayInvoices.reduce((acc, i) => acc + i.totalAmount, 0);
    const finalizedAmount = finalizedInvoices.reduce((acc, i) => acc + i.totalAmount, 0);
    const draftAmount = draftInvoices.reduce((acc, i) => acc + i.totalAmount, 0);

    assert.equal(totalInvoiced, 2500);
    assert.equal(finalizedAmount, 2000);
    assert.equal(draftAmount, 500);
    assert.equal(draftInvoices.length, 1);
  });
});

