// =============================================================
// VetRx — Shared Medicine Form / Formulation Section
// Authoritative single source of truth for medicine formulation fields
// Reused across:
//   1. Medicines Module → Add / Edit Medicine (MedicineFormModal)
//   2. Prescription Module → Add Medicine (PrescriptionBuilderPage)
// =============================================================

import React from 'react';
import { Icon } from '../../components/ui/Icon';

export interface MedicineFormulationValues {
  brandName: string;
  genericName?: string;
  presentation: string;
  packSize?: string;
  strength?: string;
}

export const COMMON_PRESENTATIONS = [
  'Tablet',
  'Ear Drops',
  'Eye Drops',
  'Syrup',
  'Injection',
  'Vial',
  'Tube',
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

export interface MedicineFormulationSectionProps {
  values: MedicineFormulationValues;
  onChange?: (field: keyof MedicineFormulationValues, value: string) => void;
  errors?: {
    brandName?: string;
    presentation?: string;
  };
  readOnly?: boolean;
  autoFocus?: boolean;
  idPrefix?: string;
  layout?: 'modal' | 'embedded';
  showHints?: boolean;
  // Prescription-specific header & banner controls
  isFromFormulary?: boolean;
  onEditInFormulary?: () => void;
  onCreateInFormulary?: () => void;
  showFormularyStatus?: boolean;
  containerStyle?: React.CSSProperties;
}

export function MedicineFormulationSection({
  values,
  onChange,
  errors = {},
  readOnly = false,
  autoFocus = false,
  idPrefix = 'med',
  layout = 'modal',
  showHints = true,
  isFromFormulary = false,
  onEditInFormulary,
  onCreateInFormulary,
  showFormularyStatus = false,
  containerStyle,
}: MedicineFormulationSectionProps) {
  const isModalLayout = layout === 'modal';

  // Ensure current presentation is present in dropdown options even if custom
  const presentationOptions = React.useMemo(() => {
    const list = [...COMMON_PRESENTATIONS];
    if (values.presentation && !list.includes(values.presentation)) {
      list.splice(list.length - 1, 0, values.presentation);
    }
    return list;
  }, [values.presentation]);

  const gridContent = (
    <div className="medicine-form-grid">
      {/* 1. Brand Name */}
      <div className={`medicine-form-group ${isModalLayout ? 'full-width' : ''}`}>
        <label className="medicine-form-label" htmlFor={`${idPrefix}-brand-name`}>
          Brand Name {!readOnly && <span className="required">*</span>}
        </label>
        <input
          id={`${idPrefix}-brand-name`}
          type="text"
          className={`medicine-form-input ${errors.brandName ? 'error' : ''}`}
          placeholder={readOnly ? 'Select or search medicine' : 'e.g. Amoxicillin 500mg, Posatex Otic Drops 15ml'}
          value={values.brandName}
          readOnly={readOnly}
          onChange={(e) => onChange?.('brandName', e.target.value)}
          autoFocus={autoFocus && !readOnly}
          style={readOnly ? { background: 'var(--color-surface-container-lowest, #ffffff)', fontWeight: 600 } : undefined}
        />
        {errors.brandName && (
          <span className="medicine-form-error-msg">{errors.brandName}</span>
        )}
      </div>

      {/* 2. Chemical / Formulation */}
      <div className={`medicine-form-group ${isModalLayout ? 'full-width' : ''}`}>
        <label className="medicine-form-label" htmlFor={`${idPrefix}-chemical-formulation`}>
          Chemical / Formulation
        </label>
        <input
          id={`${idPrefix}-chemical-formulation`}
          type="text"
          className="medicine-form-input"
          placeholder="e.g. Amoxicillin Trihydrate, Orbifloxacin / Mometasone"
          value={values.genericName || ''}
          readOnly={readOnly}
          onChange={(e) => onChange?.('genericName', e.target.value)}
          style={readOnly ? { background: 'var(--color-surface-container-lowest, #ffffff)' } : undefined}
        />
        {showHints && !readOnly && (
          <span className="medicine-form-hint">
            Displays on prescriptions for drug substitution and pharmacy guidance.
          </span>
        )}
      </div>

      {/* 3. Strength / Concentration */}
      <div className="medicine-form-group">
        <label className="medicine-form-label" htmlFor={`${idPrefix}-strength`}>
          Strength / Concentration
        </label>
        <input
          id={`${idPrefix}-strength`}
          type="text"
          className="medicine-form-input"
          placeholder="e.g. 125 mg/tablet, 5 mg/mL, 500 mg"
          value={values.strength || ''}
          readOnly={readOnly}
          onChange={(e) => onChange?.('strength', e.target.value)}
          style={readOnly ? { background: 'var(--color-surface-container-lowest, #ffffff)', fontWeight: 600, color: 'var(--color-primary)' } : undefined}
        />
        {showHints && !readOnly && (
          <span className="medicine-form-hint">
            Active ingredient potency (e.g. 5 mg/mL, 125 mg/tablet)
          </span>
        )}
      </div>

      {/* 4. Presentation / Form */}
      <div className="medicine-form-group">
        <label className="medicine-form-label" htmlFor={`${idPrefix}-presentation`}>
          Presentation / Form {!readOnly && <span className="required">*</span>}
        </label>
        {readOnly ? (
          <input
            id={`${idPrefix}-presentation`}
            type="text"
            className="medicine-form-input"
            placeholder="e.g. Tablet, Syrup, Injection"
            value={values.presentation}
            readOnly
            style={{ background: 'var(--color-surface-container-lowest, #ffffff)' }}
          />
        ) : (
          <select
            id={`${idPrefix}-presentation`}
            className={`medicine-form-select ${errors.presentation ? 'error' : ''}`}
            value={values.presentation}
            onChange={(e) => onChange?.('presentation', e.target.value)}
          >
            {presentationOptions.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
        {errors.presentation && (
          <span className="medicine-form-error-msg">{errors.presentation}</span>
        )}
      </div>

      {/* 5. Presentation / Pack Size */}
      <div className="medicine-form-group">
        <label className="medicine-form-label" htmlFor={`${idPrefix}-pack-size`}>
          Presentation / Pack Size
        </label>
        <input
          id={`${idPrefix}-pack-size`}
          type="text"
          className="medicine-form-input"
          placeholder="e.g. 10 tablets/strip, 30 mL bottle, 2 mL vial"
          value={values.packSize || ''}
          readOnly={readOnly}
          onChange={(e) => onChange?.('packSize', e.target.value)}
          style={readOnly ? { background: 'var(--color-surface-container-lowest, #ffffff)' } : undefined}
        />
        {showHints && !readOnly && (
          <span className="medicine-form-hint">
            Commercial container or strip size (e.g. 30 mL bottle, 10 tablets/strip)
          </span>
        )}
      </div>
    </div>
  );

  // If embedded in Prescription with formulary header and banner controls
  if (showFormularyStatus) {
    return (
      <div
        className="medicine-form-section"
        style={{
          background: 'var(--color-surface-container-low, #f8fafc)',
          border: '1px solid var(--color-surface-container, #e2e8f0)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '16px',
          marginBottom: '16px',
          ...containerStyle,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--color-outline)' }}>
              Medicine Formulation
            </span>
            {isFromFormulary && (
              <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--color-primary)', background: 'rgba(0,104,95,0.08)', padding: '2px 8px', borderRadius: '999px', letterSpacing: '0.03em' }}>
                From Formulary
              </span>
            )}
          </div>
          {isFromFormulary && onEditInFormulary && (
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-primary)',
                fontSize: '11.5px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '2px 4px',
                textDecoration: 'underline',
              }}
              onClick={onEditInFormulary}
            >
              Edit in Formulary →
            </button>
          )}
        </div>

        {gridContent}

        {!isFromFormulary && values.brandName?.trim() && onCreateInFormulary && (
          <div
            style={{
              marginTop: '12px',
              padding: '8px 12px',
              background: 'rgba(234, 179, 8, 0.08)',
              border: '1px solid rgba(234, 179, 8, 0.25)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Icon name="information-circle" size={14} style={{ color: '#b45309', flexShrink: 0 }} />
              <span style={{ fontSize: '11.5px', color: '#92400e', lineHeight: 1.4 }}>
                This medicine is not linked to an existing formulary entry.
              </span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ height: '24px', fontSize: '11px', padding: '0 8px' }}
              onClick={onCreateInFormulary}
            >
              Create in Formulary
            </button>
          </div>
        )}
      </div>
    );
  }

  return gridContent;
}

export const SharedMedicineForm = MedicineFormulationSection;
