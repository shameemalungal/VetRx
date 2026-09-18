// =============================================================
// VetRx — PractitionerHeader.tsx
// Standardized multi-line professional header for Invoices & Receipts
// Matches approved reference PDF visual design
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
  const hasClinic = Boolean(lines.clinicName);

  const rawPhone = practitioner?.phone?.trim() || organisation?.phone?.trim();
  const rawEmail = practitioner?.email?.trim() || organisation?.email?.trim();

  const subtitle = hasClinic && lines.clinicName
    ? `${lines.clinicName.toUpperCase()}${lines.qualifications ? ` • ${lines.qualifications.toUpperCase()}` : ''}`
    : `${(lines.designation || 'INDEPENDENT VETERINARY PRACTITIONER').toUpperCase()}${lines.qualifications ? ` • ${lines.qualifications.toUpperCase()}` : ''}`;

  return (
    <div className={`practitioner-header-container ${className}`.trim()}>
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
              <Icon name="stethoscope" size={22} color="#ffffff" />
            )}
          </div>
        )}

        <div className="practitioner-header-details">
          {/* Line 1. Doctor Name */}
          <h1 className="practitioner-header-doctor-name">
            {lines.name}
          </h1>

          {/* Line 2. Subtitle: Designation / Clinic & Qualifications */}
          <div className="practitioner-header-subtitle">
            {subtitle}
          </div>

          {/* Line 3. Practice Address */}
          {lines.address && (
            <div className="practitioner-header-address">
              {lines.address}
            </div>
          )}

          {/* Line 4. Contact Details */}
          {(rawPhone || rawEmail) && (
            <div className="practitioner-header-contact">
              {rawPhone && <span>Phone: {rawPhone}</span>}
              {rawPhone && rawEmail && <span>•</span>}
              {rawEmail && <span>Email: {rawEmail}</span>}
            </div>
          )}

          {/* Line 5. Registration Pill Badge */}
          {lines.cleanRegNumber && (
            <div className="registration-pill">
              Reg. No.: {lines.cleanRegNumber}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export { formatPractitionerHeaderLines } from '../../utils/practitionerFormat';
