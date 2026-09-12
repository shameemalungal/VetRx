// =============================================================
// VetRx — PrescriptionDetailsPage.tsx
// Phase 3: Prescription Detail & Printable Medical Stationery
// Follows Stitch reference: vetrx_prescription_preview_generate_desktop
// =============================================================

import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { useSettingsStore } from '../../store/settingsStore';
import { Icon } from '../../components/ui/Icon';
import { formatAnimalSubtitle, formatOwnerPrimary, isArtificialOrBlankName } from '../../utils/patientFormat';
import './Prescriptions.css';

export const PrescriptionDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const rxId = id ? parseInt(id, 10) : undefined;

  const { practitioner: storePractitioner, organisation: storeOrganisation } = useSettingsStore();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmIssueModal, setShowConfirmIssueModal] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ── Database Queries ──────────────────────────────────────────
  const prescription = useLiveQuery(
    () => (rxId ? db.prescriptions.get(rxId) : undefined),
    [rxId]
  );

  const items = useLiveQuery(
    () =>
      rxId
        ? db.prescriptionItems.where('prescriptionId').equals(rxId).sortBy('sortOrder')
        : [],
    [rxId]
  );

  const patient = useLiveQuery(
    () => (prescription?.patientId ? db.patients.get(prescription.patientId) : undefined),
    [prescription?.patientId]
  );

  const owner = useLiveQuery(
    () => (prescription?.ownerId ? db.owners.get(prescription.ownerId) : undefined),
    [prescription?.ownerId]
  );

  // Associated practitioner directly from prescription record or fallback
  const rxPractitioner = useLiveQuery(
    () => (prescription?.practitionerId ? db.practitioners.get(prescription.practitionerId) : undefined),
    [prescription?.practitionerId]
  );

  const allPractitioners = useLiveQuery(() => db.practitioners.toArray(), []);

  // ── Actions ───────────────────────────────────────────────────
  const handleExecuteIssue = async () => {
    if (!prescription?.id) return;
    setIsUpdating(true);
    setShowConfirmIssueModal(false);
    try {
      const now = new Date();
      await db.prescriptions.update(prescription.id, {
        status: 'Issued',
        issuedAt: now,
        updatedAt: now,
      });
      showToast(`Prescription ${prescription.rxNumber} issued and saved to patient record.`);
    } catch (err) {
      console.error('Failed to issue prescription:', err);
      showToast('Error issuing prescription.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCompleteAndIssue = () => {
    setShowConfirmIssueModal(true);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSavePdf = () => {
    showToast("Select 'Save as PDF' as the destination in the print preview.");
    setTimeout(() => {
      window.print();
    }, 400);
  };

  if (!rxId || prescription === undefined) {
    return (
      <div className="rx-page-container">
        <div style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--color-on-surface-variant)' }}>Loading prescription preview…</p>
        </div>
      </div>
    );
  }

  if (prescription === null) {
    return (
      <div className="rx-page-container">
        <div className="rx-empty-state">
          <div className="rx-empty-icon-box">
            <Icon name="prescription" size={28} />
          </div>
          <h3 className="rx-empty-title">Prescription Not Found</h3>
          <p className="rx-empty-desc">
            The requested prescription record does not exist or has been removed.
          </p>
          <div style={{ marginTop: '16px' }}>
            <Link to="/prescriptions" className="btn btn-primary">
              <Icon name="chevron-left" size={16} />
              Return to Prescriptions
            </Link>
          </div>
        </div>
      </div>
    );
  }

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
  const instructionList = prescription.instructions
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

  // ── Resolve Active Practitioner & Organisation ───────────────
  // Preference order:
  // 1. rxPractitioner (linked directly via prescription.practitionerId)
  // 2. storePractitioner (active in settings store)
  // 3. first practitioner in DB
  const activePractitioner =
    rxPractitioner ||
    storePractitioner ||
    (allPractitioners && allPractitioners.length > 0 ? allPractitioners[0] : null);

  // CRITICAL IDENTITY RULE:
  // The active session organisation from useSettingsStore is the single source of truth.
  // If clinic is OFF / Independent Practitioner, storeOrganisation.isActive === false, so activeOrganisation is null.
  // Never fall back to a stale or disabled clinic from Dexie.
  const activeOrganisation =
    storeOrganisation && storeOrganisation.isActive !== false ? storeOrganisation : null;

  // Doctor credentials
  const doctorName = activePractitioner?.name?.trim() || 'Veterinarian';
  const doctorQual = activePractitioner?.qualifications?.trim() || '';
  const doctorReg = activePractitioner?.registrationNumber?.trim()
    ? (activePractitioner.registrationNumber.trim().startsWith('Reg')
        ? activePractitioner.registrationNumber.trim()
        : `Reg: ${activePractitioner.registrationNumber.trim()}`)
    : '';

  const doctorAddress = activePractitioner?.address?.trim() || '';
  const doctorPhone = activePractitioner?.phone?.trim() || '';
  const doctorEmail = activePractitioner?.email?.trim() || '';

  // ── Practice / Clinic Identity State ───────────────────────────
  // CRITICAL REQUIREMENT:
  // - RULE 1: CLINIC ACTIVE -> Show Clinic/Practice info + Veterinarian info
  // - RULE 2: CLINIC OFF / INDEPENDENT PRACTITIONER -> DO NOT display clinic name.
  //   Never display "Dr. Shameem Alungal's Vet Clinic" or "— Veterinary Practice" or any fake clinic.
  //   Show ONLY veterinarian identity and contact.
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

  const isIssued = prescription.status === 'Issued';

  return (
    <div className="rx-page-container">
      {/* Toast alert */}
      {toastMessage && (
        <div
          className="no-print"
          style={{
            position: 'fixed',
            top: '80px',
            right: '24px',
            zIndex: 9999,
            background: 'var(--color-on-surface)',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          <Icon name="check-circle" size={18} color="var(--color-tertiary-fixed-dim)" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── Workflow Progress & Stepper Ribbon (Horizontal Layout) ── */}
      <div className="no-print rx-preview-stepper-header">
        <div className="rx-breadcrumbs">
          <Link to="/prescriptions" className="rx-crumb-link">CONSULTATIONS</Link>
          <Icon name="chevron-right" size={14} className="rx-crumb-sep" />
          <Link to="/prescriptions" className="rx-crumb-link">OUTPATIENT RX</Link>
          <Icon name="chevron-right" size={14} className="rx-crumb-sep" />
          <span className="rx-crumb-current">{prescription.rxNumber}</span>
        </div>

        {/* Stepper Indicator */}
        <div className="rx-preview-stepper-pill">
          <div className="rx-preview-step-item done">
            <Icon name="check-circle" size={18} color="var(--color-tertiary)" />
            <span className="rx-preview-step-text">1 Select Animal</span>
          </div>
          <span className="rx-preview-step-connector done" />
          <div className="rx-preview-step-item done">
            <Icon name="check-circle" size={18} color="var(--color-tertiary)" />
            <span className="rx-preview-step-text">2 Clinical Details</span>
          </div>
          <span className="rx-preview-step-connector done" />
          <div className="rx-preview-step-item done">
            <Icon name="check-circle" size={18} color="var(--color-tertiary)" />
            <span className="rx-preview-step-text">3 Medicines</span>
          </div>
          <span className="rx-preview-step-connector active" />
          <div className="rx-preview-step-badge active">
            <Icon name="sparkles" size={16} color="#ffffff" />
            <span className="rx-preview-step-text">4 Generate</span>
          </div>
        </div>
      </div>

      {/* ── Page Header Module ─────────────────────────────────── */}
      <div className="no-print rx-preview-header-card">
        <div className="rx-preview-header-left">
          <div className="rx-preview-title-row">
            <h1 className="rx-title">Prescription Preview</h1>
            {isIssued ? (
              <span className="rx-status-chip issued">
                <span className="status-dot"></span>
                Issued Record
              </span>
            ) : (
              <span className="rx-status-chip ready">
                <span className="status-dot pulse"></span>
                Ready to Generate
              </span>
            )}
          </div>
          <p className="rx-subtitle">Review the prescription before printing or saving.</p>
        </div>

        <div className="rx-preview-header-right">
          <div className="rx-date-pill">
            <Icon name="calendar" size={16} color="var(--color-outline)" />
            <span>Date: {formattedDate}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/prescriptions/new?cloneFrom=${prescription.id}`)}
          >
            <Icon name="copy" size={16} />
            <span>Clone Prescription</span>
          </button>
          <Link to="/prescriptions/new" className="btn btn-primary">
            <Icon name="plus" size={16} />
            <span>New Prescription</span>
          </Link>
        </div>
      </div>

      {/* ── Two-Column Workspace Layout ────────────────────────── */}
      <div className="rx-preview-workspace">
        {/* Left Column: Dominant A4 Realistic Medical Stationery */}
        <div className="prescription-sheet-wrapper" id="printable-prescription-wrapper">
          <div id="prescription-sheet">
            <div>
              {/* Shared Document Top Bar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  paddingBottom: '10px',
                  borderBottom: '1px solid #e2e8f0',
                  marginBottom: '14px',
                  gap: '12px',
                  flexWrap: 'nowrap',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flexShrink: 0 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0 }} />
                  <span
                    style={{
                      fontFamily: 'var(--font-data)',
                      fontSize: '11px',
                      fontWeight: 700,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      color: 'var(--color-outline)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    OFFICIAL REGISTERED CLINICAL VETERINARY DOCUMENT
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '11px',
                    fontFamily: 'var(--font-data)',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                  }}
                >
                  <span style={{ color: 'var(--color-outline)', whiteSpace: 'nowrap' }}>
                    Doc Ref: <strong>{prescription.rxNumber}</strong>
                  </span>
                  <span
                    style={{
                      background: 'var(--color-surface-container-high)',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontWeight: 600,
                      color: 'var(--color-primary)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Original Prescription
                  </span>
                </div>
              </div>

              {/* ── Polished Letterhead Header Band ──────────────────── */}
              {hasClinic ? (
                /* State A: CLINIC ACTIVE */
                <div className="prescription-letterhead-band">
                  {/* Clinic / Practice Block */}
                  <div className="letterhead-block">
                    <span className="letterhead-block-tag">
                      <Icon name="hospital" size={13} color="var(--color-outline)" />
                      Clinic / Practice
                    </span>
                    <div className="letterhead-clinic-brand-row">
                      <div className="letterhead-clinic-logo-box" style={{ overflow: 'hidden' }}>
                        {activeOrganisation?.logoDataUrl ? (
                          <img
                            src={activeOrganisation.logoDataUrl}
                            alt="Clinic Logo"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        ) : (
                          <Icon name="stethoscope" size={24} color="#ffffff" />
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

                  {/* Elegant vertical separator */}
                  <div className="letterhead-vertical-divider" />

                  {/* Veterinarian Block */}
                  <div className="letterhead-block letterhead-veterinarian-block">
                    <span className="letterhead-block-tag">Veterinarian</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                      {activePractitioner?.photoDataUrl && (
                        <div
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius: '50%',
                            overflow: 'hidden',
                            border: '1.5px solid var(--color-primary)',
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={activePractitioner.photoDataUrl}
                            alt={doctorName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                      )}
                      <div>
                        <h3 className="letterhead-doctor-name">{doctorName}</h3>
                        <p className="letterhead-doctor-qual">{doctorQual}</p>
                      </div>
                    </div>
                    {doctorReg && <span className="letterhead-reg-chip">{doctorReg}</span>}
                  </div>
                </div>
              ) : (
                /* State B: CLINIC OFF / INDEPENDENT PRACTITIONER */
                <div className="prescription-letterhead-band">
                  {/* Veterinarian Identity Hero Block */}
                  <div className="letterhead-block">
                    <span className="letterhead-block-tag">
                      <Icon name="stethoscope" size={13} color="var(--color-primary)" />
                      Veterinary Practitioner
                    </span>
                    <div className="letterhead-practitioner-hero-row">
                      <div className="letterhead-practitioner-avatar" style={{ overflow: 'hidden' }}>
                        {activePractitioner?.photoDataUrl ? (
                          <img
                            src={activePractitioner.photoDataUrl}
                            alt={doctorName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Icon name="stethoscope" size={26} color="#ffffff" />
                        )}
                      </div>
                      <div>
                        <h2 className="letterhead-doctor-name-hero">{doctorName}</h2>
                        <p className="letterhead-doctor-qual-hero">{doctorQual}</p>
                        {doctorReg && <span className="letterhead-reg-chip">{doctorReg}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Elegant vertical separator */}
                  <div className="letterhead-vertical-divider" />

                  {/* Practice Location & Direct Contact Block */}
                  <div className="letterhead-block letterhead-practitioner-contact-block">
                    <span className="letterhead-block-tag">Practice Location &amp; Contact</span>
                    {doctorAddress && (
                      <p className="letterhead-location" style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-on-surface)' }}>
                        {doctorAddress}
                      </p>
                    )}
                    <div className="letterhead-contact-line" style={{ justifyContent: 'flex-end', marginTop: '2px' }}>
                      {doctorPhone && <span>Ph: {doctorPhone}</span>}
                      {doctorPhone && doctorEmail && <span>•</span>}
                      {doctorEmail && <span>Email: {doctorEmail}</span>}
                    </div>
                  </div>
                </div>
              )}

              {/* Document Title & Meta Ribbon */}
              <div className="stationery-title-ribbon">
                <div className="stationery-doc-title">
                  <Icon name="prescription" size={18} color="var(--color-primary)" />
                  <span>VETERINARY PRESCRIPTION</span>
                </div>
                <div className="stationery-meta-right">
                  <span>
                    Date: <strong>{formattedDate}</strong>
                  </span>
                  <span>
                    Rx No: <strong style={{ color: 'var(--color-primary)' }}>{prescription.rxNumber}</strong>
                  </span>
                </div>
              </div>

              {/* Owner & Patient Signalment Grid */}
              <div className="stationery-signalment-grid">
                {/* Owner Block */}
                <div className="stationery-signalment-box">
                  <div className="stationery-box-label">
                    <Icon name="owner" size={14} />
                    <span>Owner Details</span>
                  </div>
                  <div className="stationery-primary-name">{formatOwnerPrimary(owner, 'Client')}</div>
                  {owner?.phone && <p className="stationery-sub-text">Ph: {owner.phone}</p>}
                  {owner?.address && <p className="stationery-sub-text">{owner.address}</p>}
                </div>

                {/* Patient Animal Block */}
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
                      {!isArtificialOrBlankName(patient?.name) ? patient?.name : (patient ? formatAnimalSubtitle(patient) : '')}
                    </div>
                    <span className="stationery-weight-badge">{effectiveWeight}</span>
                  </div>
                  <p className="stationery-sub-text">
                    {patient?.species} {patient?.breed ? `• ${patient.breed}` : ''}
                  </p>
                  <p className="stationery-sub-text">
                    {patient?.sex && patient.sex !== 'Unknown' ? `${patient.sex}` : ''}
                    {patient?.ageNote ? ` • ${patient.ageNote}` : ''}
                    {patient?.identificationRef ? ` • Ear Tag: ${patient.identificationRef}` : ''}
                  </p>
                </div>
              </div>

              {/* Clinical Symptoms & Diagnosis Findings */}
              <div className="stationery-findings-box">
                <div>
                  <span className="stationery-box-label">Clinical Presentation</span>
                  <p style={{ fontSize: '13px', color: 'var(--color-on-surface)', lineHeight: 1.4 }}>
                    {prescription.symptoms || 'None recorded'}
                  </p>
                </div>
                <div>
                  <span className="stationery-box-label">Confirmed Diagnosis</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: 'var(--color-error)',
                        display: 'inline-block',
                        flexShrink: 0,
                      }}
                    />
                    <p style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                      {prescription.diagnosis || 'Clinical Examination / Prescribed Treatment'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Structured Medications Table */}
              <div style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', marginBottom: '8px' }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: '15px', fontWeight: 700, color: 'var(--color-on-surface)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Icon name="pill" size={18} color="var(--color-primary)" />
                    Prescribed Medication Schedule
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-outline)' }}>
                    {items?.length || 0} Line Items
                  </span>
                </div>

                <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-surface-container)' }}>
                  <table className="stationery-meds-table">
                    <thead>
                      <tr>
                        <th style={{ width: '36px', textAlign: 'center' }}>#</th>
                        <th>Medicine &amp; Formulation</th>
                        <th>Dose</th>
                        <th>Route</th>
                        <th>Frequency</th>
                        <th>Duration</th>
                        <th style={{ textAlign: 'right' }}>Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items && items.length > 0 ? (
                        items.map((item, idx) => (
                          <tr key={item.id || idx}>
                            <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--color-outline)' }}>
                              {idx + 1}
                            </td>
                            <td>
                              <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 600, fontSize: '14px', color: 'var(--color-on-surface)' }}>
                                {item.brandName} {item.strengthVolume ? `• ${item.strengthVolume}` : ''}
                              </div>
                              {item.genericName && (
                                <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                                  {item.presentation} ({item.genericName})
                                </div>
                              )}
                              {item.directions && (
                                <div className="stationery-sig-box">
                                  <strong>Sig:</strong> {item.directions}
                                </div>
                              )}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-primary)' }}>
                              {item.dose || item.strengthVolume || '1 tab'}
                            </td>
                            <td>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  background: 'var(--color-surface-container)',
                                  borderRadius: 'var(--radius-sm)',
                                  fontFamily: 'var(--font-mono)',
                                  fontSize: '11px',
                                }}
                              >
                                {item.route || 'PO (Oral)'}
                              </span>
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
                              {item.frequency || 'BID (q12h)'}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>
                              {item.durationDays ? `${item.durationDays} days` : '5 days'}
                            </td>
                            <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                              {item.quantity} {item.unit || 'Tabs'}
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

              {/* Instructions & Clinical Advice for Owner */}
              <div className="stationery-advice-grid">
                <div className="stationery-signalment-box">
                  <span className="stationery-box-label">Special Instructions for Owner</span>
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: '13px', color: 'var(--color-on-surface)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {instructionList.map((inst, i) => (
                      <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                        <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>•</span>
                        <span>{inst}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="stationery-signalment-box" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <span className="stationery-box-label">Follow-Up Care Plan</span>
                    <p style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 600, color: 'var(--color-on-surface)', marginTop: '4px' }}>
                      Recommended Re-evaluation: {followUpDays} Days
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', marginTop: '4px', lineHeight: 1.4 }}>
                      Please schedule clinical recheck on or before <strong>{formattedFollowUpDate}</strong>.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Document Footer / Professional Sign-Off Block */}
            <div className="stationery-signoff-row">
              <div className="stationery-signoff-box">
                <div style={{ width: '160px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: '8px' }}>
                  {activePractitioner?.signatureDataUrl ? (
                    <img
                      src={activePractitioner.signatureDataUrl}
                      alt="Doctor Signature"
                      style={{ maxHeight: '44px', maxWidth: '150px', objectFit: 'contain' }}
                    />
                  ) : null}
                </div>
                <div className="stationery-sig-line"></div>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                  {doctorName}, {doctorQual}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                  Veterinarian in Charge
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-outline)', marginTop: '2px' }}>
                  {doctorReg}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sticky Action Column (~340px) */}
        <div className="no-print rx-summary-column" style={{ position: 'sticky', top: '80px' }}>
          {/* Primary Action Card */}
          <div className="rx-action-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '16px', fontWeight: 700, color: 'var(--color-on-surface)', margin: 0 }}>
                Actions &amp; Export
              </h3>
              <Icon name="check-circle" size={20} color="var(--color-primary)" />
            </div>

            {/* Quick Summary Strip */}
            <div
              style={{
                background: 'var(--color-surface-container)',
                padding: '12px 14px',
                borderRadius: 'var(--radius-lg)',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  background: 'var(--color-surface-container-lowest)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary)',
                  flexShrink: 0,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                }}
              >
                <Icon name="paw" size={18} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'var(--color-on-surface)',
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {formatOwnerPrimary(owner, 'Client')}
                </span>
                <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', display: 'block' }}>
                  {formatAnimalSubtitle(patient)} • {items?.length || 0} Active Medicines
                </span>
              </div>
            </div>

            {/* Primary Action Trigger */}
            {!isIssued ? (
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', height: '48px', fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}
                onClick={handleCompleteAndIssue}
                disabled={isUpdating}
              >
                <Icon name="check-circle" size={20} />
                <span>{isUpdating ? 'Issuing…' : 'Complete Prescription'}</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', height: '48px', fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}
                onClick={handlePrint}
              >
                <Icon name="printer" size={20} />
                <span>Print Prescription</span>
              </button>
            )}

            {/* Secondary Document Handlers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: '42px', fontSize: '13px' }}
                onClick={handlePrint}
              >
                <Icon name="printer" size={16} />
                <span>Print Sheet</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: '42px', fontSize: '13px' }}
                onClick={handleSavePdf}
              >
                <Icon name="download" size={16} />
                <span>Save PDF</span>
              </button>
            </div>

            {/* Return / Edit / Clone Action Button */}
            {!isIssued ? (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', height: '38px', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}
                onClick={() => navigate(`/prescriptions/${prescription.id}/edit`)}
              >
                <Icon name="arrow-left" size={16} />
                <span>Back to Medication Editor</span>
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', height: '38px', fontSize: '13px' }}
                onClick={() => navigate(`/prescriptions/new?cloneFrom=${prescription.id}`)}
              >
                <Icon name="copy" size={16} />
                <span>Clone Prescription</span>
              </button>
            )}

            {/* Start New Prescription */}
            <Link
              to="/prescriptions/new"
              className="btn btn-secondary"
              style={{
                width: '100%',
                height: '40px',
                fontSize: '13px',
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <Icon name="plus" size={16} />
              <span>New Prescription</span>
            </Link>

            {/* Generate Invoice Link */}
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                width: '100%',
                height: '40px',
                fontSize: '13px',
                marginTop: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                color: 'var(--color-primary)',
                borderColor: 'rgba(0, 104, 95, 0.3)',
                background: 'rgba(0, 104, 95, 0.04)',
              }}
              onClick={() => navigate(`/invoices/new?prescriptionId=${prescription.id}`)}
            >
              <Icon name="invoices" size={16} />
              <span>Generate Invoice for Rx</span>
            </button>

            {/* Clinical Governance Advisory Note */}
            <div
              style={{
                marginTop: '18px',
                paddingTop: '14px',
                borderTop: '1px solid var(--color-surface-container)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                color: 'var(--color-on-surface-variant)',
              }}
            >
              <Icon name="info" size={16} color="var(--color-outline)" />
              <p style={{ fontSize: '12px', lineHeight: 1.4, margin: 0 }}>
                Completing the prescription saves it to the animal record.
              </p>
            </div>
          </div>

          {/* Prescribing Clinician Identity Card */}
          <div className="rx-action-card">
            <span
              style={{
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--color-outline)',
                display: 'block',
                marginBottom: '12px',
              }}
            >
              Veterinarian
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '50%',
                  background: 'var(--color-primary-container)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: '15px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                {activePractitioner?.photoDataUrl ? (
                  <img
                    src={activePractitioner.photoDataUrl}
                    alt={doctorName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  doctorName
                    .split(' ')
                    .filter((w) => !w.toLowerCase().startsWith('dr'))
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase() || 'SA'
                )}
              </div>
              <div>
                <h4 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 600, color: 'var(--color-on-surface)', margin: 0 }}>
                  {doctorName}
                </h4>
                <p style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', margin: '2px 0 0' }}>
                  {doctorQual}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal before Generating/Issuing */}
      {showConfirmIssueModal && (
        <div className="rx-modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="rx-modal-box" style={{ maxWidth: '460px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#fef3c7',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="alert-triangle" size={22} />
              </div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                Generate Prescription?
              </h3>
            </div>
            <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--color-on-surface-variant)', marginBottom: '24px' }}>
              No editing will be allowed after generating. If you want to edit, use Save Draft.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowConfirmIssueModal(false)}
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleExecuteIssue}
                disabled={isUpdating}
              >
                {isUpdating ? 'Generating…' : 'Generate & Issue'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
