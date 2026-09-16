import type { Practitioner, Organisation } from '../types/index.js';

export interface FormattedPractitionerLines {
  clinicName?: string;
  name: string;
  qualifications?: string;
  designation?: string;
  regNumber?: string;
  contact?: string;
  address?: string;
}

/**
 * Standard multi-line clinical practitioner header formatter.
 * Line 1: Doctor Name
 * Line 2: Qualifications
 * Line 3: Designation / Title
 * Line 4: Registration Number
 * Line 5: Contact Phone & Email
 * Line 6: Physical Practice Address
 */
export function formatPractitionerHeaderLines(
  practitioner?: Practitioner | null,
  organisation?: Organisation | null
): FormattedPractitionerLines {
  const isClinicActive =
    organisation &&
    organisation.isActive !== false &&
    organisation.name &&
    organisation.name.trim().toLowerCase() !== 'independent practitioner';

  const name = practitioner?.name?.trim() || 'Veterinary Practitioner';
  const qualifications = practitioner?.qualifications?.trim() || undefined;
  const designation = practitioner?.designation?.trim() || undefined;

  let regNumber = practitioner?.registrationNumber?.trim();
  if (regNumber && !regNumber.toLowerCase().startsWith('reg')) {
    regNumber = `Reg. No: ${regNumber}`;
  }

  const phone = practitioner?.phone?.trim() || organisation?.phone?.trim();
  const email = practitioner?.email?.trim() || organisation?.email?.trim();

  const contactParts: string[] = [];
  if (phone) contactParts.push(`Mob: ${phone}`);
  if (email) contactParts.push(`Email: ${email}`);
  const contact = contactParts.length > 0 ? contactParts.join(' • ') : undefined;

  const address =
    (isClinicActive ? organisation?.address?.trim() : undefined) ||
    practitioner?.address?.trim() ||
    undefined;

  return {
    clinicName: isClinicActive ? organisation?.name?.trim() : undefined,
    name,
    qualifications,
    designation,
    regNumber: regNumber || undefined,
    contact,
    address,
  };
}
