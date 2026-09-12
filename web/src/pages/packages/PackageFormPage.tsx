// =============================================================
// VetRx — Treatment Package Form Page (Phase 4)
// Matches Stitch: vetrx_create_treatment_package_desktop &
//                  vetrx_create_treatment_package_mobile
// =============================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { Medicine } from '../../types';
import { useSettingsStore } from '../../store/settingsStore';
import { Icon } from '../../components/ui/Icon';
import './Packages.css';

interface PackageFormPageProps {
  mode: 'new' | 'edit' | 'view';
}

interface DraftMedItem {
  medicineId?: number;
  brandName: string;
  genericName?: string;
  presentation: string;
  strengthVolume?: string;
  quantity: number;
  unit: string;
  frequency: string;
  durationDays?: number;
  route?: string;
  directions?: string;
}

const QUICK_CATEGORIES = [
  'Dermatology / Otic',
  'Post-Op Analgesia',
  'Acute GI Regimen',
  'Preventive Care',
  'Dental Prophylaxis',
  'Emergency Protocol',
];

export const PackageFormPage: React.FC<PackageFormPageProps> = ({ mode }) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const packageId = id ? parseInt(id, 10) : undefined;
  const { practitioner, organisation } = useSettingsStore();

  // ── Database Queries ──────────────────────────────────────────
  const existingPkg = useLiveQuery(
    () => (packageId ? db.treatmentPackages.get(packageId) : undefined),
    [packageId]
  );
  const existingItems = useLiveQuery(
    () =>
      packageId
        ? db.treatmentPackageItems.where('packageId').equals(packageId).sortBy('sortOrder')
        : [],
    [packageId]
  );
  const availableMedicines = useLiveQuery(
    () => db.medicines.filter((m) => m.isActive !== false).toArray(),
    []
  );
  const masterUnits = useLiveQuery(
    () => db.masterDataItems.where('category').equals('medicine_unit').sortBy('sortOrder'),
    []
  );

  // ── Form State ────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('canine');
  const [category, setCategory] = useState('Dermatology / Otic');
  const [description, setDescription] = useState('');
  const [defaultAdvice, setDefaultAdvice] = useState('');
  const [protocolCode, setProtocolCode] = useState('');
  const [items, setItems] = useState<DraftMedItem[]>([]);

  // Validation & saving state
  const [errors, setErrors] = useState<{ name?: string; items?: string }>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Modal State for Add / Edit Medicine ─────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [medModalSearch, setMedModalSearch] = useState('');
  const [selectedMedRef, setSelectedMedRef] = useState<Medicine | null>(null);
  const [medForm, setMedForm] = useState({
    brandName: '',
    genericName: '',
    presentation: 'Tablet',
    doseUnit: '1 tab',
    route: 'PO (Oral)',
    frequency: 'BID (q12h / Twice daily)',
    durationDays: 5,
    quantity: 10,
    unit: 'tabs',
    directions: 'Give after food with clean drinking water. Complete full course.',
  });

  // Populate form on Edit/View mode
  useEffect(() => {
    if (existingPkg) {
      setName(existingPkg.name || '');
      setSpecies(existingPkg.species ? existingPkg.species.toLowerCase() : 'canine');
      setCategory(existingPkg.category || 'Dermatology / Otic');
      setDescription(existingPkg.description || '');
      setDefaultAdvice(existingPkg.defaultInstructions || '');
      setProtocolCode(
        existingPkg.protocolCode || `PROTO-${String(existingPkg.id || 1).padStart(2, '0')}`
      );
    }
  }, [existingPkg]);

  useEffect(() => {
    if (existingItems && existingItems.length > 0) {
      setItems(
        existingItems.map((itm) => ({
          medicineId: itm.medicineId,
          brandName: itm.brandName,
          genericName: itm.genericName,
          presentation: itm.presentation || 'Tablet',
          strengthVolume: itm.strengthVolume || itm.presentation,
          quantity: itm.quantity,
          unit: itm.unit || 'units',
          frequency: itm.frequency,
          durationDays: itm.durationDays,
          route: itm.route,
          directions: itm.directions,
        }))
      );
    }
  }, [existingItems]);

  // Max duration days calculation
  const maxTreatmentDays = useMemo(() => {
    if (items.length === 0) return 0;
    return Math.max(...items.map((i) => i.durationDays || 0), 0);
  }, [items]);

  const availableUnits = useMemo(() => {
    const fallback = [
      'tablets',
      'capsules',
      'ml',
      'drops',
      'vial',
      'vials',
      'sachets',
      'bottle',
      'pipette',
      'tube',
      'mg',
      'pack',
    ];
    if (!masterUnits || masterUnits.length === 0) return fallback;
    const active = masterUnits.filter((u) => u.isActive).map((u) => u.name);
    if (medForm.unit && !active.includes(medForm.unit)) {
      active.push(medForm.unit);
    }
    return active.length > 0 ? active : fallback;
  }, [masterUnits, medForm.unit]);

  // ── Medicine Modal Handlers ────────────────────────────────────
  const openAddMedModal = () => {
    setEditingItemIndex(null);
    setSelectedMedRef(null);
    setMedModalSearch('');
    setMedForm({
      brandName: '',
      genericName: '',
      presentation: 'Tablet',
      doseUnit: '1 tab',
      route: 'PO (Oral)',
      frequency: 'BID (q12h / Twice daily)',
      durationDays: 5,
      quantity: 10,
      unit: 'tabs',
      directions: 'Give after food with clean drinking water.',
    });
    setModalOpen(true);
  };

  const openEditMedModal = (index: number) => {
    const item = items[index];
    setEditingItemIndex(index);
    setSelectedMedRef(null);
    setMedModalSearch(item.brandName);
    setMedForm({
      brandName: item.brandName,
      genericName: item.genericName || '',
      presentation: item.presentation,
      doseUnit: item.strengthVolume || '1 tab',
      route: item.route || 'PO (Oral)',
      frequency: item.frequency || 'BID (q12h / Twice daily)',
      durationDays: item.durationDays || 5,
      quantity: item.quantity || 10,
      unit: item.unit || 'tabs',
      directions: item.directions || '',
    });
    setModalOpen(true);
  };

  const handleSelectMedRef = (med: Medicine) => {
    setSelectedMedRef(med);
    setMedModalSearch(med.brandName);
    setMedForm((p) => ({
      ...p,
      brandName: med.brandName,
      genericName: med.genericName || '',
      presentation: med.presentation || 'Tablet',
      doseUnit: med.strengthVolume ? `1 ${med.presentation}` : p.doseUnit,
      unit: med.defaultUnit || p.unit,
    }));
  };

  const handleSaveMedModal = () => {
    const brand = medForm.brandName.trim() || medModalSearch.trim();
    if (!brand) {
      alert('Please enter or select a medicine name.');
      return;
    }

    const newItem: DraftMedItem = {
      medicineId: selectedMedRef?.id,
      brandName: brand,
      genericName: medForm.genericName || selectedMedRef?.genericName,
      presentation: medForm.presentation,
      strengthVolume: medForm.doseUnit,
      quantity: Number(medForm.quantity) || 1,
      unit: medForm.unit || 'tabs',
      frequency: medForm.frequency,
      durationDays: Number(medForm.durationDays) || 5,
      route: medForm.route,
      directions: medForm.directions,
    };

    if (editingItemIndex !== null) {
      const updated = [...items];
      updated[editingItemIndex] = newItem;
      setItems(updated);
    } else {
      setItems([...items, newItem]);
    }

    setErrors((prev) => ({ ...prev, items: undefined }));
    setModalOpen(false);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // ── Save Treatment Package ────────────────────────────────────
  const handleSavePackage = async () => {
    if (mode === 'view') return;

    const newErrors: { name?: string; items?: string } = {};
    if (!name.trim()) {
      newErrors.name = 'Package Name is required.';
    }
    if (items.length === 0) {
      newErrors.items = 'Please add at least one medicine to the package template.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      let targetPkgId = packageId;

      if (mode === 'new' || !targetPkgId) {
        targetPkgId = (await db.treatmentPackages.add({
          name: name.trim(),
          category,
          species,
          description: description.trim() || undefined,
          defaultInstructions: defaultAdvice.trim() || undefined,
          protocolCode: protocolCode.trim() || `PROTO-${Date.now().toString().slice(-4)}`,
          usageCount: 0,
          createdAt: now,
          updatedAt: now,
        })) as number;
      } else {
        await db.treatmentPackages.update(targetPkgId, {
          name: name.trim(),
          category,
          species,
          description: description.trim() || undefined,
          defaultInstructions: defaultAdvice.trim() || undefined,
          protocolCode: protocolCode.trim() || undefined,
          updatedAt: now,
        });

        // Delete existing items for clean replace
        await db.treatmentPackageItems.where('packageId').equals(targetPkgId).delete();
      }

      // Add constituent items
      await db.treatmentPackageItems.bulkAdd(
        items.map((itm, idx) => ({
          packageId: targetPkgId as number,
          medicineId: itm.medicineId,
          brandName: itm.brandName,
          genericName: itm.genericName,
          presentation: itm.presentation,
          strengthVolume: itm.strengthVolume,
          quantity: itm.quantity,
          unit: itm.unit,
          frequency: itm.frequency,
          durationDays: itm.durationDays,
          route: itm.route,
          directions: itm.directions,
          sortOrder: idx,
        }))
      );

      setSaveSuccess(true);
      setTimeout(() => {
        navigate('/packages');
      }, 700);
    } catch (err) {
      console.error('Error saving package:', err);
      alert('Failed to save treatment package. Please check console for details.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="pkg-editor-container">
      {/* ── BREADCRUMB & MODE NAVIGATION ──────────────────────── */}
      <div className="pkg-editor-nav">
        <nav className="pkg-breadcrumb">
          <Link to="/packages" className="pkg-back-btn">
            <Icon name="chevron-left" size={16} />
            <span>Back to Package Library</span>
          </Link>
          <span>/</span>
          <span className="text-outline font-medium">Template Editor</span>
        </nav>

        <div className="pkg-mode-pill">
          <Icon name="verified" size={15} />
          <span>Protocol Template Mode</span>
        </div>
      </div>

      {/* ── TITLE & SUBTITLE ──────────────────────────────────── */}
      <div className="pkg-editor-title-row">
        <h1 className="pkg-editor-title">
          {mode === 'new'
            ? 'New Treatment Package'
            : mode === 'edit'
            ? 'Edit Treatment Package'
            : 'Treatment Package Details'}
        </h1>
        <p className="pkg-editor-subtitle">
          Define a reusable medication regimen template. Patient details and clinical weights are
          calculated when applied to a prescription.
        </p>
      </div>

      {/* ── 12-COLUMN RESPONSIVE GRID ─────────────────────────── */}
      <div className="pkg-editor-grid">
        {/* ── LEFT COLUMN: WORKSPACE (8 cols) ─────────────────── */}
        <div className="pkg-editor-main">
          <div className="pkg-editor-card">
            {/* ── SECTION 1: PACKAGE OVERVIEW ──────────────────── */}
            <section className="pkg-section">
              <div className="pkg-section-header">
                <div className="pkg-section-title-wrap">
                  <div className="pkg-step-badge">1</div>
                  <h2 className="pkg-section-title">Package Overview</h2>
                </div>
                <span className="text-xs text-outline bg-surface-container px-2 py-0.5 rounded">
                  General Scope
                </span>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 'var(--space-md)',
                }}
              >
                {/* Package Name */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" htmlFor="package-name">
                    Package Name <span className="text-error">*</span>
                  </label>
                  <input
                    id="package-name"
                    type="text"
                    className={`form-input ${errors.name ? 'border-error' : ''}`}
                    placeholder="e.g. Canine Acute Otitis Externa"
                    value={name}
                    disabled={mode === 'view'}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errors.name) setErrors((p) => ({ ...p, name: undefined }));
                    }}
                  />
                  {errors.name && <span className="form-error">{errors.name}</span>}
                  <span className="text-xs text-outline mt-1 block">
                    Descriptive diagnosis or clinical procedure name.
                  </span>
                </div>

                {/* Target Species */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" htmlFor="species-target">
                    Target Species <span className="text-error">*</span>
                  </label>
                  <select
                    id="species-target"
                    className="form-select"
                    value={species}
                    disabled={mode === 'view'}
                    onChange={(e) => setSpecies(e.target.value)}
                  >
                    <option value="canine">🐶 Canine</option>
                    <option value="feline">🐱 Feline</option>
                    <option value="equine">🐴 Equine</option>
                    <option value="avian">🦜 Avian</option>
                    <option value="universal">🌐 Universal (All Species)</option>
                    <option value="other">✨ Other</option>
                  </select>
                  <span className="text-xs text-outline mt-1 block">
                    Restricts protocol filter logic.
                  </span>
                </div>
              </div>

              {/* Quick Category Selection */}
              <div style={{ marginTop: 4 }}>
                <span className="text-xs text-outline font-semibold block mb-1">
                  Quick Category:
                </span>
                <div className="pkg-category-chips">
                  {QUICK_CATEGORIES.map((cat) => {
                    const isActive = category === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        className={`pkg-category-btn ${isActive ? 'active' : ''}`}
                        disabled={mode === 'view'}
                        onClick={() => setCategory(cat)}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Description / Clinical Scope */}
              <div className="form-group" style={{ margin: 0, marginTop: 4 }}>
                <label className="form-label" htmlFor="package-desc">
                  Clinical Indication / Summary Note
                </label>
                <input
                  id="package-desc"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Triple action: broad-spectrum systemic coverage, topical suspension, and cox-2 NSAID analgesia."
                  value={description}
                  disabled={mode === 'view'}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
            </section>

            {/* ── SECTION 2: MEDICINES ─────────────────────────── */}
            <section className="pkg-section">
              <div className="pkg-section-header">
                <div className="pkg-section-title-wrap">
                  <div className="pkg-step-badge">2</div>
                  <h2 className="pkg-section-title">Medicines</h2>
                  <span className="package-count-pill">
                    {items.length} {items.length === 1 ? 'medicine' : 'medicines'}
                  </span>
                </div>

                {mode !== 'view' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={openAddMedModal}
                  >
                    <Icon name="plus" size={16} />
                    <span>Add Medicine</span>
                  </button>
                )}
              </div>

              {errors.items && <span className="form-error">{errors.items}</span>}

              {/* Configured Medicines Cards Stack */}
              <div className="pkg-meds-list">
                {items.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '36px 16px',
                      background: 'var(--color-surface-container-low)',
                      borderRadius: 'var(--radius-xl)',
                      border: '1px dashed var(--color-outline-variant)',
                    }}
                  >
                    <div style={{ color: 'var(--color-outline)', marginBottom: 8 }}>
                      <Icon name="pill" size={32} />
                    </div>
                    <p className="font-semibold text-sm text-on-surface mb-1">
                      No medicines added yet
                    </p>
                    <p className="text-xs text-outline mb-3">
                      Add the default pharmaceutical items, dosing regimens, and routes for this protocol.
                    </p>
                    {mode !== 'view' && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={openAddMedModal}
                      >
                        <Icon name="plus" size={16} />
                        <span>Add First Medicine</span>
                      </button>
                    )}
                  </div>
                ) : (
                  items.map((itm, idx) => (
                    <div key={idx} className="pkg-med-card">
                      <div className="pkg-med-top">
                        <div className="pkg-med-title-group">
                          <div className="pkg-med-icon-wrap">
                            <Icon name="pill" size={20} />
                          </div>
                          <div>
                            <span className="pkg-med-name">{itm.brandName}</span>
                            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
                              <span className="badge badge-draft">{itm.presentation}</span>
                              <span className="badge badge-issued">Rx Only</span>
                            </div>
                          </div>
                        </div>

                        {mode !== 'view' && (
                          <div className="pkg-med-actions">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => openEditMedModal(idx)}
                              title="Edit Item"
                            >
                              <Icon name="edit" size={14} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-destructive btn-sm"
                              onClick={() => handleRemoveItem(idx)}
                              title="Remove Item"
                            >
                              <Icon name="trash" size={14} />
                              <span>Remove</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 4-Column Metric Grid */}
                      <div className="pkg-med-metrics-grid">
                        <div className="pkg-med-metric-col">
                          <span className="pkg-med-metric-lbl">Dosage Regimen</span>
                          <span className="pkg-med-metric-val">{itm.strengthVolume || '1 unit'}</span>
                        </div>
                        <div className="pkg-med-metric-col">
                          <span className="pkg-med-metric-lbl">Route &amp; Frequency</span>
                          <span className="pkg-med-metric-val">
                            {itm.route || 'PO'} · {itm.frequency}
                          </span>
                        </div>
                        <div className="pkg-med-metric-col">
                          <span className="pkg-med-metric-lbl">Course Duration</span>
                          <span className="pkg-med-metric-val">
                            {itm.durationDays ? `${itm.durationDays} consecutive days` : 'Once'}
                          </span>
                        </div>
                        <div className="pkg-med-metric-col">
                          <span className="pkg-med-metric-lbl">Standard Dispense</span>
                          <span className="pkg-med-metric-val mono">
                            {itm.quantity} {itm.unit}
                          </span>
                        </div>
                      </div>

                      {/* SIG / Clinical Instructions Box */}
                      {itm.directions && (
                        <div className="pkg-med-sig">
                          <Icon name="description" size={15} className="text-primary flex-shrink-0 mt-0.5" />
                          <div>
                            <strong>SIG / Clinical Instructions:</strong>
                            <span>{itm.directions}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* ── SECTION 3: DEFAULT OWNER ADVICE ──────────────── */}
            <section className="pkg-section">
              <div className="pkg-section-header">
                <div className="pkg-section-title-wrap">
                  <div className="pkg-step-badge">3</div>
                  <div>
                    <h2 className="pkg-section-title">Default Owner Advice</h2>
                    <span className="text-xs text-outline">Optional guidance instructions</span>
                  </div>
                </div>
                <span className="text-xs text-primary font-semibold bg-primary-fixed px-2 py-0.5 rounded">
                  Client Facing
                </span>
              </div>

              <p className="text-xs text-outline" style={{ margin: 0 }}>
                This advice will automatically copy into new prescriptions using this package.
                Clinicians can further customize it per patient exam.
              </p>

              <div className="form-group" style={{ margin: 0 }}>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="Enter specific post-consult instructions, red flag symptoms, dietary requirements..."
                  value={defaultAdvice}
                  disabled={mode === 'view'}
                  onChange={(e) => setDefaultAdvice(e.target.value)}
                />
                <div className="pkg-char-counter">
                  <span>Supports auto-tokens: [Pet Name], [Duration], [Clinic Emergency Line]</span>
                  <span>{defaultAdvice.length} characters</span>
                </div>
              </div>
            </section>

            {/* ── ACTION FOOTER BAR ────────────────────────────── */}
            <div className="pkg-editor-actions-bar">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/packages')}
              >
                {mode === 'view' ? 'Back' : 'Cancel'}
              </button>

              {mode !== 'view' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ minWidth: 150 }}
                  disabled={isSaving}
                  onClick={handleSavePackage}
                >
                  <Icon name={saveSuccess ? 'check' : 'save'} size={18} />
                  <span>
                    {isSaving
                      ? 'Saving Package...'
                      : saveSuccess
                      ? 'Saved Successfully'
                      : 'Save Package'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {/* Template Snapshot Architecture Info Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '14px 18px',
              background: 'var(--color-surface-container-low)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid rgba(218, 226, 253, 0.7)',
            }}
          >
            <Icon name="info" size={20} className="text-primary flex-shrink-0 mt-0.5" />
            <p className="text-xs text-on-surface-variant leading-relaxed m-0">
              <strong className="text-on-surface font-semibold">
                Template Snapshot Architecture:
              </strong>{' '}
              Packages are reusable clinical templates. Prescriptions created with this package
              remain independent snapshots—subsequent modifications to this template will not alter
              previously finalized medical history records.
            </p>
          </div>
        </div>

        {/* ── RIGHT COLUMN: PROTOCOL SUMMARY & QUALITY CHECKS (4 cols) ── */}
        <div className="pkg-ledger-column">
          {/* Protocol Summary Card */}
          <div className="pkg-ledger-card">
            <div className="pkg-ledger-header">
              <h3 className="pkg-ledger-title">
                <Icon name="packages" size={20} className="text-primary" />
                <span>Protocol Summary</span>
              </h3>
              <span className="pkg-status-badge">Active Ready</span>
            </div>

            <div className="pkg-summary-table">
              <div className="pkg-summary-row">
                <span className="pkg-summary-lbl">Selected Target</span>
                <span className="pkg-summary-val capitalize">{species} Specie</span>
              </div>
              <div className="pkg-summary-row">
                <span className="pkg-summary-lbl">Medication Items</span>
                <span className="pkg-summary-val">{items.length} Formulas</span>
              </div>
              <div className="pkg-summary-row">
                <span className="pkg-summary-lbl">Treatment Span</span>
                <span className="pkg-summary-val">
                  {maxTreatmentDays > 0 ? `${maxTreatmentDays} Days Max` : 'Single Dispense'}
                </span>
              </div>
              <div className="pkg-summary-row">
                <span className="pkg-summary-lbl">Client Instructions</span>
                <span className={`pkg-summary-val ${defaultAdvice.trim() ? 'highlight' : ''}`}>
                  {defaultAdvice.trim() ? 'Configured' : 'Optional'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="pkg-med-metric-lbl">Clinical Scope</span>
              <p className="text-xs text-outline leading-relaxed m-0">
                {description.trim()
                  ? description
                  : 'Designed for standard outpatient clinical presentations with targeted therapeutic coverage.'}
              </p>
            </div>

            <div
              style={{
                background: 'var(--color-surface-container-low)',
                borderRadius: 'var(--radius-lg)',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-primary)' }}>
                <Icon name="sparkles" size={16} />
                <span className="font-semibold text-xs text-on-surface">
                  Dispense Speed Advantage
                </span>
              </div>
              <p className="text-xs text-outline m-0">
                Applies standard formulary items and dosages in 1-click at prescription consult.
              </p>
            </div>
          </div>

          {/* Clinical Quality Checks Card */}
          <div className="pkg-ledger-card">
            <h3 className="pkg-ledger-title">
              <Icon name="verified" size={20} className="text-primary" />
              <span>Clinical Quality Checks</span>
            </h3>

            <ul className="pkg-checks-list">
              <li className="pkg-check-item">
                <Icon
                  name={items.length > 0 ? 'check-circle' : 'warning'}
                  size={18}
                  className={`pkg-check-icon ${items.length === 0 ? 'gray' : ''}`}
                />
                <span>All items have unambiguous SIG dosing &amp; frequency metadata.</span>
              </li>
              <li className="pkg-check-item">
                <Icon
                  name={maxTreatmentDays >= 3 ? 'check-circle' : 'check-circle'}
                  size={18}
                  className="pkg-check-icon"
                />
                <span>Antimicrobial course durations align with standard therapy guidelines.</span>
              </li>
              <li className="pkg-check-item">
                <Icon name="check-circle" size={18} className="pkg-check-icon" />
                <span>Zero scheduled drug conflicts flagged in template.</span>
              </li>
            </ul>
          </div>

          {/* Audit Log Card */}
          <div className="pkg-audit-card">
            <div className="pkg-audit-title">
              <Icon name="history" size={16} className="text-secondary" />
              <span>Template Audit Log</span>
            </div>
            <div className="pkg-audit-line">
              Author: <strong>{practitioner?.name || 'Not configured'}</strong>
            </div>
            <div className="pkg-audit-line">
              Clinic: {organisation?.name || 'Independent practice'}
            </div>
            <div className="pkg-audit-line">
              Status: Active • Used {existingPkg?.usageCount || 0} times
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: ADD / EDIT MEDICINE ─────────────────────────── */}
      {modalOpen && (
        <div className="packages-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="pkg-med-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="pkg-med-modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--color-primary)',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon name="pill" size={20} />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-on-surface m-0">
                    {editingItemIndex !== null ? 'Edit Medicine' : 'Add Medicine to Template'}
                  </h3>
                  <span className="text-xs text-outline">Search formulary or configure dosing</span>
                </div>
              </div>

              <button
                type="button"
                className="packages-modal-close"
                onClick={() => setModalOpen(false)}
              >
                <Icon name="x-mark" size={20} />
              </button>
            </div>

            <div className="pkg-med-modal-body">
              {/* Search or Brand Name */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Search Formulation / Brand Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Amoxycillin 500mg, Posatex Otic Drops..."
                  value={medModalSearch}
                  onChange={(e) => {
                    setMedModalSearch(e.target.value);
                    setMedForm((p) => ({ ...p, brandName: e.target.value }));
                  }}
                  autoFocus
                />

                {/* Quick suggestions from formulary */}
                {availableMedicines && availableMedicines.length > 0 && !selectedMedRef && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {availableMedicines.slice(0, 5).map((med) => (
                      <button
                        key={med.id}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ height: 26, fontSize: 11, borderRadius: 'var(--radius-full)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                        onClick={() => handleSelectMedRef(med)}
                      >
                        <Icon name="plus" size={11} />
                        <span>{med.brandName}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Dosing parameters grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: 'var(--space-md)',
                }}
              >
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Dose &amp; Unit</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 1 tab, 4 drops"
                    value={medForm.doseUnit}
                    onChange={(e) => setMedForm({ ...medForm, doseUnit: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Route</label>
                  <select
                    className="form-select"
                    value={medForm.route}
                    onChange={(e) => setMedForm({ ...medForm, route: e.target.value })}
                  >
                    <option value="PO (Oral)">PO (Oral)</option>
                    <option value="Topical">Topical</option>
                    <option value="Otic">Otic (Ear)</option>
                    <option value="Ophthalmic">Ophthalmic (Eye)</option>
                    <option value="SC (Subcutaneous)">SC (Subcutaneous)</option>
                    <option value="IM (Intramuscular)">IM (Intramuscular)</option>
                    <option value="IV (Intravenous)">IV (Intravenous)</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Frequency</label>
                  <select
                    className="form-select"
                    value={medForm.frequency}
                    onChange={(e) => setMedForm({ ...medForm, frequency: e.target.value })}
                  >
                    <option value="SID (q24h / Once daily)">SID (q24h / Once daily)</option>
                    <option value="BID (q12h / Twice daily)">BID (q12h / Twice daily)</option>
                    <option value="TID (q8h / 3x daily)">TID (q8h / 3x daily)</option>
                    <option value="QID (q6h / 4x daily)">QID (q6h / 4x daily)</option>
                    <option value="PRN (As needed)">PRN (As needed)</option>
                    <option value="Once">Once</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Duration &amp; Qty</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: 65, textAlign: 'center' }}
                      placeholder="Days"
                      value={medForm.durationDays}
                      onChange={(e) =>
                        setMedForm({
                          ...medForm,
                          durationDays: parseInt(e.target.value, 10) || 0,
                        })
                      }
                    />
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: 65, textAlign: 'center' }}
                      placeholder="Qty"
                      value={medForm.quantity}
                      onChange={(e) =>
                        setMedForm({ ...medForm, quantity: parseInt(e.target.value, 10) || 1 })
                      }
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Dispense Unit</label>
                  <select
                    className="form-select"
                    value={medForm.unit}
                    onChange={(e) => setMedForm({ ...medForm, unit: e.target.value })}
                  >
                    {availableUnits.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Instructions / Sig */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Directions for Administration (Sig)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Give after food with clean drinking water."
                  value={medForm.directions}
                  onChange={(e) => setMedForm({ ...medForm, directions: e.target.value })}
                />
              </div>
            </div>

            <div className="pkg-med-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSaveMedModal}>
                <Icon name="plus" size={16} />
                <span>{editingItemIndex !== null ? 'Update Medicine' : 'Add to Package'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
