// =============================================================
// VetRx — DoseCalcNumericField.tsx
// Shared robust numeric field component for Dose Calculator
// =============================================================

import React from 'react';
import './DoseCalcNumericField.css';

export interface DoseCalcNumericFieldProps {
  id?: string;
  label?: string;
  required?: boolean;
  value: number | string | undefined | null;
  onChange: (value: string) => void;
  placeholder?: string;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  unit?: string; // Static unit badge (e.g. "kg", "drops", "drops/mL")
  unitOptions?: string[]; // Dropdown unit options (e.g. ["tablet", "vial", "mL"])
  selectedUnit?: string;
  onUnitChange?: (unit: string) => void;
  className?: string;
  inputClassName?: string;
  hint?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  title?: string;
}

export const DoseCalcNumericField: React.FC<DoseCalcNumericFieldProps> = ({
  id,
  label,
  required = false,
  value,
  onChange,
  placeholder,
  min,
  max,
  step = 'any',
  unit,
  unitOptions,
  selectedUnit,
  onUnitChange,
  className = '',
  inputClassName = '',
  hint,
  disabled = false,
  autoFocus = false,
  title,
}) => {
  // Safe normalization: preserve empty editing state, preserve zero, never falsy-coerce to ''
  const displayValue = value === null || value === undefined ? '' : String(value);

  const inputId =
    id ||
    (label ? `calc-field-${label.toLowerCase().replace(/[^a-z0-9]/g, '-')}` : undefined);

  return (
    <div className={`rx-numeric-field-group ${className}`.trim()}>
      {label && (
        <label htmlFor={inputId} className="rx-numeric-field-label" title={title || label}>
          {label}
          {required && <span className="rx-numeric-required">*</span>}
        </label>
      )}

      <div className="rx-numeric-control-container">
        <div className="rx-numeric-input-wrapper">
          <input
            id={inputId}
            type="number"
            className={`rx-numeric-input ${inputClassName}`.trim()}
            value={displayValue}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            autoFocus={autoFocus}
          />
        </div>

        {unitOptions && unitOptions.length > 0 && onUnitChange ? (
          <div className="rx-numeric-unit-select-wrapper">
            <select
              className="rx-numeric-unit-select"
              value={selectedUnit}
              onChange={(e) => onUnitChange(e.target.value)}
              disabled={disabled}
              aria-label={label ? `${label} unit` : 'Unit'}
            >
              {unitOptions.map((u, idx) => (
                <option key={`unit-opt-${u}-${idx}`} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        ) : unit ? (
          <span className="rx-numeric-unit-badge">{unit}</span>
        ) : null}
      </div>

      {hint && <span className="rx-numeric-field-hint">{hint}</span>}
    </div>
  );
};
