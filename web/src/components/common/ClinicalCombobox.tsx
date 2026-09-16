// =============================================================
// VetRx — ClinicalCombobox.tsx
// Accessible autocomplete/combobox for Symptoms & Diagnosis
// Practice-scoped, case-insensitive, keyboard-navigable
// =============================================================

import React, { useState, useRef, useEffect, useId } from 'react';
import { Icon } from '../ui/Icon';
import './ClinicalCombobox.css';

export interface ClinicalComboboxProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  required?: boolean;
  error?: string;
  isTextarea?: boolean;
  rows?: number;
  iconName?: string;
  helperText?: string;
  id?: string;
}

export const ClinicalCombobox: React.FC<ClinicalComboboxProps> = ({
  label,
  value,
  onChange,
  suggestions,
  placeholder,
  required = false,
  error,
  isTextarea = false,
  rows = 3,
  iconName,
  helperText,
  id,
}) => {
  const generatedId = useId();
  const inputId = id || `combobox-${generatedId}`;
  const listboxId = `listbox-${generatedId}`;

  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Extract the current token being typed if user is entering comma/semicolon separated items
  const getCurrentQuery = (): string => {
    if (!isTextarea) return value.trim();
    // For multiline/multi-value textarea, match the last segment
    const parts = value.split(/[\n,;]+/);
    return (parts[parts.length - 1] || '').trim();
  };

  const currentQuery = getCurrentQuery().toLowerCase();

  // Filter suggestions: prefix matches first, then contains matches
  const filteredSuggestions = React.useMemo(() => {
    if (!suggestions || suggestions.length === 0) return [];
    const unique = Array.from(new Set(suggestions.map((s) => s.trim()))).filter(Boolean);

    if (!currentQuery) {
      return unique.slice(0, 8);
    }

    const prefixMatches: string[] = [];
    const containsMatches: string[] = [];

    for (const item of unique) {
      const lower = item.toLowerCase();
      if (lower.startsWith(currentQuery)) {
        prefixMatches.push(item);
      } else if (lower.includes(currentQuery)) {
        containsMatches.push(item);
      }
    }

    return [...prefixMatches, ...containsMatches].slice(0, 8);
  }, [suggestions, currentQuery]);

  // Handle clicking outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelectSuggestion = (suggestion: string) => {
    if (isTextarea) {
      // Append or replace the last typed token
      const parts = value.split(/([\n,;]+)/);
      if (parts.length > 0) {
        // replace the last text part
        let lastTextIdx = parts.length - 1;
        while (lastTextIdx >= 0 && /^[\n,;\s]+$/.test(parts[lastTextIdx])) {
          lastTextIdx--;
        }
        if (lastTextIdx >= 0) {
          parts[lastTextIdx] = suggestion;
        } else {
          parts.push(suggestion);
        }
        onChange(parts.join(''));
      } else {
        onChange(suggestion);
      }
    } else {
      onChange(suggestion);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || filteredSuggestions.length === 0) {
      if (e.key === 'ArrowDown' && filteredSuggestions.length > 0) {
        setIsOpen(true);
        setHighlightedIndex(0);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev < filteredSuggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredSuggestions.length - 1));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
        e.preventDefault();
        handleSelectSuggestion(filteredSuggestions[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div className="clinical-combobox-wrapper" ref={containerRef}>
      <label className="form-label" htmlFor={inputId}>
        {label} {required && <span className="text-error">*</span>}
      </label>

      <div className="clinical-combobox-input-wrap">
        {iconName && (
          <div className="clinical-combobox-icon">
            <Icon name={iconName} size={18} />
          </div>
        )}

        {isTextarea ? (
          <textarea
            id={inputId}
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            rows={rows}
            className={`form-input clinical-combobox-field ${iconName ? 'with-icon' : ''} ${error ? 'rx-input-error' : ''}`}
            placeholder={placeholder}
            value={value}
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls={isOpen ? listboxId : undefined}
            aria-haspopup="listbox"
            onChange={(e) => {
              onChange(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (filteredSuggestions.length > 0) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
          />
        ) : (
          <input
            id={inputId}
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            className={`form-input clinical-combobox-field ${iconName ? 'with-icon' : ''} ${error ? 'rx-input-error' : ''}`}
            placeholder={placeholder}
            value={value}
            aria-autocomplete="list"
            aria-expanded={isOpen}
            aria-controls={isOpen ? listboxId : undefined}
            aria-haspopup="listbox"
            onChange={(e) => {
              onChange(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => {
              if (filteredSuggestions.length > 0) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
          />
        )}
      </div>

      {/* Suggestion Listbox */}
      {isOpen && filteredSuggestions.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={`${label} suggestions`}
          className="clinical-combobox-listbox"
        >
          {filteredSuggestions.map((sugg, idx) => (
            <li
              key={`combobox-opt-${idx}-${sugg}`}
              role="option"
              aria-selected={highlightedIndex === idx}
              className={`clinical-combobox-option ${highlightedIndex === idx ? 'highlighted' : ''}`}
              onMouseEnter={() => setHighlightedIndex(idx)}
              onClick={() => handleSelectSuggestion(sugg)}
            >
              <Icon name="sparkles" size={13} className="clinical-combobox-opt-icon" />
              <span>{sugg}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Quick click pills below input */}
      {filteredSuggestions.length > 0 && !isOpen && (
        <div className="clinical-combobox-quick-pills">
          <span className="clinical-combobox-quick-label">Suggestions:</span>
          {filteredSuggestions.slice(0, 5).map((sugg, idx) => (
            <button
              key={`quick-pill-${idx}-${sugg}`}
              type="button"
              className="btn btn-secondary btn-sm clinical-combobox-pill"
              onClick={() => handleSelectSuggestion(sugg)}
            >
              + {sugg}
            </button>
          ))}
        </div>
      )}

      {helperText && !error && (
        <span className="clinical-combobox-hint">{helperText}</span>
      )}

      {error && (
        <div className="rx-field-error" role="alert">
          <Icon name="warning" size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
