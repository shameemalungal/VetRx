// =============================================================
// VetRx — Medicine Form Modal (Medicine Master Data)
// Pure Medicine Master Data definition — "What is this medicine/formulation?"
// Completely decoupled from patient-specific prescription dosage.
// =============================================================

import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { Medicine } from '../../types';
import { Icon } from '../../components/ui/Icon';
import {
  MedicineFormulationSection,
  type MedicineFormulationValues,
  COMMON_PRESENTATIONS,
} from './MedicineFormulationSection';
import {
  parseStructuredStrength,
  parseStructuredPackSize,
  formatStructuredStrength,
  formatStructuredPackSize,
  defaultPerUnitForPresentation,
  defaultPackSizeUnitForPresentation,
} from '../../utils/doseCalculator';

export { COMMON_PRESENTATIONS };

const COMMON_CATEGORIES = [
  'Antibiotic / Antimicrobial',
  'NSAID / Analgesic',
  'Otic / Topical',
  'Gastrointestinal / Antiemetic',
  'Antiparasitic / Dewormer',
  'Dermatology / Antiallergic',
  'Cardiovascular / Renal',
  'Supplement / Probiotic',
  'Sedative / Anesthetic',
  'Endocrine / Hormone',
  'Respiratory / Bronchodilator',
  'Ophthalmic',
  'Other',
];

interface MedicineFormModalProps {
  isOpen: boolean;
  medicine?: Medicine | null;
  initialBrandName?: string;
  isFromPrescription?: boolean;
  onClose: () => void;
  onSaved: (medicineId: number) => void;
}

