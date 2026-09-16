// =============================================================
// VetRx — PractitionerHeader.tsx
// Standardized multi-line professional header for Invoices & Receipts
// Displays complete practitioner credentials from active profile.
// =============================================================

import React from 'react';
import type { Practitioner, Organisation } from '../../types';
import { Icon } from '../ui/Icon';
import { formatPractitionerHeaderLines } from '../../utils/practitionerFormat';
import './PractitionerHeader.css';

export interface PractitionerHeaderProps {
  practitioner?: Practitioner | null;
  organisation?: Organisation | null;
  showLogo?: boolean;
  className?: string;
}

export const PractitionerHeader: React.FC<PractitionerHeaderProps> = ({
  practitioner,
  organisation,
  showLogo = true,
  className = '',
}) => {
  const lines = formatPractitionerHeaderLines(practitioner, organisation);
  const designation = lines.designation || 'Veterinary Practitioner';

  const hasClinic = Boolean(lines.clinicName);

  return (
    <div className={`practitioner-header-container ${className}`.trim()}>
      <div className="practitioner-header-branding">
        {showLogo && (
          <div className="practitioner-header-logo-box">
            {hasClinic && organisation?.logoDataUrl ? (
              <img
                src={organisation.logoDataUrl}
                alt="Clinic Logo"
                className="practitioner-header-img"
              />
            ) : practitioner?.photoDataUrl ? (
              <img
                src={practitioner.photoDataUrl}
                alt={lines.name}
                className="practitioner-header-img cover"
              />
            ) : (
              <Icon name="pets" size={28} />
            )}
          </div>
        )}

        <div className="practitioner-header-details">
          {/* Clinic Name if clinic mode is enabled */}
          {hasClinic && (
            <h2 className="practitioner-header-clinic-name">
              {lines.clinicName}
            </h2>
          )}

          {/* Line 1. Practitioner Name */}
          <h1 className="practitioner-header-doctor-name">
            {lines.name}
          </h1>

          {/* Line 2. Qualifications on their own line */}
          {lines.qualifications && (
            <div className="practitioner-header-qualifications">
              {lines.qualifications}
            </div>
          )}

          {/* Line 3. Professional Designation on its own line */}
          <div className="practitioner-header-designation">
            {designation}
          </div>

          {/* Line 4. Registration Number */}
          {lines.regNumber && (
            <div className="practitioner-header-reg">
              {lines.regNumber}
            </div>
          )}

          {/* Line 5. Phone and Email on a dedicated line */}
          {lines.contact && (
            <div className="practitioner-header-contact">
              {lines.contact}
            </div>
          )}

          {/* Line 6. Address on its own line */}
          {lines.address && (
            <div className="practitioner-header-address">
              Address: {lines.address}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { formatPractitionerHeaderLines } from '../../utils/practitionerFormat';
