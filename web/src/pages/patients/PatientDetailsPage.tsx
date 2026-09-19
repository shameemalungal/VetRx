// =============================================================
// VetRx — Patient Details / Profile Page
// Presentation layer displaying patient record, owner profile,
// multiple animals for owner, and historical prescriptions & invoices.
// =============================================================

import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { Icon } from '../../components/ui/Icon';
import { formatAnimalSubtitle, formatOwnerPrimary, isArtificialOrBlankName } from '../../utils/patientFormat';
import type { Patient } from '../../types';
import './Patients.css';

function fmtRupees(paisa: number): string {
  return '₹' + (paisa / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

function formatDate(d?: Date): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const PatientDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const patientId = Number(id);

  // ── Live Queries ──────────────────────────────────────────────
  const patient = useLiveQuery(
    () => (patientId ? db.patients.get(patientId) : undefined),
    [patientId]
  );

  const owner = useLiveQuery(
    () => (patient?.ownerId ? db.owners.get(patient.ownerId) : undefined),
    [patient?.ownerId]
  );

  // Other animals for this owner
  const siblingAnimals = useLiveQuery(
    async () => {
      if (!patient?.ownerId) return [];
      const animals = await db.patients
        .where('ownerId')
        .equals(patient.ownerId)
        .toArray();
      return animals.filter((a) => a.id !== patientId);
    },
    [patient?.ownerId, patientId]
  );

  // Historical Prescriptions
  const prescriptions = useLiveQuery(
    async () => {
      if (!patientId) return [];
      const list = await db.prescriptions
        .where('patientId')
        .equals(patientId)
        .toArray();
      return list.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    },
    [patientId]
  );

  // Historical Invoices
  const invoices = useLiveQuery(
    async () => {
      if (!patientId) return [];
      const list = await db.invoices
        .where('patientId')
        .equals(patientId)
        .toArray();
      return list.sort(
        (a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()
      );
    },
    [patientId]
  );

  // ── Owner Edit Modal State & Handlers ─────────────────────────
  const [isEditOwnerOpen, setIsEditOwnerOpen] = useState(false);
  const [ownerName, setOwnerName] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerAddress, setOwnerAddress] = useState('');
  const [ownerNotes, setOwnerNotes] = useState('');
  const [ownerError, setOwnerError] = useState<string | null>(null);
  const [isSavingOwner, setIsSavingOwner] = useState(false);

  const openEditOwner = () => {
    if (!owner) return;
    setOwnerName(owner.name || '');
    setOwnerPhone(owner.phone || '');
    setOwnerEmail(owner.email || '');
    setOwnerAddress(owner.address || '');
    setOwnerNotes(owner.notes || '');
    setOwnerError(null);
    setIsEditOwnerOpen(true);
  };

  const handleSaveOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!owner?.id) return;
    const trimmedName = ownerName.trim();
    const trimmedPhone = ownerPhone.trim();
    if (!trimmedName) {
      setOwnerError('Owner full name is required.');
      return;
    }
    if (!trimmedPhone) {
      setOwnerError('Owner phone number is required.');
      return;
    }
    const cleanPhone = trimmedPhone.replace(/[^0-9+]/g, '');
    if (cleanPhone.replace(/\D/g, '').length < 7) {
      setOwnerError('Please enter a valid phone number (at least 7 digits).');
      return;
    }

    setIsSavingOwner(true);
    try {
      // Duplicate phone normalization check
      const existingWithPhone = await db.owners.where('phone').equals(cleanPhone).first();
      if (existingWithPhone && existingWithPhone.id !== owner.id) {
        setOwnerError(
          `Another client record (${existingWithPhone.name}) already has this phone number (${cleanPhone}). Please verify.`
        );
        setIsSavingOwner(false);
        return;
      }

      await db.owners.update(owner.id, {
        name: trimmedName,
        phone: cleanPhone,
        email: ownerEmail.trim() || undefined,
        address: ownerAddress.trim() || undefined,
        notes: ownerNotes.trim() || undefined,
        updatedAt: new Date(),
      });

      setIsEditOwnerOpen(false);
    } catch (err) {
      console.error('Failed to update owner:', err);
      setOwnerError('Failed to save owner changes.');
    } finally {
      setIsSavingOwner(false);
    }
  };

  if (patient === undefined) {
    return (
      <div className="patients-page">
        <div className="empty-state">
          <div className="spinner" />
          <span>Loading patient record…</span>
        </div>
      </div>
    );
  }

  if (patient === null) {
    return (
      <div className="patients-page">
        <div className="empty-state card">
          <Icon name="warning" size={48} className="text-warning" />
          <div className="section-title">Patient Record Not Found</div>
          <div className="section-sub">
            The requested patient record could not be found or has been removed.
          </div>
          <Link to="/patients" className="btn btn-secondary btn-sm">
            <Icon name="chevron-left" size={16} />
            <span>Back to Patients</span>
          </Link>
        </div>
      </div>
    );
  }

  const formatAge = (p: Patient) => {
    if (p.ageNote) return p.ageNote;
    if (p.dateOfBirth) {
      const now = new Date();
      const dob = new Date(p.dateOfBirth);
      const months = (now.getFullYear() - dob.getFullYear()) * 12 + (now.getMonth() - dob.getMonth());
      if (months < 12) return `${Math.max(1, months)} mos`;
      const years = Math.floor(months / 12);
      const remMonths = months % 12;
      return remMonths > 0 ? `${years}y ${remMonths}m` : `${years} yrs`;
    }
    return 'Not recorded';
  };

  const isCanine = patient.species === 'Canine';
  const isFeline = patient.species === 'Feline';
  const avatarClass = isCanine ? 'avatar-canine' : isFeline ? 'avatar-feline' : 'avatar-other';
  const identification = patient.identificationRef || (patient.id ? `#CAN-${8800 + patient.id}` : undefined);

  return (
    <div className="patients-page">
      {/* ── Breadcrumb & Top Bar ───────────────────────────────── */}
      <div className="patient-details-header flex items-center justify-between flex-wrap gap-space-sm">
        <nav aria-label="Breadcrumb" className="flex items-center gap-space-sm text-sm flex-wrap">
          <Link to="/patients" className="btn-back" title="Back to Patients">
            <Icon name="arrow-left" size={14} />
            <span>Back</span>
          </Link>
          <span className="text-outline-variant">/</span>
          <span className="text-on-surface font-semibold">{formatOwnerPrimary(owner, 'Client')} — {!isArtificialOrBlankName(patient.name) ? patient.name : patient.species}</span>
        </nav>

        <div className="patient-details-actions">
          {/* Group 1: Primary Clinical / Billing Actions */}
          <div className="patient-actions-group patient-actions-primary-group">
            <Link
              to={`/prescriptions/new?patientId=${patient.id}`}
              className="btn patient-action-btn patient-btn-primary"
              id="btn-add-new-rx"
            >
              <Icon name="plus" size={15} />
              <span>Add New Rx</span>
            </Link>
            <Link
              to={`/invoices/new?patientId=${patient.id}`}
              className="btn patient-action-btn patient-btn-primary"
              id="btn-add-new-invoice"
            >
              <Icon name="plus" size={15} />
              <span>Add New Invoice/Receipt</span>
            </Link>
          </div>

          {/* Group 2: Patient Record Management */}
          <div className="patient-actions-group patient-actions-secondary-group">
            <Link
              to={`/patients/${patient.id}/edit`}
              className="btn patient-action-btn patient-btn-secondary"
              id="btn-edit-patient"
            >
              <Icon name="edit" size={15} />
              <span>Edit Patient</span>
            </Link>
            {owner?.id && (
              <Link
                to={`/patients/new?ownerId=${owner.id}`}
                className="btn patient-action-btn patient-btn-secondary"
                id="btn-add-sibling-animal"
                title={`Add another animal for ${owner.name}`}
              >
                <Icon name="plus" size={15} />
                <span>Add Another Animal</span>
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* ── Main 2-Column Details Grid ─────────────────────────── */}
      <div className="patient-details-grid">
        {/* ======================================================= */}
        {/* LEFT COLUMN: Patient Hero & Clinical History (8 cols)   */}
        {/* ======================================================= */}
        <div className="flex flex-col gap-space-lg">
          {/* Patient Hero Card */}
          <section className="patient-profile-hero" aria-label="Patient details">
            <div className="profile-hero-top">
              <div className="profile-hero-identity">
                <div className={`profile-large-avatar ${avatarClass}`}>
                  <Icon name="paw" size={32} />
                </div>
                <div className="profile-title-block">
                  <div className="flex items-center gap-space-sm flex-wrap">
                    <h1 className="profile-animal-name">{formatOwnerPrimary(owner, 'Client')}</h1>
                    {owner?.phone && (
                      <span className="text-sm font-mono text-outline font-semibold">({owner.phone})</span>
                    )}
                    {identification && (
                      <span className="patient-id-badge">{identification}</span>
                    )}
                    <span className="badge badge-issued">Active Record</span>
                  </div>
                  <div className="profile-animal-subtitle">
                    {formatAnimalSubtitle(patient)}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick stats grid */}
            <div className="profile-quick-stats">
              <div className="quick-stat-box">
                <span className="quick-stat-label">Species</span>
                <span className="quick-stat-val">{patient.species}</span>
              </div>
              <div className="quick-stat-box">
                <span className="quick-stat-label">Breed</span>
                <span className="quick-stat-val truncate">{patient.breed || 'Not specified'}</span>
              </div>
              <div className="quick-stat-box">
                <span className="quick-stat-label">Sex</span>
                <span className="quick-stat-val">{patient.sex || 'Unknown'}</span>
              </div>
              <div className="quick-stat-box">
                <span className="quick-stat-label">Age / DOB</span>
                <span className="quick-stat-val">{formatAge(patient)}</span>
              </div>
              <div className="quick-stat-box">
                <span className="quick-stat-label">Weight</span>
                <span className="quick-stat-val text-primary">
                  {patient.weightKg !== undefined && patient.weightKg !== null
                    ? `${patient.weightKg.toFixed(1)} kg`
                    : 'Not weighed'}
                </span>
              </div>
              {patient.microchipNumber && (
                <div className="quick-stat-box">
                  <span className="quick-stat-label">Microchip</span>
                  <span className="quick-stat-val font-mono">{patient.microchipNumber}</span>
                </div>
              )}
            </div>

            {/* Patient Clinical Notes */}
            {patient.notes && (
              <div className="patient-notes-box">
                <strong className="block text-on-surface font-medium mb-1">Clinical Notes:</strong>
                {patient.notes}
              </div>
            )}
          </section>

          {/* SECTION: PREVIOUS PRESCRIPTIONS HISTORY */}
          <section className="history-section-card" aria-label="Prescriptions history">
            <div className="history-card-header">
              <div className="flex items-center gap-space-sm">
                <div className="section-header-icon-wrap icon-wrap-teal">
                  <Icon name="prescription" size={18} />
                </div>
                <div>
                  <h2 className="section-title">Prescription History</h2>
                  <span className="section-subtitle">
                    Dispensed electronic prescriptions and clinical orders
                  </span>
                </div>
              </div>
              <span className="badge badge-primary">
                {prescriptions?.length || 0} Records
              </span>
            </div>

            <div className="flex flex-col mt-space-sm">
              {!prescriptions || prescriptions.length === 0 ? (
                <div className="empty-state p-space-lg">
                  <Icon name="prescription" size={32} />
                  <span className="text-sm">No prescriptions recorded yet for this animal ({formatAnimalSubtitle(patient) || 'Registered Animal'})</span>
                </div>
              ) : (
                prescriptions.map((rx) => (
                  <div key={rx.id} className="history-item-row">
                    <div className="history-item-left flex items-center gap-space-md min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary shrink-0">
                        <Icon name="prescription" size={20} />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-space-xs flex-wrap">
                          <strong className="data-mono text-primary font-semibold">{rx.rxNumber}</strong>
                          <span className="text-outline-variant">•</span>
                          <span className="font-medium text-on-surface truncate">
                            {rx.diagnosis || 'Clinical Prescription'}
                          </span>
                        </div>
                        <div className="text-xs text-on-surface-variant mt-0.5 truncate">
                          {rx.symptoms ? `Symptoms: ${rx.symptoms}` : 'Routine clinical dispensing'}
                        </div>
                      </div>
                    </div>

                    <div className="history-item-right flex items-center gap-space-md shrink-0">
                      <span className="text-xs text-on-surface-variant font-mono">
                        {formatDate(rx.issuedAt || rx.createdAt)}
                      </span>
                      <span className={`badge-pill badge-pill-${rx.status.toLowerCase()}`}>
                        <span className="badge-pill-dot" />
                        {rx.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* SECTION: PREVIOUS INVOICES HISTORY */}
          <section className="history-section-card" aria-label="Invoices history">
            <div className="history-card-header">
              <div className="flex items-center gap-space-sm">
                <div className="section-header-icon-wrap icon-wrap-blue">
                  <Icon name="invoices" size={18} />
                </div>
                <div>
                  <h2 className="section-title">Invoice History</h2>
                  <span className="section-subtitle">
                    Document-only billing records and itemized charges (₹ INR)
                  </span>
                </div>
              </div>
              <span className="badge badge-primary">
                {invoices?.length || 0} Documents
              </span>
            </div>

            <div className="flex flex-col mt-space-sm">
              {!invoices || invoices.length === 0 ? (
                <div className="empty-state p-space-lg">
                  <Icon name="invoices" size={32} />
                  <span className="text-sm">No invoices recorded yet for this animal ({formatAnimalSubtitle(patient) || 'Registered Animal'})</span>
                </div>
              ) : (
                invoices.map((inv) => (
                  <div key={inv.id} className="history-item-row">
                    <div className="history-item-left flex items-center gap-space-md min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-secondary shrink-0 font-bold font-mono text-xs">
                        INV
                      </div>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-space-xs flex-wrap">
                          <strong className="data-mono text-on-surface font-semibold">{inv.invoiceNumber}</strong>
                          <span className="text-outline-variant">•</span>
                          <span className="text-xs text-on-surface-variant font-mono">
                            {formatDate(inv.invoiceDate)}
                          </span>
                        </div>
                        <div className="text-xs text-on-surface-variant mt-0.5">
                          {inv.notes || 'Veterinary care & treatment charges'}
                        </div>
                      </div>
                    </div>

                    <div className="history-item-right flex items-center gap-space-md shrink-0">
                      <span className="data-mono font-bold text-on-surface">
                        {fmtRupees(inv.grandTotal)}
                      </span>
                      <span className={`badge-pill badge-pill-${inv.status.toLowerCase()}`}>
                        <span className="badge-pill-dot" />
                        {inv.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* ======================================================= */}
        {/* RIGHT COLUMN: Owner Card & Sibling Animals (4 cols)     */}
        {/* ======================================================= */}
        <div className="patient-sidebar-column">
          {/* 1. Registered Owner / Client Profile Card */}
          <section className="client-profile-card" aria-label="Registered Owner Profile">
            <div className="client-card-header">
              <span className="client-section-label">Registered Owner</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {owner && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ height: '26px', fontSize: '11.5px', padding: '0 8px', color: 'var(--color-primary)' }}
                    onClick={openEditOwner}
                    title="Edit owner profile & contact details"
                  >
                    <Icon name="edit" size={13} />
                    <span>Edit Details</span>
                  </button>
                )}
                <span className="client-profile-badge">Client Profile</span>
              </div>
            </div>

            {owner ? (
              <div className="client-profile-body">
                <div className="client-identity-box">
                  <div className="client-avatar" aria-hidden="true">
                    {owner.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="client-identity-info">
                    <span className="client-name">{owner.name}</span>
                    <span className="client-id-tag">Client ID: #{owner.id}</span>
                  </div>
                </div>

                <div className="client-contact-box">
                  <div className="client-contact-row">
                    <div className="contact-icon-wrap" aria-hidden="true">
                      <Icon name="phone" size={15} />
                    </div>
                    <div className="contact-value-wrap">
                      <a
                        href={`tel:${owner.phone}`}
                        className="contact-link contact-phone"
                        title={`Call ${owner.name}`}
                      >
                        {owner.phone}
                      </a>
                    </div>
                  </div>

                  {owner.email && (
                    <div className="client-contact-row">
                      <div className="contact-icon-wrap" aria-hidden="true">
                        <Icon name="mail" size={15} />
                      </div>
                      <div className="contact-value-wrap">
                        <a
                          href={`mailto:${owner.email}`}
                          className="contact-link contact-email"
                          title={`Email ${owner.name}`}
                        >
                          {owner.email}
                        </a>
                      </div>
                    </div>
                  )}

                  {owner.address && (
                    <div className="client-contact-row">
                      <div className="contact-icon-wrap" aria-hidden="true">
                        <Icon name="map-pin" size={15} />
                      </div>
                      <div className="contact-value-wrap">
                        <span className="contact-text contact-address">{owner.address}</span>
                      </div>
                    </div>
                  )}
                </div>

                {owner.notes && (
                  <div className="client-notes-box">
                    <span className="client-notes-label">Notes: </span>
                    <span>{owner.notes}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="client-empty-state">
                No owner currently linked to this patient.
              </div>
            )}
          </section>

          {/* 2. Family Animals Section / Distinct Card */}
          <section className="family-animals-card" aria-label="Family Animals">
            <div className="family-animals-header">
              <span className="family-animals-title">
                Family Animals ({siblingAnimals?.length || 0})
              </span>
              {owner?.id && (
                <Link
                  to={`/patients/new?ownerId=${owner.id}`}
                  className="family-add-animal-action"
                  title="Add another animal for this client"
                >
                  <Icon name="plus" size={13} />
                  <span>Add Animal</span>
                </Link>
              )}
            </div>

            {!siblingAnimals || siblingAnimals.length === 0 ? (
              <div className="family-animals-empty">
                No other animals currently registered for this client.
              </div>
            ) : (
              <div className="family-animals-list">
                {siblingAnimals.map((sibling) => (
                  <div key={sibling.id} className="family-animal-item">
                    <div className="family-animal-meta-left">
                      <div className="family-animal-avatar" aria-hidden="true">
                        <Icon name="paw" size={15} />
                      </div>
                      <div className="family-animal-details">
                        <span className="family-animal-name">{sibling.name}</span>
                        <span className="family-animal-sub">
                          {sibling.species} {sibling.breed ? `• ${sibling.breed}` : ''}
                        </span>
                      </div>
                    </div>
                    <Link
                      to={`/patients/${sibling.id}`}
                      className="family-animal-view-btn"
                      title={`View profile of ${sibling.name}`}
                      aria-label={`View profile of ${sibling.name}`}
                    >
                      <Icon name="arrow-right" size={14} />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Edit Owner Modal */}
      {isEditOwnerOpen && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={() => setIsEditOwnerOpen(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              borderRadius: 'var(--radius-xl)',
              background: 'var(--color-surface, #ffffff)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius)', background: 'var(--color-primary-container)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="user" size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>Edit Owner Profile</h3>
                  <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>Client ID: #{owner?.id}</span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setIsEditOwnerOpen(false)}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            {ownerError && (
              <div
                style={{
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 14px',
                  marginBottom: '16px',
                  color: '#991b1b',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Icon name="warning" size={16} />
                <span>{ownerError}</span>
              </div>
            )}

            <form onSubmit={handleSaveOwner} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Owner Full Name <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Rahul Sharma"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>
                  Phone Number <span style={{ color: 'var(--color-error)' }}>*</span>
                </label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="e.g. +91 9876543210"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.target.value)}
                  required
                />
                <span style={{ fontSize: '11px', color: 'var(--color-outline)', marginTop: '2px' }}>
                  Used across sibling animal records
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="e.g. rahul@example.com"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Residential Address</label>
                <textarea
                  className="form-input"
                  rows={2}
                  placeholder="e.g. Flat 402, Green Valley Apartments"
                  value={ownerAddress}
                  onChange={(e) => setOwnerAddress(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '12px', fontWeight: 600 }}>Notes / Preferences</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Prefers WhatsApp communication"
                  value={ownerNotes}
                  onChange={(e) => setOwnerNotes(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsEditOwnerOpen(false)}
                  disabled={isSavingOwner}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSavingOwner}
                >
                  {isSavingOwner ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
