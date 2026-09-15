import type { Medicine, Species, WeightBandRule } from '../types';

export interface DoseCalculationResult {
  status:
    | 'calculated'
    | 'range'
    | 'band'
    | 'fixed'
    | 'volume_per_weight'
    | 'reconstituted_liquid'
    | 'reconstituted_drops'
    | 'missing_weight'
    | 'missing_drops_per_ml'
    | 'species_mismatch'
    | 'invalid_parameters'
    | 'no_rule';
  calculatedDoseValue?: number;
  calculatedDoseUnit?: string;
  minCalculatedDose?: number;
  maxCalculatedDose?: number;
  formattedDoseString: string;
  formulaDisplay?: string;
  matchedBand?: WeightBandRule;
  warningMessage?: string;
  requiresManualDose: boolean;
  suggestedRoute?: string;
  suggestedFrequency?: string;
  suggestedDurationDays?: number;
  suggestedDirections?: string;
  calculatedQuantity?: number;
  quantityUnit?: string;
  quantityFormulaDisplay?: string;
  calculatedSourceEquivalent?: string; // e.g. "1/20 tablet equivalent (0.05 tablet)"
  calculatedVolumeMl?: number;         // e.g. 1 mL for drops
}

/**
 * Parses common frequency strings to doses per day.
 * Returns undefined if non-standard or PRN (as needed).
 */
export function getDosesPerDay(frequency?: string): number | undefined {
  if (!frequency) return undefined;
  const f = frequency.trim().toUpperCase();
  if (f === 'SID' || f === 'OD' || f === 'DAILY' || f === 'ONCE DAILY' || f === 'Q24H') return 1;
  if (f === 'BID' || f === 'TWICE DAILY' || f === 'Q12H') return 2;
  if (f === 'TID' || f === 'THRICE DAILY' || f === 'THREE TIMES DAILY' || f === 'Q8H') return 3;
  if (f === 'QID' || f === 'FOUR TIMES DAILY' || f === 'Q6H') return 4;
  if (f === 'EOD' || f === 'EVERY OTHER DAY') return 0.5;
  return undefined;
}

/**
 * Calculates dispensing quantity if explicit formulation data exists.
 * Formula: Quantity = (Dose / Strength) * DosesPerDay * DurationDays
 * Or if dose is already in presentation units (tablets, sachets):
 * Quantity = Dose * DosesPerDay * DurationDays
 */
export function calculateDispenseQuantity(
  arg1: number | Medicine,
  arg2: string | number,
  arg3?: string | number,
  arg4?: number,
  arg5?: Medicine | string
): { quantity?: number; formulaDisplay?: string; unit?: string } {
  let medicine: Medicine | undefined;
  let doseValue: number;
  let doseUnit: string;
  let frequency: string | undefined;
  let durationDays: number | undefined;

  if (typeof arg1 === 'object' && arg1 !== null) {
    // Called with (medicine, doseValue, frequency, durationDays, doseUnit)
    medicine = arg1 as Medicine;
    doseValue = typeof arg2 === 'number' ? arg2 : parseFloat(arg2) || 0;
    frequency = typeof arg3 === 'string' ? arg3 : undefined;
    durationDays = arg4;
    doseUnit = typeof arg5 === 'string' ? arg5 : medicine.doseUnit || 'mg';
  } else {
    // Called with (doseValue, doseUnit, frequency, durationDays, medicine)
    doseValue = arg1 as number;
    doseUnit = arg2 as string;
    frequency = typeof arg3 === 'string' ? arg3 : undefined;
    durationDays = arg4;
    medicine = typeof arg5 === 'object' ? (arg5 as Medicine) : undefined;
  }

  if (!medicine) {
    return {};
  }

  const dosesPerDay = getDosesPerDay(frequency);
  if (!dosesPerDay || !durationDays || durationDays <= 0 || doseValue <= 0) {
    return {};
  }

  const targetUnit = medicine.defaultUnit || 'tablets';

  // Case 1: Dose unit matches medicine default presentation unit (e.g. 1 tablet, 1 sachet)
  if (doseUnit.toLowerCase() === targetUnit.toLowerCase() || 
      (targetUnit.toLowerCase().startsWith('tablet') && doseUnit.toLowerCase().startsWith('tablet')) ||
      (targetUnit.toLowerCase().startsWith('sachet') && doseUnit.toLowerCase().startsWith('sachet')) ||
      (targetUnit.toLowerCase().startsWith('capsule') && doseUnit.toLowerCase().startsWith('capsule'))) {
    const total = doseValue * dosesPerDay * durationDays;
    return {
      quantity: Number(total.toFixed(2)),
      unit: targetUnit,
      formulaDisplay: `${doseValue} ${doseUnit}/dose × ${dosesPerDay} doses/day × ${durationDays} days = ${total} ${targetUnit}`
    };
  }

  // Case 2: Explicit concentration/strength is configured
  // Support both concentrationStrength and formulationStrengthValue
  const strengthVal = medicine.concentrationStrength ?? (medicine as any).formulationStrengthValue;
  const strengthUnit = medicine.concentrationStrengthUnit || (medicine as any).formulationStrengthUnit;
  const volumeMultiplier = medicine.concentrationVolume || 1;
  const volumeUnit = medicine.concentrationVolumeUnit || (medicine as any).formulationPresentationUnit || medicine.defaultUnit || targetUnit;

  if (
    strengthVal &&
    strengthVal > 0 &&
    strengthUnit &&
    strengthUnit.toLowerCase() === doseUnit.toLowerCase()
  ) {
    const unitsPerDose = (doseValue / strengthVal) * volumeMultiplier;
    const totalUnits = unitsPerDose * dosesPerDay * durationDays;
    const finalUnit = volumeUnit;

    return {
      quantity: Number(totalUnits.toFixed(2)),
      unit: finalUnit,
      formulaDisplay: `${doseValue} ${doseUnit}/dose ÷ ${strengthVal} ${strengthUnit} × ${dosesPerDay} doses/day × ${durationDays} days = ${Number(totalUnits.toFixed(2))} ${finalUnit}`
    };
  }

  // Without explicit conversion rule, do NOT invent conversion values
  return {};
}

