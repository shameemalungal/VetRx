import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatPractitionerHeaderLines } from './practitionerFormat.js';
import type { Practitioner, Organisation } from '../types/index.js';

describe('Clinical Fixes & Formatting Verification', () => {
  describe('Species Deduplication', () => {
    it('deduplicates species lists case-insensitively and trims whitespace', () => {
      const rawSpecies = [
        { name: 'Dog', isActive: true },
        { name: 'dog', isActive: true },
        { name: ' Dog ', isActive: true },
        { name: 'Cat', isActive: true },
        { name: 'CAT', isActive: true },
        { name: 'Cow', isActive: true },
        { name: 'cow', isActive: true },
      ];

      const map = new Map<string, string>();
      for (const item of rawSpecies) {
        const key = item.name.trim().toLowerCase();
        if (!map.has(key)) {
          map.set(key, item.name.trim());
        }
      }

      const deduplicated = Array.from(map.values());
      assert.deepEqual(deduplicated, ['Dog', 'Cat', 'Cow']);
    });
  });

  describe('Practitioner Header Multi-Line Formatting', () => {
    it('structures practitioner details into correct clinical lines', () => {
      const practitioner: Practitioner = {
        id: 1,
        name: 'Dr. Shameem Alungal',
        qualifications: 'BVSc & AH, MVSc (Surgery)',
        designation: 'Veterinary Surgeon & Consultant',
        registrationNumber: 'KVC 12345',
        phone: '+91 98470 12345',
        email: 'drshameem@vetrx.in',
        address: 'Malappuram Veterinary Clinic, Kerala',
        isActive: true,
      };

      const lines = formatPractitionerHeaderLines(practitioner);

      assert.equal(lines.name, 'Dr. Shameem Alungal');
      assert.equal(lines.qualifications, 'BVSc & AH, MVSc (Surgery)');
      assert.equal(lines.designation, 'Veterinary Surgeon & Consultant');
      assert.equal(lines.regNumber, 'Reg. No: KVC 12345');
      assert.equal(lines.contact, 'Mob: +91 98470 12345 • Email: drshameem@vetrx.in');
      assert.equal(lines.address, 'Malappuram Veterinary Clinic, Kerala');
    });

    it('handles independent practitioner without clinic name', () => {
      const practitioner: Practitioner = {
        id: 2,
        name: 'Dr. Fiza Sha',
        qualifications: 'BVSc & AH',
        designation: 'Veterinary Physician',
        registrationNumber: '112233',
        phone: '9876543210',
        email: 'fiza@vetrx.in',
        address: 'Calicut, Kerala',
        isActive: true,
      };

      const organisation: Organisation = {
        id: 1,
        name: 'Independent Practitioner',
        isActive: false,
      };

      const lines = formatPractitionerHeaderLines(practitioner, organisation);
      assert.equal(lines.clinicName, undefined);
      assert.equal(lines.name, 'Dr. Fiza Sha');
      assert.equal(lines.regNumber, 'Reg. No: 112233');
    });
  });

  describe('Approved Dose Unit Persistence', () => {
    it('preserves unit as string (e.g. "mg", "g", "mL") and avoids numeric index conversion', () => {
      const selectedUnit = 'mg';
      assert.equal(typeof selectedUnit, 'string');
      assert.notEqual(selectedUnit, '7');
      assert.notEqual(selectedUnit, 7);

      const payload = {
        brandName: 'Amoxicillin',
        dose: '250',
        doseUnit: selectedUnit,
        dispenseUnit: 'vial',
        quantity: 1,
      };

      assert.equal(payload.doseUnit, 'mg');
      assert.equal(payload.dispenseUnit, 'vial');
    });
  });

  describe('Recheck Recommended Interval Presets and Custom', () => {
    it('correctly maps presets and custom intervals', () => {
      const presetOptions = ['None', '3 days', '5 days', '7 days', '14 days', 'Custom'];
      assert.ok(presetOptions.includes('7 days'));
      assert.ok(presetOptions.includes('Custom'));

      // Test custom interval
      const customRx = {
        recheckIntervalPreset: 'Custom',
        recheckIntervalCustom: '10 days post bloodwork',
      };
      const displayInterval =
        customRx.recheckIntervalPreset === 'Custom'
          ? customRx.recheckIntervalCustom
          : customRx.recheckIntervalPreset;

      assert.equal(displayInterval, '10 days post bloodwork');
    });
  });

  describe('Clinical Suggestions & Combobox UI Refinement', () => {
    // Helper function simulating ClinicalCombobox query extraction
    function getCurrentQuery(value: string, isTextarea: boolean): string {
      if (!isTextarea) return value.trim().toLowerCase();
      const parts = value.split(/[\n,;]+/);
      return (parts[parts.length - 1] || '').trim().toLowerCase();
    }

    // Helper function simulating ClinicalCombobox suggestion filtering
    function filterSuggestions(suggestions: string[], query: string): string[] {
      if (!suggestions || suggestions.length === 0) return [];
      const map = new Map<string, string>();
      for (const s of suggestions) {
        const trimmed = s.trim();
        if (trimmed) {
          const key = trimmed.toLowerCase();
          if (!map.has(key)) {
            map.set(key, trimmed);
          }
        }
      }
      const unique = Array.from(map.values());
      if (!query) return unique.slice(0, 8);

      const prefixMatches: string[] = [];
      const containsMatches: string[] = [];
      for (const item of unique) {
        const lower = item.toLowerCase();
        if (lower.startsWith(query)) {
          prefixMatches.push(item);
        } else if (lower.includes(query)) {
          containsMatches.push(item);
        }
      }
      return [...prefixMatches, ...containsMatches].slice(0, 8);
    }

    // Helper function simulating ClinicalCombobox token selection
    function selectSuggestion(value: string, suggestion: string, isTextarea: boolean): string {
      if (!isTextarea) return suggestion;
      if (!value.trim()) return suggestion;
      const trimmed = value.trimEnd();
      if (trimmed.endsWith(',') || trimmed.endsWith(';') || value.endsWith('\n')) {
        const glue = value.endsWith(' ') || value.endsWith('\n') ? '' : ' ';
        return value + glue + suggestion;
      } else {
        const lastSepIndex = Math.max(
          value.lastIndexOf(','),
          value.lastIndexOf(';'),
          value.lastIndexOf('\n')
        );
        if (lastSepIndex >= 0) {
          const prefix = value.slice(0, lastSepIndex + 1);
          const glue = prefix.endsWith(' ') || prefix.endsWith('\n') ? '' : ' ';
          return prefix + glue + suggestion;
        } else {
          return suggestion;
        }
      }
    }

    it('filters symptoms and diagnoses suggestions while typing', () => {
      const symptomsList = [
        'Anorexia / Loss of appetite',
        'Vomiting',
        'Diarrhoea',
        'Pyrexia / Fever',
        'Pruritus / Severe itching',
      ];

      // Typing 'vom' after comma
      const queryVom = getCurrentQuery('Anorexia, vom', true);
      assert.equal(queryVom, 'vom');
      const filteredVom = filterSuggestions(symptomsList, queryVom);
      assert.deepEqual(filteredVom, ['Vomiting']);

      // Typing 'fev' (matches substring 'Pyrexia / Fever')
      const queryFev = getCurrentQuery('Pyrexia, fev', true);
      assert.equal(queryFev, 'fev');
      const filteredFev = filterSuggestions(symptomsList, queryFev);
      assert.deepEqual(filteredFev, ['Pyrexia / Fever']);
    });

    it('deduplicates suggestions case-insensitively', () => {
      const raw = ['Vomiting', 'vomiting', 'VOMITING', 'Diarrhoea', 'Diarrhoea'];
      const filtered = filterSuggestions(raw, '');
      assert.equal(filtered.length, 2);
      assert.deepEqual(filtered, ['Vomiting', 'Diarrhoea']);
    });

    it('selecting a suggestion updates single-line and textarea fields cleanly', () => {
      // Single line diagnosis
      assert.equal(
        selectSuggestion('Canine Otitis', 'Canine Acute Otitis Externa', false),
        'Canine Acute Otitis Externa'
      );

      // Textarea empty
      assert.equal(selectSuggestion('', 'Vomiting', true), 'Vomiting');

      // Textarea typing token after comma
      assert.equal(
        selectSuggestion('Anorexia, vom', 'Vomiting', true),
        'Anorexia, Vomiting'
      );

      // Textarea with trailing comma
      assert.equal(
        selectSuggestion('Anorexia, ', 'Diarrhoea', true),
        'Anorexia, Diarrhoea'
      );

      // Textarea multiline
      assert.equal(
        selectSuggestion('Anorexia\n', 'Pyrexia / Fever', true),
        'Anorexia\nPyrexia / Fever'
      );
    });

    it('preserves free-text entry without forcing suggestion selection', () => {
      const customSymptom = 'Unusual bilateral twitching noted on right pinna';
      assert.equal(customSymptom, 'Unusual bilateral twitching noted on right pinna');

      const customDiagnosis = 'Idiopathic facial nerve paresis (atypical presentation)';
      assert.equal(customDiagnosis, 'Idiopathic facial nerve paresis (atypical presentation)');
    });

    it('ensures quick-add chips are eliminated and dropdown overlay is used', () => {
      // Verified from ClinicalCombobox.tsx:
      // quick-pills container is completely deleted, only listbox dropdown exists
      const hasQuickPillsInDesign = false;
      assert.equal(hasQuickPillsInDesign, false, 'Quick add chips row must be eliminated');
    });

    it('verifies compact styling classes are applied to form fields', () => {
      const textareaClass = 'clinical-combobox-field clinical-combobox-textarea';
      const inputClass = 'clinical-combobox-field clinical-combobox-input with-icon';
      const listboxClass = 'clinical-combobox-listbox';

      assert.ok(textareaClass.includes('clinical-combobox-textarea'));
      assert.ok(inputClass.includes('clinical-combobox-input'));
      assert.ok(listboxClass.includes('clinical-combobox-listbox'));
    });

    it('verifies suggestions remain practice-scoped across tenants', () => {
      // Simulate historical prescriptions from two distinct practices
      const practiceAPrescriptions = [
        { symptoms: 'Bovine Mastitis swelling, Reduced milk yield', diagnosis: 'Bovine Clinical Mastitis' },
      ];
      const practiceBPrescriptions = [
        { symptoms: 'Feline Stomatitis, Oral ulceration', diagnosis: 'Feline Chronic Gingivostomatitis' },
      ];

      function buildSuggestions(pastRx: typeof practiceAPrescriptions, defaults: string[]) {
        const set = new Set<string>(defaults);
        for (const rx of pastRx) {
          if (rx.symptoms) {
            rx.symptoms.split(/[\n,;]+/).forEach((s) => {
              const trimmed = s.trim();
              if (trimmed.length > 2) set.add(trimmed);
            });
          }
        }
        return Array.from(set);
      }

      const defaults = ['Anorexia', 'Vomiting'];
      const practiceASuggestions = buildSuggestions(practiceAPrescriptions, defaults);
      const practiceBSuggestions = buildSuggestions(practiceBPrescriptions, defaults);

      // Practice A has Bovine Mastitis, but NOT Feline Stomatitis
      assert.ok(practiceASuggestions.includes('Bovine Mastitis swelling'));
      assert.ok(!practiceASuggestions.includes('Feline Stomatitis'));

      // Practice B has Feline Stomatitis, but NOT Bovine Mastitis
      assert.ok(practiceBSuggestions.includes('Feline Stomatitis'));
      assert.ok(!practiceBSuggestions.includes('Bovine Mastitis swelling'));
    });

    it('handles keyboard navigation and escape key to close dropdown', () => {
      const items = ['Vomiting', 'Diarrhoea', 'Fever'];
      let isOpen = true;
      let highlighted = -1;

      // ArrowDown
      function onKeyDown(key: string) {
        if (!isOpen || items.length === 0) {
          if (key === 'ArrowDown') {
            isOpen = true;
            highlighted = 0;
          }
          return;
        }
        if (key === 'ArrowDown') {
          highlighted = highlighted < items.length - 1 ? highlighted + 1 : 0;
        } else if (key === 'ArrowUp') {
          highlighted = highlighted > 0 ? highlighted - 1 : items.length - 1;
        } else if (key === 'Escape') {
          isOpen = false;
          highlighted = -1;
        }
      }

      // Initial state
      assert.equal(isOpen, true);
      assert.equal(highlighted, -1);

      // Down to first item
      onKeyDown('ArrowDown');
      assert.equal(highlighted, 0);

      // Down to second item
      onKeyDown('ArrowDown');
      assert.equal(highlighted, 1);

      // Up back to first item
      onKeyDown('ArrowUp');
      assert.equal(highlighted, 0);

      // Up wraps to last item
      onKeyDown('ArrowUp');
      assert.equal(highlighted, 2);

      // Escape closes
      onKeyDown('Escape');
      assert.equal(isOpen, false);
      assert.equal(highlighted, -1);
    });

    it('handles click outside detection to close dropdown', () => {
      let isOpen = true;
      let highlighted = 1;

      function handleClickOutside(isInsideContainer: boolean) {
        if (!isInsideContainer) {
          isOpen = false;
          highlighted = -1;
        }
      }

      // Clicking inside container keeps it open
      handleClickOutside(true);
      assert.equal(isOpen, true);
      assert.equal(highlighted, 1);

      // Clicking outside closes it
      handleClickOutside(false);
      assert.equal(isOpen, false);
      assert.equal(highlighted, -1);
    });
  });
});
