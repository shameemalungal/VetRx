// =============================================================
// VetRx — PrescriptionDocument.tsx
// Authoritative, Single-Source-of-Truth Prescription Document Component
// Shared identically by:
//   1. Screen Preview
//   2. Browser Print (window.print() -> Microsoft Print to PDF)
//   3. Direct Client-Side PDF Generation (Save PDF)
// =============================================================

import React from 'react';
import { Icon } from '../ui/Icon';
import { formatAnimalSubtitle, formatOwnerPrimary, isArtificialOrBlankName, formatPatientAge } from '../../utils/patientFormat';
import type { Prescription, PrescriptionItem, Patient, Owner, Practitioner, Organisation } from '../../types';
import './DocumentStyles.css';

export interface PrescriptionDocumentProps {
  prescription: Prescription;
  items: PrescriptionItem[];
  patient?: Patient | null;
  owner?: Owner | null;
  activePractitioner?: Practitioner | null;
  activeOrganisation?: Organisation | null;
  id?: string;
}

export const PrescriptionDocument: React.FC<PrescriptionDocumentProps> = ({
  prescription,
  items,
  patient,
  owner,
  activePractitioner,
  activeOrganisation,
  id = 'prescription-sheet',
}) => {
  // Format Dates
  const createdDate = new Date(prescription.createdAt);
  const formattedDate = createdDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  const followUpDays = prescription.followUpDays || 7;
  const followUpDate = new Date(createdDate.getTime() + followUpDays * 24 * 60 * 60 * 1000);
  const formattedFollowUpDate = followUpDate.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  // Instruction points
  const instructionList = Array.isArray(prescription.instructions)
    ? prescription.instructions
    : typeof prescription.instructions === 'string' && prescription.instructions.trim()
    ? prescription.instructions
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean)
    : [
        'Give oral medicines strictly following a meal.',
        'Keep treated area clean and dry during recovery.',
        'Fit protective Elizabethan collar if persistent licking or scratching resumes.',
        'Complete entire antimicrobial regimen even if clinical signs resolve earlier.',
      ];

  const effectiveWeight = patient?.weightKg ? `${patient.weightKg.toFixed(1)} kg` : 'Weight N/A';

  // Doctor credentials
  const doctorName = activePractitioner?.name?.trim() || 'Veterinarian';
  const doctorQual = activePractitioner?.qualifications?.trim() || '';
  const cleanDoctorReg = activePractitioner?.registrationNumber?.trim()
    ? activePractitioner.registrationNumber.trim().replace(/^KSVC[- ]?/i, 'KSVC-')
    : '';

  const doctorAddress = activePractitioner?.address?.trim() || '';
  const doctorPhone = activePractitioner?.phone?.trim() || '';
  const doctorEmail = activePractitioner?.email?.trim() || '';

  const rawOrgName = activeOrganisation?.name?.trim();
  const hasClinic = Boolean(
    activeOrganisation &&
    activeOrganisation.isActive !== false &&
    rawOrgName &&
    rawOrgName.length > 0 &&
    rawOrgName.toLowerCase() !== 'independent practitioner'
  );

  const clinicName = hasClinic ? rawOrgName! : '';
  const formattedClinicAddress = hasClinic
    ? [
        activeOrganisation?.address?.trim(),
        activeOrganisation?.city?.trim(),
        activeOrganisation?.state?.trim() && activeOrganisation?.pincode?.trim()
          ? `${activeOrganisation.state.trim()} - ${activeOrganisation.pincode.trim()}`
          : (activeOrganisation?.state?.trim() || activeOrganisation?.pincode?.trim()),
      ].filter(Boolean).join(', ')
    : '';
  const clinicAddress = formattedClinicAddress || doctorAddress;
  const clinicPhone = (hasClinic && activeOrganisation?.phone?.trim())
    ? activeOrganisation.phone.trim()
    : doctorPhone;
  const clinicEmail = (hasClinic && activeOrganisation?.email?.trim())
    ? activeOrganisation.email.trim()
    : doctorEmail;

  const effectiveDesignation = hasClinic
    ? (activePractitioner?.designation?.trim() || (activeOrganisation as any)?.designation?.trim() || 'Veterinarian in Charge')
    : (activePractitioner?.designation?.trim() || 'Independent Veterinary Practitioner');

  return (
    <div className="vetrx-document prescription-sheet-canvas" id={id}>
      {/* Non-Approved Watermark Overlay */}
      {prescription.status !== 'Approved' && (
        <div className="document-watermark-overlay" aria-hidden="true">
          {prescription.status === 'Pending Approval'
            ? 'PENDING VETERINARIAN APPROVAL'
            : prescription.status === 'Changes Requested'
            ? 'CHANGES REQUESTED'
            : prescription.status === 'Cancelled'
            ? 'CANCELLED'
            : 'DRAFT — NOT APPROVED'}
        </div>
      )}

      {/* Document Top Bar */}
      <div className="prescription-doc-top-bar avoid-break">
        <div className="prescription-doc-top-left">
          <span className="prescription-official-dot" />
          <span className="prescription-doc-top-badge">
            OFFICIAL REGISTERED CLINICAL VETERINARY DOCUMENT
          </span>
        </div>
        <div className="prescription-doc-top-right">
          <span className="prescription-doc-ref">
            Doc Ref: <strong>{prescription.rxNumber}</strong> {prescription.version ? `(v${prescription.version})` : ''}
          </span>
          <span className={`document-badge-prescription ${prescription.status === 'Approved' ? 'badge-approved' : ''}`}>
            {prescription.status === 'Approved'
              ? 'Approved Clinical Rx'
              : prescription.status === 'Pending Approval'
              ? 'Pending Vet Approval'
              : prescription.status === 'Changes Requested'
              ? 'Changes Requested'
              : 'Draft Prescription'}
          </span>
        </div>
      </div>

      {/* Letterhead Header Band */}
      {hasClinic ? (
        <div className="prescription-letterhead-band avoid-break">
          {/* Clinic / Practice Block */}
          <div className="letterhead-block letterhead-clinic-block">
            <span className="letterhead-block-tag">
              <Icon name="hospital" size={13} color="var(--color-outline)" />
              Clinic / Practice
            </span>
            <div className="letterhead-clinic-brand-row">
              <div className="letterhead-clinic-logo-box">
                {activeOrganisation?.logoDataUrl ? (
                  <img
                    src={activeOrganisation.logoDataUrl}
                    alt="Clinic Logo"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <Icon name="stethoscope" size={20} color="#ffffff" />
                )}
              </div>
              <div>
                <h2 className="letterhead-clinic-name">{clinicName}</h2>
                {clinicAddress && <p className="letterhead-location">{clinicAddress}</p>}
                {(clinicPhone || clinicEmail) && (
                  <div className="letterhead-contact-line">
                    {clinicPhone && <span>Ph: {clinicPhone}</span>}
                    {clinicPhone && clinicEmail && <span>•</span>}
                    {clinicEmail && <span>Email: {clinicEmail}</span>}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Veterinarian Block */}
          <div className="letterhead-block letterhead-veterinarian-block">
            <span className="letterhead-block-tag">Veterinary Practitioner</span>
            <div className="letterhead-practitioner-hero-row">
              <div className="letterhead-practitioner-avatar">
                {activePractitioner?.photoDataUrl ? (
                  <img
                    src={activePractitioner.photoDataUrl}
                    alt={doctorName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Icon name="stethoscope" size={20} color="#ffffff" />
                )}
              </div>
              <div className="letterhead-credentials-stack">
                <h3 className="letterhead-doctor-name">{doctorName}</h3>
                {doctorQual && <p className="letterhead-doctor-qual">{doctorQual}</p>}
                {cleanDoctorReg && (
                  <div className="registration-pill">
                    Reg. No.: {cleanDoctorReg}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* State B: Independent Practitioner Header */
        <div className="practitioner-header-container avoid-break">
          <div className="practitioner-header-left">
            <div className="practitioner-header-hero-row">
              <div className="practitioner-header-avatar">
                {activePractitioner?.photoDataUrl ? (
                  <img
                    src={activePractitioner.photoDataUrl}
                    alt={doctorName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <Icon name="stethoscope" size={20} color="#ffffff" />
                )}
              </div>
              <div className="practitioner-header-info">
                <span className="practitioner-header-tag">Veterinary Practitioner</span>
                <h1 className="practitioner-header-name">{doctorName}</h1>
                {doctorQual && <p className="practitioner-header-qual">{doctorQual}</p>}
                {cleanDoctorReg && (
                  <div className="practitioner-header-reg-chip">
                    Reg. No.: {cleanDoctorReg}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="practitioner-header-right">
            <div className="practitioner-header-contact-panel">
              <span className="practitioner-header-contact-tag">Practice Location &amp; Contact</span>
              {clinicAddress && <p className="practitioner-header-contact-address">{clinicAddress}</p>}
              {(clinicPhone || clinicEmail) && (
                <div className="practitioner-header-contact-row">
                  {clinicPhone && <span>Ph: {clinicPhone}</span>}
                  {clinicPhone && clinicEmail && <span>•</span>}
                  {clinicEmail && <span>Email: {clinicEmail}</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Prescription Document Title Ribbon */}
      <div className="prescription-ribbon avoid-break">
        <div className="prescription-ribbon-title">
          <Icon name="prescription" size={16} color="var(--color-primary)" />
          <span>VETERINARY PRESCRIPTION</span>
        </div>
        <div className="prescription-ribbon-meta">
          <span>Date: <strong>{formattedDate}</strong></span>
          <span>Rx No: <strong>{prescription.rxNumber}</strong></span>
        </div>
      </div>

      {/* Signalment Card Grid (Owner Details & Animal Details Side-by-Side) */}
      <div className="stationery-signalment-grid avoid-break">
        {/* Owner Card */}
        <div className="stationery-signalment-box">
          <div className="stationery-box-label">
            <Icon name="owner" size={14} />
            <span>Owner Details</span>
          </div>
          <div className="stationery-primary-name">{formatOwnerPrimary(owner, 'Client')}</div>
          {owner?.phone && <p className="stationery-sub-text">Ph: {owner.phone}</p>}
          {owner?.address && <p className="stationery-sub-text">{owner.address}</p>}
        </div>

        {/* Animal Details Card */}
        <div className="stationery-signalment-box">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div className="stationery-box-label" style={{ marginBottom: 0 }}>
              <Icon name="paw" size={14} />
              <span>Animal Details</span>
            </div>
            <span className="stationery-id-code">
              ID: {patient?.identificationRef || (patient?.id ? `PT-2026-${patient.id.toString().padStart(4, '0')}` : 'PT-RECORD')}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div className="stationery-primary-name">
              {!isArtificialOrBlankName(patient?.name)
                ? patient?.name
                : (patient ? formatAnimalSubtitle(patient, { includeWeight: false }) : '')}
            </div>
            <span className="stationery-weight-badge">{effectiveWeight}</span>
          </div>
          <p className="stationery-sub-text">
            {patient?.species} {patient?.breed ? `• ${patient.breed}` : ''}
          </p>
          <p className="stationery-sub-text">
            {patient?.sex && patient.sex !== 'Unknown' ? `${patient.sex}` : ''}
            {formatPatientAge(patient) ? ` • ${formatPatientAge(patient)}` : ''}
            {patient?.identificationRef ? ` • Ear Tag: ${patient.identificationRef}` : ''}
          </p>
        </div>
      </div>

      {/* Clinical Presentation & Confirmed Diagnosis Side-by-Side */}
      <div className="stationery-findings-box avoid-break">
        <div>
          <span className="stationery-box-label">Clinical Presentation</span>
          <p style={{ fontSize: '11.5px', color: 'var(--color-on-surface)', lineHeight: 1.25, margin: 0 }}>
            {prescription.symptoms || 'None recorded'}
          </p>
        </div>
        <div>
          <span className="stationery-box-label">Confirmed Diagnosis</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <span
              style={{
                width: '7px',
                height: '7px',
                borderRadius: '50%',
                background: 'var(--color-error)',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--color-on-surface)', margin: 0, lineHeight: 1.25 }}>
              {prescription.diagnosis || 'Clinical Examination / Prescribed Treatment'}
            </p>
          </div>
        </div>
      </div>

      {/* Prescribed Medication Schedule Table */}
      <div className="rx-meds-table-container">
        <div className="rx-meds-table-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '3px', marginBottom: '3px' }}>
          <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--color-on-surface)', display: 'flex', alignItems: 'center', gap: '5px' }}>
            <Icon name="pill" size={16} color="var(--color-primary)" />
            Prescribed Medication Schedule
          </span>
          <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-outline)' }}>
            {items?.length || 0} Line Items
          </span>
        </div>

        <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-surface-container)' }}>
          <table className="stationery-meds-table">
            <thead>
              <tr>
                <th className="col-num" style={{ width: '28px', textAlign: 'center' }}>#</th>
                <th className="col-name" style={{ textAlign: 'left' }}>Medicine &amp; Formulation</th>
                <th className="col-dose" style={{ textAlign: 'center' }}>Dose</th>
                <th className="col-route" style={{ textAlign: 'center' }}>Route</th>
                <th className="col-freq" style={{ textAlign: 'center' }}>Frequency</th>
                <th className="col-dur" style={{ textAlign: 'center' }}>Duration</th>
                <th className="col-qty" style={{ textAlign: 'right' }}>Quantity</th>
              </tr>
            </thead>
            <tbody>
              {items && items.length > 0 ? (
                items.map((item, idx) => (
                  <tr key={item.id || idx} className="medication-row avoid-break">
                    <td className="med-col-num">{idx + 1}</td>
                    <td className="med-col-name">
                      <div className="medication-cell">
                        <div className="medication-name">{item.brandName}</div>
                        {item.genericName && (
                          <div className="medication-generic">
                            {item.presentation ? `${item.presentation} ` : ''}({item.genericName})
                          </div>
                        )}
                        {item.directions && (
                          <div className="stationery-sig-box">
                            <span className="sig-label">Sig:</span>{' '}
                            <span className="sig-text">{item.directions.replace(/^Sig:\s*/i, '')}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="med-col-dose">
                      <span className="dose-badge">
                        {item.dose ? `${item.dose} ${item.doseUnit || ''}`.trim() : item.strengthVolume || '1 tab'}
                      </span>
                    </td>
                    <td className="med-col-route">
                      <span className="route-badge">
                        {item.route || 'PO (Oral)'}
                      </span>
                    </td>
                    <td className="med-col-freq">
                      <span className="freq-val">
                        {item.frequency || 'BID (q12h)'}
                      </span>
                    </td>
                    <td className="med-col-dur">
                      <span className="dur-val">
                        {item.durationDays ? `${item.durationDays} days` : '5 days'}
                      </span>
                    </td>
                    <td className="med-col-qty">
                      <span className="qty-val">
                        {item.quantity} {item.dispenseUnit || item.unit || 'Tabs'}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: 'var(--color-on-surface-variant)' }}>
                    No medicines attached to this prescription.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Special Instructions & Follow-up Care Plan Side-by-Side */}
      <div className="stationery-advice-grid avoid-break">
        <div className="stationery-signalment-box">
          <span className="stationery-box-label">Special Instructions for Owner</span>
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '11px', color: 'var(--color-on-surface)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {instructionList.map((inst, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
                <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>•</span>
                <span>{inst}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="stationery-signalment-box" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <span className="stationery-box-label">Follow-Up Care Plan</span>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: '12px', fontWeight: 600, color: 'var(--color-on-surface)', marginTop: '2px', margin: 0 }}>
              Recommended Re-evaluation: {prescription.recheckIntervalCustom || prescription.recheckIntervalPreset || (followUpDays ? `${followUpDays} Days` : 'As needed')}
            </p>
            {followUpDays > 0 && (
              <p style={{ fontSize: '11px', color: 'var(--color-on-surface-variant)', marginTop: '2px', lineHeight: 1.25, margin: 0 }}>
                Please schedule clinical recheck on or before <strong>{formattedFollowUpDate}</strong>.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Indivisible Bottom-Right Signature Block */}
      <div className="stationery-signoff-row signature-block avoid-break">
        <div className="stationery-signoff-box">
          {prescription.status === 'Approved' && activePractitioner?.signatureDataUrl ? (
            <div className="stationery-sig-img-container">
              <img
                src={activePractitioner.signatureDataUrl}
                alt="Doctor Signature"
                style={{ maxHeight: '36px', maxWidth: '140px', objectFit: 'contain' }}
              />
            </div>
          ) : prescription.status === 'Approved' ? (
            <div className="stationery-sig-line" />
          ) : (
            <div className="stationery-sig-unsigned-notice" style={{
              border: '1px dashed #cbd5e1',
              borderRadius: '4px',
              padding: '6px 10px',
              backgroundColor: '#f8fafc',
              fontSize: '10px',
              color: '#64748b',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              textAlign: 'center',
              marginBottom: '6px'
            }}>
              Unsigned — Pending Veterinarian Sign-off
            </div>
          )}
          <div className="stationery-sig-credentials">
            <div className="stationery-sig-name">
              {doctorName}{doctorQual ? `, ${doctorQual}` : ''}
            </div>
            {cleanDoctorReg && (
              <div className="stationery-sig-reg">
                Reg. No.: {cleanDoctorReg}
              </div>
            )}
            <div className="stationery-sig-role">
              {effectiveDesignation}
            </div>
            {prescription.status === 'Approved' && prescription.approvedAt && (
              <div style={{ fontSize: '10px', color: '#0f766e', fontWeight: 600, marginTop: '4px', letterSpacing: '0.02em' }}>
                ✓ Digitally Approved {prescription.approvedByUser?.name ? `by ${prescription.approvedByUser.name}` : ''} ({new Date(prescription.approvedAt).toLocaleDateString('en-GB')})
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