/**
 * Validates whether an entered dose is within configured min and max range.
 * Supports calling with (enteredDose, minDose, maxDose) or (medicine, enteredDose, patientWeightKg).
 * Returns exact Section 8 warning string:
 * "Entered dose is outside the configured dose range. Please review before continuing."
 */
export function validateDoseRange(
  arg1: number | Medicine,
  arg2?: number,
  arg3?: number
): { isOutOfRange: boolean; warning?: string } {
  let enteredDose: number;
  let minDose: number | undefined;
  let maxDose: number | undefined;

  if (typeof arg1 === 'object' && arg1 !== null) {
    // Called with (medicine, enteredDose, patientWeightKg)
    const medicine = arg1 as Medicine;
    enteredDose = arg2 ?? 0;
    const weightKg = arg3;
    if (weightKg && weightKg > 0) {
      minDose = medicine.minDosePerKg ? medicine.minDosePerKg * weightKg : undefined;
      maxDose = medicine.maxDosePerKg ? medicine.maxDosePerKg * weightKg : undefined;
    }
  } else {
    // Called with (enteredDose, minDose, maxDose)
    enteredDose = arg1 as number;
    minDose = arg2;
    maxDose = arg3;
  }

  if (minDose !== undefined && enteredDose < minDose) {
    return {
      isOutOfRange: true,
      warning: 'Entered dose is outside the configured dose range. Please review before continuing.'
    };
  }
  if (maxDose !== undefined && enteredDose > maxDose) {
    return {
      isOutOfRange: true,
      warning: 'Entered dose is outside the configured dose range. Please review before continuing.'
    };
  }
  return { isOutOfRange: false };
}

/**
 * Deterministic Smart Dose Calculator
 * Uses ONLY configured medicine dosing rules, patient species, and patient weight.
 * Strictly zero AI / external APIs.
 */
