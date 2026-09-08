// =============================================================
// VetRx — Settings page
// Practitioner profile + optional Clinic/Practice identity.
// Clinic section omitted entirely if left blank.
// =============================================================

import React, { useEffect, useState } from 'react';
import { useSettingsStore } from '../store/settingsStore';
import { Icon } from '../components/ui/Icon';
import './SettingsPage.css';

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
              placeholder="Dr. Sarah Jenkins"
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

// ── Main export ────────────────────────────────────────────────

import { MasterDataSection } from './MasterDataSection';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profile' | 'master-data'>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') === 'master-data' ? 'master-data' : 'profile';
  });

  const handleTabChange = (tab: 'profile' | 'master-data') => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    if (tab === 'master-data') {
      url.searchParams.set('tab', 'master-data');
    } else {
      url.searchParams.delete('tab');
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
              {activeTab === 'profile'
                ? 'Manage your practitioner profile and optional clinic identity.'
                : 'Configure standard clinical options, formulary units, routes, and invoice items.'}
            </p>
          </div>

          <div className="settings-tab-switcher" role="tablist" aria-label="Settings Tabs">
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

      {activeTab === 'profile' ? (
        <div className="settings-sections">
          <PractitionerSection />
          <OrganisationSection />
        </div>
      ) : (
        <MasterDataSection />
      )}
    </div>
  );
};