export function MedicineFormModal({
  isOpen,
  medicine,
  initialBrandName,
  isFromPrescription = false,
  onClose,
  onSaved,
}: MedicineFormModalProps) {
  // Query all existing medicines for duplicate detection
  const allMedicines = useLiveQuery(() => db.medicines.toArray(), []) || [];

  // Form State - Medicine Master formulation values
  const [formulationValues, setFormulationValues] = useState<MedicineFormulationValues>({
    brandName: '',
    genericName: '',
    presentation: 'Tablet',
    strengthValue: '',
    strengthUnit: 'mg',
    strengthPerValue: '1',
    strengthPerUnit: 'tablet',
    packSizeValue: '',
    packSizeUnit: 'pack',
    strength: '',
    packSize: '',
  });

  const [category, setCategory] = useState('Antibiotic / Antimicrobial');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Duplicate warning states
  const [duplicateMatch, setDuplicateMatch] = useState<Medicine | null>(null);
  const [duplicateBypassed, setDuplicateBypassed] = useState(false);

  // Errors & submission
  const [errors, setErrors] = useState<{
    brandName?: string;
    genericName?: string;
    presentation?: string;
    strengthValue?: string;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEdit = Boolean(medicine && medicine.id);

  // Synchronize when modal opens or medicine prop changes
  useEffect(() => {
    if (medicine && medicine.id) {
      // Parse structured strength from existing records
      let strVal: number | string = medicine.strengthValue !== undefined ? medicine.strengthValue : '';
      let strUnit = medicine.strengthUnit || 'mg';
      let perVal: number | string = medicine.strengthPerValue !== undefined ? medicine.strengthPerValue : '1';
      let perUnit = medicine.strengthPerUnit || defaultPerUnitForPresentation(medicine.presentation);

      if (strVal === '' && (medicine.strength || medicine.strengthVolume)) {
        const parsed = parseStructuredStrength(medicine.strength || medicine.strengthVolume, medicine.presentation);
        if (parsed.strengthValue !== undefined) {
          strVal = parsed.strengthValue;
          strUnit = parsed.strengthUnit || strUnit;
          perVal = parsed.strengthPerValue || perVal;
          perUnit = parsed.strengthPerUnit || perUnit;
        }
      }

      // Parse structured pack size from existing records
      let packVal: number | string = medicine.packSizeValue !== undefined ? medicine.packSizeValue : '';
      let packUnit = medicine.packSizeUnit || defaultPackSizeUnitForPresentation(medicine.presentation);

      if (packVal === '' && medicine.packSize) {
        const parsedPack = parseStructuredPackSize(medicine.packSize);
        if (parsedPack.packSizeValue !== undefined) {
          packVal = parsedPack.packSizeValue;
          packUnit = parsedPack.packSizeUnit || packUnit;
        }
      }

      setFormulationValues({
        brandName: medicine.brandName || '',
        genericName: medicine.genericName || '',
        presentation: medicine.presentation || 'Tablet',
        strengthValue: strVal,
        strengthUnit: strUnit,
        strengthPerValue: perVal,
        strengthPerUnit: perUnit,
        packSizeValue: packVal,
        packSizeUnit: packUnit,
        strength: medicine.strength || medicine.strengthVolume || '',
        packSize: medicine.packSize || '',
      });

      setCategory(medicine.category || 'Antibiotic / Antimicrobial');
      setNotes(medicine.notes || '');
      setIsActive(medicine.isActive !== false);
    } else {
      const defaultPres = 'Tablet';
      setFormulationValues({
        brandName: initialBrandName || '',
        genericName: '',
        presentation: defaultPres,
        strengthValue: '',
        strengthUnit: 'mg',
        strengthPerValue: '1',
        strengthPerUnit: defaultPerUnitForPresentation(defaultPres),
        packSizeValue: '',
        packSizeUnit: defaultPackSizeUnitForPresentation(defaultPres),
        strength: '',
        packSize: '',
      });
      setCategory('Antibiotic / Antimicrobial');
      setNotes('');
      setIsActive(true);
    }

    setDuplicateMatch(null);
    setDuplicateBypassed(false);
    setErrors({});
  }, [medicine, isOpen, initialBrandName]);

  // Live duplicate detection
  useEffect(() => {
    if (!isOpen || duplicateBypassed) return;
    const qBrand = formulationValues.brandName.trim().toLowerCase();
    const qGeneric = (formulationValues.genericName || '').trim().toLowerCase();
    const qPres = formulationValues.presentation.toLowerCase();

    if (!qBrand && !qGeneric) {
      setDuplicateMatch(null);
      return;
    }

    // Look for duplicate excluding currently edited medicine
    const match = allMedicines.find((m) => {
      if (isEdit && m.id === medicine?.id) return false;
      const mBrand = (m.brandName || '').trim().toLowerCase();
      const mGeneric = (m.genericName || '').trim().toLowerCase();
      const mPres = (m.presentation || '').trim().toLowerCase();

      // Exact brand match
      if (qBrand && mBrand === qBrand) {
        return true;
      }

      // Exact generic + presentation match
      if (qGeneric && mGeneric && qGeneric === mGeneric && qPres === mPres) {
        if (formulationValues.strengthValue && m.strengthValue) {
          return String(formulationValues.strengthValue) === String(m.strengthValue);
        }
        return true;
      }

      return false;
    });

    setDuplicateMatch(match || null);
  }, [formulationValues.brandName, formulationValues.genericName, formulationValues.presentation, formulationValues.strengthValue, allMedicines, isEdit, medicine?.id, isOpen, duplicateBypassed]);

  if (!isOpen) return null;

  const handleFormulationChange = (field: keyof MedicineFormulationValues, val: string) => {
    setFormulationValues((prev) => {
      const next = { ...prev, [field]: val };

      // Clear related errors on edit
      if (field === 'brandName' && errors.brandName) {
        setErrors((e) => ({ ...e, brandName: undefined }));
      }
      if (field === 'genericName' && errors.genericName) {
        setErrors((e) => ({ ...e, genericName: undefined }));
      }
      if (field === 'presentation') {
        next.strengthPerUnit = defaultPerUnitForPresentation(val);
        next.packSizeUnit = defaultPackSizeUnitForPresentation(val);
        if (errors.presentation) {
          setErrors((e) => ({ ...e, presentation: undefined }));
        }
      }
      if (field === 'strengthValue' && errors.strengthValue) {
        setErrors((e) => ({ ...e, strengthValue: undefined }));
      }

      return next;
    });
  };

  const handleUseExisting = (existingId?: number) => {
    if (existingId) {
      onSaved(existingId);
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: {
      brandName?: string;
      genericName?: string;
      presentation?: string;
      strengthValue?: string;
    } = {};

    if (!formulationValues.brandName.trim()) {
      newErrors.brandName = 'Brand name is required.';
    }
    if (!formulationValues.genericName?.trim()) {
      newErrors.genericName = 'Chemical / Active Ingredient is required.';
    }
    if (!formulationValues.presentation.trim()) {
      newErrors.presentation = 'Presentation/form is required.';
    }
    if (
      formulationValues.strengthValue === undefined ||
      formulationValues.strengthValue === null ||
      formulationValues.strengthValue === '' ||
      isNaN(parseFloat(String(formulationValues.strengthValue))) ||
      parseFloat(String(formulationValues.strengthValue)) <= 0
    ) {
      newErrors.strengthValue = 'Valid strength value is required.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Check duplicate warning blocker
    if (duplicateMatch && !duplicateBypassed) {
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const numStrengthVal = parseFloat(String(formulationValues.strengthValue));
      const numPerVal = formulationValues.strengthPerValue ? parseFloat(String(formulationValues.strengthPerValue)) : 1;
      const numPackVal = formulationValues.packSizeValue ? parseFloat(String(formulationValues.packSizeValue)) : undefined;

      const formattedStrength = formatStructuredStrength(
        numStrengthVal,
        formulationValues.strengthUnit || 'mg',
        numPerVal,
        formulationValues.strengthPerUnit || defaultPerUnitForPresentation(formulationValues.presentation)
      );

      const formattedPack = numPackVal !== undefined
        ? formatStructuredPackSize(
            numPackVal,
            formulationValues.packSizeUnit || defaultPackSizeUnitForPresentation(formulationValues.presentation)
          )
        : '';

      const medicinePayload: Partial<Medicine> = {
        brandName: formulationValues.brandName.trim(),
        genericName: formulationValues.genericName?.trim() || undefined,
        presentation: formulationValues.presentation.trim(),
        // Structured Strength
        strengthValue: numStrengthVal,
        strengthUnit: formulationValues.strengthUnit?.trim() || 'mg',
        strengthPerValue: numPerVal,
        strengthPerUnit: formulationValues.strengthPerUnit?.trim() || defaultPerUnitForPresentation(formulationValues.presentation),
        // Structured Pack Size
        packSizeValue: numPackVal,
        packSizeUnit: formulationValues.packSizeUnit?.trim() || undefined,
        // Canonical String representations
        strength: formattedStrength,
        strengthVolume: formattedStrength,
        packSize: formattedPack || undefined,
        // Backward-compatible concentration conversion fields for calculators
        concentrationStrength: numStrengthVal,
        concentrationStrengthUnit: formulationValues.strengthUnit?.trim() || 'mg',
        concentrationVolume: numPerVal,
        concentrationVolumeUnit: formulationValues.strengthPerUnit?.trim() || defaultPerUnitForPresentation(formulationValues.presentation),
        defaultUnit: formulationValues.packSizeUnit || formulationValues.strengthPerUnit || 'tablet',
        dispenseUnit: formulationValues.packSizeUnit || formulationValues.strengthPerUnit || 'tablet',
        category: category.trim() || undefined,
        notes: notes.trim() || undefined,
        isActive,
        updatedAt: now,
      };

      let savedId: number;

      if (isEdit && medicine?.id) {
        // Edit existing medicine
        await db.medicines.update(medicine.id, medicinePayload);
        savedId = medicine.id;
      } else {
        // Create new canonical medicine master
        savedId = (await db.medicines.add({
          ...medicinePayload,
          createdAt: now,
        } as Medicine)) as number;
      }

      onSaved(savedId);
      onClose();
    } catch (err) {
      console.error('Failed to save medicine master:', err);
      alert('Failed to save medicine master. Please verify all required fields and try again.');
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
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        background: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
      }}
    >
      <div
        className="medicine-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: 'var(--radius-xl, 16px)',
          width: '100%',
          maxWidth: '780px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="medicine-modal-header"
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--color-surface-container, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-surface-container-lowest, #ffffff)',
          }}
        >
          <div>
            <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-primary, #00685f)' }}>
              {isEdit ? 'Update Medicine Master' : 'Medicine Master Formulation'}
            </div>
            <h2 className="medicine-modal-title" id="medicine-modal-title" style={{ margin: '2px 0 0 0', fontSize: '18px', fontWeight: 700, color: 'var(--color-on-surface, #0f172a)' }}>
              {isEdit ? 'Edit Medicine Master' : 'Add New Medicine'}
            </h2>
          </div>
          <button
            type="button"
            className="medicine-modal-close btn btn-ghost btn-icon btn-sm"
            onClick={onClose}
            aria-label="Close dialog"
            style={{ borderRadius: '50%', color: 'var(--color-outline, #64748b)' }}
          >
            <Icon name="x-mark" size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} id="medicine-master-form" style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div
            className="medicine-modal-body"
            style={{
              padding: '20px 24px',
              overflowY: 'auto',
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: 'var(--color-surface-container-low, #f8fafc)',
            }}
          >
            {/* Duplicate Medicine Warning Banner (Section 41) */}
            {duplicateMatch && !duplicateBypassed && (
              <div
                className="medicine-duplicate-alert medicine-duplicate-banner"
                style={{
                  background: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <Icon name="exclamation-triangle" size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <h5 style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#92400e' }}>
                      A similar medicine already exists in the formulary.
                    </h5>
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#b45309' }}>
                      <strong>{duplicateMatch.brandName}</strong>
                      {duplicateMatch.genericName ? ` (${duplicateMatch.genericName})` : ''}
                      {duplicateMatch.presentation ? ` • ${duplicateMatch.presentation}` : ''}
                      {duplicateMatch.strength ? ` • ${duplicateMatch.strength}` : ''}
                      {duplicateMatch.packSize ? ` • Pack: ${duplicateMatch.packSize}` : ''}
                    </p>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignSelf: 'flex-end', marginTop: '2px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '11.5px', height: '28px', background: '#ffffff', borderColor: '#d97706', color: '#92400e' }}
                    onClick={() => handleUseExisting(duplicateMatch.id)}
                  >
                    Use Existing Medicine
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: '11.5px', height: '28px', color: '#64748b' }}
                    onClick={() => setDuplicateBypassed(true)}
                  >
                    Create Anyway
                  </button>
                </div>
              </div>
            )}

            {/* Authoritative Single Formulation Component */}
            <MedicineFormulationSection
              values={formulationValues}
              onChange={handleFormulationChange}
              errors={errors}
              autoFocus={!isEdit}
              idPrefix="med"
              layout="modal"
              showHints={true}
            />

            {/* Additional Master Data: Category & Guidelines */}
            <div style={{ background: '#ffffff', padding: '16px', borderRadius: 'var(--radius-lg, 10px)', border: '1px solid var(--color-surface-container, #e2e8f0)' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '12px', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--color-outline, #64748b)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Icon name="folder" size={14} />
                <span>Therapeutic Category &amp; Guidelines</span>
              </h4>

              <div className="medicine-form-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
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

                <div className="medicine-form-group full-width" style={{ gridColumn: '1 / -1' }}>
                  <label className="medicine-form-label" htmlFor="med-notes">
                    Clinical Notes / Prescribing Guidelines
                  </label>
                  <textarea
                    id="med-notes"
                    className="medicine-form-textarea"
                    rows={2}
                    placeholder="e.g. Broad-spectrum antimicrobial. Safe in pregnant animals. Protect from light."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    style={{ width: '100%', resize: 'vertical' }}
                  />
                  <span className="medicine-form-hint">
                    General drug guidelines (patient-specific advice belongs on the prescription).
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            className="medicine-modal-footer"
            style={{
              padding: '16px 24px',
              borderTop: '1px solid var(--color-surface-container, #e2e8f0)',
              background: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              id="med-cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>

            <button
              type="submit"
              className="btn btn-primary"
              id="med-save-btn"
              disabled={isSubmitting}
              style={{ minWidth: '160px', gap: '8px', fontWeight: 600 }}
            >
              <Icon name="check" size={16} />
              <span>
                {isSubmitting
                  ? 'Saving...'
                  : isFromPrescription
                  ? 'Save & Use in Prescription'
                  : 'Save Medicine'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
