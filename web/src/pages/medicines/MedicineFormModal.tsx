// =============================================================
// VetRx — Medicine Form Modal (Add / Edit Medicine)
// Seamlessly integrates with Settings → Master Data (Medicine Units)
// =============================================================

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { Medicine } from '../../types';
import { Icon } from '../../components/ui/Icon';

interface MedicineFormModalProps {
  isOpen: boolean;
  medicine?: Medicine | null;
  onClose: () => void;
  onSaved: (medicineId: number) => void;
}

const COMMON_PRESENTATIONS = [
  'Tablet',
  'Ear Drops',
  'Eye Drops',
  'Syrup',
  'Injection',
  'Sachet',
  'Capsule',
  'Topical Spot-on',
  'Ointment',
  'Cream',
  'Oral Suspension',
  'Spray',
  'Shampoo',
  'Powder',
  'Other',
];

const COMMON_CATEGORIES = [
  'Antibiotic / Antimicrobial',
  'Otic / Topical',
  'NSAID / Analgesic',
  'Gastrointestinal / Antiemetic',
  'Antiparasitic / Dewormer',
  'Dermatology / Antiallergic',
  'Cardiovascular / Renal',
  'Supplement / Probiotic',
  'Sedative / Anesthetic',
  'Endocrine / Hormone',
  'Other',
];

