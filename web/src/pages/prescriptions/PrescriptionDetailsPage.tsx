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
import { generatePdfBlob, savePdfWithFilePicker, savePdfNative, buildPrescriptionFilename } from '../../utils/pdfGenerator';
import { isMobileDevice } from '../../utils/platformDetect';
import { ShareModal } from '../../components/ui/ShareModal';
import { PrescriptionDocument } from '../../components/documents/PrescriptionDocument';
import { useAuth } from '../../context/AuthContext';
import type { PrescriptionWorkflowHistoryItem } from '../../types';
import './Prescriptions.css';

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');

export const PrescriptionDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const rxId = id ? parseInt(id, 10) : undefined;

  const { user, can, hasRole } = useAuth();
  const { practitioner: storePractitioner, organisation: storeOrganisation } = useSettingsStore();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showCreatePackageModal, setShowCreatePackageModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [cachedPdfBlob, setCachedPdfBlob] = useState<Blob | null>(null);

  // Clinical Approval Workflow States
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRequestChangesModal, setShowRequestChangesModal] = useState(false);
  const [showReviseModal, setShowReviseModal] = useState(false);
  const [forwardToUserId, setForwardToUserId] = useState('');
  const [forwardRemarks, setForwardRemarks] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [changeRequestRemarks, setChangeRequestRemarks] = useState('');
  const [eligibleClinicians, setEligibleClinicians] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [loadingClinicians, setLoadingClinicians] = useState(false);

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

  // ── Approval Workflow Actions ─────────────────────────────────
  const loadEligibleClinicians = async () => {
    setLoadingClinicians(true);
    try {
      const res = await fetch(`${API_BASE}/api/prescriptions/eligible-clinicians`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setEligibleClinicians(data);
          if (!forwardToUserId && data[0]?.id) {
            setForwardToUserId(data[0].id);
          }
          return;
        }
      }
    } catch {
      // Offline fallback
    } finally {
      setLoadingClinicians(false);
    }

    if (allPractitioners && allPractitioners.length > 0) {
      const fallbackList = allPractitioners.map((p) => ({
        id: String(p.id),
        name: p.name,
        email: p.email || '',
      }));
      setEligibleClinicians(fallbackList);
      if (!forwardToUserId && fallbackList[0]?.id) {
        setForwardToUserId(fallbackList[0].id);
      }
    }
  };

  const handleOpenForwardModal = () => {
    void loadEligibleClinicians();
    setShowForwardModal(true);
  };

  const handleExecuteForward = async () => {
    if (!prescription?.id || !forwardToUserId) return;
    setIsUpdating(true);
    try {
      const selectedClinician = eligibleClinicians.find((c) => c.id === forwardToUserId);
      const targetUser = selectedClinician || { id: forwardToUserId, name: 'Veterinarian', email: '' };

      try {
        await fetch(`${API_BASE}/api/prescriptions/${prescription.id}/forward`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            forwardedToUserId: forwardToUserId,
            forwardingRemarks: forwardRemarks.trim() || undefined,
          }),
        });
      } catch (err) {
        console.warn('Server forward sync failed, updating local DB:', err);
      }

      const now = new Date();
      const isResubmission = prescription.status === 'Changes Requested';
      const historyItem: PrescriptionWorkflowHistoryItem = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        version: prescription.version || 1,
        status: 'Pending Approval',
        action: isResubmission ? 'RESUBMITTED' : 'FORWARDED',
        actorUserId: user?.id || 'current-user',
        actorUser: { id: user?.id || 'current-user', name: user?.name || 'Staff', email: user?.email || '' },
        targetUserId: targetUser.id,
        targetUser: { id: targetUser.id, name: targetUser.name, email: targetUser.email || '' },
        remarks: forwardRemarks.trim() || (isResubmission ? 'Resubmitted for clinical approval after addressing changes' : 'Forwarded for clinical approval'),
        createdAt: now,
      };

      await db.prescriptions.update(prescription.id, {
        status: 'Pending Approval',
        forwardedToUserId: targetUser.id,
        forwardedToUser: { id: targetUser.id, name: targetUser.name, email: targetUser.email || '' },
        forwardedByUserId: user?.id || null,
        forwardedByUser: { id: user?.id || 'current-user', name: user?.name || 'Staff', email: user?.email || '' },
        forwardingRemarks: forwardRemarks.trim() || null,
        forwardedAt: now,
        workflowHistory: [...(prescription.workflowHistory || []), historyItem],
        updatedAt: now,
      });

      setShowForwardModal(false);
      setForwardRemarks('');
      showToast(`Prescription ${prescription.rxNumber} submitted for clinical approval by Dr. ${targetUser.name}.`);
    } catch (err) {
      console.error('Failed to forward prescription:', err);
      showToast('Error forwarding prescription.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExecuteApprove = async () => {
    if (!prescription?.id) return;
    setIsUpdating(true);
    try {
      try {
        await fetch(`${API_BASE}/api/prescriptions/${prescription.id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            approvalRemarks: approvalRemarks.trim() || undefined,
          }),
        });
      } catch (err) {
        console.warn('Server approve sync failed, updating local DB:', err);
      }

      const now = new Date();
      const approverName = user?.name || activePractitioner?.name || 'Veterinarian';
      const historyItem: PrescriptionWorkflowHistoryItem = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        version: prescription.version || 1,
        status: 'Approved',
        action: 'APPROVED',
        actorUserId: user?.id || 'current-user',
        actorUser: { id: user?.id || 'current-user', name: approverName, email: user?.email || '' },
        remarks: approvalRemarks.trim() || null,
        createdAt: now,
      };

      await db.prescriptions.update(prescription.id, {
        status: 'Approved',
        approvedByUserId: user?.id || null,
        approvedByUser: { id: user?.id || 'current-user', name: approverName, email: user?.email || '' },
        approvedAt: now,
        approvedVersion: prescription.version || 1,
        approvalRemarks: approvalRemarks.trim() || null,
        workflowHistory: [...(prescription.workflowHistory || []), historyItem],
        updatedAt: now,
      });

      setShowApproveModal(false);
      setApprovalRemarks('');
      showToast(`Prescription ${prescription.rxNumber} approved and digitally sealed.`);
    } catch (err) {
      console.error('Failed to approve prescription:', err);
      showToast('Error approving prescription.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExecuteRequestChanges = async () => {
    if (!prescription?.id || !changeRequestRemarks.trim()) return;
    setIsUpdating(true);
    try {
      try {
        await fetch(`${API_BASE}/api/prescriptions/${prescription.id}/request-changes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            changeRequestRemarks: changeRequestRemarks.trim(),
          }),
        });
      } catch (err) {
        console.warn('Server request-changes sync failed, updating local DB:', err);
      }

      const now = new Date();
      const clinicianName = user?.name || activePractitioner?.name || 'Veterinarian';
      const historyItem: PrescriptionWorkflowHistoryItem = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        version: prescription.version || 1,
        status: 'Changes Requested',
        action: 'CHANGES_REQUESTED',
        actorUserId: user?.id || 'current-user',
        actorUser: { id: user?.id || 'current-user', name: clinicianName, email: user?.email || '' },
        remarks: changeRequestRemarks.trim(),
        createdAt: now,
      };

      await db.prescriptions.update(prescription.id, {
        status: 'Changes Requested',
        requestedByUserId: user?.id || null,
        requestedByUser: { id: user?.id || 'current-user', name: clinicianName, email: user?.email || '' },
        requestedAt: now,
        changeRequestRemarks: changeRequestRemarks.trim(),
        workflowHistory: [...(prescription.workflowHistory || []), historyItem],
        updatedAt: now,
      });

      setShowRequestChangesModal(false);
      setChangeRequestRemarks('');
      showToast(`Changes requested for prescription ${prescription.rxNumber}.`);
    } catch (err) {
      console.error('Failed to request changes:', err);
      showToast('Error requesting changes.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleExecuteRevise = async () => {
    if (!prescription?.id) return;
    setIsUpdating(true);
    try {
      try {
        await fetch(`${API_BASE}/api/prescriptions/${prescription.id}/revise`, {
          method: 'POST',
          credentials: 'include',
        });
      } catch (err) {
        console.warn('Server revise sync failed, updating local DB:', err);
      }

      const now = new Date();
      const newVersion = (prescription.version || 1) + 1;
      const historyItem: PrescriptionWorkflowHistoryItem = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        version: newVersion,
        status: 'Draft',
        action: 'REVISED',
        actorUserId: user?.id || 'current-user',
        actorUser: { id: user?.id || 'current-user', name: user?.name || 'Staff', email: user?.email || '' },
        remarks: `Revised from v${prescription.version || 1} to create new editable draft v${newVersion}`,
        createdAt: now,
      };

      await db.prescriptions.update(prescription.id, {
        version: newVersion,
        status: 'Draft',
        forwardedToUserId: null,
        forwardedToUser: null,
        forwardedByUserId: null,
        forwardedByUser: null,
        forwardingRemarks: null,
        forwardedAt: null,
        approvedByUserId: null,
        approvedByUser: null,
        approvedAt: null,
        approvedVersion: null,
        approvalRemarks: null,
        requestedByUserId: null,
        requestedByUser: null,
        requestedAt: null,
        changeRequestRemarks: null,
        workflowHistory: [...(prescription.workflowHistory || []), historyItem],
        updatedAt: now,
      });

      setShowReviseModal(false);
      showToast(`Prescription revised to Version ${newVersion}. You can now edit medications.`);
      navigate(`/prescriptions/${prescription.id}/edit`);
    } catch (err) {
      console.error('Failed to revise prescription:', err);
      showToast('Error revising prescription.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSavePdf = async () => {
    // Desktop: use browser's native print engine for pixel-perfect PDF output
    // (identical to "Microsoft Print to PDF" / Ctrl+P)
    if (!isMobileDevice()) {
      savePdfNative();
      return;
    }

    // Mobile: fallback to html2canvas + jsPDF for direct download/share
    try {
      setIsGeneratingPdf(true);
      const sheet = document.getElementById('prescription-sheet');
      if (!sheet) {
        showToast('Prescription document could not be rendered for export.');
        return;
      }
      const blob = await generatePdfBlob(sheet);
      setCachedPdfBlob(blob);
      if (!prescription) return;
      const filename = buildPrescriptionFilename(prescription.rxNumber, patient?.name);
      await savePdfWithFilePicker(blob, filename);
      showToast('Prescription PDF saved successfully.');
    } catch (err) {
      console.error('Failed to save PDF on mobile:', err);
      showToast('Failed to generate PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShare = async () => {
    try {
      setIsGeneratingPdf(true);
      const sheet = document.getElementById('prescription-sheet');
      if (!sheet || !prescription) return;
      const blob = cachedPdfBlob || (await generatePdfBlob(sheet));
      setCachedPdfBlob(blob);

      const filename = buildPrescriptionFilename(prescription.rxNumber, patient?.name);
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Prescription ${prescription.rxNumber}`,
          text: `Prescription for ${patient?.name || 'patient'}`,
          files: [file],
        });
      } else {
        setShareModalOpen(true);
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        console.error('Share failed:', err);
        setShareModalOpen(true);
      }
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (!prescription) {
    return (
      <div className="rx-page-container">
        <div className="rx-empty-state">
          <div className="rx-empty-icon">
            <Icon name="prescription" size={48} />
          </div>
          <h2 className="rx-empty-title">Prescription Not Found</h2>
          <p className="rx-empty-desc">
            The requested prescription record (ID #{rxId}) could not be located in local storage.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => navigate('/prescriptions')}
          >
            <Icon name="arrow-left" size={16} />
            <span>Return to Prescriptions</span>
          </button>
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
    rxPractitioner && rxPractitioner.isActive !== false
      ? rxPractitioner
      : storePractitioner && storePractitioner.isActive !== false
      ? storePractitioner
      : null;

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
  const isPendingApproval = prescription.status === 'Pending Approval';
  const isChangesRequested = prescription.status === 'Changes Requested';
  const isApproved = prescription.status === 'Approved';
  const isDraft = prescription.status === 'Draft' || (!prescription.status as any);

  // Authoritative clinical authority check:
  // Must possess PRESCRIPTION_APPROVE or have the VETERINARIAN role.
  const canApprove =
    can('PRESCRIPTION_APPROVE') ||
    hasRole('VETERINARIAN');

  const canRequestChanges =
    can('PRESCRIPTION_REQUEST_CHANGES') ||
    canApprove;

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
            <span className="rx-preview-step-text">{isApproved ? '4 Review & Sign' : '4 Review & Approval'}</span>
          </div>
        </div>
      </div>

      {/* ── Page Header Module ─────────────────────────────────── */}
      <div className="no-print rx-preview-header-card">
        <div className="rx-preview-header-left">
          <div className="rx-preview-title-row" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h1 className="rx-title">Prescription Preview</h1>
            <span className="rx-version-badge">v{prescription.version || 1}</span>
            {isApproved ? (
              <span className="rx-status-chip approved">
                <span className="status-dot"></span>
                Approved &amp; Sealed
              </span>
            ) : isPendingApproval ? (
              <span className="rx-status-chip pending">
                <span className="status-dot pulse"></span>
                Pending Approval
              </span>
            ) : isChangesRequested ? (
              <span className="rx-status-chip changes-requested">
                <span className="status-dot"></span>
                Changes Requested
              </span>
            ) : isIssued ? (
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
                Draft
              </span>
            )}
          </div>
          <p className="rx-subtitle">
            {isCancelled
              ? 'This prescription is cancelled and preserved as a read-only historical record.'
              : isApproved
              ? `Approved clinical veterinary prescription (v${prescription.version || 1}). Printable and recorded in patient history.`
              : isPendingApproval
              ? `Prescription forwarded for clinical sign-off to Dr. ${prescription.forwardedToUser?.name || 'Veterinarian'}.`
              : isChangesRequested
              ? 'Clinical modifications requested. Update medication items and re-forward for sign-off.'
              : isIssued
              ? 'Official issued veterinary prescription. Printable and recorded in patient history.'
              : 'Draft prescription. Forward for clinical approval or approve before printing.'}
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

          {/* Workflow Banner: Pending Clinical Approval */}
          {isPendingApproval && (
            <div className="no-print rx-workflow-banner pending">
              <Icon name="clock" size={20} color="#b45309" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <div className="rx-workflow-banner-title">
                  Pending Clinical Approval — Forwarded to Dr. {prescription.forwardedToUser?.name || 'Veterinarian'}
                </div>
                <p className="rx-workflow-banner-desc">
                  This prescription is awaiting clinical sign-off by a registered veterinarian before it can be sealed and issued to the client.
                  {prescription.forwardingRemarks && (
                    <span style={{ display: 'block', marginTop: '4px', fontStyle: 'italic' }}>
                      Forwarding Remarks: "{prescription.forwardingRemarks}"
                    </span>
                  )}
                </p>
              </div>
              {canApprove && (
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0, alignItems: 'center' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ height: '36px', fontSize: '12px', background: '#fff' }}
                    onClick={() => setShowRequestChangesModal(true)}
                  >
                    Request Changes
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ height: '36px', fontSize: '12px', background: '#059669', borderColor: '#047857' }}
                    onClick={() => setShowApproveModal(true)}
                  >
                    Approve Prescription
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Workflow Banner: Changes Requested */}
          {isChangesRequested && (
            <div className="no-print rx-workflow-banner changes-requested">
              <Icon name="alert-triangle" size={20} color="#e11d48" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <div className="rx-workflow-banner-title">
                  Clinical Changes Requested by Dr. {prescription.requestedByUser?.name || 'Veterinarian'}
                </div>
                <p className="rx-workflow-banner-desc">
                  The prescribing clinician requested modifications before approval:
                  <span style={{ display: 'block', marginTop: '4px', fontWeight: 600, color: '#9f1239' }}>
                    "{prescription.changeRequestRemarks}"
                  </span>
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                style={{ height: '36px', fontSize: '12px', flexShrink: 0 }}
                onClick={() => navigate(`/prescriptions/${prescription.id}/edit`)}
              >
                <Icon name="edit" size={14} />
                <span>Edit Prescription</span>
              </button>
            </div>
          )}

          {/* Workflow Banner: Approved & Sealed Record */}
          {isApproved && (
            <div className="no-print rx-workflow-banner approved">
              <Icon name="check-circle" size={20} color="#059669" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>
                <div className="rx-workflow-banner-title">
                  Clinically Approved &amp; Sealed Record (Version {prescription.version || 1})
                </div>
                <p className="rx-workflow-banner-desc">
                  Digitally signed and sealed by Dr. {prescription.approvedByUser?.name || doctorName}
                  {prescription.approvedAt ? ` on ${new Date(prescription.approvedAt).toLocaleDateString('en-GB')}` : ''}.
                  Approved records are immutable under clinical governance standards.
                  {prescription.approvalRemarks && (
                    <span style={{ display: 'block', marginTop: '4px', fontStyle: 'italic' }}>
                      Approval Remarks: "{prescription.approvalRemarks}"
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: '36px', fontSize: '12px', flexShrink: 0, background: '#fff' }}
                onClick={() => setShowReviseModal(true)}
                title="Create a new revision starting as Draft"
              >
                <Icon name="copy" size={14} />
                <span>Create New Revision</span>
              </button>
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
            ) : isPendingApproval ? (
              canApprove || canRequestChanges ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {canApprove && (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ width: '100%', height: '48px', fontSize: '14px', fontWeight: 700, background: '#059669', borderColor: '#047857' }}
                      onClick={() => setShowApproveModal(true)}
                      disabled={isUpdating}
                    >
                      <Icon name="check-circle" size={20} />
                      <span>Approve &amp; Sign Prescription</span>
                    </button>
                  )}
                  {canRequestChanges && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      style={{ width: '100%', height: '40px', fontSize: '13px', fontWeight: 600, color: '#e11d48', borderColor: '#fecdd3' }}
                      onClick={() => setShowRequestChangesModal(true)}
                      disabled={isUpdating}
                    >
                      <Icon name="alert-triangle" size={16} />
                      <span>Request Changes</span>
                    </button>
                  )}
                </div>
              ) : (
                <div
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 'var(--radius)',
                    padding: '12px',
                    marginBottom: '12px',
                    fontSize: '13px',
                    color: '#92400e',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Icon name="clock" size={18} color="#b45309" />
                  <span>Awaiting approval by Dr. {prescription.forwardedToUser?.name || 'Clinician'}</span>
                </div>
              )
            ) : isChangesRequested ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', height: '48px', fontSize: '14px', fontWeight: 700 }}
                  onClick={() => navigate(`/prescriptions/${prescription.id}/edit`)}
                >
                  <Icon name="edit" size={20} />
                  <span>Edit &amp; Fix Medications</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', height: '40px', fontSize: '13px', fontWeight: 600 }}
                  onClick={handleOpenForwardModal}
                  disabled={isUpdating}
                >
                  <Icon name="share" size={16} />
                  <span>Resubmit for Approval</span>
                </button>
              </div>
            ) : isDraft ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', height: '48px', fontSize: '14px', fontWeight: 700 }}
                  onClick={handleOpenForwardModal}
                  disabled={isUpdating}
                >
                  <Icon name="share" size={20} />
                  <span>Forward for Clinical Approval</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', height: '40px', fontSize: '13px', fontWeight: 600 }}
                  onClick={() => navigate(`/prescriptions/${prescription.id}/edit`)}
                >
                  <Icon name="edit" size={16} />
                  <span>Edit Draft</span>
                </button>
                {canApprove && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ width: '100%', height: '40px', fontSize: '13px', fontWeight: 600, color: '#059669', borderColor: '#a7f3d0' }}
                    onClick={() => setShowApproveModal(true)}
                    disabled={isUpdating}
                  >
                    <Icon name="check-circle" size={16} />
                    <span>Direct Clinician Approval</span>
                  </button>
                )}
              </div>
            ) : isApproved ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ width: '100%', height: '48px', fontSize: '14px', fontWeight: 700 }}
                  onClick={handlePrint}
                >
                  <Icon name="printer" size={20} />
                  <span>Print Approved Prescription</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: '100%', height: '40px', fontSize: '13px', fontWeight: 600 }}
                  onClick={() => setShowReviseModal(true)}
                >
                  <Icon name="copy" size={16} />
                  <span>Create New Revision (v{(prescription.version || 1) + 1})</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', height: '48px', fontSize: '14px', fontWeight: 700, marginBottom: '12px' }}
                onClick={handleOpenForwardModal}
              >
                <Icon name="share" size={20} />
                <span>Forward for Clinical Approval</span>
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

            {/* Cancel Action Button (clearly visible when approved/issued or draft) */}
            {(isIssued || isApproved || isDraft || isPendingApproval || isChangesRequested) && !isCancelled && (
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
            {(isDraft || isChangesRequested) ? (
              <button
                type="button"
                className="btn btn-ghost"
                style={{ width: '100%', height: '38px', fontSize: '13px', color: 'var(--color-on-surface-variant)' }}
                onClick={() => navigate(`/prescriptions/${prescription.id}/edit`)}
              >
                <Icon name="arrow-left" size={16} />
                <span>Back to Medication Editor</span>
              </button>
            ) : isApproved ? (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', height: '38px', fontSize: '13px' }}
                onClick={() => setShowReviseModal(true)}
              >
                <Icon name="copy" size={16} />
                <span>Create New Revision</span>
              </button>
            ) : isCancelled ? (
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

          {/* Workflow Audit Trail & Revision History */}
          {prescription.workflowHistory && prescription.workflowHistory.length > 0 && (
            <div className="rx-timeline-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '13.5px', fontWeight: 700, color: 'var(--color-on-surface)', margin: 0 }}>
                  Workflow History
                </h3>
                <span className="rx-version-badge">v{prescription.version || 1}</span>
              </div>
              <div className="rx-timeline-list">
                {prescription.workflowHistory.slice().reverse().map((step) => {
                  const isApprovedStep = step.action === 'APPROVED';
                  const isPendingStep = step.action === 'FORWARDED';
                  const isChangesStep = step.action === 'CHANGES_REQUESTED';
                  const isRevisedStep = step.action === 'REVISED';
                  const dotClass = isApprovedStep ? 'approved' : isPendingStep ? 'pending' : isChangesStep ? 'changes' : isRevisedStep ? 'revised' : '';
                  const timeStr = step.createdAt ? new Date(step.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
                  return (
                    <div key={step.id} className="rx-timeline-item">
                      <div className={`rx-timeline-dot ${dotClass}`} />
                      <div className="rx-timeline-header">
                        <span className="rx-timeline-action">
                          {step.action.replace(/_/g, ' ')}
                          <span style={{ fontSize: '11px', color: 'var(--color-outline)', marginLeft: '4px' }}>
                            (v{step.version})
                          </span>
                        </span>
                        <span className="rx-timeline-time">{timeStr}</span>
                      </div>
                      <div className="rx-timeline-actor">
                        By: <strong>{step.actorUser?.name || 'Staff'}</strong>
                        {step.targetUser && (
                          <span> → To: <strong>Dr. {step.targetUser.name}</strong></span>
                        )}
                      </div>
                      {step.remarks && (
                        <div className="rx-timeline-remarks">
                          "{step.remarks}"
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

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

      {/* Forward for Clinical Approval Modal */}
      {showForwardModal && (
        <div className="rx-modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="rx-modal-box" style={{ maxWidth: '480px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(0, 104, 95, 0.1)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="share" size={20} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                  Forward for Clinical Approval
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
                  Assign to a licensed veterinarian for clinical validation
                </span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" htmlFor="forward-clinician-select">
                Select Prescribing Veterinarian *
              </label>
              {loadingClinicians ? (
                <div style={{ fontSize: '13px', color: 'var(--color-outline)', padding: '8px 0' }}>
                  Loading eligible clinicians…
                </div>
              ) : (
                <select
                  id="forward-clinician-select"
                  className="form-input"
                  value={forwardToUserId}
                  onChange={(e) => setForwardToUserId(e.target.value)}
                  style={{ width: '100%', height: '40px', fontSize: '13px' }}
                >
                  {eligibleClinicians.map((c) => (
                    <option key={c.id} value={c.id}>
                      Dr. {c.name} {c.email ? `(${c.email})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" htmlFor="forward-remarks">
                Clinical Remarks / Handover Notes <span style={{ color: 'var(--color-outline)', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                id="forward-remarks"
                className="form-textarea"
                rows={3}
                placeholder="e.g. Prepared under Dr.'s telephone advice; special dosing for renal condition..."
                value={forwardRemarks}
                onChange={(e) => setForwardRemarks(e.target.value)}
                style={{ fontSize: '13px', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: '40px', minWidth: '100px' }}
                onClick={() => setShowForwardModal(false)}
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ height: '40px', minWidth: '160px' }}
                onClick={handleExecuteForward}
                disabled={isUpdating || !forwardToUserId}
              >
                {isUpdating ? 'Forwarding…' : 'Forward for Approval'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approve Prescription Modal */}
      {showApproveModal && (
        <div className="rx-modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="rx-modal-box" style={{ maxWidth: '480px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  color: '#047857',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="check-circle" size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                  Approve &amp; Digitally Seal
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
                  Prescription {prescription.rxNumber} (Version {prescription.version || 1})
                </span>
              </div>
            </div>

            <p style={{ fontSize: '13.5px', lineHeight: 1.5, color: 'var(--color-on-surface-variant)', marginBottom: '16px' }}>
              You are approving this prescription under your veterinary license. Once approved, this clinical record will be sealed as immutable. Any future changes will require creating a new numbered revision.
            </p>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" htmlFor="approval-remarks">
                Approval Remarks / Seal Notes <span style={{ color: 'var(--color-outline)', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                id="approval-remarks"
                className="form-textarea"
                rows={2}
                placeholder="e.g. Dose reviewed and confirmed against patient weight and biochemistry."
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                style={{ fontSize: '13px', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: '40px', minWidth: '100px' }}
                onClick={() => setShowApproveModal(false)}
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ height: '40px', minWidth: '150px', background: '#059669', borderColor: '#047857' }}
                onClick={handleExecuteApprove}
                disabled={isUpdating}
              >
                {isUpdating ? 'Approving…' : 'Approve & Sign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Request Changes Modal */}
      {showRequestChangesModal && (
        <div className="rx-modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="rx-modal-box" style={{ maxWidth: '480px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#ffe4e6',
                  color: '#e11d48',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="alert-triangle" size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                  Request Clinical Changes
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
                  Return prescription to draft with instructions for staff
                </span>
              </div>
            </div>

            <p style={{ fontSize: '13px', lineHeight: 1.45, color: 'var(--color-on-surface-variant)', marginBottom: '14px' }}>
              Please specify the clinical adjustments or dosage corrections required before this prescription can be approved.
            </p>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" htmlFor="change-request-remarks">
                Required Changes / Instructions *
              </label>
              <textarea
                id="change-request-remarks"
                className="form-textarea"
                rows={3}
                placeholder="e.g. Reduce Amoxicillin dose to 10mg/kg BID; check if patient has had NSAIDs recently..."
                value={changeRequestRemarks}
                onChange={(e) => setChangeRequestRemarks(e.target.value)}
                style={{ fontSize: '13px', width: '100%' }}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: '40px', minWidth: '100px' }}
                onClick={() => setShowRequestChangesModal(false)}
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: '40px', minWidth: '160px', background: '#dc2626', color: '#fff', borderColor: '#b91c1c' }}
                onClick={handleExecuteRequestChanges}
                disabled={isUpdating || !changeRequestRemarks.trim()}
              >
                {isUpdating ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Revision Modal */}
      {showReviseModal && (
        <div className="rx-modal-backdrop" style={{ zIndex: 9999 }}>
          <div className="rx-modal-box" style={{ maxWidth: '480px', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: 'rgba(99, 102, 241, 0.1)',
                  color: '#6366f1',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="copy" size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                  Create New Revision (v{(prescription.version || 1) + 1})?
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
                  Amend approved prescription {prescription.rxNumber}
                </span>
              </div>
            </div>

            <p style={{ fontSize: '13.5px', lineHeight: 1.5, color: 'var(--color-on-surface-variant)', marginBottom: '20px' }}>
              Approved prescriptions are legally sealed and immutable. Creating a revision will generate Version {(prescription.version || 1) + 1} starting in Draft status, preserving the approved record in audit history.
            </p>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: '40px', minWidth: '100px' }}
                onClick={() => setShowReviseModal(false)}
                disabled={isUpdating}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ height: '40px', minWidth: '160px' }}
                onClick={handleExecuteRevise}
                disabled={isUpdating}
              >
                {isUpdating ? 'Creating…' : `Create Revision v${(prescription.version || 1) + 1}`}
              </button>
            </div>
          </div>
        </div>
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