export function calculateSmartDose(
  medicine: Medicine,
  patientWeightKg?: number,
  patientSpecies?: Species
): DoseCalculationResult {
  // Common suggestions from medicine config
  const suggestedRoute = medicine.defaultRoute || 'Oral';
  const suggestedFrequency = medicine.defaultFrequency || 'BID';
  const suggestedDurationDays = medicine.defaultDurationDays || 5;
  const suggestedDirections = medicine.defaultDirections || '';

  // 1. Check if medicine has a dosing method configured
  if (!medicine.dosingMethod || medicine.dosingMethod === 'none') {
    return {
      status: 'no_rule',
      formattedDoseString: '',
      requiresManualDose: true,
      warningMessage: 'No dosing rule is configured for this medicine. Please enter and verify the dose manually.',
      suggestedRoute,
      suggestedFrequency,
      suggestedDurationDays,
      suggestedDirections
    };
  }

  // 2. Check species applicability
  if (medicine.targetSpecies && medicine.targetSpecies.length > 0 && patientSpecies) {
    const isSpeciesAllowed = medicine.targetSpecies.includes(patientSpecies);
    if (!isSpeciesAllowed) {
      return {
        status: 'species_mismatch',
        formattedDoseString: '',
        requiresManualDose: true,
        warningMessage: `Caution: No dosing rule is configured for ${patientSpecies} (Configured for: ${medicine.targetSpecies.join(', ')}). Please enter and verify the dose manually.`,
        suggestedRoute,
        suggestedFrequency,
        suggestedDurationDays,
        suggestedDirections
      };
    }
  }

  // 3. Handle FIXED DOSE (Does not require patient weight)
  if (medicine.dosingMethod === 'fixed' || (medicine.dosingMethod as string) === 'fixed_dose') {
    const doseVal = medicine.fixedDose !== undefined ? medicine.fixedDose : 1;
    const unit = medicine.doseUnit || medicine.defaultUnit || 'tablet';
    const formatted = `${doseVal} ${unit}/dose`;
    const formula = `Fixed dose: ${doseVal} ${unit} per dose (no weight calculation)`;

    // Calculate dispense quantity if default frequency and duration exist
    const qtyResult = calculateDispenseQuantity(doseVal, unit, suggestedFrequency, suggestedDurationDays, medicine);

    return {
      status: 'fixed',
      calculatedDoseValue: doseVal,
      calculatedDoseUnit: unit,
      formattedDoseString: formatted,
      formulaDisplay: formula,
      requiresManualDose: false,
      suggestedRoute,
      suggestedFrequency,
      suggestedDurationDays,
      suggestedDirections,
      calculatedQuantity: qtyResult.quantity,
      quantityUnit: qtyResult.unit,
      quantityFormulaDisplay: qtyResult.formulaDisplay
    };
  }

  // 3b. Handle RECONSTITUTED TABLET/UNIT -> LIQUID VOLUME (Does not require patient weight)
  if (medicine.dosingMethod === 'reconstituted_liquid') {
    const srcQty = medicine.reconstitutionSourceQty;
    const srcUnit = medicine.reconstitutionSourceUnit || 'tablet';
    const dilVol = medicine.reconstitutionDiluentVolume;
    const dilUnit = medicine.reconstitutionDiluentUnit || 'mL';
    const adminVol = medicine.reconstitutionAdminVolume;
    const adminUnit = medicine.reconstitutionAdminUnit || 'mL';

    // Validation: check for missing, zero, or negative values
    if (
      srcQty === undefined || srcQty === null || srcQty <= 0 ||
      dilVol === undefined || dilVol === null || dilVol <= 0 ||
      adminVol === undefined || adminVol === null || adminVol <= 0
    ) {
      return {
        status: 'invalid_parameters',
        formattedDoseString: '',
        requiresManualDose: true,
        warningMessage: 'Reconstitution requires positive Source Quantity, Diluent Volume, and Administration Dose.',
        suggestedRoute,
        suggestedFrequency,
        suggestedDurationDays,
        suggestedDirections,
      };
    }

    // Fraction of original source quantity: (Admin Volume / Diluent Volume) * Source Quantity
    const fractionVal = (adminVol / dilVol) * srcQty;
    const simplifiedFraction = Number(fractionVal.toFixed(4));
    const sourceEquiv = `${srcQty === 1 ? `1/${Math.round(dilVol / adminVol)}` : simplifiedFraction} ${srcUnit} equivalent (${simplifiedFraction} ${srcUnit})`;

    const formatted = `${adminVol} ${adminUnit}`;
    const formula = `Reconstituted: ${srcQty} ${srcUnit} in ${dilVol} ${dilUnit} → Administer ${adminVol} ${adminUnit} (${sourceEquiv})`;

    const qtyResult = calculateDispenseQuantity(adminVol, adminUnit, suggestedFrequency, suggestedDurationDays, medicine);

    return {
      status: 'reconstituted_liquid',
      calculatedDoseValue: adminVol,
      calculatedDoseUnit: adminUnit,
      formattedDoseString: formatted,
      formulaDisplay: formula,
      calculatedSourceEquivalent: sourceEquiv,
      requiresManualDose: false,
      suggestedRoute,
      suggestedFrequency,
      suggestedDurationDays,
      suggestedDirections,
      calculatedQuantity: qtyResult.quantity,
      quantityUnit: qtyResult.unit || adminUnit,
      quantityFormulaDisplay: qtyResult.formulaDisplay,
    };
  }

  // 3c. Handle RECONSTITUTED TABLET/UNIT -> DROPS (Does not require patient weight)
  if (medicine.dosingMethod === 'reconstituted_drops') {
    const srcQty = medicine.reconstitutionSourceQty;
    const srcUnit = medicine.reconstitutionSourceUnit || 'tablet';
    const dilVol = medicine.reconstitutionDiluentVolume;
    const dilUnit = medicine.reconstitutionDiluentUnit || 'mL';
    const dropsPerMl = medicine.dropsPerMl;
    const doseInDrops = medicine.doseDrops;

    // Safety requirement: Missing dropsPerMl must NOT assume 20 drops/mL!
    if (!dropsPerMl || dropsPerMl <= 0) {
      return {
        status: 'missing_drops_per_ml',
        formattedDoseString: doseInDrops && doseInDrops > 0 ? `${doseInDrops} drops` : '',
        requiresManualDose: true,
        warningMessage: 'Calibrated Drops per mL is required to calculate liquid volume and source equivalent. Do not assume 20 drops = 1 mL.',
        suggestedRoute,
        suggestedFrequency,
        suggestedDurationDays,
        suggestedDirections,
      };
    }

    if (
      srcQty === undefined || srcQty === null || srcQty <= 0 ||
      dilVol === undefined || dilVol === null || dilVol <= 0 ||
      doseInDrops === undefined || doseInDrops === null || doseInDrops <= 0
    ) {
      return {
        status: 'invalid_parameters',
        formattedDoseString: '',
        requiresManualDose: true,
        warningMessage: 'Reconstitution requires positive Source Quantity, Diluent Volume, Drops per mL, and Dose in Drops.',
        suggestedRoute,
        suggestedFrequency,
        suggestedDurationDays,
        suggestedDirections,
      };
    }

    // Calculated mL = Dose in Drops ÷ Drops per mL
    const calculatedMl = Number((doseInDrops / dropsPerMl).toFixed(3));
    // Fraction of source = Calculated mL ÷ Reconstitution Volume × Source Quantity
    const fractionVal = (calculatedMl / dilVol) * srcQty;
    const simplifiedFraction = Number(fractionVal.toFixed(4));
    const sourceEquiv = `${simplifiedFraction} ${srcUnit} equivalent`;

    const formatted = `${doseInDrops} drops (${calculatedMl} mL)`;
    const formula = `${doseInDrops} drops ÷ ${dropsPerMl} drops/mL = ${calculatedMl} mL administered (${srcQty} ${srcUnit} in ${dilVol} ${dilUnit} → ${sourceEquiv})`;

    const qtyResult = calculateDispenseQuantity(doseInDrops, 'drops', suggestedFrequency, suggestedDurationDays, medicine);

    return {
      status: 'reconstituted_drops',
      calculatedDoseValue: doseInDrops,
      calculatedDoseUnit: 'drops',
      calculatedVolumeMl: calculatedMl,
      calculatedSourceEquivalent: sourceEquiv,
      formattedDoseString: formatted,
      formulaDisplay: formula,
      requiresManualDose: false,
      suggestedRoute,
      suggestedFrequency,
      suggestedDurationDays,
      suggestedDirections,
      calculatedQuantity: qtyResult.quantity,
      quantityUnit: qtyResult.unit || 'drops',
      quantityFormulaDisplay: qtyResult.formulaDisplay,
    };
  }

  // For weight-dependent dosing methods, patient weight is mandatory
  if (patientWeightKg === undefined || patientWeightKg === null || patientWeightKg <= 0 || isNaN(patientWeightKg)) {
    return {
      status: 'missing_weight',
      formattedDoseString: '',
      requiresManualDose: true,
      warningMessage: 'Enter patient weight to calculate dose.',
      suggestedRoute,
      suggestedFrequency,
      suggestedDurationDays,
      suggestedDirections
    };
  }

  const weight = patientWeightKg;
  const doseUnit = medicine.doseUnit || 'mg';

  // 3d. Handle VOLUME PER BODY WEIGHT (e.g. 1 mL per 20 kg)
  if (medicine.dosingMethod === 'volume_per_weight') {
    const doseAmt = medicine.doseVolumeAmount !== undefined ? medicine.doseVolumeAmount : (medicine.fixedDose || 1);
    const volUnit = medicine.doseVolumeUnit || medicine.doseUnit || 'mL';
    const weightBasis = medicine.weightBasis;
    const weightUnit = medicine.weightBasisUnit || 'kg';

    if (!weightBasis || weightBasis <= 0) {
      return {
        status: 'invalid_parameters',
        formattedDoseString: '',
        requiresManualDose: true,
        warningMessage: 'Weight basis must be greater than 0 (e.g. 20 for 1 mL per 20 kg).',
        suggestedRoute,
        suggestedFrequency,
        suggestedDurationDays,
        suggestedDirections,
      };
    }

    if (doseAmt <= 0) {
      return {
        status: 'invalid_parameters',
        formattedDoseString: '',
        requiresManualDose: true,
        warningMessage: 'Dose volume amount must be greater than 0.',
        suggestedRoute,
        suggestedFrequency,
        suggestedDurationDays,
        suggestedDirections,
      };
    }

    // Calculated Volume = Patient Weight × (Dose Amount ÷ Weight Basis)
    const calculatedVolume = Number((weight * (doseAmt / weightBasis)).toFixed(2));
    const formula = `${weight} ${weightUnit} × (${doseAmt} ${volUnit} ÷ ${weightBasis} ${weightUnit}) = ${calculatedVolume} ${volUnit}`;
    const formatted = `${calculatedVolume} ${volUnit}/dose`;

    const qtyResult = calculateDispenseQuantity(calculatedVolume, volUnit, suggestedFrequency, suggestedDurationDays, medicine);

    return {
      status: 'volume_per_weight',
      calculatedDoseValue: calculatedVolume,
      calculatedDoseUnit: volUnit,
      formattedDoseString: formatted,
      formulaDisplay: formula,
      requiresManualDose: false,
      suggestedRoute,
      suggestedFrequency,
      suggestedDurationDays,
      suggestedDirections,
      calculatedQuantity: qtyResult.quantity,
      quantityUnit: qtyResult.unit || volUnit,
      quantityFormulaDisplay: qtyResult.formulaDisplay,
    };
  }

  // 4. Handle WEIGHT-BASED (e.g. 10 mg/kg)
  if (medicine.dosingMethod === 'weight_based') {
    const dosePerKg = medicine.dosePerKg;
    if (!dosePerKg || dosePerKg <= 0) {
      return {
        status: 'no_rule',
        formattedDoseString: '',
        requiresManualDose: true,
        warningMessage: 'Dose per kg is not configured. Please enter the dose manually.',
        suggestedRoute,
        suggestedFrequency,
        suggestedDurationDays,
        suggestedDirections
      };
    }

    const calculatedTotalDose = Number((weight * dosePerKg).toFixed(2));
    const formula = `${weight} kg × ${dosePerKg} ${doseUnit}/kg = ${calculatedTotalDose} ${doseUnit}/dose`;
    const formatted = `${calculatedTotalDose} ${doseUnit}/dose`;

    const qtyResult = calculateDispenseQuantity(calculatedTotalDose, doseUnit, suggestedFrequency, suggestedDurationDays, medicine);

    return {
      status: 'calculated',
      calculatedDoseValue: calculatedTotalDose,
      calculatedDoseUnit: doseUnit,
      formattedDoseString: formatted,
      formulaDisplay: formula,
      requiresManualDose: false,
      suggestedRoute,
      suggestedFrequency,
      suggestedDurationDays,
      suggestedDirections,
      calculatedQuantity: qtyResult.quantity,
      quantityUnit: qtyResult.unit,
      quantityFormulaDisplay: qtyResult.formulaDisplay
    };
  }

  // 5. Handle WEIGHT-BASED RANGE (e.g. 10–20 mg/kg)
  if (medicine.dosingMethod === 'weight_range') {
    const minPerKg = medicine.minDosePerKg || medicine.dosePerKg || 0;
    const maxPerKg = medicine.maxDosePerKg || minPerKg;

    if (minPerKg <= 0 && maxPerKg <= 0) {
      return {
        status: 'no_rule',
        formattedDoseString: '',
        requiresManualDose: true,
        warningMessage: 'Dose range is not configured. Please enter the dose manually.',
        suggestedRoute,
        suggestedFrequency,
        suggestedDurationDays,
        suggestedDirections
      };
    }

    const minCalculated = Number((weight * minPerKg).toFixed(2));
    const maxCalculated = Number((weight * maxPerKg).toFixed(2));
    // Default suggestion is midpoint or min dose
    const defaultDose = minCalculated;
    const formatted = `${minCalculated}–${maxCalculated} ${doseUnit}/dose`;
    const formula = `Configured range: ${minPerKg}–${maxPerKg} ${doseUnit}/kg | Patient weight: ${weight} kg | Calculated range: ${minCalculated}–${maxCalculated} ${doseUnit}/dose`;

    const qtyResult = calculateDispenseQuantity(defaultDose, doseUnit, suggestedFrequency, suggestedDurationDays, medicine);

    return {
      status: 'range',
      calculatedDoseValue: defaultDose,
      calculatedDoseUnit: doseUnit,
      minCalculatedDose: minCalculated,
      maxCalculatedDose: maxCalculated,
      formattedDoseString: formatted,
      formulaDisplay: formula,
      requiresManualDose: false,
      suggestedRoute,
      suggestedFrequency,
      suggestedDurationDays,
      suggestedDirections,
      calculatedQuantity: qtyResult.quantity,
      quantityUnit: qtyResult.unit,
      quantityFormulaDisplay: qtyResult.formulaDisplay
    };
  }

  // 6. Handle WEIGHT-BAND
  if (medicine.dosingMethod === 'weight_band') {
    const bands = medicine.weightBands || [];
    if (bands.length === 0) {
      return {
        status: 'no_rule',
        formattedDoseString: '',
        requiresManualDose: true,
        warningMessage: 'No weight bands configured. Please enter the dose manually.',
        suggestedRoute,
        suggestedFrequency,
        suggestedDurationDays,
        suggestedDirections
      };
    }

    // Find applicable band
    // Criteria: weight >= minWeightKg (or no min) and weight <= maxWeightKg (or no max)
    const matched = bands.find((b) => {
      const minOk = b.minWeightKg === undefined || b.minWeightKg === null || weight >= b.minWeightKg;
      const maxOk = b.maxWeightKg === undefined || b.maxWeightKg === null || weight <= b.maxWeightKg;
      return minOk && maxOk;
    });

    if (!matched) {
      return {
        status: 'no_rule',
        formattedDoseString: '',
        requiresManualDose: true,
        warningMessage: `Patient weight (${weight} kg) does not fall into any configured weight band. Please enter the dose manually.`,
        suggestedRoute,
        suggestedFrequency,
        suggestedDurationDays,
        suggestedDirections
      };
    }

    const bandLabel = matched.label || `${matched.minWeightKg ?? 0}–${matched.maxWeightKg ?? '∞'} kg`;
    const formatted = `${matched.doseValue} ${matched.doseUnit}/dose`;
    const formula = `Weight band matched: ${bandLabel} for patient weight ${weight} kg → ${matched.doseValue} ${matched.doseUnit}/dose`;

    const qtyResult = calculateDispenseQuantity(matched.doseValue, matched.doseUnit, suggestedFrequency, suggestedDurationDays, medicine);

    return {
      status: 'band',
      calculatedDoseValue: matched.doseValue,
      calculatedDoseUnit: matched.doseUnit,
      formattedDoseString: formatted,
      formulaDisplay: formula,
      matchedBand: matched,
      requiresManualDose: false,
      suggestedRoute,
      suggestedFrequency,
      suggestedDurationDays,
      suggestedDirections,
      calculatedQuantity: qtyResult.quantity,
      quantityUnit: qtyResult.unit,
      quantityFormulaDisplay: qtyResult.formulaDisplay
    };
  }

  return {
    status: 'no_rule',
    formattedDoseString: '',
    requiresManualDose: true,
    warningMessage: 'No applicable dosing rule found. Please enter dose manually.',
    suggestedRoute,
    suggestedFrequency,
    suggestedDurationDays,
    suggestedDirections
  };
}

/**
 * Safely normalizes numeric values for controlled input bindings.
 * Preserves numeric zero ('0'), returns string representation for valid numbers,
 * and distinguishes null/undefined as empty string ('') without destructive falsy coercion.
 */
export function formatControlledNumber(val: number | string | undefined | null): string {
  if (val === undefined || val === null) return '';
  if (typeof val === 'number') {
    if (isNaN(val)) return '';
    return String(val);
  }
  const str = String(val).trim();
  if (str === '') return '';
  if (isNaN(Number(str)) && str !== '-' && str !== '.') return '';
  return str;
}
