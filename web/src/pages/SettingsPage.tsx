// =============================================================
// VetRx — Settings page
// Practitioner profile + optional Clinic/Practice identity.
// Clinic section omitted entirely if left blank.
// =============================================================

import React, { useEffect, useState, useRef } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { db } from '../db/schema';
import { Icon } from '../components/ui/Icon';
import { MasterDataSection } from './MasterDataSection';
import {
  exportDatabaseBackup,
  validateBackupFile,
  restoreDatabaseBackup,
  requestPersistentStorage,
  type BackupValidationResult,
} from '../utils/backupRestore';
import { useAuth } from '../context/AuthContext';
import './SettingsPage.css';

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');

function FormGroup({
  label,
  htmlFor,
  optional,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={htmlFor}>
        {label}
        {optional && <span className="form-label-optional">(optional)</span>}
      </label>
      {children}
      {hint && <span className="form-hint">{hint}</span>}
    </div>
  );
}

// ── Practitioner form ──────────────────────────────────────────

interface PractitionerFormData {
  name: string;
  registrationNumber: string;
  qualifications: string;
  phone: string;
  email: string;
  address: string;
  photoDataUrl?: string;
  signatureDataUrl?: string;
}

function PractitionerSection() {
  const { practitioner, savePractitioner } = useSettingsStore();
  const [form, setForm] = useState<PractitionerFormData>({
    name: '',
    registrationNumber: '',
    qualifications: '',
    phone: '',
    email: '',
    address: '',
    photoDataUrl: undefined,
    signatureDataUrl: undefined,
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (practitioner) {
      setForm({
        name: practitioner.name,
        registrationNumber: practitioner.registrationNumber,
        qualifications: practitioner.qualifications,
        phone: practitioner.phone,
        email: practitioner.email,
        address: practitioner.address,
        photoDataUrl: practitioner.photoDataUrl,
        signatureDataUrl: practitioner.signatureDataUrl,
      });
    }
  }, [practitioner]);

  const update = (field: keyof PractitionerFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
      alert('Please select a JPG, JPEG, PNG, or WEBP image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const result = loadEvt.target?.result as string;
      if (result) {
        setForm((f) => ({ ...f, photoDataUrl: result }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handlePhotoRemove = () => {
    setForm((f) => ({ ...f, photoDataUrl: undefined }));
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
      alert('Please select a JPG, JPEG, PNG, or WEBP image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const result = loadEvt.target?.result as string;
      if (result) {
        setForm((f) => ({ ...f, signatureDataUrl: result }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSignatureRemove = () => {
    setForm((f) => ({ ...f, signatureDataUrl: undefined }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await savePractitioner(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <section className="settings-section card">
      <div className="card-header">
        <div>
          <div className="section-title">Practitioner Profile</div>
          <div className="section-sub">
            Your identity shown on prescriptions and invoices
          </div>
        </div>
        <Icon name="patients" size={20} />
      </div>
      <form onSubmit={handleSave} className="card-body settings-form" noValidate>
        <div className="settings-grid">
          <FormGroup label="Full name" htmlFor="prac-name">
            <input
              id="prac-name"
              className="form-input"
              type="text"
              value={form.name}
              onChange={update('name')}
              placeholder="Dr. Full Name"
              required
              autoComplete="name"
            />
          </FormGroup>

          <FormGroup
            label="Registration number"
            htmlFor="prac-reg"
            hint="As issued by your veterinary council"
          >
            <input
              id="prac-reg"
              className="form-input"
              type="text"
              value={form.registrationNumber}
              onChange={update('registrationNumber')}
              placeholder="KVC-84920-A"
              required
            />
          </FormGroup>

          <FormGroup label="Qualifications / designation" htmlFor="prac-qual" optional>
            <input
              id="prac-qual"
              className="form-input"
              type="text"
              value={form.qualifications}
              onChange={update('qualifications')}
              placeholder="BVSc, MVSc (Surgery)"
            />
          </FormGroup>

          <FormGroup label="Phone" htmlFor="prac-phone">
            <input
              id="prac-phone"
              className="form-input"
              type="tel"
              value={form.phone}
              onChange={update('phone')}
              placeholder="+91 98765 43210"
              autoComplete="tel"
            />
          </FormGroup>

          <FormGroup label="Email" htmlFor="prac-email" optional>
            <input
              id="prac-email"
              className="form-input"
              type="email"
              value={form.email}
              onChange={update('email')}
              placeholder="sarah@clinic.in"
              autoComplete="email"
            />
          </FormGroup>

          <FormGroup label="Address" htmlFor="prac-addr" optional>
            <textarea
              id="prac-addr"
              className="form-textarea"
              value={form.address}
              onChange={update('address')}
              placeholder="12, MG Road, Bengaluru"
              rows={2}
            />
          </FormGroup>
        </div>

        {/* Doctor Photo & Signature Upload Cards */}
        <div style={{ marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--color-border)' }}>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
              Doctor Photo &amp; Doctor Signature
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', marginTop: '2px' }}>
              Upload doctor portrait photo and authorized digital signature for electronic prescriptions, invoices, and receipts.
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {/* Card 1: Doctor Photo */}
            <div
              className="card"
              style={{
                padding: '16px',
                background: 'var(--color-surface-container-low)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                  Doctor Photo
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>JPG, JPEG, PNG, WEBP</span>
              </div>

              {/* Photo Preview Container */}
              <div
                style={{
                  height: '140px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-container-lowest)',
                  border: '1px dashed var(--color-outline-variant)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                  padding: '8px',
                }}
              >
                {form.photoDataUrl ? (
                  <img
                    src={form.photoDataUrl}
                    alt="Doctor Photo Preview"
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--color-outline)' }}>
                    <Icon name="patients" size={36} />
                    <div style={{ fontSize: '12px', marginTop: '6px', fontWeight: 500 }}>
                      No photo uploaded
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label
                  className="btn btn-secondary btn-sm"
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', margin: 0 }}
                >
                  <Icon name="upload" size={14} />
                  <span>{form.photoDataUrl ? 'Replace Photo' : 'Upload Photo'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    style={{ display: 'none' }}
                    onChange={handlePhotoUpload}
                  />
                </label>

                {form.photoDataUrl && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ color: 'var(--color-error)', borderColor: 'rgba(186, 26, 26, 0.3)' }}
                    onClick={handlePhotoRemove}
                  >
                    <Icon name="trash" size={14} />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {/* Recommended Dimensions Helper */}
              <div style={{ fontSize: '11.5px', color: 'var(--color-outline)', lineHeight: 1.45 }}>
                Recommended: square image (e.g. 300 × 300 px or 1:1 ratio) for best placement. Other dimensions are accepted.
              </div>
            </div>

            {/* Card 2: Doctor Signature */}
            <div
              className="card"
              style={{
                padding: '16px',
                background: 'var(--color-surface-container-low)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                  Doctor Signature
                </span>
                <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>JPG, JPEG, PNG, WEBP</span>
              </div>

              {/* Signature Preview Container */}
              <div
                style={{
                  height: '140px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-container-lowest)',
                  border: '1px dashed var(--color-outline-variant)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                  padding: '8px',
                }}
              >
                {form.signatureDataUrl ? (
                  <img
                    src={form.signatureDataUrl}
                    alt="Doctor Signature Preview"
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--color-outline)' }}>
                    <Icon name="edit" size={32} />
                    <div style={{ fontSize: '12px', marginTop: '6px', fontWeight: 500 }}>
                      No signature uploaded
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label
                  className="btn btn-secondary btn-sm"
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', margin: 0 }}
                >
                  <Icon name="upload" size={14} />
                  <span>{form.signatureDataUrl ? 'Replace Signature' : 'Upload Signature'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    style={{ display: 'none' }}
                    onChange={handleSignatureUpload}
                  />
                </label>

                {form.signatureDataUrl && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ color: 'var(--color-error)', borderColor: 'rgba(186, 26, 26, 0.3)' }}
                    onClick={handleSignatureRemove}
                  >
                    <Icon name="trash" size={14} />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {/* Recommended Dimensions Helper */}
              <div style={{ fontSize: '11.5px', color: 'var(--color-outline)', lineHeight: 1.45 }}>
                Recommended: horizontal signature image (e.g. 300 × 100 px or 3:1 ratio) for best placement. Other dimensions are accepted.
              </div>
            </div>
          </div>
        </div>

        <div className="settings-actions">
          <button type="submit" className="btn btn-primary">
            {saved ? (
              <>
                <Icon name="check" size={16} />
                Saved
              </>
            ) : (
              <>
                <Icon name="save" size={16} />
                Save Practitioner Profile
              </>
            )}
          </button>
        </div>
      </form>
    </section>
  );
}

// ── Organisation / Clinic form ─────────────────────────────────

interface OrgFormData {
  name: string;
  address: string;
  state: string;
  city: string;
  pincode: string;
  phone: string;
  email: string;
  registrationNumber: string;
  licenseNumber: string;
  logoDataUrl?: string;
}

const EMPTY_ORG: OrgFormData = {
  name: '',
  address: '',
  state: '',
  city: '',
  pincode: '',
  phone: '',
  email: '',
  registrationNumber: '',
  licenseNumber: '',
  logoDataUrl: undefined,
};

function OrganisationSection() {
  const { organisation, saveOrganisation, setClinicActive } = useSettingsStore();
  const [enabled, setEnabled] = useState(
    organisation ? organisation.isActive !== false : false
  );
  const [form, setForm] = useState<OrgFormData>(() => {
    if (organisation) {
      return {
        name: organisation.name || '',
        address: organisation.address || '',
        state: organisation.state || '',
        city: organisation.city || '',
        pincode: organisation.pincode || '',
        phone: organisation.phone || '',
        email: organisation.email || '',
        registrationNumber: organisation.registrationNumber || '',
        licenseNumber: organisation.licenseNumber || '',
        logoDataUrl: organisation.logoDataUrl,
      };
    }
    return EMPTY_ORG;
  });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (organisation) {
      setEnabled(organisation.isActive !== false);
      setForm({
        name: organisation.name || '',
        address: organisation.address || '',
        state: organisation.state || '',
        city: organisation.city || '',
        pincode: organisation.pincode || '',
        phone: organisation.phone || '',
        email: organisation.email || '',
        registrationNumber: organisation.registrationNumber || '',
        licenseNumber: organisation.licenseNumber || '',
        logoDataUrl: organisation.logoDataUrl,
      });
    }
  }, [organisation]);

  const update = (field: keyof OrgFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
      alert('Please select a JPG, JPEG, PNG, or WEBP image.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (loadEvt) => {
      const result = loadEvt.target?.result as string;
      if (result) {
        setForm((f) => ({ ...f, logoDataUrl: result }));
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleLogoRemove = () => {
    setForm((f) => ({ ...f, logoDataUrl: undefined }));
  };

  const handleToggle = async () => {
    const nextState = !enabled;
    setEnabled(nextState);
    if (organisation?.id) {
      // Toggle active flag only - NEVER delete the record or clear the form
      await setClinicActive(nextState);
    } else if (nextState && form.name.trim()) {
      await saveOrganisation({ ...form, isActive: true });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await saveOrganisation({ ...form, isActive: true });
    setEnabled(true);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <section className="settings-section card">
      <div className="card-header">
        <div>
          <div className="section-title">Clinic / Practice Identity</div>
          <div className="section-sub">
            Optional. Leave disabled if you practice independently.
            When disabled, all data remains securely preserved and no clinic section appears on documents.
          </div>
        </div>
        {/* Toggle */}
        <button
          type="button"
          className={`org-toggle ${enabled ? 'org-toggle--on' : ''}`}
          onClick={handleToggle}
          aria-pressed={enabled}
          aria-label={enabled ? 'Disable clinic/practice' : 'Enable clinic/practice'}
        >
          <span className="org-toggle-knob" />
        </button>
      </div>

      {enabled && (
        <form onSubmit={handleSave} className="card-body settings-form" noValidate>
          <div className="settings-grid">
            <FormGroup label="Practice / clinic name" htmlFor="org-name">
              <input
                id="org-name"
                className="form-input"
                type="text"
                value={form.name}
                onChange={update('name')}
                placeholder="Oakwood Animal Hospital"
                required
              />
            </FormGroup>

            <FormGroup label="Street address" htmlFor="org-addr" optional>
              <textarea
                id="org-addr"
                className="form-textarea"
                value={form.address}
                onChange={update('address')}
                placeholder="123, Park Road, Indiranagar"
                rows={2}
              />
            </FormGroup>

            <FormGroup label="District / City" htmlFor="org-city" optional>
              <input
                id="org-city"
                className="form-input"
                type="text"
                value={form.city}
                onChange={update('city')}
                placeholder="Bengaluru"
              />
            </FormGroup>

            <FormGroup label="State" htmlFor="org-state" optional>
              <input
                id="org-state"
                className="form-input"
                type="text"
                value={form.state}
                onChange={update('state')}
                placeholder="Karnataka"
              />
            </FormGroup>

            <FormGroup label="PIN Code" htmlFor="org-pin" optional>
              <input
                id="org-pin"
                className="form-input"
                type="text"
                value={form.pincode}
                onChange={update('pincode')}
                placeholder="560038"
              />
            </FormGroup>

            <FormGroup label="Phone" htmlFor="org-phone" optional>
              <input
                id="org-phone"
                className="form-input"
                type="tel"
                value={form.phone}
                onChange={update('phone')}
                placeholder="+91 80 1234 5678"
              />
            </FormGroup>

            <FormGroup label="Email" htmlFor="org-email" optional>
              <input
                id="org-email"
                className="form-input"
                type="email"
                value={form.email}
                onChange={update('email')}
                placeholder="info@oakwoodvet.in"
              />
            </FormGroup>

            <FormGroup
              label="GSTIN / Business registration"
              htmlFor="org-reg"
              optional
              hint="Shown on tax invoices where applicable"
            >
              <input
                id="org-reg"
                className="form-input"
                type="text"
                value={form.registrationNumber}
                onChange={update('registrationNumber')}
                placeholder="29AABCU9603R1ZX"
              />
            </FormGroup>

            <FormGroup
              label="Registration / Licence details"
              htmlFor="org-lic"
              optional
              hint="Clinical establishment or local body licence number"
            >
              <input
                id="org-lic"
                className="form-input"
                type="text"
                value={form.licenseNumber}
                onChange={update('licenseNumber')}
                placeholder="KMC/VET/2023/889"
              />
            </FormGroup>
          </div>

          {/* Clinic Logo Card */}
          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--color-border)' }}>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: '13px', fontWeight: 700, color: 'var(--color-on-surface)', marginBottom: '8px' }}>
              Clinic / Hospital Logo
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-container-lowest)',
                  border: '1px dashed var(--color-outline-variant)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  padding: '4px',
                }}
              >
                {form.logoDataUrl ? (
                  <img
                    src={form.logoDataUrl}
                    alt="Clinic Logo Preview"
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <Icon name="hospital" size={32} />
                )}
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label
                  className="btn btn-secondary btn-sm"
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', margin: 0 }}
                >
                  <Icon name="upload" size={14} />
                  <span>{form.logoDataUrl ? 'Replace Logo' : 'Upload Logo'}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg"
                    style={{ display: 'none' }}
                    onChange={handleLogoUpload}
                  />
                </label>
                {form.logoDataUrl && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ color: 'var(--color-error)', borderColor: 'rgba(186, 26, 26, 0.3)' }}
                    onClick={handleLogoRemove}
                  >
                    <Icon name="trash" size={14} />
                    <span>Remove</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="settings-actions">
            <button type="submit" className="btn btn-primary" disabled={!form.name.trim()}>
              {saved ? (
                <>
                  <Icon name="check" size={16} />
                  Saved
                </>
              ) : (
                <>
                  <Icon name="save" size={16} />
                  Save Clinic Profile
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleToggle}
            >
              <Icon name="close" size={16} />
              Switch to Independent Practice (Turn Off)
            </button>
          </div>
        </form>
      )}

      {!enabled && (
        <div className="card-body">
          <div
            className="empty-state"
            style={{ padding: 'var(--space-lg)', textAlign: 'left', alignItems: 'flex-start' }}
          >
            <p style={{ fontSize: 'var(--text-body-sm)', color: 'var(--color-text-muted)', maxWidth: 540 }}>
              {form.name.trim()
                ? `Clinic / Practice "${form.name}" is currently switched OFF. You are operating as an independent practitioner. All clinic details, address, registration, and logo remain safely preserved. Turn the switch above ON to reactivate clinic identity at any time.`
                : 'No clinic or practice is active. You are operating as an independent practitioner. Prescriptions and invoices will show only your veterinarian identity. Turn on the toggle above to add clinic details.'}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Invoice & Receipt Settings Section ───────────────────────
function InvoiceSettingsSection() {
  const {
    showHsnColumn,
    showSacColumn,
    showSpecialInstructionsForOwner,
    setShowHsnColumn,
    setShowSacColumn,
    setShowSpecialInstructionsForOwner,
  } = useSettingsStore();

  return (
    <section className="settings-section card">
      <div className="card-header">
        <div className="section-title-wrap">
          <div className="section-title flex items-center gap-2">
            <Icon name="invoices" size={18} />
            <span>Invoice &amp; Receipt Configuration</span>
          </div>
          <div className="section-sub">
            Customize print and display columns for invoices and payment receipts.
          </div>
        </div>
      </div>
      <div className="card-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showHsnColumn}
              onChange={(e) => setShowHsnColumn(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }}
            />
            <div>
              <strong style={{ fontSize: '14px', display: 'block', color: 'var(--color-on-surface)' }}>
                Display HSN Code Column on Invoices
              </strong>
              <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
                Show Harmonized System of Nomenclature (HSN) codes for medicinal and drug items.
              </span>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showSacColumn}
              onChange={(e) => setShowSacColumn(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }}
            />
            <div>
              <strong style={{ fontSize: '14px', display: 'block', color: 'var(--color-on-surface)' }}>
                Display SAC Code Column on Invoices
              </strong>
              <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
                Show Services Accounting Code (SAC) for clinical procedures and consultation fees.
              </span>
            </div>
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showSpecialInstructionsForOwner}
              onChange={(e) => setShowSpecialInstructionsForOwner(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary)' }}
            />
            <div>
              <strong style={{ fontSize: '14px', display: 'block', color: 'var(--color-on-surface)' }}>
                Include Special Instructions for Owner on Invoices
              </strong>
              <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
                Print client notes and post-consultation special remarks in the ledger section.
              </span>
            </div>
          </label>
        </div>
      </div>
    </section>
  );
}

// ── Backup & Restore Section ──────────────────────────────────
function BackupRestoreSection() {
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Restore states
  const [restoreModalOpen, setRestoreModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<BackupValidationResult | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreConfirmed, setRestoreConfirmed] = useState(false);
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const lastBackupAt = localStorage.getItem('vetrx_last_backup_at');
  const lastRestoredAt = localStorage.getItem('vetrx_last_restored_at');

  useEffect(() => {
    // Check persistent storage support
    void requestPersistentStorage().then((res) => {
      if (res.supported) {
        setStoragePersisted(res.persisted);
      }
    });
  }, []);

  const handleExport = async () => {
    setIsExporting(true);
    setExportSuccess(null);
    setExportError(null);
    try {
      const { filename, recordCount } = await exportDatabaseBackup();
      setExportSuccess(`Backup downloaded successfully: ${filename} (${recordCount} total records across all 13 tables).`);
      setTimeout(() => setExportSuccess(null), 5000);
    } catch (err) {
      console.error('Failed to export backup:', err);
      setExportError(`Export failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setRestoreModalOpen(true);
    setIsValidating(true);
    setValidationResult(null);
    setRestoreError(null);
    setRestoreConfirmed(false);

    try {
      const text = await file.text();
      const result = validateBackupFile(text);
      setValidationResult(result);
    } catch (readErr) {
      setValidationResult({
        valid: false,
        errors: [`Could not read the selected file: ${readErr instanceof Error ? readErr.message : String(readErr)}`],
        warnings: [],
        summary: {},
      });
    } finally {
      setIsValidating(false);
      // Reset input value so the same file can be re-selected if needed
      e.target.value = '';
    }
  };

  const handleExecuteRestore = async () => {
    if (!validationResult?.payload || !validationResult.valid || !restoreConfirmed) return;

    setIsRestoring(true);
    setRestoreError(null);

    try {
      const res = await restoreDatabaseBackup(validationResult.payload, 'replace');
      if (res.success) {
        // App needs to reload to refresh all active stores, Dexie subscribers, and pages
        alert('Database restored successfully! The application will now reload to refresh all views.');
        window.location.reload();
      } else {
        setRestoreError(res.message);
      }
    } catch (err) {
      console.error('Restore error:', err);
      setRestoreError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsRestoring(false);
    }
  };

  const handleCloseRestoreModal = () => {
    if (isRestoring) return;
    setRestoreModalOpen(false);
    setSelectedFile(null);
    setValidationResult(null);
    setRestoreConfirmed(false);
    setRestoreError(null);
  };

  return (
    <section className="settings-section card" style={{ marginTop: '24px' }}>
      <div className="card-header" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="section-title-wrap">
          <div className="section-title flex items-center gap-2">
            <Icon name="database" size={18} />
            <span>Data Management (Backup &amp; Restore)</span>
          </div>
          <div className="section-sub">
            Protect your clinical and billing data. Export complete offline snapshots or restore previous backups.
          </div>
        </div>
      </div>
      <div className="card-body">
        <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', marginBottom: '16px', lineHeight: 1.5 }}>
          VetRx stores all clinical records, patients, prescriptions, medicines, and invoices locally in your browser&apos;s IndexedDB storage.
          To prevent data loss from browser cache resets or hardware changes, download regular backups.
        </p>

        {/* Persistence Status pill if available */}
        {storagePersisted !== null && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: 'var(--radius-full)',
              background: storagePersisted ? 'rgba(0, 104, 95, 0.08)' : 'rgba(234, 179, 8, 0.1)',
              color: storagePersisted ? 'var(--color-primary)' : 'var(--color-on-surface)',
              fontSize: '12px',
              fontWeight: 500,
              marginBottom: '16px',
            }}
          >
            <Icon name={storagePersisted ? 'verified' : 'info'} size={14} />
            <span>
              {storagePersisted
                ? 'Browser Storage Status: Persistent (protected from automatic browser eviction)'
                : 'Browser Storage Status: Standard (regular backup export strongly recommended)'}
            </span>
          </div>
        )}

        {/* Timestamps */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', fontSize: '12px', color: 'var(--color-on-surface-variant)', marginBottom: '20px' }}>
          <div>
            <strong>Last Backup Export:</strong>{' '}
            {lastBackupAt ? new Date(lastBackupAt).toLocaleString() : 'Never in this browser session'}
          </div>
          {lastRestoredAt && (
            <div>
              <strong>Last Restored:</strong> {new Date(lastRestoredAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* Action alerts */}
        {exportSuccess && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 104, 95, 0.1)',
              color: 'var(--color-primary)',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '16px',
            }}
          >
            {exportSuccess}
          </div>
        )}

        {exportError && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(186, 26, 26, 0.1)',
              color: 'var(--color-error)',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '16px',
            }}
          >
            {exportError}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExport}
            disabled={isExporting}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Icon name="upload" size={16} />
            <span>{isExporting ? 'Exporting Snapshot…' : 'Download Full Backup (.json)'}</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: 'none' }}
            onChange={handleFileSelect}
          />

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => fileInputRef.current?.click()}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Icon name="save" size={16} />
            <span>Restore from Backup</span>
          </button>
        </div>
      </div>

      {/* Restore Verification & Confirmation Modal */}
      {restoreModalOpen && (
        <div className="master-data-modal-backdrop" onClick={handleCloseRestoreModal}>
          <div
            className="master-data-modal"
            style={{ maxWidth: '580px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="master-data-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Icon name="database" size={20} />
                <h3>Restore Database from Backup</h3>
              </div>
              <button
                type="button"
                className="master-data-modal-close"
                onClick={handleCloseRestoreModal}
                disabled={isRestoring}
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="master-data-modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* File details */}
              <div style={{ padding: '10px 12px', background: 'var(--color-surface-container-low)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}>
                <div><strong>Selected File:</strong> {selectedFile?.name}</div>
                {selectedFile && <div><strong>File Size:</strong> {(selectedFile.size / 1024).toFixed(1)} KB</div>}
              </div>

              {/* Validation Progress */}
              {isValidating && (
                <div style={{ textAlign: 'center', padding: '16px' }}>
                  <div className="spinner" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                    Verifying backup integrity and compatibility…
                  </div>
                </div>
              )}

              {/* Validation Result */}
              {!isValidating && validationResult && (
                <>
                  {!validationResult.valid ? (
                    <div
                      style={{
                        padding: '12px',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(186, 26, 26, 0.08)',
                        border: '1px solid rgba(186, 26, 26, 0.25)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-error)', fontWeight: 700, fontSize: '13px', marginBottom: '8px' }}>
                        <Icon name="alert-triangle" size={16} />
                        <span>Backup Validation Failed</span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--color-error)', marginBottom: '8px' }}>
                        This file cannot be restored because it failed strict integrity checks:
                      </p>
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--color-error)' }}>
                        {validationResult.errors.map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <>
                      {/* Success summary */}
                      <div
                        style={{
                          padding: '12px',
                          borderRadius: 'var(--radius-md)',
                          background: 'rgba(0, 104, 95, 0.08)',
                          border: '1px solid rgba(0, 104, 95, 0.25)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-primary)', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                          <Icon name="check-circle" size={16} />
                          <span>Backup File Verified (Format v{validationResult.payload?.backupFormatVersion}, Schema v{validationResult.payload?.schemaVersion})</span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                          Exported at: {validationResult.payload?.exportedAt ? new Date(validationResult.payload.exportedAt).toLocaleString() : 'Unknown'}
                        </div>
                      </div>

                      {/* Warnings if any */}
                      {validationResult.warnings.length > 0 && (
                        <div
                          style={{
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(234, 179, 8, 0.08)',
                            border: '1px solid rgba(234, 179, 8, 0.3)',
                            fontSize: '12px',
                          }}
                        >
                          <strong style={{ display: 'block', color: 'var(--color-on-surface)', marginBottom: '4px' }}>
                            Warnings:
                          </strong>
                          <ul style={{ margin: 0, paddingLeft: '16px' }}>
                            {validationResult.warnings.map((w, idx) => (
                              <li key={idx}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Record counts table */}
                      <div>
                        <strong style={{ fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                          Records to be Restored ({Object.values(validationResult.summary).reduce((a, b) => a + b, 0)} total):
                        </strong>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
                            gap: '6px',
                            fontSize: '12px',
                            background: 'var(--color-surface-container-low)',
                            padding: '10px',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--color-border)',
                          }}
                        >
                          {Object.entries(validationResult.summary).map(([tbl, count]) => (
                            <div key={tbl} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 4px' }}>
                              <span style={{ color: 'var(--color-on-surface-variant)' }}>{tbl}:</span>
                              <strong>{count}</strong>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Explicit Danger & Safety Warning */}
                      <div
                        style={{
                          padding: '12px',
                          borderRadius: 'var(--radius-md)',
                          background: 'rgba(186, 26, 26, 0.05)',
                          border: '1px solid rgba(186, 26, 26, 0.25)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--color-error)', fontWeight: 700, fontSize: '13px', marginBottom: '6px' }}>
                          <Icon name="warning" size={16} />
                          <span>Important: Replace Mode Warning</span>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--color-on-surface)', margin: '0 0 8px 0', lineHeight: 1.4 }}>
                          Restoring will <strong>replace all existing records</strong> in the current database with the contents of this backup file.
                          An automated safety backup of your current database will be saved in browser memory before replacement begins.
                        </p>
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: 'var(--color-error)' }}>
                          <input
                            type="checkbox"
                            checked={restoreConfirmed}
                            onChange={(e) => setRestoreConfirmed(e.target.checked)}
                            style={{ width: '16px', height: '16px', marginTop: '2px', accentColor: 'var(--color-error)' }}
                          />
                          <span>
                            I understand that current local records will be replaced with this backup and wish to proceed.
                          </span>
                        </label>
                      </div>

                      {/* Restore error message */}
                      {restoreError && (
                        <div
                          style={{
                            padding: '10px 12px',
                            borderRadius: 'var(--radius-md)',
                            background: 'rgba(186, 26, 26, 0.1)',
                            color: 'var(--color-error)',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          {restoreError}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>

            <div className="master-data-modal-footer">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleCloseRestoreModal}
                disabled={isRestoring}
              >
                Cancel
              </button>

              {validationResult?.valid && (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleExecuteRestore}
                  disabled={!restoreConfirmed || isRestoring}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Icon name="sync" size={14} />
                  <span>{isRestoring ? 'Restoring Database…' : 'Confirm & Restore Database'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ── Developer Data Reset Section ─────────────────────────────
function DeveloperDataResetSection() {
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleReset = async () => {
    const confirmed = window.confirm(
      'This will clear local patient, prescription, and invoice consultation records. Formulary medicines and master settings will remain intact. This action cannot be undone. Do you want to proceed?'
    );
    if (!confirmed) return;

    setIsResetting(true);
    try {
      await db.transaction('rw', [db.patients, db.owners, db.prescriptions, db.prescriptionItems, db.invoices, db.invoiceItems], async () => {
        await db.prescriptionItems.clear();
        await db.prescriptions.clear();
        await db.invoiceItems.clear();
        await db.invoices.clear();
        await db.patients.clear();
        await db.owners.clear();
      });
      localStorage.removeItem('vetrx_demo_mode');
      setResetMessage('Clinical patient and consultation records cleared successfully.');
      setTimeout(() => setResetMessage(null), 4000);
    } catch (err) {
      console.error('Failed to reset records:', err);
      alert('Failed to reset records.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <section className="settings-section card" style={{ marginTop: '24px', borderColor: 'rgba(186, 26, 26, 0.2)' }}>
      <div className="card-header" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <div className="section-title-wrap">
          <div className="section-title flex items-center gap-2" style={{ color: 'var(--color-error)' }}>
            <Icon name="trash" size={18} />
            <span>Developer Reset / Clean Database</span>
          </div>
          <div className="section-sub">
            Clear locally saved test patients, prescriptions, and invoices to test fresh, clean clinical workflows without fictional data.
          </div>
        </div>
      </div>
      <div className="card-body">
        <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', marginBottom: '16px', lineHeight: 1.5 }}>
          This will wipe all local test patients, owners, prescriptions, and invoices while keeping your practitioner settings, clinic details, and master medicine formulary intact.
        </p>

        {resetMessage && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(0, 104, 95, 0.1)',
              color: 'var(--color-primary)',
              fontSize: '13px',
              fontWeight: 600,
              marginBottom: '16px',
            }}
          >
            {resetMessage}
          </div>
        )}

        <button
          type="button"
          className="btn btn-secondary"
          onClick={handleReset}
          disabled={isResetting}
          style={{
            borderColor: 'rgba(186, 26, 26, 0.4)',
            color: 'var(--color-error)',
            fontWeight: 600,
          }}
        >
          <Icon name="trash" size={16} />
          <span>{isResetting ? 'Resetting Records…' : 'Reset to Clean State'}</span>
        </button>
      </div>
    </section>
  );
}

// ── Account & Security Management Section ───────────────────────
function AccountSecuritySection() {
  const { user, practice, membership, logout } = useAuth();
  const { practitioner } = useSettingsStore();

  const [identities, setIdentities] = useState<{
    email: string;
    hasPassword: boolean;
    hasGoogle: boolean;
    identities: Array<{ provider: string; createdAt: string }>;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('error');
  });
  const [success, setSuccess] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('google_connected') === 'true'
      ? 'Google account connected successfully.'
      : null;
  });

  // Password Modal / Form State
  const [showPasswordModal, setShowPasswordModal] = useState<'set' | 'change' | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const fetchIdentities = async () => {
    try {
      setIsLoading(true);
      const res = await fetch(`${API_BASE}/api/auth/identities`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setIdentities(data);
      }
    } catch (err) {
      console.error('Failed to load identities:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchIdentities();
  }, []);

  const handleConnectGoogle = () => {
    window.location.href = `${API_BASE}/api/auth/google/start?action=link&returnTo=/settings?tab=account`;
  };

  const handleDisconnectGoogle = async () => {
    if (!identities?.hasPassword) {
      alert('You must set an account password before disconnecting Google to prevent losing access to your account.');
      return;
    }

    if (!window.confirm('Are you sure you want to disconnect Google authentication from this account?')) {
      return;
    }

    try {
      setError(null);
      const res = await fetch(`${API_BASE}/api/auth/identities/google`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Failed to disconnect Google.');
      }
      setSuccess('Google account disconnected successfully.');
      void fetchIdentities();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Google.');
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setSubmittingPassword(true);
    try {
      const endpoint = showPasswordModal === 'set' ? '/api/auth/password/set' : '/api/auth/password/change';
      const body = showPasswordModal === 'set'
        ? { newPassword }
        : { currentPassword, newPassword };

      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || 'Password update failed.');
      }

      setSuccess(showPasswordModal === 'set' ? 'Password created successfully.' : 'Password updated successfully.');
      setShowPasswordModal(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      void fetchIdentities();
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Password update failed.');
    } finally {
      setSubmittingPassword(false);
    }
  };

  return (
    <div className="settings-sections">
      {/* Notifications */}
      {error && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(186, 26, 26, 0.1)',
          border: '1px solid rgba(186, 26, 26, 0.3)',
          color: 'var(--color-error)',
          fontSize: '13px',
          fontWeight: 500,
        }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          background: 'rgba(0, 104, 95, 0.1)',
          border: '1px solid rgba(0, 104, 95, 0.3)',
          color: 'var(--color-primary)',
          fontSize: '13px',
          fontWeight: 600,
        }}>
          {success}
        </div>
      )}

      {/* ── 1. ACCOUNT DETAILS ── */}
      <section className="settings-section card">
        <div className="card-header">
          <div>
            <div className="section-title">Account Profile</div>
            <div className="section-sub">Authenticated practitioner identity</div>
          </div>
        </div>
        <div className="card-body">
          <div className="settings-grid">
            <div className="form-group">
              <label className="form-label">Practitioner Name</label>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-on-surface)' }}>
                {user?.name || practitioner?.name || 'Veterinary Practitioner'}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-on-surface)' }}>
                {user?.email || 'doctor@example.com'}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Mobile Number</label>
              <div style={{ fontSize: '14px', color: 'var(--color-on-surface-variant)' }}>
                {practitioner?.phone || 'Not configured'}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Account Status</label>
              <div>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: 'rgba(0, 104, 95, 0.12)',
                  color: 'var(--color-primary)',
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--color-primary)' }} />
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. AUTHENTICATION METHODS ── */}
      <section className="settings-section card">
        <div className="card-header">
          <div>
            <div className="section-title">Authentication Methods</div>
            <div className="section-sub">Connected login options for this VetRx account</div>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Email & Password */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-container)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary)',
                }}>
                  <Icon name="lock" size={20} />
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-on-surface)' }}>
                    Email & Password
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                    {isLoading ? 'Checking status…' : identities?.hasPassword ? '✓ Configured' : '○ Password not configured'}
                  </div>
                </div>
              </div>
              <div>
                {identities?.hasPassword ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setPasswordError(null);
                      setShowPasswordModal('change');
                    }}
                  >
                    Change Password
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setPasswordError(null);
                      setShowPasswordModal('set');
                    }}
                  >
                    Set Password
                  </button>
                )}
              </div>
            </div>

            {/* Google Authentication */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)',
              flexWrap: 'wrap',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--color-surface-container)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg style={{ width: '20px', height: '20px' }} viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-on-surface)' }}>
                    Google
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                    {isLoading ? 'Checking status…' : identities?.hasGoogle ? '✓ Connected to Google' : '○ Not connected'}
                  </div>
                </div>
              </div>
              <div>
                {identities?.hasGoogle ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleDisconnectGoogle}
                    style={{ color: 'var(--color-error)' }}
                  >
                    Disconnect Google
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleConnectGoogle}
                  >
                    Connect Google
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. PRACTICE TENANT DETAILS ── */}
      <section className="settings-section card">
        <div className="card-header">
          <div>
            <div className="section-title">Practice Information</div>
            <div className="section-sub">Commercial practice tenancy and membership</div>
          </div>
        </div>
        <div className="card-body">
          <div className="settings-grid">
            <div className="form-group">
              <label className="form-label">Practice Name</label>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-on-surface)' }}>
                {practice?.name || 'Primary Practice'}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Membership Role</label>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-on-surface)' }}>
                {membership?.role || 'PRACTICE_OWNER'}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Practice Tenant ID</label>
              <div style={{ fontSize: '13px', fontFamily: 'monospace', color: 'var(--color-on-surface-variant)' }}>
                {practice?.id || '—'}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. SESSION MANAGEMENT ── */}
      <section className="settings-section card">
        <div className="card-header">
          <div>
            <div className="section-title">Session Management</div>
            <div className="section-sub">Current login session controls</div>
          </div>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--color-on-surface)' }}>
                Current Active Session
              </div>
              <div style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)' }}>
                Protected with HttpOnly, SameSite, cryptographic session verification
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => logout()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Icon name="logout" size={14} />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </section>

      {/* Modal: Set or Change Password */}
      {showPasswordModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="password-modal-title"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 1000,
          }}
        >
          <div className="card" style={{ maxWidth: '440px', width: '100%', padding: '24px' }}>
            <h2 id="password-modal-title" style={{ fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>
              {showPasswordModal === 'set' ? 'Set Account Password' : 'Change Account Password'}
            </h2>
            <p style={{ fontSize: '13px', color: 'var(--color-on-surface-variant)', marginBottom: '16px' }}>
              {showPasswordModal === 'set'
                ? 'Create a password so you can sign in with your email directly.'
                : 'Enter your current password and a new secure password.'}
            </p>

            {passwordError && (
              <div style={{
                padding: '10px 12px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(186, 26, 26, 0.1)',
                color: 'var(--color-error)',
                fontSize: '13px',
                marginBottom: '14px',
              }}>
                {passwordError}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit}>
              {showPasswordModal === 'change' && (
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label" htmlFor="current-pw">Current Password</label>
                  <input
                    id="current-pw"
                    type="password"
                    required
                    className="auth-input"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                  />
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label" htmlFor="new-pw">New Password (min. 8 characters)</label>
                <input
                  id="new-pw"
                  type="password"
                  required
                  className="auth-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label" htmlFor="confirm-pw">Confirm New Password</label>
                <input
                  id="confirm-pw"
                  type="password"
                  required
                  className="auth-input"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={submittingPassword}
                  onClick={() => setShowPasswordModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingPassword}
                >
                  {submittingPassword ? 'Saving…' : showPasswordModal === 'set' ? 'Set Password' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main SettingsPage Component ────────────────────────────────

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'account' | 'profile' | 'master-data'>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'account') return 'account';
    if (tab === 'master-data') return 'master-data';
    return 'profile';
  });

  const handleTabChange = (tab: 'account' | 'profile' | 'master-data') => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === 'profile') {
      url.searchParams.delete('tab');
    } else {
      url.searchParams.set('tab', tab);
    }
    window.history.replaceState({}, '', url.toString());
  };

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1>Settings</h1>
            <p className="section-sub">
              {activeTab === 'account'
                ? 'Manage your practitioner account, authentication methods, and security.'
                : activeTab === 'profile'
                ? 'Manage your practitioner profile and optional clinic identity.'
                : 'Configure standard clinical options, formulary units, routes, and invoice items.'}
            </p>
          </div>

          <div className="settings-tab-switcher" role="tablist" aria-label="Settings Tabs">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'account'}
              className={`settings-tab-btn ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => handleTabChange('account')}
              id="tab-account"
            >
              <Icon name="lock" size={16} />
              <span>Account & Security</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'profile'}
              className={`settings-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => handleTabChange('profile')}
              id="tab-profile"
            >
              <Icon name="user" size={16} />
              <span>Practitioner & Clinic</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'master-data'}
              className={`settings-tab-btn ${activeTab === 'master-data' ? 'active' : ''}`}
              onClick={() => handleTabChange('master-data')}
              id="tab-master-data"
            >
              <Icon name="database" size={16} />
              <span>Master Data</span>
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'account' ? (
        <AccountSecuritySection />
      ) : activeTab === 'profile' ? (
        <div className="settings-sections">
          <PractitionerSection />
          <OrganisationSection />
          <InvoiceSettingsSection />
          <BackupRestoreSection />
          <DeveloperDataResetSection />
        </div>
      ) : (
        <MasterDataSection />
      )}
    </div>
  );
};

