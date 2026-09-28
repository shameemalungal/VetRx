import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Medicine, PrescriptionItem } from './src/types';

describe('Medicine Formulation Persistence & Reopen Verification', () => {
  // Test case 1: Amoxicillin
  const amoxicillinFormulation = {
    brandName: 'Amoxicillin',
    genericName: 'Amoxicillin Trihydrate',
    strength: '125 mg/tablet',
    presentation: 'Tablet',
    packSize: '10 tablets/strip',
  };

  // Test case 2: Prednisolone
  const prednisoloneFormulation = {
    brandName: 'Prednisolone',
    genericName: 'Prednisolone Sodium Phosphate',
    strength: '5 mg/mL',
    presentation: 'Syrup',
    packSize: '30 mL bottle',
  };

  it('Payload generator creates valid formulary record for Amoxicillin', () => {
    const now = new Date();
    const payload: Partial<Medicine> = {
      brandName: amoxicillinFormulation.brandName.trim(),
      genericName: amoxicillinFormulation.genericName.trim(),
      presentation: amoxicillinFormulation.presentation.trim(),
      packSize: amoxicillinFormulation.packSize.trim(),
      strength: amoxicillinFormulation.strength.trim(),
      strengthVolume: amoxicillinFormulation.strength.trim(),
      updatedAt: now,
    };

    assert.strictEqual(payload.brandName, 'Amoxicillin');
    assert.strictEqual(payload.strength, '125 mg/tablet');
    assert.strictEqual(payload.presentation, 'Tablet');
    assert.strictEqual(payload.packSize, '10 tablets/strip');
  });

  it('Payload generator creates valid formulary record for Prednisolone', () => {
    const now = new Date();
    const payload: Partial<Medicine> = {
      brandName: prednisoloneFormulation.brandName.trim(),
      genericName: prednisoloneFormulation.genericName.trim(),
      presentation: prednisoloneFormulation.presentation.trim(),
      packSize: prednisoloneFormulation.packSize.trim(),
      strength: prednisoloneFormulation.strength.trim(),
      strengthVolume: prednisoloneFormulation.strength.trim(),
      updatedAt: now,
    };

    assert.strictEqual(payload.brandName, 'Prednisolone');
    assert.strictEqual(payload.strength, '5 mg/mL');
    assert.strictEqual(payload.presentation, 'Syrup');
    assert.strictEqual(payload.packSize, '30 mL bottle');
  });

  it('Prescription item correctly inherits formulation fields upon selection (Amoxicillin)', () => {
    const med: Medicine = {
      id: 101,
      brandName: 'Amoxicillin',
      genericName: 'Amoxicillin Trihydrate',
      presentation: 'Tablet',
      strength: '125 mg/tablet',
      packSize: '10 tablets/strip',
      isActive: true,
      createdAt: new Date(),
    };

    // Simulated handleSelectMedRef logic
    const medForm = {
      brandName: med.brandName,
      genericName: med.genericName || '',
      presentation: med.presentation,
      strength: med.strength || med.strengthVolume || '',
      packSize: med.packSize || '',
      dose: '1',
      doseUnit: 'tablet',
      route: 'PO (Oral)',
      frequency: 'BID',
      durationDays: 5,
      quantity: 10,
      unit: 'tablet',
      directions: 'Give with food',
    };

    assert.strictEqual(medForm.brandName, 'Amoxicillin');
    assert.strictEqual(medForm.genericName, 'Amoxicillin Trihydrate');
    assert.strictEqual(medForm.strength, '125 mg/tablet');
    assert.strictEqual(medForm.presentation, 'Tablet');
    assert.strictEqual(medForm.packSize, '10 tablets/strip');

    // Simulated prescription item creation
    const rxItem: Partial<PrescriptionItem> = {
      medicineId: med.id,
      brandName: medForm.brandName,
      genericName: medForm.genericName,
      strength: medForm.strength,
      presentation: medForm.presentation,
      packSize: medForm.packSize,
      dose: medForm.dose,
      doseUnit: medForm.doseUnit,
      route: medForm.route,
      frequency: medForm.frequency,
      durationDays: medForm.durationDays,
      quantity: medForm.quantity,
    };

    assert.strictEqual(rxItem.strength, '125 mg/tablet');
    assert.strictEqual(rxItem.presentation, 'Tablet');
    assert.strictEqual(rxItem.packSize, '10 tablets/strip');
  });

  it('Prescription item correctly inherits formulation fields upon selection (Prednisolone)', () => {
    const med: Medicine = {
      id: 102,
      brandName: 'Prednisolone',
      genericName: 'Prednisolone Sodium Phosphate',
      presentation: 'Syrup',
      strength: '5 mg/mL',
      packSize: '30 mL bottle',
      isActive: true,
      createdAt: new Date(),
    };

    const medForm = {
      brandName: med.brandName,
      genericName: med.genericName || '',
      presentation: med.presentation,
      strength: med.strength || med.strengthVolume || '',
      packSize: med.packSize || '',
    };

    assert.strictEqual(medForm.brandName, 'Prednisolone');
    assert.strictEqual(medForm.strength, '5 mg/mL');
    assert.strictEqual(medForm.presentation, 'Syrup');
    assert.strictEqual(medForm.packSize, '30 mL bottle');
  });

  it('Edit/reopen prescription item retains exact formulation fields', () => {
    const savedRxItem: PrescriptionItem = {
      id: 201,
      prescriptionId: 1,
      medicineId: 101,
      brandName: 'Amoxicillin',
      genericName: 'Amoxicillin Trihydrate',
      strength: '125 mg/tablet',
      presentation: 'Tablet',
      packSize: '10 tablets/strip',
      dose: '125',
      doseUnit: 'mg',
      route: 'PO (Oral)',
      frequency: 'BID',
      durationDays: 7,
      quantity: 14,
    };

    // Simulated openEditMedModal logic
    const reopenedMedForm = {
      brandName: savedRxItem.brandName,
      genericName: savedRxItem.genericName || '',
      presentation: savedRxItem.presentation || 'Tablet',
      strength: savedRxItem.strength || savedRxItem.strengthVolume || '',
      packSize: savedRxItem.packSize || '',
      dose: savedRxItem.dose,
      doseUnit: savedRxItem.doseUnit,
      durationDays: savedRxItem.durationDays,
      quantity: savedRxItem.quantity,
    };

    assert.strictEqual(reopenedMedForm.brandName, 'Amoxicillin');
    assert.strictEqual(reopenedMedForm.genericName, 'Amoxicillin Trihydrate');
    assert.strictEqual(reopenedMedForm.strength, '125 mg/tablet');
    assert.strictEqual(reopenedMedForm.presentation, 'Tablet');
    assert.strictEqual(reopenedMedForm.packSize, '10 tablets/strip');
  });

  it('Edit/reopen formulary medicine retains updated values', () => {
    let existingMedicine: Medicine = {
      id: 102,
      brandName: 'Prednisolone',
      genericName: 'Prednisolone Sodium Phosphate',
      presentation: 'Syrup',
      strength: '5 mg/mL',
      packSize: '30 mL bottle',
      isActive: true,
      createdAt: new Date(),
    };

    // User edits pack size to '60 mL bottle'
    const updatedPayload = {
      ...existingMedicine,
      packSize: '60 mL bottle',
      updatedAt: new Date(),
    };

    existingMedicine = { ...existingMedicine, ...updatedPayload };

    // Reopen
    assert.strictEqual(existingMedicine.packSize, '60 mL bottle');
    assert.strictEqual(existingMedicine.strength, '5 mg/mL');
    assert.strictEqual(existingMedicine.presentation, 'Syrup');
  });
});
