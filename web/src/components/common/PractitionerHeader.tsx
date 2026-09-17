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
      <div className="practitioner-header-wrapper">
        <span className="practitioner-header-tag">
          {designation || 'Veterinary Practitioner'}
        </span>
        {hasClinic && lines.clinicName && (
          <h2 className="practitioner-header-clinic-name">
            {lines.clinicName}
          </h2>
        )}

        <div className="practitioner-header-branding">
          {showLogo && (
            <div className="practitioner-header-logo-box">
              {practitioner?.photoDataUrl ? (
                <img
                  src={practitioner.photoDataUrl}
                  alt={lines.name}
                  className="practitioner-header-img cover"
                />
              ) : hasClinic && organisation?.logoDataUrl ? (
                <img
                  src={organisation.logoDataUrl}
                  alt="Clinic Logo"
                  className="practitioner-header-img"
                />
              ) : (
                <Icon name="pets" size={26} />
              )}
            </div>
          )}

          <div className="practitioner-header-details">
            {/* Line 1. Practitioner Name */}
            <h1 className="practitioner-header-doctor-name">
              {lines.name}
            </h1>

            {/* Line 2. Qualifications */}
            {lines.qualifications && (
              <div className="practitioner-header-qualifications">
                {lines.qualifications}
              </div>
            )}

            {/* Line 3. Registration Line */}
            {lines.cleanRegNumber && (
              <div className="registration-line">
                <span className="registration-label">Reg. No.:</span>{' '}
                <span className="registration-value">{lines.cleanRegNumber}</span>
              </div>
            )}

            {/* Line 4. Contact Details */}
            {lines.contact && (
              <div className="practitioner-header-contact">
                {lines.contact}
              </div>
            )}

            {/* Line 5. Address */}
            {lines.address && (
              <div className="practitioner-header-address">
                Address: {lines.address}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export { formatPractitionerHeaderLines } from '../../utils/practitionerFormat';
