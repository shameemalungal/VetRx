import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Shared Medicine Form Architecture & Formulation Integrity', () => {
  const formulationSectionPath = path.resolve('src/pages/medicines/MedicineFormulationSection.tsx');
  const medicineModalPath = path.resolve('src/pages/medicines/MedicineFormModal.tsx');
  const rxBuilderPath = path.resolve('src/pages/prescriptions/PrescriptionBuilderPage.tsx');

  it('MedicineFormulationSection exists and defines authoritative formulation fields', () => {
    assert.ok(fs.existsSync(formulationSectionPath), 'MedicineFormulationSection.tsx must exist');
    const content = fs.readFileSync(formulationSectionPath, 'utf8');

    // Formulation fields
    assert.ok(content.includes('Brand Name'), 'Must include Brand Name field');
    assert.ok(content.includes('Chemical / Formulation'), 'Must include Chemical / Formulation field');
    assert.ok(content.includes('Strength / Concentration'), 'Must include Strength / Concentration field');
    assert.ok(content.includes('Presentation / Form'), 'Must include Presentation / Form field');
    assert.ok(content.includes('Presentation / Pack Size'), 'Must include Presentation / Pack Size field');

    // Both named exports
    assert.ok(content.includes('export function MedicineFormulationSection'), 'Must export MedicineFormulationSection');
    assert.ok(content.includes('export const SharedMedicineForm'), 'Must export SharedMedicineForm alias');
  });

  it('MedicineFormModal consumes MedicineFormulationSection and has no duplicate formulation JSX', () => {
    const content = fs.readFileSync(medicineModalPath, 'utf8');

    assert.ok(
      content.includes("from './MedicineFormulationSection'"),
      'MedicineFormModal must import from MedicineFormulationSection'
    );
    assert.ok(
      content.includes('<MedicineFormulationSection'),
      'MedicineFormModal must render <MedicineFormulationSection'
    );

    // Ensure raw duplicate inputs are removed
    assert.ok(
      !content.includes('id="med-brand-name"'),
      'MedicineFormModal must not declare its own separate id="med-brand-name" input'
    );
    assert.ok(
      !content.includes('id="med-generic-name"'),
      'MedicineFormModal must not declare its own separate id="med-generic-name" input'
    );
    assert.ok(
      !content.includes('id="med-pack-size"'),
      'MedicineFormModal must not declare its own separate id="med-pack-size" input'
    );
  });

  it('PrescriptionBuilderPage consumes MedicineFormulationSection and removed duplicate formulation JSX', () => {
    const content = fs.readFileSync(rxBuilderPath, 'utf8');

    assert.ok(
      content.includes("from '../medicines/MedicineFormulationSection'"),
      'PrescriptionBuilderPage must import from MedicineFormulationSection'
    );
    assert.ok(
      content.includes('<MedicineFormulationSection'),
      'PrescriptionBuilderPage must render <MedicineFormulationSection'
    );

    // Ensure duplicate inputs are removed from PrescriptionBuilderPage
    assert.ok(
      !content.includes('id="rx-form-brand-name"'),
      'PrescriptionBuilderPage must not contain duplicate id="rx-form-brand-name" input'
    );
    assert.ok(
      !content.includes('id="rx-form-chemical-formulation"'),
      'PrescriptionBuilderPage must not contain duplicate id="rx-form-chemical-formulation" input'
    );
    assert.ok(
      !content.includes('id="rx-form-pack-size"'),
      'PrescriptionBuilderPage must not contain duplicate id="rx-form-pack-size" input'
    );
  });

  it('PrescriptionBuilderPage passes formulary auto-population and edit callbacks to shared form', () => {
    const content = fs.readFileSync(rxBuilderPath, 'utf8');

    assert.ok(
      content.includes('isFromFormulary={Boolean(selectedMedRef)}'),
      'Must pass formulary status to shared form'
    );
    assert.ok(
      content.includes('readOnly={Boolean(selectedMedRef)}'),
      'Must pass readOnly controlled by selectedMedRef'
    );
    assert.ok(
      content.includes('onEditInFormulary={() => setCreateMedicineModalOpen(true)}'),
      'Must link Edit in Formulary to MedicineFormModal'
    );
    assert.ok(
      content.includes('onCreateInFormulary={() => setCreateMedicineModalOpen(true)}'),
      'Must link Create in Formulary to MedicineFormModal'
    );
  });
});