const FALLBACK_UNITS = [
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

export function MedicineFormModal({
  isOpen,
  medicine,
  onClose,
  onSaved,
}: MedicineFormModalProps) {
  // Master Data: Query active medicine units from master data
  const masterUnits = useLiveQuery(
    () =>
      db.masterDataItems
        .where('category')
        .equals('medicine_unit')
        .and((item) => item.isActive)
        .sortBy('sortOrder'),
    []
  );

  const availableUnits =
    masterUnits && masterUnits.length > 0
      ? masterUnits.map((u) => u.name)
      : FALLBACK_UNITS;

  // Form State
  const [brandName, setBrandName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [presentation, setPresentation] = useState('Tablet');
  const [strengthVolume, setStrengthVolume] = useState('');
  const [defaultUnit, setDefaultUnit] = useState('tablets');
  const [category, setCategory] = useState('Antibiotic / Antimicrobial');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Errors & loading
  const [errors, setErrors] = useState<{ brandName?: string; presentation?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = Boolean(medicine && medicine.id);

  // Synchronize when medicine prop changes
  useEffect(() => {
    if (medicine) {
      setBrandName(medicine.brandName || '');
      setGenericName(medicine.genericName || '');
      setPresentation(medicine.presentation || 'Tablet');
      setStrengthVolume(medicine.strengthVolume || '');
      setDefaultUnit(medicine.defaultUnit || 'tablets');
      setCategory(medicine.category || 'Antibiotic / Antimicrobial');
      setNotes(medicine.notes || '');
      setIsActive(medicine.isActive !== false);
    } else {
      setBrandName('');
      setGenericName('');
      setPresentation('Tablet');
      setStrengthVolume('');
      setDefaultUnit('tablets');
      setCategory('Antibiotic / Antimicrobial');
      setNotes('');
      setIsActive(true);
    }
    setErrors({});
  }, [medicine, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { brandName?: string; presentation?: string } = {};

    if (!brandName.trim()) {
      newErrors.brandName = 'Medicine brand name is required.';
    }
    if (!presentation.trim()) {
      newErrors.presentation = 'Presentation/form is required.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      if (isEdit && medicine?.id) {
        // Edit existing medicine — preserves id & relationships
        await db.medicines.update(medicine.id, {
          brandName: brandName.trim(),
          genericName: genericName.trim() || undefined,
          presentation: presentation.trim(),
          strengthVolume: strengthVolume.trim() || undefined,
          defaultUnit: defaultUnit.trim() || undefined,
          category: category.trim() || undefined,
          notes: notes.trim() || undefined,
          isActive,
          updatedAt: now,
        });
        onSaved(medicine.id);
      } else {
        // Add new medicine
        const newId = await db.medicines.add({
          brandName: brandName.trim(),
          genericName: genericName.trim() || undefined,
          presentation: presentation.trim(),
          strengthVolume: strengthVolume.trim() || undefined,
          defaultUnit: defaultUnit.trim() || undefined,
          category: category.trim() || undefined,
          notes: notes.trim() || undefined,
          isActive,
          createdAt: now,
          updatedAt: now,
        });
        onSaved(newId as number);
      }
      onClose();
    } catch (err) {
      console.error('Failed to save medicine:', err);
      alert('Failed to save medicine formulation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="medicine-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="medicine-modal-title"
    >
      <div className="medicine-modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="medicine-modal-header">
          <div>
            <div className="medicine-modal-kicker">
              {isEdit ? 'Update Formulation' : 'Clinical Formulary'}
            </div>
            <h2 className="medicine-modal-title" id="medicine-modal-title">
              {isEdit ? 'Edit Medicine' : 'Add New Medicine'}
            </h2>
          </div>
          <button
            type="button"
            className="medicine-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} id="medicine-form">
          <div className="medicine-modal-body">
            <div className="medicine-form-grid">
              {/* Brand Name */}
              <div className="medicine-form-group full-width">
                <label className="medicine-form-label" htmlFor="med-brand-name">
                  Medicine / Brand Name <span className="required">*</span>
                </label>
                <input
                  id="med-brand-name"
                  type="text"
                  className={`medicine-form-input ${errors.brandName ? 'error' : ''}`}
                  placeholder="e.g. Amoxicillin 500mg, Posatex Otic Drops 15ml"
                  value={brandName}
                  onChange={(e) => {
                    setBrandName(e.target.value);
                    if (errors.brandName) setErrors((prev) => ({ ...prev, brandName: undefined }));
                  }}
                  autoFocus
                />
                {errors.brandName && (
                  <span className="medicine-form-error-msg">{errors.brandName}</span>
                )}
              </div>

              {/* Generic / Chemical Name */}
              <div className="medicine-form-group full-width">
                <label className="medicine-form-label" htmlFor="med-generic-name">
                  Generic / Chemical Composition
                </label>
                <input
                  id="med-generic-name"
                  type="text"
                  className="medicine-form-input"
                  placeholder="e.g. Amoxicillin Trihydrate, Orbifloxacin / Mometasone"
                  value={genericName}
                  onChange={(e) => setGenericName(e.target.value)}
                />
                <span className="medicine-form-hint">
                  Displays on prescriptions for drug substitution and pharmacy guidance.
                </span>
              </div>

              {/* Form / Presentation */}
              <div className="medicine-form-group">
                <label className="medicine-form-label" htmlFor="med-presentation">
                  Presentation / Form <span className="required">*</span>
                </label>
                <select
                  id="med-presentation"
                  className={`medicine-form-select ${errors.presentation ? 'error' : ''}`}
                  value={presentation}
                  onChange={(e) => {
                    setPresentation(e.target.value);
                    if (errors.presentation) setErrors((prev) => ({ ...prev, presentation: undefined }));
                  }}
                >
                  {COMMON_PRESENTATIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                {errors.presentation && (
                  <span className="medicine-form-error-msg">{errors.presentation}</span>
                )}
              </div>

              {/* Strength / Volume */}
              <div className="medicine-form-group">
                <label className="medicine-form-label" htmlFor="med-strength">
                  Strength / Volume
                </label>
                <input
                  id="med-strength"
                  type="text"
                  className="medicine-form-input"
                  placeholder="e.g. 500mg, 15ml, 250mg/5ml"
                  value={strengthVolume}
                  onChange={(e) => setStrengthVolume(e.target.value)}
                />
              </div>

              {/* Default Unit (from Master Data) */}
              <div className="medicine-form-group">
                <label className="medicine-form-label" htmlFor="med-default-unit">
                  Default Dispense Unit
                </label>
                <select
                  id="med-default-unit"
                  className="medicine-form-select"
                  value={defaultUnit}
                  onChange={(e) => setDefaultUnit(e.target.value)}
                >
                  {availableUnits.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
                <span className="medicine-form-hint">
                  Master Data configured via Settings → Master Data
                </span>
              </div>

              {/* Category */}
              <div className="medicine-form-group">
                <label className="medicine-form-label" htmlFor="med-category">
                  Therapeutic Category
                </label>
                <select
                  id="med-category"
                  className="medicine-form-select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {COMMON_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clinical Notes / Directions */}
              <div className="medicine-form-group full-width">
                <label className="medicine-form-label" htmlFor="med-notes">
                  Clinical Notes / Prescribing Guidelines
                </label>
                <textarea
                  id="med-notes"
                  className="medicine-form-textarea"
                  rows={2}
                  placeholder="e.g. Safe in pregnant animals. Avoid co-administration with antacids."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              {/* Active / Inactive Status Switch */}
              <div className="medicine-form-group full-width">
                <div
                  className="medicine-status-toggle-card"
                  onClick={() => setIsActive((prev) => !prev)}
                  role="checkbox"
                  aria-checked={isActive}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      setIsActive((prev) => !prev);
                    }
                  }}
                >
                  <div className="medicine-status-toggle-info">
                    <span className="medicine-status-toggle-title">
                      {isActive ? 'Active in Formulary' : 'Inactive Formulation'}
                    </span>
                    <span className="medicine-status-toggle-sub">
                      {isActive
                        ? 'Available for selection in new prescriptions and treatment packages.'
                        : 'Hidden from new prescription pickers. Historical records remain unaffected.'}
                    </span>
                  </div>
                  <div className={`medicine-switch ${isActive ? 'active' : ''}`}>
                    <div className="medicine-switch-knob" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="medicine-modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? 'Saving...'
                : isEdit
                ? 'Save Changes'
                : 'Add to Formulary'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
