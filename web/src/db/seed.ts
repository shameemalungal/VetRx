// =============================================================
// VetRx — Demo seed data
// Realistic veterinary data as specified in the requirements.
// Runs once on first launch; never re-runs on reload.
// =============================================================

import { db } from './schema';

export async function seed(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.practitioners,
      db.organisations,
      db.owners,
      db.patients,
      db.medicines,
      db.prescriptions,
      db.prescriptionItems,
      db.treatmentPackages,
      db.treatmentPackageItems,
      db.invoices,
      db.invoiceItems,
      db.auditEvents,
    ],
    async () => {
      const now = new Date();

      // ── Practitioner ────────────────────────────────────────
      const practitionerId = await db.practitioners.add({
        name: 'Dr. Sarah Jenkins',
        registrationNumber: 'KVC-84920-A',
        qualifications: 'BVSc, MVSc (Surgery)',
        phone: '+91 98765 43210',
        email: 'sarah.jenkins@vetrx.in',
        address: '12, MG Road, Bengaluru, Karnataka 560001',
        createdAt: now,
        updatedAt: now,
      });

      // Note: no Organisation seeded → tests the "no clinic" path

      // ── Owners ──────────────────────────────────────────────
      const ahmedId = await db.owners.add({
        name: 'Ahmed Kumar',
        phone: '+1 555-019-2831',
        email: 'ahmed.kumar@email.com',
        address: '42, Park Street, Bengaluru',
        createdAt: now,
        updatedAt: now,
      });
      const priyaId = await db.owners.add({
        name: 'Priya Nair',
        phone: '+91 99887 76655',
        email: 'priya.nair@email.com',
        createdAt: now,
        updatedAt: now,
      });
      const rahulId = await db.owners.add({
        name: 'Rahul Menon',
        phone: '+91 94433 22110',
        email: 'rahul.menon@email.com',
        createdAt: now,
        updatedAt: now,
      });

      // ── Patients ─────────────────────────────────────────────
      const brunoId = await db.patients.add({
        ownerId: ahmedId as number,
        name: 'Bruno',
        species: 'Canine',
        breed: 'Labrador Retriever',
        sex: 'Male (Intact)',
        ageNote: '4 years',
        weightKg: 24.0,
        createdAt: now,
        updatedAt: now,
      });
      const miloId = await db.patients.add({
        ownerId: priyaId as number,
        name: 'Milo',
        species: 'Feline',
        breed: 'Domestic Shorthair',
        sex: 'Male (Intact)',
        ageNote: '2 years',
        weightKg: 4.2,
        createdAt: now,
        updatedAt: now,
      });
      const lunaId = await db.patients.add({
        ownerId: rahulId as number,
        name: 'Luna',
        species: 'Canine',
        breed: 'Golden Retriever',
        sex: 'Female (Intact)',
        ageNote: '3 years',
        weightKg: 28.0,
        createdAt: now,
        updatedAt: now,
      });

      // ── Medicines ─────────────────────────────────────────────
      const amoxId = await db.medicines.add({
        brandName: 'Amoxicillin 500mg',
        genericName: 'Amoxicillin',
        presentation: 'Tablet',
        strengthVolume: '500mg',
        createdAt: now,
        updatedAt: now,
      });
      const posatexId = await db.medicines.add({
        brandName: 'Posatex Drops 15ml',
        genericName: 'Orbifloxacin / Mometasone / Posaconazole',
        presentation: 'Ear Drops',
        strengthVolume: '15ml',
        createdAt: now,
        updatedAt: now,
      });
      const metronId = await db.medicines.add({
        brandName: 'Metronidazole 250mg',
        genericName: 'Metronidazole',
        presentation: 'Tablet',
        strengthVolume: '250mg',
        createdAt: now,
        updatedAt: now,
      });
      const ondanId = await db.medicines.add({
        brandName: 'Ondansetron 4mg',
        genericName: 'Ondansetron',
        presentation: 'Tablet',
        strengthVolume: '4mg',
        createdAt: now,
        updatedAt: now,
      });
      const probioId = await db.medicines.add({
        brandName: 'Fortiflora Probiotic',
        genericName: 'Enterococcus faecium',
        presentation: 'Sachet',
        strengthVolume: '1g',
        createdAt: now,
        updatedAt: now,
      });
      const cephalexinId = await db.medicines.add({
        brandName: 'Cephalexin 500mg',
        genericName: 'Cephalexin',
        presentation: 'Capsule',
        strengthVolume: '500mg',
        createdAt: now,
        updatedAt: now,
      });
      const apoquelId = await db.medicines.add({
        brandName: 'Apoquel 16mg',
        genericName: 'Oclacitinib',
        presentation: 'Tablet',
        strengthVolume: '16mg',
        createdAt: now,
        updatedAt: now,
      });
      const chlorhexId = await db.medicines.add({
        brandName: 'Chlorhexidine Wash 250ml',
        genericName: 'Chlorhexidine Gluconate 2%',
        presentation: 'Shampoo',
        strengthVolume: '250ml',
        createdAt: now,
        updatedAt: now,
      });
      const bravectoId = await db.medicines.add({
        brandName: 'Bravecto 1000mg',
        genericName: 'Fluralaner',
        presentation: 'Chewable Tablet',
        strengthVolume: '1000mg',
        createdAt: now,
        updatedAt: now,
      });
      const drontalId = await db.medicines.add({
        brandName: 'Drontal Plus',
        genericName: 'Praziquantel / Pyrantel / Febantel',
        presentation: 'Tablet',
        createdAt: now,
        updatedAt: now,
      });
      const spotOnId = await db.medicines.add({
        brandName: 'Spot-On Fipronil',
        genericName: 'Fipronil 9.7%',
        presentation: 'Spot-On',
        strengthVolume: '2.68ml',
        createdAt: now,
        updatedAt: now,
      });

      // ── Treatment Packages ─────────────────────────────────
      const pkg1 = await db.treatmentPackages.add({
        name: 'Canine Otitis',
        description: 'Standard ear infection protocol for dogs',
        category: 'Ear & Topical Protocol',
        usageCount: 2,
        lastUsedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      });
      await db.treatmentPackageItems.bulkAdd([
        { packageId: pkg1 as number, medicineId: amoxId as number,    brandName: 'Amoxicillin 500mg',   genericName: 'Amoxicillin', presentation: 'Tablet',    strengthVolume: '500mg', quantity: 10, unit: 'tablets', frequency: 'BID', durationDays: 5,  route: 'PO (Oral)',    directions: 'Give after food.', sortOrder: 0 },
        { packageId: pkg1 as number, medicineId: posatexId as number,  brandName: 'Posatex Drops 15ml', genericName: 'Orbifloxacin / Mometasone / Posaconazole', presentation: 'Ear Drops', strengthVolume: '15ml', quantity: 1, unit: 'vial', frequency: 'SID', durationDays: 7, route: 'Otic', directions: 'Apply 4 drops per affected ear. Clean ear before application.', sortOrder: 1 },
      ]);

      const pkg2 = await db.treatmentPackages.add({
        name: 'Canine Gastroenteritis',
        description: 'Acute GI regimen for dogs',
        category: 'Acute GI Regimen',
        usageCount: 1,
        lastUsedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      });
      await db.treatmentPackageItems.bulkAdd([
        { packageId: pkg2 as number, medicineId: metronId as number,  brandName: 'Metronidazole 250mg', genericName: 'Metronidazole', presentation: 'Tablet', strengthVolume: '250mg', quantity: 14, unit: 'tablets', frequency: 'BID', durationDays: 7, route: 'PO (Oral)', directions: 'Give with food.', sortOrder: 0 },
        { packageId: pkg2 as number, medicineId: ondanId as number,   brandName: 'Ondansetron 4mg',    genericName: 'Ondansetron',   presentation: 'Tablet', strengthVolume: '4mg',  quantity: 6,  unit: 'tablets', frequency: 'TID', durationDays: 2, route: 'PO (Oral)', directions: 'Give 30 min before meals.', sortOrder: 1 },
        { packageId: pkg2 as number, medicineId: probioId as number,  brandName: 'Fortiflora Probiotic', genericName: 'Enterococcus faecium', presentation: 'Sachet', strengthVolume: '1g', quantity: 7, unit: 'sachets', frequency: 'SID', durationDays: 7, route: 'PO (Oral)', directions: 'Mix with food.', sortOrder: 2 },
      ]);

      const pkg3 = await db.treatmentPackages.add({
        name: 'Skin Infection / Dermatitis',
        description: 'Dermatology set for bacterial/allergic skin disease',
        category: 'Dermatology Set',
        usageCount: 5,
        lastUsedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      });
      await db.treatmentPackageItems.bulkAdd([
        { packageId: pkg3 as number, medicineId: cephalexinId as number, brandName: 'Cephalexin 500mg',        presentation: 'Capsule',  strengthVolume: '500mg', quantity: 14, unit: 'capsules', frequency: 'BID', durationDays: 7, route: 'PO (Oral)', directions: 'Give with food.', sortOrder: 0 },
        { packageId: pkg3 as number, medicineId: apoquelId as number,    brandName: 'Apoquel 16mg',            presentation: 'Tablet',   strengthVolume: '16mg',  quantity: 7,  unit: 'tablets',  frequency: 'SID', durationDays: 7, route: 'PO (Oral)', directions: 'Give at same time daily.', sortOrder: 1 },
        { packageId: pkg3 as number, medicineId: chlorhexId as number,   brandName: 'Chlorhexidine Wash 250ml', presentation: 'Shampoo', strengthVolume: '250ml', quantity: 1,  unit: 'bottle',   frequency: '3x per week', directions: 'Lather, leave 5 minutes, rinse thoroughly.', sortOrder: 2 },
      ]);

      const pkg4 = await db.treatmentPackages.add({
        name: 'Routine Deworming & Ticks',
        description: 'Preventive care — deworming and ectoparasite control',
        category: 'Preventive Care',
        usageCount: 0,
        lastUsedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        createdAt: now,
        updatedAt: now,
      });
      await db.treatmentPackageItems.bulkAdd([
        { packageId: pkg4 as number, medicineId: bravectoId as number, brandName: 'Bravecto 1000mg',     presentation: 'Chewable Tablet', strengthVolume: '1000mg', quantity: 1, unit: 'tablet',  frequency: 'Once', directions: 'Give with or after a meal.', sortOrder: 0 },
        { packageId: pkg4 as number, medicineId: drontalId as number,  brandName: 'Drontal Plus',        presentation: 'Tablet',          quantity: 2, unit: 'tablets', frequency: 'Once', directions: 'Give on empty stomach.', sortOrder: 1 },
        { packageId: pkg4 as number, medicineId: spotOnId as number,   brandName: 'Spot-On Fipronil',    presentation: 'Spot-On',         strengthVolume: '2.68ml', quantity: 1, unit: 'pipette', frequency: 'Once monthly', directions: 'Apply to back of neck.', sortOrder: 2 },
      ]);

      // ── Prescriptions ──────────────────────────────────────
      const yesterday = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);
      const today1030 = new Date(); today1030.setHours(10, 30, 0, 0);
      const today0915 = new Date(); today0915.setHours(9,  15, 0, 0);

      const rx892Id = await db.prescriptions.add({
        rxNumber: 'RX-2026-0892',
        patientId: brunoId as number,
        ownerId: ahmedId as number,
        practitionerId: practitionerId as number,
        packageId: pkg1 as number,
        symptoms: 'Head shaking, scratching at right ear, malodorous discharge',
        diagnosis: 'Otitis Externa (R)',
        instructions: 'Keep right ear dry during baths. Prevent scratching with Elizabethan collar if head-shaking persists. Return for re-check in 7 days.',
        followUpDays: 7,
        status: 'Issued',
        issuedAt: today1030,
        createdAt: today1030,
        updatedAt: today1030,
      });
      await db.prescriptionItems.bulkAdd([
        { prescriptionId: rx892Id as number, medicineId: amoxId as number,   brandName: 'Amoxicillin 500mg',  genericName: 'Amoxicillin', presentation: 'Tablet',   strengthVolume: '500mg', quantity: 10, unit: 'tablets', frequency: 'BID', durationDays: 5, route: 'PO (Oral)', directions: 'Give after food with water. Complete full course.', sortOrder: 0 },
        { prescriptionId: rx892Id as number, medicineId: posatexId as number, brandName: 'Posatex Drops 15ml', presentation: 'Ear Drops', strengthVolume: '15ml',  quantity: 1,  unit: 'vial',    frequency: 'SID', durationDays: 7, route: 'Otic',    directions: '4 drops in right ear. Shake well before instilling.', sortOrder: 1 },
      ]);

      const rx891Id = await db.prescriptions.add({
        rxNumber: 'RX-2026-0891',
        patientId: miloId as number,
        ownerId: priyaId as number,
        practitionerId: practitionerId as number,
        symptoms: 'Vomiting, lethargy, reduced appetite',
        diagnosis: 'Acute Gastroenteritis',
        instructions: 'Offer small meals, increase gradually. Monitor for recurrence.',
        followUpDays: 3,
        status: 'Issued',
        issuedAt: today0915,
        createdAt: today0915,
        updatedAt: today0915,
      });
      await db.prescriptionItems.bulkAdd([
        { prescriptionId: rx891Id as number, medicineId: metronId as number, brandName: 'Metronidazole 250mg', presentation: 'Tablet', strengthVolume: '250mg', quantity: 14, unit: 'tablets', frequency: 'BID', durationDays: 7, route: 'PO (Oral)', directions: 'Give with food.', sortOrder: 0 },
        { prescriptionId: rx891Id as number, medicineId: ondanId as number,  brandName: 'Ondansetron 4mg',    presentation: 'Tablet', strengthVolume: '4mg',  quantity: 6,  unit: 'tablets', frequency: 'TID', durationDays: 2, route: 'PO (Oral)', directions: 'Give 30 min before meals.', sortOrder: 1 },
      ]);

      const rx890Id = await db.prescriptions.add({
        rxNumber: 'RX-2026-0890',
        patientId: lunaId as number,
        ownerId: rahulId as number,
        practitionerId: practitionerId as number,
        symptoms: 'Intermittent lameness, mild swelling in right foreleg',
        diagnosis: 'Soft Tissue Injury (R foreleg)',
        status: 'Issued',
        issuedAt: yesterday,
        createdAt: yesterday,
        updatedAt: yesterday,
      });

      await db.prescriptions.add({
        rxNumber: 'RX-2026-0887',
        patientId: brunoId as number,
        ownerId: ahmedId as number,
        practitionerId: practitionerId as number,
        symptoms: 'Excessive scratching, hair loss on flank',
        diagnosis: 'Allergic Dermatitis',
        status: 'Draft',
        createdAt: yesterday,
        updatedAt: yesterday,
      });

      // ── Invoices ──────────────────────────────────────────
      // Using integer paisa (₹1 = 100 paisa)

      const inv125Id = await db.invoices.add({
        invoiceNumber: 'INV-2026-00125',
        patientId: brunoId as number,
        ownerId: ahmedId as number,
        practitionerId: practitionerId as number,
        prescriptionId: rx892Id as number,
        invoiceDate: today1030,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal: 168000,  // ₹1,680.00
        status: 'Issued',
        issuedAt: today1030,
        createdAt: today1030,
        updatedAt: today1030,
      });
      await db.invoiceItems.bulkAdd([
        { invoiceId: inv125Id as number, category: 'Consultation Fee', description: 'Consultation Fee', quantity: 1, unitPricePaisa: 50000, discountPct: 0, taxPct: 0, subtotalPaisa: 50000, discountAmtPaisa: 0, taxAmtPaisa: 0, lineTotalPaisa: 50000, sortOrder: 0 },
        { invoiceId: inv125Id as number, category: 'Medicine', description: 'Amoxicillin 500mg × 10 tablets', quantity: 10, unitPricePaisa: 5000, discountPct: 0, taxPct: 0, subtotalPaisa: 50000, discountAmtPaisa: 0, taxAmtPaisa: 0, lineTotalPaisa: 50000, sortOrder: 1 },
        { invoiceId: inv125Id as number, category: 'Medicine', description: 'Posatex Drops 15ml × 1 vial',    quantity: 1,  unitPricePaisa: 68000, discountPct: 0, taxPct: 0, subtotalPaisa: 68000, discountAmtPaisa: 0, taxAmtPaisa: 0, lineTotalPaisa: 68000, sortOrder: 2 },
      ]);

      const inv124Id = await db.invoices.add({
        invoiceNumber: 'INV-2026-00124',
        patientId: miloId as number,
        ownerId: priyaId as number,
        practitionerId: practitionerId as number,
        prescriptionId: rx891Id as number,
        invoiceDate: today0915,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal: 85000,  // ₹850.00
        status: 'Issued',
        issuedAt: today0915,
        createdAt: today0915,
        updatedAt: today0915,
      });
      await db.invoiceItems.bulkAdd([
        { invoiceId: inv124Id as number, category: 'Consultation Fee', description: 'Consultation Fee', quantity: 1, unitPricePaisa: 40000, discountPct: 0, taxPct: 0, subtotalPaisa: 40000, discountAmtPaisa: 0, taxAmtPaisa: 0, lineTotalPaisa: 40000, sortOrder: 0 },
        { invoiceId: inv124Id as number, category: 'Medicine', description: 'Metronidazole 250mg × 14 tablets', quantity: 14, unitPricePaisa: 2000, discountPct: 0, taxPct: 0, subtotalPaisa: 28000, discountAmtPaisa: 0, taxAmtPaisa: 0, lineTotalPaisa: 28000, sortOrder: 1 },
        { invoiceId: inv124Id as number, category: 'Medicine', description: 'Ondansetron 4mg × 6 tablets',     quantity: 6,  unitPricePaisa: 2500, discountPct: 0, taxPct: 0, subtotalPaisa: 15000, discountAmtPaisa: 0, taxAmtPaisa: 0, lineTotalPaisa: 15000, sortOrder: 2 },
        { invoiceId: inv124Id as number, category: 'Medicine', description: 'Fortiflora Probiotic × 7 sachets', quantity: 7, unitPricePaisa: 500,  discountPct: 0, taxPct: 0, subtotalPaisa: 3500,  discountAmtPaisa: 0, taxAmtPaisa: 0, lineTotalPaisa: 3500,  sortOrder: 3 },
      ]);

      await db.invoices.add({
        invoiceNumber: 'INV-2026-00123',
        patientId: lunaId as number,
        ownerId: rahulId as number,
        practitionerId: practitionerId as number,
        prescriptionId: rx890Id as number,
        invoiceDate: yesterday,
        discountTotal: 0,
        taxTotal: 0,
        grandTotal: 240000,  // ₹2,400.00
        status: 'Draft',
        createdAt: yesterday,
        updatedAt: yesterday,
      });

      // ── Audit events ──────────────────────────────────────
      await db.auditEvents.bulkAdd([
        { entityType: 'Invoice', entityId: inv125Id as number, eventType: 'invoice_created', practitionerId: practitionerId as number, occurredAt: today1030 },
        { entityType: 'Invoice', entityId: inv125Id as number, eventType: 'invoice_issued',  practitionerId: practitionerId as number, occurredAt: today1030 },
        { entityType: 'Invoice', entityId: inv124Id as number, eventType: 'invoice_created', practitionerId: practitionerId as number, occurredAt: today0915 },
        { entityType: 'Invoice', entityId: inv124Id as number, eventType: 'invoice_issued',  practitionerId: practitionerId as number, occurredAt: today0915 },
      ]);
    }
  );
}
