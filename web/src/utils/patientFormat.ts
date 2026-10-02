// =============================================================
// VetRx — patientFormat.ts
// Centralized patient & owner identification formatting helpers.
// Supports named companion animals and unnamed livestock.
// =============================================================

import type { Patient, Owner } from '../types';

/**
 * Checks whether a given animal name is blank, placeholder, or artificial.
 */
export function isArtificialOrBlankName(name?: string | null): boolean {
  if (!name) return true;
  const trimmed = name.trim().toLowerCase();
  if (!trimmed) return true;
  const artificialNames = ['unnamed', 'animal', 'patient', 'unknown', 'n/a', 'na', 'none', '-'];
  return artificialNames.includes(trimmed);
}

/**
 * Formats the animal/patient subtitle.
 *
 * Examples:
 * Named animal:
 *   "Bruno • Canine • Labrador Retriever • 24 kg"
 *
 * Unnamed livestock:
 *   "Bovine • Female • 420 kg • Ear Tag: KL-08-123"
 *
 * Never outputs artificial placeholder names like "Unnamed", "Animal", or "Patient".
 */
export function formatAnimalSubtitle(
  patient?: Partial<Patient> | null,
  options?: { includeWeight?: boolean }
): string {
  if (!patient) return '';

  const includeWeight = options?.includeWeight ?? true;
  const parts: string[] = [];

  // 1. Name (only if real and non-artificial)
  const hasRealName = !isArtificialOrBlankName(patient.name);
  if (hasRealName && patient.name) {
    parts.push(patient.name.trim());
  }

  // 2. Species
  if (patient.species) {
    parts.push(patient.species);
  }

  // 3. Breed
  if (patient.breed && patient.breed.trim()) {
    parts.push(patient.breed.trim());
  }

  // 4. Sex (include if known, especially important for unnamed livestock or if breed is missing)
  if (patient.sex && patient.sex !== 'Unknown') {
    // If there is no individual animal name, sex is a primary identifier (e.g. "Bovine • Female • 420 kg")
    if (!hasRealName || !patient.breed) {
      parts.push(patient.sex);
    }
  }

  // 5. Weight (omitted if caller explicitly sets includeWeight: false)
  if (includeWeight && patient.weightKg !== undefined && patient.weightKg !== null && patient.weightKg > 0) {
    const formattedWeight = Number.isInteger(patient.weightKg)
      ? `${patient.weightKg} kg`
      : `${patient.weightKg.toFixed(1)} kg`;
    parts.push(formattedWeight);
  }

  // 6. Ear Tag / Animal ID / Chart Reference
  if (patient.identificationRef && patient.identificationRef.trim()) {
    const ref = patient.identificationRef.trim();
    if (/^(ear\s*tag|tag)/i.test(ref)) {
      parts.push(ref);
    } else if (ref.startsWith('#')) {
      parts.push(`Ref: ${ref}`);
    } else if (patient.species === 'Bovine' || patient.species === 'Other') {
      parts.push(`Ear Tag: ${ref}`);
    } else {
      parts.push(`ID: ${ref}`);
    }
  } else if (patient.microchipNumber && patient.microchipNumber.trim()) {
    parts.push(`Microchip: ${patient.microchipNumber.trim()}`);
  }

  return parts.join(' • ');
}

/**
 * Returns formatted primary owner display name.
 */
export function formatOwnerPrimary(owner?: Partial<Owner> | null, fallback = 'Client'): string {
  if (!owner || !owner.name || !owner.name.trim()) {
    return fallback;
  }
  return owner.name.trim();
}

/**
 * Formats patient age with clear units (e.g. "2 years", "6 months", "1 year 3 months").
 * Handles raw numeric inputs ("2", "1.5"), abbreviated strings ("2y", "6m"),
 * existing descriptive notes ("2 years", "Adult"), and dates of birth.
 */
export function formatPatientAge(patient?: Partial<Patient> | null): string {
  if (!patient) return '';

  const raw = patient.ageNote?.trim();
  if (raw) {
    // Check if it's already a full human phrase with units like "years", "months", "weeks", "days"
    if (/\b(year|yr|month|mo|week|wk|day)\b/i.test(raw)) {
      return raw;
    }

    // Check if it's a pure number or decimal e.g. "2", "2.5", "1", "0.5"
    const numeric = parseFloat(raw);
    if (!isNaN(numeric) && /^\d+(\.\d+)?$/.test(raw)) {
      if (numeric === 1) return '1 year';
      if (numeric > 0 && numeric < 1) {
        const mos = Math.round(numeric * 12);
        return mos === 1 ? '1 month' : `${mos} months`;
      }
      if (numeric >= 1) {
        return Number.isInteger(numeric) ? `${numeric} years` : `${numeric} years`;
      }
    }

    // Check abbreviated strings like "2y", "2 y", "6m", "6 m", "3w", "4d"
    const matchY = raw.match(/^(\d+(?:\.\d+)?)\s*y(?:ears?|rs?)?$/i);
    if (matchY) {
      const val = parseFloat(matchY[1]);
      return val === 1 ? '1 year' : `${val} years`;
    }

    const matchM = raw.match(/^(\d+(?:\.\d+)?)\s*m(?:onths?|os?)?$/i);
    if (matchM) {
      const val = parseFloat(matchM[1]);
      return val === 1 ? '1 month' : `${val} months`;
    }

    const matchW = raw.match(/^(\d+)\s*w(?:eeks?|ks?)?$/i);
    if (matchW) {
      const val = parseInt(matchW[1], 10);
      return val === 1 ? '1 week' : `${val} weeks`;
    }

    const matchD = raw.match(/^(\d+)\s*d(?:ays?)?$/i);
    if (matchD) {
      const val = parseInt(matchD[1], 10);
      return val === 1 ? '1 day' : `${val} days`;
    }

    // If it's a qualitative note like "Adult", "Senior", "Puppy", preserve it
    return raw;
  }

  // Fallback to dateOfBirth if ageNote is not provided
  if (patient.dateOfBirth) {
    const now = new Date();
    const dob = new Date(patient.dateOfBirth);
    if (!isNaN(dob.getTime())) {
      const months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
      if (months <= 0) {
        const diffDays = Math.max(1, Math.floor((now.getTime() - dob.getTime()) / (1000 * 60 * 60 * 24)));
        return diffDays === 1 ? '1 day' : `${diffDays} days`;
      }
      if (months < 12) {
        return months === 1 ? '1 month' : `${months} months`;
      }
      const years = Math.floor(months / 12);
      const remMonths = months % 12;
      if (remMonths > 0) {
        return `${years} ${years === 1 ? 'year' : 'years'} ${remMonths} ${remMonths === 1 ? 'month' : 'months'}`;
      }
      return years === 1 ? '1 year' : `${years} years`;
    }
  }

  return '';
}

