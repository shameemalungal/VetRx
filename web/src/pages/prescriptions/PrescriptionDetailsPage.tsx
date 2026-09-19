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
import { formatAnimalSubtitle, formatOwnerPrimary } from '../../utils/patientFormat';
import { CreatePackageFromPrescriptionModal } from './CreatePackageFromPrescriptionModal';
import { generatePdfBlob, savePdfWithFilePicker, buildPrescriptionFilename } from '../../utils/pdfGenerator';
import { ShareModal } from '../../components/ui/ShareModal';
import { PrescriptionDocument } from '../../components/documents/PrescriptionDocument';
import './Prescriptions.css';

export const PrescriptionDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const rxId = id ? parseInt(id, 10) : undefined;

  const { practitioner: storePractitioner, organisation: storeOrganisation } = useSettingsStore();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showConfirmIssueModal, setShowConfirmIssueModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCreatePackageModal, setShowCreatePackageModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [cachedPdfBlob, setCachedPdfBlob] = useState<Blob | null>(null);

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

  const handleExecuteCancel = async () => {
    if (!prescription?.id || prescription.status === 'Cancelled') return;
    setIsUpdating(true);
    try {
      const now = new Date();
      await db.prescriptions.update(prescription.id, {
        status: 'Cancelled',
        cancelledAt: now,
        cancellationReason: cancelReason.trim() || 'Prescription cancelled by clinician',
        updatedAt: now,
      });
      setShowCancelModal(false);
      showToast(`Prescription ${prescription.rxNumber} has been cancelled.`);
    } catch (err) {
      console.error('Failed to cancel prescription:', err);
      showToast('Error cancelling prescription.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSavePdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const sheet = document.getElementById('prescription-sheet');
      if (!sheet) {
        showToast('Prescription sheet element not found in DOM.');
        return;
      }
      const blob = await generatePdfBlob(sheet);
      setCachedPdfBlob(blob);
      const filename = buildPrescriptionFilename(patient?.name, prescription?.rxNumber);
      const result = await savePdfWithFilePicker(blob, filename);
      if (result.success) {
        showToast(`Prescription PDF saved: ${filename}`);
      } else if (result.error) {
        showToast(`Failed to save PDF: ${result.error}`);
      }
    } catch (err: unknown) {
      console.error('Save PDF failed:', err);
      showToast('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShare = async () => {
    try {
      setIsGeneratingPdf(true);
      const sheet = document.getElementById('prescription-sheet');
      if (!sheet) return;
      const blob = cachedPdfBlob || (await generatePdfBlob(sheet));
      setCachedPdfBlob(blob);
      const filename = buildPrescriptionFilename(patient?.name, prescription?.rxNumber);
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `Prescription ${prescription?.rxNumber}`,
            text: `Veterinary Prescription ${prescription?.rxNumber} for ${patient?.name || 'Patient'}`,
            files: [file],
          });
          return;
        } catch (err: unknown) {
          if (err instanceof Error && err.name === 'AbortError') {
            return;
          }
        }
      }
      setShareModalOpen(true);
    } catch (err: unknown) {
      console.error('Share failed:', err);
      setShareModalOpen(true);
    } finally {
      setIsGeneratingPdf(false);
    }
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

  const doctorName = activePractitioner?.name?.trim() || 'Veterinarian';
  const doctorQual = activePractitioner?.qualifications?.trim() || '';

  const isIssued = prescription.status === 'Issued';
  const isCancelled = prescription.status === 'Cancelled';

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
        <div className="rx-breadcrumbs flex items-center gap-2">
          <Link to="/prescriptions" className="btn-back" title="Back to Prescriptions">
            <Icon name="arrow-left" size={14} />
            <span>Back</span>
          </Link>
          <span className="text-outline-variant">/</span>
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
            ) : isCancelled ? (
              <span className="rx-status-chip cancelled">
                <span className="status-dot"></span>
                Cancelled
              </span>
            ) : (
              <span className="rx-status-chip ready">
                <span className="status-dot pulse"></span>
                Ready to Generate
              </span>
            )}
          </div>
          <p className="rx-subtitle">
            {isCancelled
              ? 'This prescription is cancelled and preserved as a read-only historical record.'
              : isIssued
              ? 'Official issued veterinary prescription. Printable and recorded in patient history.'
              : 'Review the prescription before printing or saving.'}
          </p>
        </div>

        <div className="rx-preview-header-right">
          <div className="rx-date-pill">
            <Icon name="calendar" size={16} color="var(--color-outline)" />
            <span>Date: {formattedDate}</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate('/prescriptions')}
            title="Back to Prescriptions History"
          >
            <span>View History</span>
          </button>
          {isIssued && (
            <button
              type="button"
              className="btn btn-secondary"
              style={{
                color: '#b91c1c',
                borderColor: '#fecaca',
                background: '#fef2f2',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontWeight: 600,
              }}
              onClick={() => setShowCancelModal(true)}
              title="Cancel this issued prescription"
            >
              <Icon name="x-mark" size={16} />
              <span>Cancel Prescription</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/prescriptions/new?cloneFrom=${prescription.id}`)}
          >
            <Icon name="copy" size={16} />
            <span>Clone Prescription</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowCreatePackageModal(true)}
            title="Create a treatment package from this prescription"
          >
            <Icon name="package" size={16} />
            <span>Create Treatment Package</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleShare}
            disabled={isGeneratingPdf}
            title="Share prescription"
          >
            <Icon name="share" size={16} />
            <span>Share</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate(`/invoices/new?fromRx=${prescription.id}`)}
            title="Generate itemized invoice from this prescription"
          >
            <Icon name="invoices" size={16} />
            <span>Add Invoice from Rx</span>
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
          {/* Prominent Cancellation Banner if Cancelled */}
          {isCancelled && (
            <div
              className="no-print"
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '10px 14px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#991b1b',
              }}
            >
              <Icon name="warning" size={20} color="#dc2626" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '13px', lineHeight: 1.4 }}>
                <strong>CANCELLED PRESCRIPTION:</strong> This prescription was cancelled
                {prescription.cancelledAt ? ` on ${new Date(prescription.cancelledAt).toLocaleDateString('en-GB')}` : ''}.
                {prescription.cancellationReason && (
                  <span> Reason: <em>{prescription.cancellationReason}</em></span>
                )}
                <span style={{ display: 'block', fontSize: '11px', color: '#b91c1c', marginTop: '2px' }}>
                  Preserved for clinical history. Use "Clone Prescription" to create a new editable version.
                </span>
              </div>
            </div>
          )}

          <PrescriptionDocument
            prescription={prescription}
            items={items || []}
            patient={patient}
            owner={owner}
            activePractitioner={activePractitioner}
            activeOrganisation={activeOrganisation}
            id="prescription-sheet"
          />
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
            {isCancelled ? (
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', height: '48px', fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}
                onClick={() => navigate(`/prescriptions/new?cloneFrom=${prescription.id}`)}
              >
                <Icon name="copy" size={20} />
                <span>Clone Prescription</span>
              </button>
            ) : !isIssued ? (
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
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
                disabled={isGeneratingPdf}
              >
                <Icon name="download" size={16} />
                <span>{isGeneratingPdf ? 'Saving PDF…' : 'Save PDF'}</span>
              </button>
            </div>

            <button
              type="button"
              className="btn btn-secondary"
              style={{
                width: '100%',
                height: '42px',
                fontSize: '13px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
              onClick={handleShare}
              disabled={isGeneratingPdf}
            >
              <Icon name="share" size={16} />
              <span>Share Prescription</span>
            </button>

            {/* Cancel Action Button (clearly visible when issued) */}
            {isIssued && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  width: '100%',
                  height: '40px',
                  fontSize: '13px',
                  marginBottom: '10px',
                  color: '#b91c1c',
                  borderColor: '#fecaca',
                  background: '#fef2f2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  fontWeight: 600,
                }}
                onClick={() => setShowCancelModal(true)}
              >
                <Icon name="x-mark" size={16} />
                <span>Cancel Prescription</span>
              </button>
            )}

            {/* Return / Edit / Clone Action Button */}
            {!isIssued && !isCancelled ? (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', height: '38px', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}
                onClick={() => navigate(`/prescriptions/${prescription.id}/edit`)}
              >
                <Icon name="arrow-left" size={16} />
                <span>Back to Medication Editor</span>
              </button>
            ) : !isCancelled ? (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', height: '38px', fontSize: '13px' }}
                onClick={() => navigate(`/prescriptions/new?cloneFrom=${prescription.id}`)}
              >
                <Icon name="copy" size={16} />
                <span>Clone Prescription</span>
              </button>
            ) : (
              <div
                style={{
                  padding: '10px 12px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 'var(--radius)',
                  fontSize: '12px',
                  color: '#991b1b',
                  lineHeight: 1.4,
                  marginBottom: '6px',
                }}
              >
                <strong>Prescription Cancelled:</strong> This medical record is read-only. Use "Clone Prescription" above to issue a new prescription.
              </div>
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
            {!isCancelled && (
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
            )}

            {/* Create Treatment Package Button */}
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
                fontWeight: 600,
              }}
              onClick={() => setShowCreatePackageModal(true)}
              title="Create a reusable treatment package from this prescription"
            >
              <Icon name="package" size={16} />
              <span>Create Treatment Package</span>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: '42px', minWidth: '110px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setShowConfirmIssueModal(false)}
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ height: '42px', minWidth: '150px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={handleExecuteIssue}
                disabled={isUpdating}
              >
                {isUpdating ? 'Generating…' : 'Generate & Issue'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancellation Confirmation Modal */}
      {showCancelModal && (
        <div className="rx-modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="rx-modal-box" style={{ maxWidth: '480px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="warning" size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                  Cancel Prescription?
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
                  Permanent status update for {prescription.rxNumber}
                </span>
              </div>
            </div>

            <p style={{ fontSize: '13.5px', lineHeight: 1.5, color: 'var(--color-on-surface-variant)', marginBottom: '16px' }}>
              Are you sure you want to cancel this issued prescription? This action cannot be undone. All original medicines, patient, owner, and date records will remain preserved in clinical history.
            </p>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" htmlFor="rx-cancel-reason">
                Reason for Cancellation <span style={{ color: 'var(--color-outline)', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                id="rx-cancel-reason"
                className="form-textarea"
                rows={3}
                placeholder="e.g. Clinical regimen updated, wrong patient chosen, dosage correction needed..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                style={{ fontSize: '13px', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: '42px', minWidth: '110px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => {
                  setShowCancelModal(false);
                  setCancelReason('');
                }}
                disabled={isUpdating}
              >
                Keep Active
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  height: '42px',
                  minWidth: '160px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#dc2626',
                  color: '#ffffff',
                  borderColor: '#b91c1c',
                  fontWeight: 600,
                }}
                onClick={handleExecuteCancel}
                disabled={isUpdating}
              >
                {isUpdating ? 'Cancelling…' : 'Cancel Prescription'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Treatment Package from Prescription Modal */}
      {showCreatePackageModal && prescription && (
        <CreatePackageFromPrescriptionModal
          isOpen={showCreatePackageModal}
          onClose={() => setShowCreatePackageModal(false)}
          prescription={prescription}
          items={items || []}
          patientSpecies={patient?.species}
          onSuccessToast={showToast}
        />
      )}

      {/* Share Document Modal */}
      {prescription && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => setShareModalOpen(false)}
          documentTitle="Prescription"
          documentNumber={prescription.rxNumber}
          recipientName={patient?.name || 'Patient'}
          pdfBlob={cachedPdfBlob}
          suggestedFilename={buildPrescriptionFilename(patient?.name, prescription.rxNumber)}
          documentUrl={window.location.href}
        />
      )}
    </div>
  );
};
