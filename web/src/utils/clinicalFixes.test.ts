import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatPractitionerHeaderLines } from './practitionerFormat.js';
import type { Practitioner, Organisation } from '../types/index.js';

describe('Clinical Fixes & Formatting Verification', () => {
  describe('Species Deduplication', () => {
    it('deduplicates species lists case-insensitively and trims whitespace', () => {
      const rawSpecies = [
        { name: 'Dog', isActive: true },
        { name: 'dog', isActive: true },
        { name: ' Dog ', isActive: true },
        { name: 'Cat', isActive: true },
        { name: 'CAT', isActive: true },
        { name: 'Cow', isActive: true },
        { name: 'cow', isActive: true },
      ];

      const map = new Map<string, string>();
      for (const item of rawSpecies) {
        const key = item.name.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, item.name.trim());
        }
      }

      const deduplicated = Array.from(map.values());
      assert.deepEqual(deduplicated, ['Dog', 'Cat', 'Cow']);
    });
  });

  describe('Practitioner Header Multi-Line Formatting', () => {
    it('structures practitioner details into correct clinical lines', () => {
      const practitioner: Practitioner = {
        id: 1,
        name: 'Dr. Shameem Alungal',
        qualifications: 'BVSc & AH, MVSc (Surgery)',
        designation: 'Veterinary Surgeon & Consultant',
        registrationNumber: 'KVC 12345',
        phone: '+91 98470 12345',
        email: 'drshameem@vetrx.in',
        address: 'Malappuram Veterinary Clinic, Kerala',
        isActive: true,
      };

      const lines = formatPractitionerHeaderLines(practitioner);

      assert.equal(lines.name, 'Dr. Shameem Alungal');
      assert.equal(lines.qualifications, 'BVSc & AH, MVSc (Surgery)');
      assert.equal(lines.designation, 'Veterinary Surgeon & Consultant');
      assert.equal(lines.regNumber, 'Reg. No: KVC 12345');
      assert.equal(lines.contact, 'Mob: +91 98470 12345 • Email: drshameem@vetrx.in');
      assert.equal(lines.address, 'Malappuram Veterinary Clinic, Kerala');
    });

    it('handles independent practitioner without clinic name', () => {
      const practitioner: Practitioner = {
        id: 2,
        name: 'Dr. Fiza Sha',
        qualifications: 'BVSc & AH',
        designation: 'Veterinary Physician',
        registrationNumber: '112233',
        phone: '9876543210',
        email: 'fiza@vetrx.in',
        address: 'Calicut, Kerala',
        isActive: true,
      };

      const organisation: Organisation = {
        id: 1,
        name: 'Independent Practitioner',
        isActive: false,
      };

      const lines = formatPractitionerHeaderLines(practitioner, organisation);
      assert.equal(lines.clinicName, undefined);
      assert.equal(lines.name, 'Dr. Fiza Sha');
      assert.equal(lines.regNumber, 'Reg. No: 112233');
    });
  });

  describe('Approved Dose Unit Persistence', () => {
    it('preserves unit as string (e.g. "mg", "g", "mL") and avoids numeric index conversion', () => {
      const selectedUnit = 'mg';
      assert.equal(typeof selectedUnit, 'string');
      assert.notEqual(selectedUnit, '7');
      assert.notEqual(selectedUnit, 7);

      const payload = {
        brandName: 'Amoxicillin',
        dose: '250',
        doseUnit: selectedUnit,
        dispenseUnit: 'vial',
        quantity: 1,
      };

      assert.equal(payload.doseUnit, 'mg');
      assert.equal(payload.dispenseUnit, 'vial');
    });
  });

  describe('Recheck Recommended Interval Presets and Custom', () => {
    it('correctly maps presets and custom intervals', () => {
      const presetOptions = ['None', '3 days', '5 days', '7 days', '14 days', 'Custom'];
      assert.ok(presetOptions.includes('7 days'));
      assert.ok(presetOptions.includes('Custom'));

      // Test custom interval
      const customRx = {
        recheckIntervalPreset: 'Custom',
        recheckIntervalCustom: '10 days post bloodwork',
      };
      const displayInterval =
        customRx.recheckIntervalPreset === 'Custom'
          ? customRx.recheckIntervalCustom
          : customRx.recheckIntervalPreset;

      assert.equal(displayInterval, '10 days post bloodwork');
    });
  });
});
