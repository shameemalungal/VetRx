import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  convertUnits,
  areUnitsCompatible,
  normalizeUnitString,
  DISPENSE_UNITS,
} from './unitConverter.js';
import { calculateDispenseQuantity } from './doseCalculator.js';

describe('Centralized Clinical Unit Converter', () => {
  describe('Mass unit conversions', () => {
    it('converts grams to milligrams (1 g = 1000 mg)', () => {
      const res = convertUnits(1, 'g', 'mg');
      assert.equal(res.isValid, true);
      assert.equal(res.convertedValue, 1000);
      assert.equal(res.dimension, 'mass');
    });

    it('converts 3 grams to milligrams (3 g = 3000 mg)', () => {
      const res = convertUnits(3, 'g', 'mg');
      assert.equal(res.isValid, true);
      assert.equal(res.convertedValue, 3000);
      assert.equal(res.dimension, 'mass');
    });

    it('converts milligrams to grams (500 mg = 0.5 g)', () => {
      const res = convertUnits(500, 'mg', 'g');
      assert.equal(res.isValid, true);
      assert.equal(res.convertedValue, 0.5);
      assert.equal(res.dimension, 'mass');
    });

    it('converts micrograms to milligrams (1000 mcg = 1 mg)', () => {
      const res = convertUnits(1000, 'mcg', 'mg');
      assert.equal(res.isValid, true);
      assert.equal(res.convertedValue, 1);
      assert.equal(res.dimension, 'mass');
    });

    it('converts kilograms to grams (0.25 kg = 250 g)', () => {
      const res = convertUnits(0.25, 'kg', 'g');
      assert.equal(res.isValid, true);
      assert.equal(res.convertedValue, 250);
      assert.equal(res.dimension, 'mass');
    });
  });

  describe('Volume unit conversions', () => {
    it('converts liters to milliliters (1 L = 1000 mL)', () => {
      const res = convertUnits(1, 'L', 'mL');
      assert.equal(res.isValid, true);
      assert.equal(res.convertedValue, 1000);
      assert.equal(res.dimension, 'volume');
    });

    it('converts milliliters to liters (2500 mL = 2.5 L)', () => {
      const res = convertUnits(2500, 'mL', 'L');
      assert.equal(res.isValid, true);
      assert.equal(res.convertedValue, 2.5);
      assert.equal(res.dimension, 'volume');
    });
  });

  describe('Clinical & Count units', () => {
    it('preserves International Units (100 IU = 100 IU)', () => {
      const res = convertUnits(100, 'IU', 'IU');
      assert.equal(res.isValid, true);
      assert.equal(res.convertedValue, 100);
      assert.equal(res.dimension, 'clinical');
    });

    it('preserves tablet counts (2 tablet = 2 tablet)', () => {
      const res = convertUnits(2, 'tablet', 'tablets');
      assert.equal(res.isValid, true);
      assert.equal(res.convertedValue, 2);
      assert.equal(res.dimension, 'count');
    });
  });

  describe('Incompatible dimensions & error handling', () => {
    it('rejects mass to volume conversion without concentration (5 mg to 5 mL)', () => {
      const res = convertUnits(5, 'mg', 'mL');
      assert.equal(res.isValid, false);
      assert.match(res.error || '', /Incompatible dimensions/i);
    });

    it('rejects volume to count conversion (10 mL to tablets)', () => {
      const res = convertUnits(10, 'mL', 'tablet');
      assert.equal(res.isValid, false);
      assert.match(res.error || '', /Incompatible dimensions/i);
    });

    it('rejects non-numeric values', () => {
      const res = convertUnits(NaN, 'mg', 'g');
      assert.equal(res.isValid, false);
      assert.match(res.error || '', /Invalid numeric value/i);
    });

    it('correctly checks compatibility with areUnitsCompatible', () => {
      assert.equal(areUnitsCompatible('mg', 'g'), true);
      assert.equal(areUnitsCompatible('mL', 'L'), true);
      assert.equal(areUnitsCompatible('mg', 'mL'), false);
      assert.equal(areUnitsCompatible('tablet', 'capsule'), true);
      assert.equal(areUnitsCompatible('IU', 'mg'), false);
    });
  });

  describe('Normalization and Formatting', () => {
    it('handles whitespace, case variations, and aliases', () => {
      assert.equal(normalizeUnitString('  Mg  '), 'mg');
      assert.equal(normalizeUnitString('ML'), 'mL');
      assert.equal(normalizeUnitString('L'), 'L');
      assert.equal(normalizeUnitString('Tabs'), 'tablet');
      assert.equal(normalizeUnitString('µg'), 'mcg');
    });

    it('includes required dispense units in DISPENSE_UNITS', () => {
      const expected = ['tablet', 'capsule', 'mL', 'vial', 'ampoule', 'bottle', 'strip'];
      for (const exp of expected) {
        assert.ok(
          DISPENSE_UNITS.includes(exp),
          `Expected DISPENSE_UNITS to contain "${exp}"`
        );
      }
    });
  });

  describe('Integration with dose calculation', () => {
    it('calculates dispense quantity converting 3 g dose against 3000 mg concentration', () => {
      // 3 g dose, 3000 mg / 10 mL concentration, BID (2 doses/day), 5 days
      // Normalized dose = 3000 mg. Vol per dose = (3000 / 3000) * 10 = 10 mL
      // Total dispense = 10 mL * 2 * 5 = 100 mL
      const qty = calculateDispenseQuantity(
        3,
        'g',
        'BID',
        5,
        {
          id: 1,
          brandName: 'Amoxicillin Inj',
          concentrationStrength: 3000,
          concentrationStrengthUnit: 'mg',
          concentrationVolume: 10,
          concentrationVolumeUnit: 'mL',
          defaultUnit: 'mL',
          isActive: true,
        } as any
      );
      assert.equal(qty.quantity, 100);
      assert.equal(qty.unit, 'mL');
    });

    it('calculates dispense quantity with matching units without extra conversion', () => {
      // 500 mg dose, 250 mg / 5 mL concentration, BID, 5 days
      // Vol per dose = (500 / 250) * 5 = 10 mL
      // Total = 10 * 2 * 5 = 100 mL
      const qty = calculateDispenseQuantity(
        500,
        'mg',
        'BID',
        5,
        {
          id: 2,
          brandName: 'Cephalexin Syrup',
          concentrationStrength: 250,
          concentrationStrengthUnit: 'mg',
          concentrationVolume: 5,
          concentrationVolumeUnit: 'mL',
          defaultUnit: 'mL',
          isActive: true,
        } as any
      );
      assert.equal(qty.quantity, 100);
      assert.equal(qty.unit, 'mL');
    });
  });
});
