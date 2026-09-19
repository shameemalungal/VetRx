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
