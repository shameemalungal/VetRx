// =============================================================
// VetRx — Centralized Clinical Unit Conversion System
// =============================================================

export type UnitDimension = 'mass' | 'volume' | 'count' | 'clinical' | 'unknown';

export interface UnitDefinition {
  canonical: string;
  dimension: UnitDimension;
  toBaseMultiplier: number; // Multiplier to normalize to base unit
  aliases: string[];
}

// Base units:
// mass: 'mg' (1 mg = 1)
// volume: 'mL' (1 mL = 1)
// count: 'unit' (1 unit = 1)

export const KNOWN_UNITS: Record<string, UnitDefinition> = {
  // Mass units (Base: mg)
  mcg: { canonical: 'mcg', dimension: 'mass', toBaseMultiplier: 0.001, aliases: ['mcg', 'µg', 'ug', 'microgram', 'micrograms'] },
  mg: { canonical: 'mg', dimension: 'mass', toBaseMultiplier: 1, aliases: ['mg', 'milligram', 'milligrams'] },
  g: { canonical: 'g', dimension: 'mass', toBaseMultiplier: 1000, aliases: ['g', 'gm', 'gram', 'grams'] },
  kg: { canonical: 'kg', dimension: 'mass', toBaseMultiplier: 1000000, aliases: ['kg', 'kilogram', 'kilograms'] },

  // Volume units (Base: mL)
  ml: { canonical: 'mL', dimension: 'volume', toBaseMultiplier: 1, aliases: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'] },
  l: { canonical: 'L', dimension: 'volume', toBaseMultiplier: 1000, aliases: ['l', 'liter', 'liters', 'litre', 'litres'] },

  // Count / presentation units (dimension: 'count')
  tablet: { canonical: 'tablet', dimension: 'count', toBaseMultiplier: 1, aliases: ['tablet', 'tablets', 'tab', 'tabs'] },
  capsule: { canonical: 'capsule', dimension: 'count', toBaseMultiplier: 1, aliases: ['capsule', 'capsules', 'cap', 'caps'] },
  vial: { canonical: 'vial', dimension: 'count', toBaseMultiplier: 1, aliases: ['vial', 'vials'] },
  ampoule: { canonical: 'ampoule', dimension: 'count', toBaseMultiplier: 1, aliases: ['ampoule', 'ampoules', 'amp', 'amps'] },
  bottle: { canonical: 'bottle', dimension: 'count', toBaseMultiplier: 1, aliases: ['bottle', 'bottles'] },
  tube: { canonical: 'tube', dimension: 'count', toBaseMultiplier: 1, aliases: ['tube', 'tubes'] },
  sachet: { canonical: 'sachet', dimension: 'count', toBaseMultiplier: 1, aliases: ['sachet', 'sachets'] },
  strip: { canonical: 'strip', dimension: 'count', toBaseMultiplier: 1, aliases: ['strip', 'strips'] },
  box: { canonical: 'box', dimension: 'count', toBaseMultiplier: 1, aliases: ['box', 'boxes'] },
  pack: { canonical: 'pack', dimension: 'count', toBaseMultiplier: 1, aliases: ['pack', 'packs'] },
  bolus: { canonical: 'bolus/boli', dimension: 'count', toBaseMultiplier: 1, aliases: ['bolus', 'boli', 'bolus/boli'] },
  drop: { canonical: 'drop', dimension: 'count', toBaseMultiplier: 1, aliases: ['drop', 'drops'] },
  pipette: { canonical: 'pipette', dimension: 'count', toBaseMultiplier: 1, aliases: ['pipette', 'pipettes'] },
  piece: { canonical: 'piece', dimension: 'count', toBaseMultiplier: 1, aliases: ['piece', 'pieces', 'pc', 'pcs'] },
  dose: { canonical: 'dose', dimension: 'count', toBaseMultiplier: 1, aliases: ['dose', 'doses'] },
  unit: { canonical: 'unit', dimension: 'count', toBaseMultiplier: 1, aliases: ['unit', 'units'] },

  // Clinical units
  iu: { canonical: 'IU', dimension: 'clinical', toBaseMultiplier: 1, aliases: ['iu', 'international unit', 'international units'] },
};

/**
 * Normalizes a unit string to its canonical key if recognized.
 */
export function normalizeUnitString(unitStr?: string | null): string {
  if (!unitStr) return '';
  const clean = unitStr.trim().toLowerCase();
  for (const def of Object.values(KNOWN_UNITS)) {
    if (def.aliases.includes(clean) || def.canonical.toLowerCase() === clean) {
      return def.canonical;
    }
  }
  return unitStr.trim();
}

/**
 * Looks up unit definition.
 */
export function getUnitDefinition(unitStr?: string | null): UnitDefinition | undefined {
  if (!unitStr) return undefined;
  const clean = unitStr.trim().toLowerCase();
  for (const def of Object.values(KNOWN_UNITS)) {
    if (def.aliases.includes(clean) || def.canonical.toLowerCase() === clean) {
      return def;
    }
  }
  return undefined;
}

export interface ConversionResult {
  isValid: boolean;
  convertedValue?: number;
  fromUnitCanonical?: string;
  toUnitCanonical?: string;
  dimension?: UnitDimension;
  error?: string;
}

/**
 * Converts a numeric value from fromUnit to toUnit within compatible dimensions.
 * For example:
 * 3 g -> mg = 3000 mg
 * 1000 mcg -> mg = 1 mg
 * 1 L -> mL = 1000 mL
 *
 * Disallows incompatible dimensional conversions (e.g. mg to mL without concentration, or IU to mg).
 */
export function convertUnits(
  value: number | string | undefined | null,
  fromUnit: string | undefined | null,
  toUnit: string | undefined | null
): ConversionResult {
  if (value === undefined || value === null || value === '') {
    return { isValid: false, error: 'Value is required for unit conversion' };
  }
  const numericVal = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numericVal)) {
    return { isValid: false, error: 'Invalid numeric value' };
  }

  if (!fromUnit || !toUnit) {
    return { isValid: false, error: 'Both fromUnit and toUnit are required' };
  }

  const normFrom = normalizeUnitString(fromUnit);
  const normTo = normalizeUnitString(toUnit);
  const fromDef = getUnitDefinition(normFrom);
  const toDef = getUnitDefinition(normTo);

  if (normFrom.toLowerCase() === normTo.toLowerCase()) {
    return {
      isValid: true,
      convertedValue: numericVal,
      fromUnitCanonical: normFrom,
      toUnitCanonical: normTo,
      dimension: fromDef?.dimension || toDef?.dimension || 'unknown',
    };
  }

  if (!fromDef || !toDef) {
    return {
      isValid: false,
      error: `Unrecognized unit: ${!fromDef ? fromUnit : toUnit}`,
    };
  }

  if (fromDef.dimension !== toDef.dimension) {
    return {
      isValid: false,
      error: `Incompatible dimensions: cannot convert ${fromDef.dimension} (${normFrom}) to ${toDef.dimension} (${normTo}) directly without concentration`,
    };
  }

  if (fromDef.dimension === 'clinical') {
    // Clinical units like IU cannot be automatically converted across different denominations without specific assays
    return {
      isValid: false,
      error: `Clinical unit ${normFrom} cannot be converted automatically to ${normTo}`,
    };
  }

  // Base value = value * fromMultiplier
  const baseValue = numericVal * fromDef.toBaseMultiplier;
  // Target value = baseValue / toMultiplier
  const convertedValue = baseValue / toDef.toBaseMultiplier;

  // Round to 4 decimal places to prevent floating point inaccuracies like 3000.0000000000005
  const cleanConverted = Number(convertedValue.toFixed(4));

  return {
    isValid: true,
    convertedValue: cleanConverted,
    fromUnitCanonical: normFrom,
    toUnitCanonical: normTo,
    dimension: fromDef.dimension,
  };
}

/**
 * Checks if two units are dimensionally compatible for automatic conversion.
 */
export function areUnitsCompatible(unitA?: string | null, unitB?: string | null): boolean {
  if (!unitA || !unitB) return false;
  const normA = normalizeUnitString(unitA);
  const normB = normalizeUnitString(unitB);
  if (normA.toLowerCase() === normB.toLowerCase()) return true;

  const defA = getUnitDefinition(normA);
  const defB = getUnitDefinition(normB);
  if (!defA || !defB) return false;
  if (defA.dimension === 'clinical' || defB.dimension === 'clinical') return false;
  return defA.dimension === defB.dimension;
}

/**
 * Standard list of Dispense Units.
 */
export const DISPENSE_UNITS = [
  'tablet',
  'capsule',
  'vial',
  'ampoule',
  'bottle',
  'tube',
  'sachet',
  'strip',
  'box',
  'pack',
  'mL',
  'L',
  'mg',
  'g',
  'mcg',
  'unit',
  'dose',
  'piece',
  'other',
] as const;

export type DispenseUnit = typeof DISPENSE_UNITS[number] | string;
