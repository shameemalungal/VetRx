// =============================================================
// VetRx — Patient Form Page (New / Edit)
// Fast clinical workflow for adding and editing patients.
// Supports existing owner reuse and new owner registration without duplicates.
// =============================================================

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { Icon } from '../../components/ui/Icon';
import type { Species, Sex } from '../../types';
import './Patients.css';

const SPECIES_OPTIONS: Species[] = ['Canine', 'Feline', 'Avian', 'Bovine', 'Equine', 'Other'];
const SEX_OPTIONS: Sex[] = ['Male', 'Female', 'Male (Intact)', 'Female (Intact)', 'Unknown'];

interface PatientFormProps {
  mode: 'new' | 'edit';
}

export const PatientFormPage: React.FC<PatientFormProps> = ({ mode }) => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const patientId = id ? Number(id) : undefined;
  const preselectedOwnerId = searchParams.get('ownerId')
    ? Number(searchParams.get('ownerId'))
    : undefined;

  // ── Master Data Queries ───────────────────────────────────────
  const masterSpecies = useLiveQuery(
    () => db.masterDataItems.where('category').equals('species').sortBy('sortOrder'),
    []
  );
  const masterSex = useLiveQuery(
    () => db.masterDataItems.where('category').equals('sex').sortBy('sortOrder'),
    []
  );

  // ── Existing Owners list for reuse ────────────────────────────
  const existingOwners = useLiveQuery(() => db.owners.toArray(), []);

  // ── Form State ────────────────────────────────────────────────
  // Patient fields
  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Species>('Canine');
  const [breed, setBreed] = useState('');
  const [sex, setSex] = useState<Sex>('Male');
  const [weightKg, setWeightKg] = useState<string>('');
  const [ageNote, setAgeNote] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [microchipNumber, setMicrochipNumber] = useState('');
  const [identificationRef, setIdentificationRef] = useState('');
  const [notes, setNotes] = useState('');

  // Active master data species + current patient's species if it happens to be inactive
  const availableSpeciesOptions = useMemo(() => {
    if (!masterSpecies || masterSpecies.length === 0) {
      return SPECIES_OPTIONS.map((sp) => ({ value: sp, label: sp === 'Other' ? 'Others' : sp }));
    }
    const options = masterSpecies
      .filter((item) => item.isActive || item.name === species)
      .map((item) => ({
        value: item.name,
        label: item.name === 'Other' ? 'Others' : item.name,
      }));
    if (species && !options.some((o) => o.value === species)) {
      options.push({ value: species, label: species === 'Other' ? 'Others' : species });
    }
    return options;
  }, [masterSpecies, species]);

  // Active master data sex + current patient's sex if it happens to be inactive
  const availableSexOptions = useMemo(() => {
    if (!masterSex || masterSex.length === 0) {
      return SEX_OPTIONS.map((s) => ({ value: s, label: s }));
    }
    const options = masterSex
      .filter((item) => item.isActive || item.name === sex)
      .map((item) => ({
        value: item.name,
        label: item.name,
      }));
    if (sex && !options.some((o) => o.value === sex)) {
      options.push({ value: sex, label: sex });
    }
    return options;
  }, [masterSex, sex]);

  // Owner association
  const [ownerMode, setOwnerMode] = useState<'existing' | 'new'>('existing');
  const [selectedOwnerId, setSelectedOwnerId] = useState<number | ''>('');
  const [ownerSearchQuery, setOwnerSearchQuery] = useState('');
  const [newOwnerName, setNewOwnerName] = useState('');
  const [newOwnerPhone, setNewOwnerPhone] = useState('');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [newOwnerAddress, setNewOwnerAddress] = useState('');

  // Filtered existing owners by name or phone
  const filteredExistingOwners = useMemo(() => {
    if (!existingOwners) return [];
    const q = ownerSearchQuery.trim().toLowerCase();
    if (!q) return existingOwners;
    return existingOwners.filter((o) =>
      o.name.toLowerCase().includes(q) ||
      (o.phone && o.phone.toLowerCase().includes(q)) ||
      (o.address && o.address.toLowerCase().includes(q))
    );
  }, [existingOwners, ownerSearchQuery]);

  // Status & Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  // ── Populate initial data for Edit or Preselected Owner ────────
  useEffect(() => {
    if (preselectedOwnerId) {
      setSelectedOwnerId(preselectedOwnerId);
      setOwnerMode('existing');
    }
  }, [preselectedOwnerId]);

  useEffect(() => {
    if (mode === 'edit' && patientId) {
      void (async () => {
        const p = await db.patients.get(patientId);
        if (p) {
          setName(p.name);
          setSpecies(p.species);
          setBreed(p.breed || '');
          setSex(p.sex || 'Unknown');
          setWeightKg(p.weightKg !== undefined && p.weightKg !== null ? String(p.weightKg) : '');
          setAgeNote(p.ageNote || '');
          setDateOfBirth(p.dateOfBirth ? new Date(p.dateOfBirth).toISOString().split('T')[0] : '');
          setMicrochipNumber(p.microchipNumber || '');
          setIdentificationRef(p.identificationRef || '');
          setNotes(p.notes || '');
          setSelectedOwnerId(p.ownerId);
          setOwnerMode('existing');
        }
      })();
    }
  }, [mode, patientId]);

  // Set default selected owner if none selected yet
  useEffect(() => {
    if (mode === 'new' && !selectedOwnerId && existingOwners && existingOwners.length > 0 && !preselectedOwnerId) {
      setSelectedOwnerId(existingOwners[0].id!);
    }
  }, [mode, selectedOwnerId, existingOwners, preselectedOwnerId]);

  // Normalize phone number helper for duplicate prevention
  const normalizePhoneNumber = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits;
  };

  // Live duplicate client check based on normalized mobile number
  const matchingExistingOwner = useMemo(() => {
    if (ownerMode !== 'new' || !newOwnerPhone.trim() || !existingOwners) return null;
    const normalizedInput = normalizePhoneNumber(newOwnerPhone);
    if (normalizedInput.length < 7) return null; // Avoid matching empty / very short inputs
    return (
      existingOwners.find((o) => {
        if (!o.phone) return false;
        return normalizePhoneNumber(o.phone) === normalizedInput;
      }) || null
    );
  }, [ownerMode, newOwnerPhone, existingOwners]);

  const validate = (): boolean => {
    const err: Record<string, string> = {};
    if (!name.trim()) err.name = 'Patient name is required.';
    if (!species) err.species = 'Species is required.';

    if (ownerMode === 'existing') {
      if (!selectedOwnerId) {
        err.owner = 'Please select an existing owner or create a new one.';
      }
    } else {
      if (!newOwnerName.trim()) err.newOwnerName = 'Owner name is required.';
      if (!newOwnerPhone.trim()) {
        err.newOwnerPhone = 'Owner contact phone is required.';
      } else if (matchingExistingOwner) {
        err.newOwnerPhone =
          'This mobile number is already registered to an existing farmer/client. Please select the existing client instead.';
      }
    }

    setErrors(err);
    return Object.keys(err).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    const now = new Date();

    try {
      let finalOwnerId: number;

      // 1. Resolve Owner ID
      if (ownerMode === 'new') {
        finalOwnerId = await db.owners.add({
          name: newOwnerName.trim(),
          phone: newOwnerPhone.trim(),
          email: newOwnerEmail.trim() || undefined,
          address: newOwnerAddress.trim() || undefined,
          createdAt: now,
          updatedAt: now,
        }) as number;
      } else {
        finalOwnerId = Number(selectedOwnerId);
      }

      // Parse optional fields
      const parsedWeight = weightKg.trim() ? parseFloat(weightKg) : undefined;
      const parsedDob = dateOfBirth.trim() ? new Date(dateOfBirth) : undefined;

      // 2. Create or Update Patient
      if (mode === 'new') {
        const newPatientId = await db.patients.add({
          ownerId: finalOwnerId,
          name: name.trim(),
          species,
          breed: breed.trim() || undefined,
          sex,
          weightKg: parsedWeight,
          ageNote: ageNote.trim() || undefined,
          dateOfBirth: parsedDob,
          microchipNumber: microchipNumber.trim() || undefined,
          identificationRef: identificationRef.trim() || undefined,
          notes: notes.trim() || undefined,
          createdAt: now,
          updatedAt: now,
        }) as number;

        const fromParam = searchParams.get('from');
        if (fromParam === 'rx') {
          navigate(`/prescriptions/new?patientId=${newPatientId}`);
        } else {
          navigate(`/patients/${newPatientId}`);
        }
      } else if (mode === 'edit' && patientId) {
        const existing = await db.patients.get(patientId);
        if (existing) {
          await db.patients.update(patientId, {
            ownerId: finalOwnerId,
            name: name.trim(),
            species,
            breed: breed.trim() || undefined,
            sex,
            weightKg: parsedWeight,
            ageNote: ageNote.trim() || undefined,
            dateOfBirth: parsedDob,
            microchipNumber: microchipNumber.trim() || undefined,
            identificationRef: identificationRef.trim() || undefined,
            notes: notes.trim() || undefined,
            updatedAt: now,
          });
        }
        navigate(`/patients/${patientId}`);
      }
    } catch (err) {
      console.error('Error saving patient:', err);
      setErrors({ submit: 'Failed to save patient. Please check input values.' });
    } finally {
      setSaving(false);
    }
  };

  const selectedOwnerRecord = existingOwners?.find((o) => o.id === selectedOwnerId);

  return (
    <div className="patients-page">
      {/* ── Breadcrumb ─────────────────────────────────────────── */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-space-xs text-sm">
        <Link to="/patients" className="text-primary hover:underline font-medium flex items-center gap-1">
          <Icon name="chevron-left" size={14} />
          <span>Patients</span>
        </Link>
        <span className="text-outline-variant">/</span>
        <span className="text-on-surface font-semibold">
          {mode === 'new' ? 'New Patient' : `Edit ${name || 'Patient'}`}
        </span>
      </nav>

      <div className="patient-form-container">
        <div className="flex items-center justify-between">
          <div className="patients-title-group">
            <h1 className="patients-title">
              {mode === 'new' ? 'Register New Patient' : 'Edit Patient Profile'}
            </h1>
            <span className="patients-subtitle">
              {mode === 'new'
                ? 'Register an animal and associate with an existing client or new owner'
                : 'Update animal signalment, weight, or owner registration details'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          {/* ── SECTION 1: OWNER / CLIENT ASSOCIATION ──────────── */}
          <div className="form-card mb-space-lg">
            <div className="form-card-title flex items-center gap-2">
              <Icon name="user" size={18} className="text-primary" />
              <span>Owner / Client Information</span>
            </div>
            <div className="form-card-sub">
              Specify the client responsible for this animal. Existing clients can be easily reused.
            </div>

            {/* Owner Mode Selector */}
            <div className="owner-select-tabs">
              <button
                type="button"
                className={`owner-select-tab ${ownerMode === 'existing' ? 'active' : ''}`}
                onClick={() => setOwnerMode('existing')}
              >
                <Icon name="search" size={16} />
                <span>Select Existing Client</span>
              </button>
              <button
                type="button"
                className={`owner-select-tab ${ownerMode === 'new' ? 'active' : ''}`}
                onClick={() => setOwnerMode('new')}
              >
                <Icon name="user-plus" size={16} />
                <span>Create New Client</span>
              </button>
            </div>

            {ownerMode === 'existing' ? (
              <div className="form-group">
                <label className="form-label" htmlFor="existing-owner-search">
                  Select Existing Owner <span className="text-error">*</span>
                </label>

                {/* Instant search input for existing owner */}
                <div style={{ position: 'relative', marginBottom: '8px' }}>
                  <Icon
                    name="search"
                    size={16}
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--color-outline)',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    id="existing-owner-search"
                    type="text"
                    className="form-input"
                    style={{ paddingLeft: '36px', paddingRight: ownerSearchQuery ? '36px' : '12px' }}
                    placeholder="Search client by name or mobile number..."
                    value={ownerSearchQuery}
                    onChange={(e) => setOwnerSearchQuery(e.target.value)}
                    autoComplete="off"
                  />
                  {ownerSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setOwnerSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        color: 'var(--color-outline)',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      title="Clear search"
                    >
                      <Icon name="x-mark" size={14} />
                    </button>
                  )}
                </div>

                {/* Filtered owners list */}
                <div
                  style={{
                    maxHeight: '180px',
                    overflowY: 'auto',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--color-surface-container-lowest)',
                    marginBottom: '8px',
                  }}
                >
                  {filteredExistingOwners.length === 0 ? (
                    <div style={{ padding: '14px', textAlign: 'center', color: 'var(--color-outline)', fontSize: '12px' }}>
                      {ownerSearchQuery.trim()
                        ? `No registered clients found matching "${ownerSearchQuery}"`
                        : 'No registered clients available'}
                    </div>
                  ) : (
                    filteredExistingOwners.map((o) => {
                      const isSelected = selectedOwnerId === o.id;
                      return (
                        <div
                          key={o.id}
                          onClick={() => {
                            setSelectedOwnerId(o.id || '');
                            if (errors.owner) setErrors(({ owner: _, ...rest }) => rest);
                          }}
                          style={{
                            padding: '8px 12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            background: isSelected
                              ? 'var(--color-surface-container-high, #e2e7ff)'
                              : 'transparent',
                            borderBottom: '1px solid var(--color-surface-container-low)',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                            <div
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                background: isSelected ? 'var(--color-primary)' : 'var(--color-surface-container)',
                                color: isSelected ? '#ffffff' : 'var(--color-on-surface)',
                                fontSize: '11px',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {o.name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-on-surface)' }}>
                                {o.name}
                              </div>
                              <div style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
                                {o.phone} {o.address ? `• ${o.address}` : ''}
                              </div>
                            </div>
                          </div>
                          {isSelected ? (
                            <span className="badge badge-primary" style={{ fontSize: '10px' }}>Selected</span>
                          ) : (
                            <span style={{ fontSize: '11px', color: 'var(--color-primary)', fontWeight: 600 }}>Select</span>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <select
                  id="existing-owner-select"
                  className="form-select"
                  value={selectedOwnerId}
                  onChange={(e) => {
                    setSelectedOwnerId(Number(e.target.value) || '');
                    if (errors.owner) setErrors(({ owner: _, ...rest }) => rest);
                  }}
                  style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)' }}
                >
                  <option value="">-- Choose from full client dropdown ({existingOwners?.length || 0}) --</option>
                  {existingOwners?.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.phone}) {o.address ? `• ${o.address}` : ''}
                    </option>
                  ))}
                </select>
                {errors.owner && <span className="form-error">{errors.owner}</span>}

                {/* Selected Owner Preview */}
                {selectedOwnerRecord && (
                  <div className="owner-preview-banner mt-space-sm">
                    <div className="flex items-center gap-space-sm min-w-0">
                      <div className="w-9 h-9 rounded-full bg-secondary-fixed text-on-secondary-fixed font-bold flex items-center justify-center shrink-0">
                        {selectedOwnerRecord.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <strong className="text-on-surface truncate">{selectedOwnerRecord.name}</strong>
                        <span className="text-xs text-outline truncate">
                          {selectedOwnerRecord.phone} {selectedOwnerRecord.email ? `• ${selectedOwnerRecord.email}` : ''}
                        </span>
                      </div>
                    </div>
                    <span className="badge badge-primary shrink-0">Selected Client</span>
                  </div>
                )}
              </div>
            ) : (
              /* New Owner Inline Registration */
              <div className="flex flex-col gap-space-md">
                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="new-owner-name">
                      Client Full Name <span className="text-error">*</span>
                    </label>
                    <input
                      id="new-owner-name"
                      type="text"
                      className="form-input"
                      placeholder="e.g. Ahmed Kumar"
                      value={newOwnerName}
                      onChange={(e) => setNewOwnerName(e.target.value)}
                    />
                    {errors.newOwnerName && <span className="form-error">{errors.newOwnerName}</span>}
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="new-owner-phone">
                      Phone Number <span className="text-error">*</span>
                    </label>
                    <input
                      id="new-owner-phone"
                      type="tel"
                      className="form-input"
                      placeholder="e.g. +91 98765 43210"
                      value={newOwnerPhone}
                      onChange={(e) => {
                        setNewOwnerPhone(e.target.value);
                        if (errors.newOwnerPhone) {
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.newOwnerPhone;
                            return next;
                          });
                        }
                      }}
                    />
                    {errors.newOwnerPhone && <span className="form-error">{errors.newOwnerPhone}</span>}

                    {/* Duplicate Farmer / Client Detection Banner */}
                    {matchingExistingOwner && (
                      <div
                        className="mt-space-sm p-3 rounded-xl border border-error bg-error-container text-on-error-container flex flex-col gap-2"
                        role="alert"
                      >
                        <div className="flex items-start gap-2">
                          <Icon name="warning" size={18} className="shrink-0 mt-0.5 text-error" />
                          <div className="text-xs leading-relaxed">
                            <strong>This mobile number is already registered to an existing farmer/client.</strong>{' '}
                            Please select the existing client instead.
                          </div>
                        </div>

                        <div className="flex items-center justify-between bg-surface-container-lowest p-2 rounded-lg border border-outline-variant">
                          <div className="flex flex-col min-w-0 pr-2">
                            <span className="text-xs font-bold text-on-surface truncate">
                              {matchingExistingOwner.name}
                            </span>
                            <span className="text-xs text-outline font-mono">
                              {matchingExistingOwner.phone}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="btn btn-sm btn-primary shrink-0"
                            onClick={() => {
                              setSelectedOwnerId(matchingExistingOwner.id!);
                              setOwnerMode('existing');
                              setNewOwnerPhone('');
                              setNewOwnerName('');
                              setErrors((prev) => {
                                const next = { ...prev };
                                delete next.newOwnerPhone;
                                delete next.owner;
                                return next;
                              });
                            }}
                          >
                            <Icon name="check" size={14} />
                            <span>Use Existing Client</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label className="form-label" htmlFor="new-owner-email">
                      Email Address <span className="form-label-optional">(optional)</span>
                    </label>
                    <input
                      id="new-owner-email"
                      type="email"
                      className="form-input"
                      placeholder="e.g. ahmed@example.com"
                      value={newOwnerEmail}
                      onChange={(e) => setNewOwnerEmail(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" htmlFor="new-owner-address">
                      Address / City <span className="form-label-optional">(optional)</span>
                    </label>
                    <input
                      id="new-owner-address"
                      type="text"
                      className="form-input"
                      placeholder="e.g. 42 Park Street, Bengaluru"
                      value={newOwnerAddress}
                      onChange={(e) => setNewOwnerAddress(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── SECTION 2: ANIMAL / PATIENT DETAILS ───────────── */}
          <div className="form-card">
            <div className="form-card-title flex items-center gap-2">
              <Icon name="paw" size={18} className="text-primary" />
              <span>Patient / Animal Details</span>
            </div>
            <div className="form-card-sub">
              Enter clinical signalment, breed, weight, and identification marks.
            </div>

            <div className="flex flex-col gap-space-md">
              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="patient-name">
                    Animal Name <span className="text-error">*</span>
                  </label>
                  <input
                    id="patient-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Bruno"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  {errors.name && <span className="form-error">{errors.name}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="patient-species">
                    Species <span className="text-error">*</span>
                  </label>
                  <select
                    id="patient-species"
                    className="form-select"
                    value={species}
                    onChange={(e) => setSpecies(e.target.value as Species)}
                  >
                    {availableSpeciesOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-grid-3">
                <div className="form-group">
                  <label className="form-label" htmlFor="patient-breed">
                    Breed <span className="form-label-optional">(optional)</span>
                  </label>
                  <input
                    id="patient-breed"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Labrador Retriever"
                    value={breed}
                    onChange={(e) => setBreed(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="patient-sex">
                    Sex <span className="text-error">*</span>
                  </label>
                  <select
                    id="patient-sex"
                    className="form-select"
                    value={sex}
                    onChange={(e) => setSex(e.target.value as Sex)}
                  >
                    {availableSexOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="patient-weight">
                    Weight (kg) <span className="form-label-optional">(optional)</span>
                  </label>
                  <input
                    id="patient-weight"
                    type="number"
                    step="0.1"
                    min="0"
                    max="1500"
                    className="form-input"
                    placeholder="e.g. 24.0"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="patient-age-note">
                    Age / Approximate Age <span className="form-label-optional">(optional)</span>
                  </label>
                  <input
                    id="patient-age-note"
                    type="text"
                    className="form-input"
                    placeholder="e.g. 4 years, or 6 months"
                    value={ageNote}
                    onChange={(e) => setAgeNote(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="patient-dob">
                    Date of Birth <span className="form-label-optional">(if known)</span>
                  </label>
                  <input
                    id="patient-dob"
                    type="date"
                    className="form-input"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label" htmlFor="patient-id-ref">
                    Identification Reference / Chart # <span className="form-label-optional">(optional)</span>
                  </label>
                  <input
                    id="patient-id-ref"
                    type="text"
                    className="form-input"
                    placeholder="e.g. #CAN-8841"
                    value={identificationRef}
                    onChange={(e) => setIdentificationRef(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="patient-microchip">
                    Microchip Number <span className="form-label-optional">(optional)</span>
                  </label>
                  <input
                    id="patient-microchip"
                    type="text"
                    className="form-input"
                    placeholder="e.g. 981020002891240"
                    value={microchipNumber}
                    onChange={(e) => setMicrochipNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="patient-notes">
                  Clinical Remarks / Notes <span className="form-label-optional">(optional)</span>
                </label>
                <textarea
                  id="patient-notes"
                  rows={3}
                  className="form-textarea"
                  placeholder="Allergies, chronic conditions, behavioral notes, vaccination history..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>

            {errors.submit && <div className="form-error mt-space-sm">{errors.submit}</div>}

            {/* Actions Footer */}
            <div className="form-actions-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate(mode === 'edit' && patientId ? `/patients/${patientId}` : '/patients')}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                id="btn-save-patient"
                disabled={saving}
              >
                <Icon name="check" size={16} />
                <span>{saving ? 'Saving...' : mode === 'new' ? 'Save & Register Patient' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
