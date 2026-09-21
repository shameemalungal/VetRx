// =============================================================
// VetRx — PrescriptionBuilderPage.tsx
// Phase 3: New / Edit Prescription Builder
// Follows Stitch references:
// - vetrx_select_animal_wireframe_flow (Step 1)
// - vetrx_new_prescription_clinical_details_desktop (Step 2 & 3)
// =============================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type {
  Owner,
  Medicine,
  TreatmentPackage,
  DosingMethod,
  WeightBandRule,
  PrescriptionWorkflowHistoryItem,
} from '../../types';
import { DOSING_METHOD_OPTIONS } from '../../types';
import { useSettingsStore } from '../../store/settingsStore';
import { useAuth } from '../../context/AuthContext';
import { Icon } from '../../components/ui/Icon';
import { formatAnimalSubtitle, formatOwnerPrimary } from '../../utils/patientFormat';

const API_BASE = import.meta.env.VITE_API_URL || (window.location.port === '5173' ? 'http://localhost:4000' : '');
import {
  calculateSmartDose,
  validateDoseRange,
  getDosesPerDay,
} from '../../utils/doseCalculator';
import './Prescriptions.css';
import { DoseCalcNumericField } from '../../components/ui/DoseCalcNumericField';
import { ClinicalCombobox } from '../../components/common/ClinicalCombobox';
import { DISPENSE_UNITS, convertUnits } from '../../utils/unitConverter';

function extractNumericDose(val?: string | number): string {
  if (val === undefined || val === null) return '1';
  if (typeof val === 'number') return String(val);
  const trimmed = String(val).trim();
  const match = trimmed.match(/^([0-9]+(?:\.[0-9]+)?)/);
  return match ? match[1] : (trimmed || '1');
}

function extractDoseUnit(val?: string): string | undefined {
  if (!val) return undefined;
  const trimmed = val.trim();
  const match = trimmed.match(/^[0-9]+(?:\.[0-9]+)?\s*(.+)$/);
  return match ? match[1].trim() : undefined;
}

interface PrescriptionBuilderPageProps {
  mode: 'new' | 'edit';
}

interface DraftItem {
  id?: number;
  medicineId?: number;
  brandName: string;
  genericName?: string;
  presentation: string;
  strengthVolume?: string;
  dose?: string; // Veterinarian-approved numeric dose value (e.g. "1", "240")
  doseUnit?: string; // Clinical dose unit (e.g. "mg", "g", "mL", "mg/kg")
  quantity: number; // Dispense quantity
  unit: string; // Dispense unit (e.g. "tablet", "vial", "bottle")
  dispenseUnit?: string;
  frequency: string;
  durationDays?: number;
  route?: string;
  directions?: string;
}

export const PrescriptionBuilderPage: React.FC<PrescriptionBuilderPageProps> = ({
  mode,
}) => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const preselectedPatientId = searchParams.get('patientId')
    ? parseInt(searchParams.get('patientId')!, 10)
    : null;
  const cloneFromRxId = searchParams.get('cloneFrom')
    ? parseInt(searchParams.get('cloneFrom')!, 10)
    : null;
  const packageIdParam = searchParams.get('packageId')
    ? parseInt(searchParams.get('packageId')!, 10)
    : null;

  const { practitioner } = useSettingsStore();
  const { user, can, hasRole } = useAuth();
  const canApprove = can('PRESCRIPTION_APPROVE') || hasRole('VETERINARIAN');

  // Forwarding & Clinical Approval states
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardToUserId, setForwardToUserId] = useState('');
  const [forwardRemarks, setForwardRemarks] = useState('');
  const [approvalRemarks, setApprovalRemarks] = useState('');
  const [eligibleClinicians, setEligibleClinicians] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [loadingClinicians, setLoadingClinicians] = useState(false);

  // ── Database Queries ──────────────────────────────────────────
  const allPatients = useLiveQuery(() => db.patients.toArray(), []);
  const allOwners = useLiveQuery(() => db.owners.toArray(), []);
  const availableMedicines = useLiveQuery(
    () => db.medicines.filter((m) => m.isActive !== false).toArray(),
    []
  );
  const treatmentPackages = useLiveQuery(() => db.treatmentPackages.toArray(), []);

  // For Edit Mode
  const existingRx = useLiveQuery(
    () => (mode === 'edit' && id ? db.prescriptions.get(parseInt(id, 10)) : undefined),
    [mode, id]
  );
  const existingRxItems = useLiveQuery(
    () =>
      mode === 'edit' && id
        ? db.prescriptionItems.where('prescriptionId').equals(parseInt(id, 10)).sortBy('sortOrder')
        : [],
    [mode, id]
  );

  // For Clone / Reuse mode
  const clonedRx = useLiveQuery(
    () => (cloneFromRxId ? db.prescriptions.get(cloneFromRxId) : undefined),
    [cloneFromRxId]
  );
  const clonedRxItems = useLiveQuery(
    () =>
      cloneFromRxId
        ? db.prescriptionItems.where('prescriptionId').equals(cloneFromRxId).sortBy('sortOrder')
        : [],
    [cloneFromRxId]
  );

  // Master Data queries for Routes, Frequencies & Medicine Units
  const masterRoutes = useLiveQuery(
    () => db.masterDataItems.where('category').equals('route').sortBy('sortOrder'),
    []
  );
  const masterFrequencies = useLiveQuery(
    () => db.masterDataItems.where('category').equals('frequency').sortBy('sortOrder'),
    []
  );
  const masterUnits = useLiveQuery(
    () => db.masterDataItems.where('category').equals('medicine_unit').sortBy('sortOrder'),
    []
  );

  // Query past prescriptions for clinical symptom & diagnosis auto-suggestions
  const allPastPrescriptions = useLiveQuery(() => db.prescriptions.toArray(), []);

  // ── Local Builder State ───────────────────────────────────────
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(
    preselectedPatientId
  );

  // Step 1: Select Animal search state
  const [animalSearch, setAnimalSearch] = useState('');
  const [speciesFilter, setSpeciesFilter] = useState('All');

  // Step 2: Clinical Details
  const [symptoms, setSymptoms] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [advice, setAdvice] = useState('');
  const [followUpDays, setFollowUpDays] = useState<number | undefined>(7);
  const [recheckIntervalPreset, setRecheckIntervalPreset] = useState<string>('7 days');
  const [recheckIntervalCustom, setRecheckIntervalCustom] = useState<string>('');

  // Step 3: Prescribed Medicines
  const [items, setItems] = useState<DraftItem[]>([]);

  // Package Popover state
  const [showPkgPopover, setShowPkgPopover] = useState(false);
  const pkgPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pkgPopoverRef.current &&
        !pkgPopoverRef.current.contains(event.target as Node)
      ) {
        setShowPkgPopover(false);
      }
    };
    if (showPkgPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPkgPopover]);

  // Add/Edit Medicine Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);

  // Register New Patient Warning Confirmation Modal
  const [registerWarningModalOpen, setRegisterWarningModalOpen] = useState(false);

  // Fresh New Prescription reset handler
  const handleResetToNew = () => {
    setSelectedPatientId(null);
    setSymptoms('');
    setDiagnosis('');
    setAdvice('');
    setFollowUpDays(7);
    setItems([]);
    setErrors({});
    setErrorMsg(null);
    navigate('/prescriptions/new');
  };

  const [medModalSearch, setMedModalSearch] = useState('');
  const [highlightedMedIndex, setHighlightedMedIndex] = useState<number>(-1);
  const [selectedMedRef, setSelectedMedRef] = useState<Medicine | null>(null);
  const [medForm, setMedForm] = useState({
    brandName: '',
    genericName: '',
    presentation: 'Tablet',
    dose: '1',
    doseUnit: 'mg',
    route: 'PO (Oral)',
    frequency: 'BID (q12h)',
    durationDays: 5,
    quantity: 10,
    unit: 'tablet',
    dispenseUnit: 'tablet',
    directions: 'Give after food with drinking water. Complete full course.',
  });

  // Controlled string inputs for duration and quantity to allow clean backspace clearing without '01' / '11'
  const [durationDaysStr, setDurationDaysStr] = useState<string>('5');
  const [quantityStr, setQuantityStr] = useState<string>('10');

  // Optional Dose Calculation Section States (UAT Issue 3 & 4 + Addendum)
  const [isDoseCalcOpen, setIsDoseCalcOpen] = useState(false);
  const [calcMethod, setCalcMethod] = useState<DosingMethod>('weight_based');
  const [calcWeight, setCalcWeight] = useState<string>('');
  const [calcDosePerKg, setCalcDosePerKg] = useState<string>('');
  const [calcDoseUnit, setCalcDoseUnit] = useState<string>('mg');
  const [calcStrength, setCalcStrength] = useState<string>('');
  const [calcStrengthUnit, setCalcStrengthUnit] = useState<string>('mg');
  const [calcBaseVolume, setCalcBaseVolume] = useState<string>('1');
  const [calcVolumeUnit, setCalcVolumeUnit] = useState<string>('mL');
  const [calcFrequency, setCalcFrequency] = useState<string>('BID (q12h)');
  const [calcDurationDays, setCalcDurationDays] = useState<number>(5);

  // Method A: Volume per Body Weight
  const [calcDoseVolumeAmount, setCalcDoseVolumeAmount] = useState<string>('1');
  const [calcDoseVolumeUnit, setCalcDoseVolumeUnit] = useState<string>('mL');
  const [calcWeightBasis, setCalcWeightBasis] = useState<string>('20');
  const [calcWeightBasisUnit, setCalcWeightBasisUnit] = useState<string>('kg');

  // Method B & C: Reconstitution
  const [calcReconSourceQty, setCalcReconSourceQty] = useState<string>('1');
  const [calcReconSourceUnit, setCalcReconSourceUnit] = useState<string>('tablet');
  const [calcReconDiluentVol, setCalcReconDiluentVol] = useState<string>('20');
  const [calcReconDiluentUnit, setCalcReconDiluentUnit] = useState<string>('mL');
  const [calcReconAdminVol, setCalcReconAdminVol] = useState<string>('1');
  const [calcReconAdminUnit, setCalcReconAdminUnit] = useState<string>('mL');

  // Method C: Drops specific
  const [calcDropsPerMl, setCalcDropsPerMl] = useState<string>('20');
  const [calcDoseDrops, setCalcDoseDrops] = useState<string>('20');

  // Method D: Weight-Based Range
  const [calcMinDosePerKg, setCalcMinDosePerKg] = useState<string>('10');
  const [calcMaxDosePerKg, setCalcMaxDosePerKg] = useState<string>('20');

  // Method E: Fixed Dose
  const [calcFixedDose, setCalcFixedDose] = useState<string>('1');
  const [calcFixedDoseUnit, setCalcFixedDoseUnit] = useState<string>('tablet');

  // Method F: Weight-Band
  const [calcWeightBands, setCalcWeightBands] = useState<WeightBandRule[]>([]);
  const [calcBandMinWeight, setCalcBandMinWeight] = useState<string>('0');
  const [calcBandMaxWeight, setCalcBandMaxWeight] = useState<string>('10');
  const [calcBandDoseValue, setCalcBandDoseValue] = useState<string>('1');
  const [calcBandDoseUnit, setCalcBandDoseUnit] = useState<string>('tablet');

  const [inlineWeight, setInlineWeight] = useState<string>('');
  const [rangeValidationWarning, setRangeValidationWarning] = useState<string | null>(null);
  const [userModifiedDose, setUserModifiedDose] = useState<boolean>(false);

  // Generation confirmation modal state (UAT Issue 7)
  const [showIssueConfirmModal, setShowIssueConfirmModal] = useState(false);

  // Validation & Generation Error modal states
  const [validationErrors, setValidationErrors] = useState<
    { field: string; message: string; refKey: 'patient' | 'symptoms' | 'diagnosis' | 'medicines' }[]
  >([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showGenerationErrorModal, setShowGenerationErrorModal] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errors, setErrors] = useState<{
    patient?: string;
    symptoms?: string;
    diagnosis?: string;
    medicines?: string;
    general?: string;
  }>({});
  const [isSaving, setIsSaving] = useState(false);

  const symptomsRef = useRef<HTMLTextAreaElement>(null);
  const medicinesRef = useRef<HTMLDivElement>(null);

  // Live medicine search filtering against Brand Name, Generic Name, Therapeutic Category, Presentation, Strength
  const matchingMedicines = useMemo(() => {
    if (!availableMedicines) return [];
    const q = medModalSearch.trim().toLowerCase();
    if (!q) return [];
    return availableMedicines.filter((m) => {
      const brand = (m.brandName || '').toLowerCase();
      const generic = (m.genericName || '').toLowerCase();
      const cat = (m.category || '').toLowerCase();
      const pres = (m.presentation || '').toLowerCase();
      const str = (m.strengthVolume || '').toLowerCase();
      return (
        brand.includes(q) ||
        generic.includes(q) ||
        cat.includes(q) ||
        pres.includes(q) ||
        str.includes(q)
      );
    });
  }, [availableMedicines, medModalSearch]);

  // Available routes and frequencies from Master Data with active filtering & fallbacks
  const availableRoutes = useMemo(() => {
    const fallback = [
      'PO (Oral)',
      'Topical',
      'Otic',
      'Ophthalmic',
      'SC (Subcutaneous)',
      'IM (Intramuscular)',
      'IV (Intravenous)',
    ];
    if (!masterRoutes || masterRoutes.length === 0) return fallback;
    const active = masterRoutes.filter((r) => r.isActive).map((r) => r.name);
    const unique = Array.from(new Set(active));
    if (medForm.route && !unique.includes(medForm.route)) {
      unique.push(medForm.route);
    }
    return unique.length > 0 ? unique : fallback;
  }, [masterRoutes, medForm.route]);

  const availableFrequencies = useMemo(() => {
    const fallback = [
      'SID (q24h / Once daily)',
      'BID (q12h / Twice daily)',
      'TID (q8h / 3x daily)',
      'QID (q6h / 4x daily)',
      'PRN (As needed)',
      'Once',
    ];
    if (!masterFrequencies || masterFrequencies.length === 0) return fallback;
    const active = masterFrequencies.filter((f) => f.isActive).map((f) => f.name);
    const unique = Array.from(new Set(active));
    if (medForm.frequency && !unique.includes(medForm.frequency)) {
      unique.push(medForm.frequency);
    }
    return unique.length > 0 ? unique : fallback;
  }, [masterFrequencies, medForm.frequency]);

  const availableUnits = useMemo(() => {
    const defaultUnits = [
      'tablet',
      'capsule',
      'mL',
      'L',
      'mg',
      'g',
      'mcg',
      'IU',
      'vial',
      'ampoule',
      'bottle',
      'sachet',
      'drop',
      'tube',
      'bolus/boli',
      'pipette',
      'pack',
      'tabs',
      'caps',
      'ml',
    ];
    if (!masterUnits || masterUnits.length === 0) return defaultUnits;
    const active = masterUnits.filter((u) => u.isActive).map((u) => u.name);
    const merged = Array.from(new Set([...defaultUnits, ...active]));
    if (medForm.unit && !merged.includes(medForm.unit)) {
      merged.push(medForm.unit);
    }
    if (calcFixedDoseUnit && !merged.includes(calcFixedDoseUnit)) {
      merged.push(calcFixedDoseUnit);
    }
    return merged.length > 0 ? merged : defaultUnits;
  }, [masterUnits, medForm.unit, calcFixedDoseUnit]);

  // Map lookups
  const ownersMap = useMemo(() => {
    const map = new Map<number, Owner>();
    if (allOwners) {
      for (const o of allOwners) {
        if (o.id) map.set(o.id, o);
      }
    }
    return map;
  }, [allOwners]);

  // Selected Patient & Owner
  const selectedPatient = useMemo(() => {
    if (!selectedPatientId || !allPatients) return null;
    return allPatients.find((p) => p.id === selectedPatientId) || null;
  }, [selectedPatientId, allPatients]);

  const selectedOwner = useMemo(() => {
    if (!selectedPatient?.ownerId) return null;
    return ownersMap.get(selectedPatient.ownerId) || null;
  }, [selectedPatient, ownersMap]);

  // Suggestions for Symptoms and Diagnoses from historical prescriptions + Curated Clinical Defaults
  const DEFAULT_SYMPTOMS = [
    'Anorexia / Loss of appetite',
    'Vomiting',
    'Diarrhoea',
    'Pyrexia / Fever',
    'Pruritus / Severe itching',
    'Alopecia / Hair loss',
    'Coughing',
    'Dyspnoea / Respiratory distress',
    'Lameness',
    'Lethargy / Depression',
    'Otitis / Ear scratching',
    'Nasal discharge',
    'Ocular discharge / Conjunctivitis',
    'Haematuria',
    'Polyuria / Polydipsia',
  ];

  const DEFAULT_DIAGNOSES = [
    'Canine Parvoviral Enteritis',
    'Acute Gastroenteritis',
    'Atopic Dermatitis',
    'Canine Acute Otitis Externa',
    'Demodicosis',
    'Sarcoptic Mange',
    'Upper Respiratory Tract Infection (URTI)',
    'Canine Infectious Respiratory Disease (Kennel Cough)',
    'Feline Panleukopenia',
    'Babesiosis / Tick-borne Haemo-parasitism',
    'Trypanosomiasis / Surra',
    'Bovine Mastitis',
    'Bovine Ephemeral Fever',
    'Haemorrhagic Septicaemia',
    'Helminthiasis / Parasitic Gastroenteritis',
  ];

  const suggestedSymptoms = useMemo(() => {
    const set = new Set<string>(DEFAULT_SYMPTOMS);
    if (allPastPrescriptions) {
      for (const rx of allPastPrescriptions) {
        if (rx.symptoms) {
          rx.symptoms.split(/[\n,;]+/).forEach((s) => {
            const trimmed = s.trim();
            if (trimmed.length > 2) set.add(trimmed);
          });
        }
      }
    }
    return Array.from(set);
  }, [allPastPrescriptions]);

  const suggestedDiagnoses = useMemo(() => {
    const set = new Set<string>(DEFAULT_DIAGNOSES);
    if (allPastPrescriptions) {
      for (const rx of allPastPrescriptions) {
        if (rx.diagnosis && rx.diagnosis.trim().length > 2) {
          set.add(rx.diagnosis.trim());
        }
      }
    }
    return Array.from(set);
  }, [allPastPrescriptions]);

  // ── Populate State for Edit Mode ──────────────────────────────
  useEffect(() => {
    if (mode === 'edit' && existingRx) {
      if (existingRx.status === 'Issued' || existingRx.status === 'Cancelled') {
        navigate(`/prescriptions/${existingRx.id}`);
        return;
      }
      setSelectedPatientId(existingRx.patientId);
      setSymptoms(existingRx.symptoms || '');
      setDiagnosis(existingRx.diagnosis || '');
      setAdvice(existingRx.instructions || '');
      setFollowUpDays(existingRx.followUpDays);
      if (existingRx.recheckIntervalPreset) {
        setRecheckIntervalPreset(existingRx.recheckIntervalPreset);
      } else if (existingRx.followUpDays === 0) {
        setRecheckIntervalPreset('None');
      } else if (existingRx.followUpDays) {
        setRecheckIntervalPreset(`${existingRx.followUpDays} days`);
      }
      setRecheckIntervalCustom(existingRx.recheckIntervalCustom || '');
    }
  }, [mode, existingRx, navigate]);

  useEffect(() => {
    if (mode === 'edit' && existingRxItems && existingRxItems.length > 0) {
      setItems(
        existingRxItems.map((item) => ({
          id: item.id,
          medicineId: item.medicineId,
          brandName: item.brandName,
          genericName: item.genericName,
          presentation: item.presentation,
          strengthVolume: item.strengthVolume,
          dose: item.dose || item.strengthVolume,
          doseUnit: item.doseUnit || extractDoseUnit(item.dose) || 'mg',
          quantity: item.quantity,
          unit: item.unit,
          dispenseUnit: item.dispenseUnit || item.unit,
          frequency: item.frequency,
          durationDays: item.durationDays,
          route: item.route,
          directions: item.directions,
        }))
      );
    }
  }, [mode, existingRxItems]);

  // ── Populate State for Clone Mode ─────────────────────────────
  useEffect(() => {
    if (mode === 'new' && clonedRx) {
      setSelectedPatientId(clonedRx.patientId);
      setSymptoms(clonedRx.symptoms || '');
      setDiagnosis(clonedRx.diagnosis || '');
      setAdvice(clonedRx.instructions || '');
      setFollowUpDays(clonedRx.followUpDays);
      if (clonedRx.recheckIntervalPreset) {
        setRecheckIntervalPreset(clonedRx.recheckIntervalPreset);
      } else if (clonedRx.followUpDays === 0) {
        setRecheckIntervalPreset('None');
      } else if (clonedRx.followUpDays) {
        setRecheckIntervalPreset(`${clonedRx.followUpDays} days`);
      }
      setRecheckIntervalCustom(clonedRx.recheckIntervalCustom || '');
    }
  }, [mode, clonedRx]);

  useEffect(() => {
    if (mode === 'new' && clonedRxItems && clonedRxItems.length > 0) {
      setItems(
        clonedRxItems.map((item) => ({
          medicineId: item.medicineId,
          brandName: item.brandName,
          genericName: item.genericName,
          presentation: item.presentation,
          strengthVolume: item.strengthVolume,
          dose: item.dose || item.strengthVolume,
          doseUnit: item.doseUnit || extractDoseUnit(item.dose) || 'mg',
          quantity: item.quantity,
          unit: item.unit,
          dispenseUnit: item.dispenseUnit || item.unit,
          frequency: item.frequency,
          durationDays: item.durationDays,
          route: item.route,
          directions: item.directions,
        }))
      );
    }
  }, [mode, clonedRxItems]);

  // ── Filtered Patients for Step 1 ──────────────────────────────
  const filteredPatients = useMemo(() => {
    if (!allPatients) return [];
    const q = animalSearch.toLowerCase().trim();

    return allPatients.filter((p) => {
      // Species pill filter
      if (speciesFilter !== 'All' && p.species.toLowerCase() !== speciesFilter.toLowerCase()) {
        return false;
      }
      if (!q) return true;

      const owner = ownersMap.get(p.ownerId);
      const speciesCode = `#${p.species.slice(0, 3).toLowerCase()}-${p.id}`;

      return (
        p.name.toLowerCase().includes(q) ||
        p.species.toLowerCase().includes(q) ||
        (p.breed && p.breed.toLowerCase().includes(q)) ||
        (p.identificationRef && p.identificationRef.toLowerCase().includes(q)) ||
        (p.microchipNumber && p.microchipNumber.toLowerCase().includes(q)) ||
        (p.ageNote && p.ageNote.toLowerCase().includes(q)) ||
        speciesCode.includes(q) ||
        (p.id !== undefined && String(p.id) === q) ||
        (owner && owner.name.toLowerCase().includes(q)) ||
        (owner?.phone && owner.phone.toLowerCase().includes(q))
      );
    });
  }, [allPatients, ownersMap, animalSearch, speciesFilter]);

  // ── Calculated metrics for Optional Dose Calculation Section (UAT 4 + Addendum) ──
  const doseCalcMetrics = useMemo(() => {
    const w = parseFloat(calcWeight) || 0;
    const dosesPerDay = getDosesPerDay(calcFrequency) || 1;

    // Method: Volume per Body Weight (e.g. 1 mL per 20 kg)
    if (calcMethod === 'volume_per_weight') {
      const volAmt = parseFloat(calcDoseVolumeAmount) || 0;
      const basis = parseFloat(calcWeightBasis) || 0;
      let calculatedVolume = 0;
      let warning: string | null = null;

      if (w <= 0) {
        warning = 'Missing patient weight: enter patient weight (kg) to calculate volume.';
      } else if (basis <= 0) {
        warning = 'Missing or invalid weight basis: enter positive value (e.g. 20 for per 20 kg).';
      } else if (volAmt <= 0) {
        warning = 'Missing dose volume amount.';
      } else {
        calculatedVolume = Number((w * (volAmt / basis)).toFixed(2));
      }

      const totalDispenseQty =
        calculatedVolume > 0 && calcDurationDays > 0
          ? Math.ceil(calculatedVolume * dosesPerDay * calcDurationDays)
          : 0;

      return {
        calcMethod,
        calculatedDose: 0,
        calculatedVolume,
        totalDispenseQty,
        dosesPerDay,
        warning,
        displayDose: calculatedVolume > 0 ? `${calculatedVolume} ${calcDoseVolumeUnit}` : '—',
        formula:
          w > 0 && basis > 0 && volAmt > 0
            ? `${w} kg × (${volAmt} ${calcDoseVolumeUnit} ÷ ${basis} ${calcWeightBasisUnit}) = ${calculatedVolume} ${calcDoseVolumeUnit}`
            : undefined,
      };
    }

    // Method: Reconstituted Tablet/Unit -> Liquid Volume
    if (calcMethod === 'reconstituted_liquid') {
      const srcQty = parseFloat(calcReconSourceQty) || 0;
      const dilVol = parseFloat(calcReconDiluentVol) || 0;
      const adminVol = parseFloat(calcReconAdminVol) || 0;
      let warning: string | null = null;
      let sourceEquiv = '';

      if (srcQty <= 0) {
        warning = 'Missing or invalid source quantity.';
      } else if (dilVol <= 0) {
        warning = 'Missing or zero reconstitution volume: dilution cannot be calculated.';
      } else if (adminVol <= 0) {
        warning = 'Missing administration dose volume.';
      } else {
        const frac = (adminVol / dilVol) * srcQty;
        const simplified = Number(frac.toFixed(4));
        sourceEquiv = `${srcQty === 1 && Math.round(dilVol / adminVol) > 0 ? `1/${Math.round(dilVol / adminVol)}` : simplified} ${calcReconSourceUnit} equivalent`;
      }

      const totalDispenseQty =
        adminVol > 0 && calcDurationDays > 0
          ? Math.ceil(adminVol * dosesPerDay * calcDurationDays)
          : 0;

      return {
        calcMethod,
        calculatedDose: adminVol,
        calculatedVolume: adminVol,
        totalDispenseQty,
        dosesPerDay,
        warning,
        sourceEquiv,
        displayDose: adminVol > 0 ? `${adminVol} ${calcReconAdminUnit}` : '—',
        formula:
          srcQty > 0 && dilVol > 0 && adminVol > 0
            ? `${srcQty} ${calcReconSourceUnit} + ${dilVol} ${calcReconDiluentUnit} → ${adminVol} ${calcReconAdminUnit} (${sourceEquiv})`
            : undefined,
      };
    }

    // Method: Reconstituted Tablet/Unit -> Drops
    if (calcMethod === 'reconstituted_drops') {
      const srcQty = parseFloat(calcReconSourceQty) || 0;
      const dilVol = parseFloat(calcReconDiluentVol) || 0;
      const dropsPerMl = parseFloat(calcDropsPerMl) || 0;
      const doseDrops = parseFloat(calcDoseDrops) || 0;
      let warning: string | null = null;
      let calculatedVolume = 0;
      let sourceEquiv = '';

      if (!dropsPerMl || dropsPerMl <= 0) {
        warning = 'Calibrated Drops per mL is required for volume conversion. System does not assume 20 drops = 1 mL.';
      } else if (srcQty <= 0) {
        warning = 'Missing or invalid source quantity.';
      } else if (dilVol <= 0) {
        warning = 'Missing or zero reconstitution volume.';
      } else if (doseDrops <= 0) {
        warning = 'Missing dose in drops.';
      } else {
        calculatedVolume = Number((doseDrops / dropsPerMl).toFixed(3));
        const frac = (calculatedVolume / dilVol) * srcQty;
        const simplified = Number(frac.toFixed(4));
        sourceEquiv = `${simplified} ${calcReconSourceUnit} equivalent`;
      }

      const totalDispenseQty =
        doseDrops > 0 && calcDurationDays > 0
          ? Math.ceil(doseDrops * dosesPerDay * calcDurationDays)
          : 0;

      return {
        calcMethod,
        calculatedDose: doseDrops,
        calculatedVolume,
        totalDispenseQty,
        dosesPerDay,
        warning,
        sourceEquiv,
        displayDose: doseDrops > 0 ? `${doseDrops} drops${calculatedVolume > 0 ? ` (${calculatedVolume} mL)` : ''}` : '—',
        formula:
          doseDrops > 0 && dropsPerMl > 0
            ? `${doseDrops} drops ÷ ${dropsPerMl} drops/mL = ${calculatedVolume} mL (${sourceEquiv})`
            : undefined,
      };
    }

    // Method: Weight-Based Range (e.g. 10–20 mg/kg)
    if (calcMethod === 'weight_range') {
      const minPerKg = parseFloat(calcMinDosePerKg) || 0;
      const maxPerKg = parseFloat(calcMaxDosePerKg) || minPerKg;
      let warning: string | null = null;
      if (w <= 0) {
        warning = 'Enter patient weight (kg) to calculate dose range.';
      } else if (minPerKg <= 0 && maxPerKg <= 0) {
        warning = 'Enter min and max dose per kg.';
      }
      const minCalculated = w > 0 && minPerKg > 0 ? Number((w * minPerKg).toFixed(2)) : 0;
      const maxCalculated = w > 0 && maxPerKg > 0 ? Number((w * maxPerKg).toFixed(2)) : minCalculated;
      const totalDispenseQty =
        minCalculated > 0 && calcDurationDays > 0
          ? Math.ceil(minCalculated * dosesPerDay * calcDurationDays)
          : 0;
      return {
        calcMethod,
        calculatedDose: minCalculated,
        minCalculatedDose: minCalculated,
        maxCalculatedDose: maxCalculated,
        calculatedVolume: 0,
        totalDispenseQty,
        dosesPerDay,
        warning,
        displayDose: minCalculated > 0 ? `${minCalculated}–${maxCalculated} ${calcDoseUnit}` : '—',
        formula:
          w > 0 && minPerKg > 0
            ? `${w} kg × (${minPerKg}–${maxPerKg} ${calcDoseUnit}/kg) = ${minCalculated}–${maxCalculated} ${calcDoseUnit}/dose`
            : undefined,
      };
    }

    // Method: Weight-Band (Tier-Based by Weight Range)
    if (calcMethod === 'weight_band') {
      let warning: string | null = null;
      let matchedDose = 0;
      let matchedUnit = calcBandDoseUnit || 'tablet';
      let matchedLabel = '';

      if (w <= 0) {
        warning = 'Enter patient weight (kg) to match weight band.';
      } else if (calcWeightBands && calcWeightBands.length > 0) {
        const matched = calcWeightBands.find((b) => {
          const minOk = b.minWeightKg === undefined || b.minWeightKg === null || w >= b.minWeightKg;
          const maxOk = b.maxWeightKg === undefined || b.maxWeightKg === null || w <= b.maxWeightKg;
          return minOk && maxOk;
        });
        if (matched) {
          matchedDose = matched.doseValue;
          matchedUnit = matched.doseUnit;
          matchedLabel = matched.label || `${matched.minWeightKg ?? 0}–${matched.maxWeightKg ?? '∞'} kg`;
        } else {
          warning = `Patient weight (${w} kg) does not fall into any configured band.`;
        }
      } else {
        const minW = parseFloat(calcBandMinWeight) || 0;
        const maxW = parseFloat(calcBandMaxWeight) || Infinity;
        const dVal = parseFloat(calcBandDoseValue) || 0;
        if (w >= minW && w <= maxW && dVal > 0) {
          matchedDose = dVal;
          matchedUnit = calcBandDoseUnit;
          matchedLabel = `${minW}–${maxW} kg`;
        } else if (dVal <= 0) {
          warning = 'Enter band dose value.';
        } else {
          warning = `Patient weight (${w} kg) outside specified band (${minW}–${maxW} kg).`;
        }
      }

      const totalDispenseQty =
        matchedDose > 0 && calcDurationDays > 0
          ? Math.ceil(matchedDose * dosesPerDay * calcDurationDays)
          : 0;

      return {
        calcMethod,
        calculatedDose: matchedDose,
        calculatedDoseUnit: matchedUnit,
        calculatedVolume: 0,
        totalDispenseQty,
        dosesPerDay,
        warning,
        displayDose: matchedDose > 0 ? `${matchedDose} ${matchedUnit}` : '—',
        formula:
          matchedDose > 0
            ? `Weight band matched (${matchedLabel}) for ${w} kg → ${matchedDose} ${matchedUnit}/dose`
            : undefined,
      };
    }

    // Method: Fixed Dose (Independent of Weight)
    if (calcMethod === 'fixed') {
      const fx = parseFloat(calcFixedDose) || 0;
      const totalDispenseQty =
        fx > 0 && calcDurationDays > 0
          ? Math.ceil(fx * dosesPerDay * calcDurationDays)
          : 0;
      return {
        calcMethod,
        calculatedDose: fx,
        calculatedVolume: 0,
        totalDispenseQty,
        dosesPerDay,
        warning: fx <= 0 ? 'Enter fixed dose value.' : null,
        displayDose: fx > 0 ? `${fx} ${calcFixedDoseUnit}` : '—',
        formula: fx > 0 ? `Fixed dose: ${fx} ${calcFixedDoseUnit} per administration` : undefined,
      };
    }

    // Method: No Smart Dosing (Manual Entry)
    if (calcMethod === 'none') {
      return {
        calcMethod,
        calculatedDose: 0,
        calculatedVolume: 0,
        totalDispenseQty: 0,
        dosesPerDay,
        warning: null,
        displayDose: 'Manual',
        formula: 'Manual dosing — no automated calculation applied',
      };
    }

    // Default: Weight-Based (mg/kg) + concentration
    const dpk = parseFloat(calcDosePerKg) || 0;
    const calculatedDose = w > 0 && dpk > 0 ? Number((w * dpk).toFixed(2)) : 0;

    const str = parseFloat(calcStrength) || 0;
    const bVol = parseFloat(calcBaseVolume) || 1;
    let calculatedVolume = 0;

    if (str > 0 && calculatedDose > 0) {
      let normalizedDose = calculatedDose;
      if (calcDoseUnit.toLowerCase() !== calcStrengthUnit.toLowerCase()) {
        const conv = convertUnits(calculatedDose, calcDoseUnit, calcStrengthUnit);
        if (conv.isValid && conv.convertedValue !== undefined) {
          normalizedDose = conv.convertedValue;
        }
      }
      calculatedVolume = Number(((normalizedDose / str) * bVol).toFixed(2));
    }

    const totalDispenseQty =
      calculatedVolume > 0 && calcDurationDays > 0
        ? Math.ceil(calculatedVolume * dosesPerDay * calcDurationDays)
        : calculatedDose > 0 && calcDurationDays > 0
        ? Math.ceil(dosesPerDay * calcDurationDays)
        : 0;

    let warning: string | null = null;
    if (w <= 0 && dpk > 0) {
      warning = 'Enter patient weight (kg) to calculate dose.';
    }

    return {
      calcMethod: 'weight_based' as DosingMethod,
      calculatedDose,
      calculatedVolume,
      dosesPerDay,
      totalDispenseQty,
      warning,
      displayDose:
        calculatedVolume > 0
          ? `${calculatedVolume} ${calcVolumeUnit}`
          : calculatedDose > 0
          ? `${calculatedDose} ${calcDoseUnit}`
          : '—',
      formula:
        w > 0 && dpk > 0
          ? `${w} kg × ${dpk} ${calcDoseUnit}/kg = ${calculatedDose} ${calcDoseUnit}`
          : undefined,
    };
  }, [
    calcMethod,
    calcWeight,
    calcDosePerKg,
    calcDoseUnit,
    calcStrength,
    calcBaseVolume,
    calcVolumeUnit,
    calcFrequency,
    calcDurationDays,
    calcDoseVolumeAmount,
    calcDoseVolumeUnit,
    calcWeightBasis,
    calcWeightBasisUnit,
    calcReconSourceQty,
    calcReconSourceUnit,
    calcReconDiluentVol,
    calcReconDiluentUnit,
    calcReconAdminVol,
    calcReconAdminUnit,
    calcDropsPerMl,
    calcDoseDrops,
    calcMinDosePerKg,
    calcMaxDosePerKg,
    calcFixedDose,
    calcFixedDoseUnit,
    calcWeightBands,
    calcBandMinWeight,
    calcBandMaxWeight,
    calcBandDoseValue,
    calcBandDoseUnit,
  ]);

  const handleApplyDoseCalculation = () => {
    const { calcMethod: method, calculatedDose, calculatedVolume, totalDispenseQty } = doseCalcMetrics;

    if (method === 'volume_per_weight') {
      if (calculatedVolume > 0) {
        setMedForm((prev) => ({
          ...prev,
          dose: String(calculatedVolume),
          doseUnit: calcDoseVolumeUnit || 'mL',
          dispenseUnit: calcDoseVolumeUnit || prev.dispenseUnit || 'mL',
          unit: calcDoseVolumeUnit || 'mL',
          quantity: totalDispenseQty > 0 ? totalDispenseQty : prev.quantity,
          frequency: calcFrequency,
          durationDays: calcDurationDays,
        }));
        setDurationDaysStr(String(calcDurationDays));
        if (totalDispenseQty > 0) setQuantityStr(String(totalDispenseQty));
      }
    } else if (method === 'reconstituted_liquid') {
      const adminVol = parseFloat(calcReconAdminVol) || 0;
      if (adminVol > 0) {
        setMedForm((prev) => ({
          ...prev,
          dose: String(adminVol),
          doseUnit: calcReconAdminUnit || 'mL',
          dispenseUnit: calcReconAdminUnit || prev.dispenseUnit || 'mL',
          unit: calcReconAdminUnit || 'mL',
          quantity: totalDispenseQty > 0 ? totalDispenseQty : prev.quantity,
          frequency: calcFrequency,
          durationDays: calcDurationDays,
        }));
        setDurationDaysStr(String(calcDurationDays));
        if (totalDispenseQty > 0) setQuantityStr(String(totalDispenseQty));
      }
    } else if (method === 'reconstituted_drops') {
      const doseDrops = parseFloat(calcDoseDrops) || 0;
      if (doseDrops > 0) {
        setMedForm((prev) => ({
          ...prev,
          dose: String(doseDrops),
          doseUnit: 'drops',
          dispenseUnit: 'drops',
          unit: 'drops',
          quantity: totalDispenseQty > 0 ? totalDispenseQty : prev.quantity,
          frequency: calcFrequency,
          durationDays: calcDurationDays,
        }));
        setDurationDaysStr(String(calcDurationDays));
        if (totalDispenseQty > 0) setQuantityStr(String(totalDispenseQty));
      }
    } else if (method === 'weight_range') {
      const minVal = doseCalcMetrics.calculatedDose || (doseCalcMetrics as any).minCalculatedDose || 0;
      if (minVal > 0) {
        setMedForm((prev) => ({
          ...prev,
          dose: String(minVal),
          doseUnit: calcDoseUnit || prev.doseUnit || 'mg',
          dispenseUnit: prev.dispenseUnit || 'tablet',
          unit: calcDoseUnit || prev.unit,
          quantity: totalDispenseQty > 0 ? totalDispenseQty : prev.quantity,
          frequency: calcFrequency,
          durationDays: calcDurationDays,
        }));
        setDurationDaysStr(String(calcDurationDays));
        if (totalDispenseQty > 0) setQuantityStr(String(totalDispenseQty));
      }
    } else if (method === 'weight_band') {
      if (calculatedDose > 0) {
        const bandUnit = (doseCalcMetrics as any).calculatedDoseUnit || calcBandDoseUnit || 'tablet';
        setMedForm((prev) => ({
          ...prev,
          dose: String(calculatedDose),
          doseUnit: bandUnit,
          dispenseUnit: bandUnit,
          unit: bandUnit,
          quantity: totalDispenseQty > 0 ? totalDispenseQty : prev.quantity,
          frequency: calcFrequency,
          durationDays: calcDurationDays,
        }));
        setDurationDaysStr(String(calcDurationDays));
        if (totalDispenseQty > 0) setQuantityStr(String(totalDispenseQty));
      }
    } else if (method === 'fixed') {
      if (calculatedDose > 0) {
        setMedForm((prev) => ({
          ...prev,
          dose: String(calculatedDose),
          doseUnit: calcFixedDoseUnit || prev.doseUnit || 'tablet',
          dispenseUnit: calcFixedDoseUnit || prev.dispenseUnit || 'tablet',
          unit: calcFixedDoseUnit || prev.unit,
          quantity: totalDispenseQty > 0 ? totalDispenseQty : prev.quantity,
          frequency: calcFrequency,
          durationDays: calcDurationDays,
        }));
        setDurationDaysStr(String(calcDurationDays));
        if (totalDispenseQty > 0) setQuantityStr(String(totalDispenseQty));
      }
    } else if (method === 'none') {
      // Manual entry, keep current form values but update frequency/duration if user changed them in calc
      setMedForm((prev) => ({
        ...prev,
        frequency: calcFrequency,
        durationDays: calcDurationDays,
      }));
      setDurationDaysStr(String(calcDurationDays));
    } else {
      // Weight based
      if (calculatedVolume > 0) {
        const roundedDose = Math.round(calculatedVolume * 100) / 100;
        setMedForm((prev) => ({
          ...prev,
          dose: String(roundedDose),
          doseUnit: calcVolumeUnit || prev.doseUnit || 'mL',
          dispenseUnit: calcVolumeUnit || prev.dispenseUnit || 'vial',
          unit: calcVolumeUnit || prev.unit,
          quantity: totalDispenseQty > 0 ? totalDispenseQty : prev.quantity,
          frequency: calcFrequency,
          durationDays: calcDurationDays,
        }));
        setDurationDaysStr(String(calcDurationDays));
        if (totalDispenseQty > 0) setQuantityStr(String(totalDispenseQty));
      } else if (calculatedDose > 0) {
        const roundedDose = Math.round(calculatedDose * 100) / 100;
        setMedForm((prev) => ({
          ...prev,
          dose: String(roundedDose),
          doseUnit: calcDoseUnit || prev.doseUnit || 'mg',
          dispenseUnit: prev.dispenseUnit || 'tablet',
          unit: calcDoseUnit || prev.unit,
          quantity: totalDispenseQty > 0 ? totalDispenseQty : prev.quantity,
          frequency: calcFrequency,
          durationDays: calcDurationDays,
        }));
        setDurationDaysStr(String(calcDurationDays));
        if (totalDispenseQty > 0) setQuantityStr(String(totalDispenseQty));
      }
    }
    setUserModifiedDose(true);
  };

  // ── Modal Handlers (Integrated Smart Dose Calculator - Phase 7 + Addendum) ──
  const openAddMedModal = () => {
    setEditingItemIndex(null);
    setSelectedMedRef(null);
    setMedModalSearch('');
    setUserModifiedDose(false);
    setRangeValidationWarning(null);
    const currWeight = selectedPatient?.weightKg ? String(selectedPatient.weightKg) : '';
    setInlineWeight(currWeight);
    setCalcWeight(currWeight);
    setCalcMethod('weight_based');
    setCalcDosePerKg('');
    setCalcDoseUnit('mg');
    setCalcStrength('');
    setCalcStrengthUnit('mg');
    setCalcBaseVolume('1');
    setCalcVolumeUnit('mL');
    setCalcFrequency('BID (q12h)');
    setCalcDurationDays(5);
    setDurationDaysStr('5');
    setQuantityStr('10');

    // Method A
    setCalcDoseVolumeAmount('1');
    setCalcDoseVolumeUnit('mL');
    setCalcWeightBasis('20');
    setCalcWeightBasisUnit('kg');

    // Method B & C
    setCalcReconSourceQty('1');
    setCalcReconSourceUnit('tablet');
    setCalcReconDiluentVol('20');
    setCalcReconDiluentUnit('mL');
    setCalcReconAdminVol('1');
    setCalcReconAdminUnit('mL');
    setCalcDropsPerMl('20');
    setCalcDoseDrops('20');
    setCalcMinDosePerKg('10');
    setCalcMaxDosePerKg('20');
    setCalcFixedDose('1');
    setCalcFixedDoseUnit('tablet');
    setCalcWeightBands([]);
    setCalcBandMinWeight('0');
    setCalcBandMaxWeight('10');
    setCalcBandDoseValue('1');
    setCalcBandDoseUnit('tablet');

    setIsDoseCalcOpen(false);

    setMedForm({
      brandName: '',
      genericName: '',
      presentation: 'Tablet',
      dose: '1',
      doseUnit: 'mg',
      dispenseUnit: 'tablet',
      route: 'PO (Oral)',
      frequency: 'BID (q12h)',
      durationDays: 5,
      quantity: 10,
      unit: 'mg',
      directions: 'Give after food with drinking water. Complete full course.',
    });
    setModalOpen(true);
  };

  const openEditMedModal = (index: number) => {
    const itm = items[index];
    setEditingItemIndex(index);
    const matched = availableMedicines?.find(
      (m) => (itm.medicineId && m.id === itm.medicineId) || m.brandName.toLowerCase() === itm.brandName.toLowerCase()
    );
    setSelectedMedRef(matched || null);
    setMedModalSearch(itm.brandName);
    const currWeight = selectedPatient?.weightKg ? String(selectedPatient.weightKg) : '';
    setInlineWeight(currWeight);
    setCalcWeight(currWeight);
    setUserModifiedDose(true); // Preserve doctor's approved dose
    setRangeValidationWarning(null);

    const numericDose = extractNumericDose(itm.dose);
    const doseUnit = itm.doseUnit || extractDoseUnit(itm.dose) || itm.unit || 'tablet';
    const dispUnit = itm.dispenseUnit || itm.unit || 'tablet';
    const initDuration = itm.durationDays || 5;
    const initQty = itm.quantity || 10;
    setDurationDaysStr(String(initDuration));
    setQuantityStr(String(initQty));

    if (matched) {
      setCalcMethod(matched.dosingMethod && matched.dosingMethod !== 'none' ? matched.dosingMethod : 'weight_based');
      setCalcDosePerKg(matched.dosePerKg ? String(matched.dosePerKg) : '');
      setCalcDoseUnit(matched.doseUnit || 'mg');
      setCalcStrength(matched.concentrationStrength ? String(matched.concentrationStrength) : '');
      setCalcStrengthUnit(matched.concentrationStrengthUnit || 'mg');
      setCalcBaseVolume(matched.concentrationVolume ? String(matched.concentrationVolume) : '1');
      setCalcVolumeUnit(matched.concentrationVolumeUnit || 'mL');
      setCalcFrequency(itm.frequency || matched.defaultFrequency || 'BID (q12h)');
      setCalcDurationDays(initDuration);

      // Method A
      setCalcDoseVolumeAmount(matched.doseVolumeAmount ? String(matched.doseVolumeAmount) : '1');
      setCalcDoseVolumeUnit(matched.doseVolumeUnit || 'mL');
      setCalcWeightBasis(matched.weightBasis ? String(matched.weightBasis) : '20');
      setCalcWeightBasisUnit(matched.weightBasisUnit || 'kg');

      // Method B & C
      setCalcReconSourceQty(matched.reconstitutionSourceQty ? String(matched.reconstitutionSourceQty) : '1');
      setCalcReconSourceUnit(matched.reconstitutionSourceUnit || 'tablet');
      setCalcReconDiluentVol(matched.reconstitutionDiluentVolume ? String(matched.reconstitutionDiluentVolume) : '20');
      setCalcReconDiluentUnit(matched.reconstitutionDiluentUnit || 'mL');
      setCalcReconAdminVol(matched.reconstitutionAdminVolume ? String(matched.reconstitutionAdminVolume) : '1');
      setCalcReconAdminUnit(matched.reconstitutionAdminUnit || 'mL');
      setCalcDropsPerMl(matched.dropsPerMl ? String(matched.dropsPerMl) : '20');
      setCalcDoseDrops(matched.doseDrops ? String(matched.doseDrops) : '20');
      setCalcMinDosePerKg(matched.minDosePerKg !== undefined ? String(matched.minDosePerKg) : (matched.dosePerKg ? String(matched.dosePerKg) : '10'));
      setCalcMaxDosePerKg(matched.maxDosePerKg !== undefined ? String(matched.maxDosePerKg) : (matched.dosePerKg ? String(matched.dosePerKg) : '20'));
      setCalcFixedDose(matched.fixedDose !== undefined ? String(matched.fixedDose) : '1');
      setCalcFixedDoseUnit(itm.doseUnit || itm.unit || matched.doseUnit || 'tablet');
      setCalcWeightBands(matched.weightBands || []);
      setCalcBandMinWeight('0');
      setCalcBandMaxWeight('10');
      setCalcBandDoseValue('1');
      setCalcBandDoseUnit('tablet');

      if (matched.dosingMethod && matched.dosingMethod !== 'none') {
        setIsDoseCalcOpen(true);
      }
    } else {
      setCalcMethod('weight_based');
      setCalcDosePerKg('');
      setCalcDoseUnit('mg');
      setCalcStrength('');
      setCalcStrengthUnit('mg');
      setCalcBaseVolume('1');
      setCalcVolumeUnit('mL');
      setCalcFrequency(itm.frequency || 'BID (q12h)');
      setCalcDurationDays(initDuration);
      setCalcDoseVolumeAmount('1');
      setCalcDoseVolumeUnit('mL');
      setCalcWeightBasis('20');
      setCalcWeightBasisUnit('kg');
      setCalcReconSourceQty('1');
      setCalcReconSourceUnit('tablet');
      setCalcReconDiluentVol('20');
      setCalcReconDiluentUnit('mL');
      setCalcReconAdminVol('1');
      setCalcReconAdminUnit('mL');
      setCalcDropsPerMl('20');
      setCalcDoseDrops('20');
      setCalcMinDosePerKg('10');
      setCalcMaxDosePerKg('20');
      setCalcFixedDose('1');
      setCalcFixedDoseUnit('tablet');
      setCalcWeightBands([]);
      setCalcBandMinWeight('0');
      setCalcBandMaxWeight('10');
      setCalcBandDoseValue('1');
      setCalcBandDoseUnit('tablet');
      setIsDoseCalcOpen(false);
    }

    setMedForm({
      brandName: itm.brandName,
      genericName: itm.genericName || '',
      presentation: itm.presentation || 'Tablet',
      dose: numericDose,
      doseUnit: doseUnit,
      dispenseUnit: dispUnit,
      route: itm.route || 'PO (Oral)',
      frequency: itm.frequency || 'BID (q12h)',
      durationDays: initDuration,
      quantity: initQty,
      unit: doseUnit,
      directions: itm.directions || '',
    });
    setModalOpen(true);
  };

  const handleSelectMedRef = (med: Medicine) => {
    setSelectedMedRef(med);
    setMedModalSearch(med.brandName);
    setUserModifiedDose(false);
    setRangeValidationWarning(null);

    const weightNum = inlineWeight ? parseFloat(inlineWeight) : selectedPatient?.weightKg;
    const res = calculateSmartDose(med, weightNum, selectedPatient?.species);

    // Populate dose calculator fields from medicine formulary data (Formulary Inheritance)
    setCalcMethod(med.dosingMethod && med.dosingMethod !== 'none' ? med.dosingMethod : 'weight_based');
    setCalcWeight(inlineWeight || (selectedPatient?.weightKg ? String(selectedPatient.weightKg) : ''));
    setCalcDosePerKg(med.dosePerKg ? String(med.dosePerKg) : '');
    setCalcDoseUnit(med.doseUnit || 'mg');
    setCalcStrength(med.concentrationStrength ? String(med.concentrationStrength) : '');
    setCalcStrengthUnit(med.concentrationStrengthUnit || 'mg');
    setCalcBaseVolume(med.concentrationVolume ? String(med.concentrationVolume) : '1');
    setCalcVolumeUnit(med.concentrationVolumeUnit || 'mL');
    setCalcFrequency(med.defaultFrequency || 'BID (q12h)');
    const chosenDur = res.suggestedDurationDays || med.defaultDurationDays || 5;
    setCalcDurationDays(chosenDur);
    setDurationDaysStr(String(chosenDur));

    // Method A inheritance
    setCalcDoseVolumeAmount(med.doseVolumeAmount !== undefined ? String(med.doseVolumeAmount) : '1');
    setCalcDoseVolumeUnit(med.doseVolumeUnit || 'mL');
    setCalcWeightBasis(med.weightBasis !== undefined ? String(med.weightBasis) : '20');
    setCalcWeightBasisUnit(med.weightBasisUnit || 'kg');

    // Method B & C inheritance
    setCalcReconSourceQty(med.reconstitutionSourceQty !== undefined ? String(med.reconstitutionSourceQty) : '1');
    setCalcReconSourceUnit(med.reconstitutionSourceUnit || 'tablet');
    setCalcReconDiluentVol(med.reconstitutionDiluentVolume !== undefined ? String(med.reconstitutionDiluentVolume) : '20');
    setCalcReconDiluentUnit(med.reconstitutionDiluentUnit || 'mL');
    setCalcReconAdminVol(med.reconstitutionAdminVolume !== undefined ? String(med.reconstitutionAdminVolume) : '1');
    setCalcReconAdminUnit(med.reconstitutionAdminUnit || 'mL');
    setCalcDropsPerMl(med.dropsPerMl !== undefined ? String(med.dropsPerMl) : '20');
    setCalcDoseDrops(med.doseDrops !== undefined ? String(med.doseDrops) : '20');
    setCalcMinDosePerKg(med.minDosePerKg !== undefined ? String(med.minDosePerKg) : (med.dosePerKg ? String(med.dosePerKg) : '10'));
    setCalcMaxDosePerKg(med.maxDosePerKg !== undefined ? String(med.maxDosePerKg) : (med.dosePerKg ? String(med.dosePerKg) : '20'));
    setCalcFixedDose(med.fixedDose !== undefined ? String(med.fixedDose) : '1');
    setCalcFixedDoseUnit(med.doseUnit || 'tablet');
    setCalcWeightBands(med.weightBands || []);
    setCalcBandMinWeight('0');
    setCalcBandMaxWeight('10');
    setCalcBandDoseValue('1');
    setCalcBandDoseUnit('tablet');

    if (med.dosingMethod && med.dosingMethod !== 'none') {
      setIsDoseCalcOpen(true);
    }

    const calculatedDoseStr = res.formattedDoseString || med.strengthVolume || '1 tablet';
    const numericDose = extractNumericDose(calculatedDoseStr);
    const doseUnit = extractDoseUnit(calculatedDoseStr) || med.doseUnit || res.quantityUnit || med.defaultUnit || 'mg';
    const dispUnit = med.dispenseUnit || med.defaultUnit || res.quantityUnit || 'tablet';

    const chosenRoute = res.suggestedRoute || med.defaultRoute || 'PO (Oral)';
    const chosenFreq = res.suggestedFrequency || med.defaultFrequency || 'BID (q12h)';
    const chosenQty = res.calculatedQuantity !== undefined ? res.calculatedQuantity : 10;
    setQuantityStr(String(chosenQty));
    const chosenDir = res.suggestedDirections || med.defaultDirections || 'Give after food with water. Complete full course.';

    setMedForm((prev) => ({
      ...prev,
      brandName: med.brandName,
      genericName: med.genericName || '',
      presentation: med.presentation,
      dose: numericDose,
      doseUnit: doseUnit,
      dispenseUnit: dispUnit,
      route: chosenRoute,
      frequency: chosenFreq,
      durationDays: chosenDur,
      quantity: chosenQty,
      unit: doseUnit,
      directions: chosenDir,
    }));
  };

  const handleCalcMethodChange = (newMethod: DosingMethod) => {
    setCalcMethod(newMethod);

    // Initialize valid defaults for the selected method while preserving shared inputs
    if (newMethod === 'weight_based') {
      if (!calcDosePerKg) setCalcDosePerKg(selectedMedRef?.dosePerKg ? String(selectedMedRef.dosePerKg) : '10');
      if (!calcDoseUnit) setCalcDoseUnit(selectedMedRef?.doseUnit || medForm.unit || 'mg');
      if (!calcBaseVolume) setCalcBaseVolume('1');
      if (!calcVolumeUnit) setCalcVolumeUnit('mL');
    } else if (newMethod === 'weight_range') {
      if (!calcMinDosePerKg) setCalcMinDosePerKg(selectedMedRef?.minDosePerKg ? String(selectedMedRef.minDosePerKg) : (calcDosePerKg || '10'));
      if (!calcMaxDosePerKg) setCalcMaxDosePerKg(selectedMedRef?.maxDosePerKg ? String(selectedMedRef.maxDosePerKg) : '20');
      if (!calcDoseUnit) setCalcDoseUnit(selectedMedRef?.doseUnit || medForm.unit || 'mg');
    } else if (newMethod === 'weight_band') {
      if (calcBandMinWeight === '' || calcBandMinWeight === undefined) setCalcBandMinWeight('0');
      if (calcBandMaxWeight === '' || calcBandMaxWeight === undefined) setCalcBandMaxWeight('10');
      if (!calcBandDoseValue) setCalcBandDoseValue(selectedMedRef?.fixedDose ? String(selectedMedRef.fixedDose) : '1');
      if (!calcBandDoseUnit) setCalcBandDoseUnit(selectedMedRef?.doseUnit || medForm.unit || 'tablet');
    } else if (newMethod === 'volume_per_weight') {
      if (!calcDoseVolumeAmount) setCalcDoseVolumeAmount(selectedMedRef?.doseVolumeAmount ? String(selectedMedRef.doseVolumeAmount) : '1');
      if (!calcDoseVolumeUnit) setCalcDoseVolumeUnit(selectedMedRef?.doseVolumeUnit || 'mL');
      if (!calcWeightBasis) setCalcWeightBasis(selectedMedRef?.weightBasis ? String(selectedMedRef.weightBasis) : '20');
      if (!calcWeightBasisUnit) setCalcWeightBasisUnit('kg');
    } else if (newMethod === 'reconstituted_liquid') {
      if (!calcReconSourceQty) setCalcReconSourceQty(selectedMedRef?.reconstitutionSourceQty ? String(selectedMedRef.reconstitutionSourceQty) : '1');
      if (!calcReconSourceUnit) setCalcReconSourceUnit(selectedMedRef?.reconstitutionSourceUnit || medForm.unit || 'tablet');
      if (!calcReconDiluentVol) setCalcReconDiluentVol(selectedMedRef?.reconstitutionDiluentVolume ? String(selectedMedRef.reconstitutionDiluentVolume) : '20');
      if (!calcReconDiluentUnit) setCalcReconDiluentUnit(selectedMedRef?.reconstitutionDiluentUnit || 'mL');
      if (!calcReconAdminVol) setCalcReconAdminVol(selectedMedRef?.reconstitutionAdminVolume ? String(selectedMedRef.reconstitutionAdminVolume) : '1');
      if (!calcReconAdminUnit) setCalcReconAdminUnit(selectedMedRef?.reconstitutionAdminUnit || 'mL');
    } else if (newMethod === 'reconstituted_drops') {
      if (!calcReconSourceQty) setCalcReconSourceQty(selectedMedRef?.reconstitutionSourceQty ? String(selectedMedRef.reconstitutionSourceQty) : '1');
      if (!calcReconSourceUnit) setCalcReconSourceUnit(selectedMedRef?.reconstitutionSourceUnit || medForm.unit || 'tablet');
      if (!calcReconDiluentVol) setCalcReconDiluentVol(selectedMedRef?.reconstitutionDiluentVolume ? String(selectedMedRef.reconstitutionDiluentVolume) : '20');
      if (!calcReconDiluentUnit) setCalcReconDiluentUnit(selectedMedRef?.reconstitutionDiluentUnit || 'mL');
      if (!calcDropsPerMl) setCalcDropsPerMl(selectedMedRef?.dropsPerMl ? String(selectedMedRef.dropsPerMl) : '20');
      if (!calcDoseDrops) setCalcDoseDrops(selectedMedRef?.doseDrops ? String(selectedMedRef.doseDrops) : '20');
    } else if (newMethod === 'fixed') {
      if (!calcFixedDose) setCalcFixedDose(selectedMedRef?.fixedDose ? String(selectedMedRef.fixedDose) : '1');
      if (!calcFixedDoseUnit) setCalcFixedDoseUnit(selectedMedRef?.doseUnit || medForm.unit || 'tablet');
    }
  };

  const handleInlineWeightChange = (newWeightStr: string) => {
    setInlineWeight(newWeightStr);
    setCalcWeight(newWeightStr);
    const weightNum = parseFloat(newWeightStr);
    if (selectedMedRef) {
      const res = calculateSmartDose(selectedMedRef, isNaN(weightNum) ? undefined : weightNum, selectedPatient?.species);

      if (!userModifiedDose && res.formattedDoseString) {
        const numericDose = extractNumericDose(res.formattedDoseString);
        const doseUnit = extractDoseUnit(res.formattedDoseString) || res.quantityUnit || prevUnit(selectedMedRef);
        setMedForm((prev) => ({
          ...prev,
          dose: numericDose,
          quantity: res.calculatedQuantity !== undefined ? res.calculatedQuantity : prev.quantity,
          unit: doseUnit || prev.unit,
        }));
      }
    }
  };

  const prevUnit = (med?: Medicine | null) => med?.defaultUnit || 'tablet';

  const handleDoseInputChange = (val: string) => {
    setUserModifiedDose(true);
    // Allow only numeric and decimal point characters (UAT Issue 3)
    const cleanNum = val.replace(/[^0-9.]/g, '');
    setMedForm((prev) => ({ ...prev, dose: cleanNum }));

    // Check min/max dose validation if configured
    if (selectedMedRef && (selectedMedRef.minDosePerKg || selectedMedRef.maxDosePerKg)) {
      const weightNum = inlineWeight ? parseFloat(inlineWeight) : selectedPatient?.weightKg;
      const numericEntered = parseFloat(cleanNum);
      if (!isNaN(numericEntered) && weightNum && weightNum > 0) {
        const minVal = selectedMedRef.minDosePerKg ? selectedMedRef.minDosePerKg * weightNum : undefined;
        const maxVal = selectedMedRef.maxDosePerKg ? selectedMedRef.maxDosePerKg * weightNum : undefined;
        const check = validateDoseRange(numericEntered, minVal, maxVal);
        if (check.isOutOfRange) {
          setRangeValidationWarning(
            'Entered dose is outside the configured dose range. Please review before continuing.'
          );
        } else {
          setRangeValidationWarning(null);
        }
      } else {
        setRangeValidationWarning(null);
      }
    } else {
      setRangeValidationWarning(null);
    }
  };

  const handleSaveMedModal = () => {
    const brand = medForm.brandName.trim() || medModalSearch.trim();
    if (!brand) {
      alert('Please enter or select a medicine name.');
      return;
    }

    const numericApprovedDose = medForm.dose.trim() || '1';
    const doseUnitVal = medForm.doseUnit || 'mg';
    const dispenseUnitVal = medForm.dispenseUnit || medForm.unit || 'tablet';
    const formattedStrengthVolume = selectedMedRef?.strengthVolume || `${numericApprovedDose} ${doseUnitVal}`;

    const newItem: DraftItem = {
      medicineId: selectedMedRef?.id,
      brandName: brand,
      genericName: medForm.genericName || selectedMedRef?.genericName,
      presentation: medForm.presentation,
      dose: numericApprovedDose,
      doseUnit: doseUnitVal,
      strengthVolume: formattedStrengthVolume,
      quantity: Number(medForm.quantity) || 1,
      unit: dispenseUnitVal,
      dispenseUnit: dispenseUnitVal,
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

    setErrors((prev) => ({ ...prev, medicines: undefined, general: undefined }));
    setErrorMsg(null);
    setModalOpen(false);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // ── Apply Treatment Package ───────────────────────────────────
  const handleApplyPackage = async (pkg: TreatmentPackage, skipMismatchCheck = false) => {
    if (!pkg.id) return;

    // Check species compatibility if patient is selected
    if (selectedPatient && !skipMismatchCheck) {
      const pkgSpeciesList =
        pkg.targetSpecies && pkg.targetSpecies.length > 0
          ? pkg.targetSpecies
          : pkg.species
          ? [pkg.species]
          : ['General'];

      const isGeneral = pkgSpeciesList.some(
        (s) => s.toLowerCase() === 'general' || s.toLowerCase() === 'universal'
      );
      const matchesPatient = pkgSpeciesList.some(
        (s) => s.toLowerCase() === selectedPatient.species.toLowerCase()
      );

      if (!isGeneral && !matchesPatient) {
        const proceed = window.confirm(
          `Species Mismatch Warning:\n\nThis treatment package is configured for "${pkgSpeciesList.join(', ')}", but the current patient is a ${selectedPatient.species}.\n\nDo you want to proceed with clinician override?`
        );
        if (!proceed) return;
      }
    }

    try {
      const pkgItems = await db.treatmentPackageItems
        .where('packageId')
        .equals(pkg.id)
        .sortBy('sortOrder');

      if (pkgItems.length === 0) {
        alert('This treatment package contains no items.');
        return;
      }

      const importedItems: DraftItem[] = pkgItems.map((p) => ({
        medicineId: p.medicineId,
        brandName: p.brandName,
        genericName: p.genericName,
        presentation: p.presentation,
        dose: p.strengthVolume,
        strengthVolume: p.strengthVolume,
        quantity: p.quantity,
        unit: p.unit,
        frequency: p.frequency,
        durationDays: p.durationDays,
        route: p.route,
        directions: p.directions,
      }));

      // Append without overwriting existing
      setItems((prev) => [...prev, ...importedItems]);
      if (pkg.defaultInstructions) {
        setAdvice((prev) => (prev.trim() ? prev : pkg.defaultInstructions || ''));
      }
      setShowPkgPopover(false);
      setErrors((prev) => ({ ...prev, medicines: undefined, general: undefined }));
      setErrorMsg(null);

      // Increment package usage count
      await db.treatmentPackages.update(pkg.id, {
        usageCount: (pkg.usageCount || 0) + 1,
        lastUsedAt: new Date(),
      });
    } catch (err) {
      console.error('Error applying treatment package:', err);
    }
  };

  // ── Auto-apply package if navigated with ?packageId= ─────────
  const packageAppliedRef = useRef(false);
  useEffect(() => {
    if (mode === 'new' && packageIdParam && treatmentPackages && !packageAppliedRef.current) {
      const targetPkg = treatmentPackages.find((p) => p.id === packageIdParam);
      if (targetPkg) {
        packageAppliedRef.current = true;
        handleApplyPackage(targetPkg);
      }
    }
  }, [mode, packageIdParam, treatmentPackages]);

  // ── Eligible Clinicians Loader ────────────────────────────────
  const loadEligibleClinicians = async () => {
    setLoadingClinicians(true);
    try {
      const res = await fetch(`${API_BASE}/api/prescriptions/eligible-clinicians`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setEligibleClinicians(data);
          if (!forwardToUserId && data[0]?.id) {
            setForwardToUserId(data[0].id);
          }
          return;
        }
      }
    } catch {
      // Offline fallback
    } finally {
      setLoadingClinicians(false);
    }

    const allPractitioners = await db.practitioners.toArray();
    if (allPractitioners && allPractitioners.length > 0) {
      const fallbackList = allPractitioners.map((p) => ({
        id: String(p.id),
        name: p.name,
        email: p.email || '',
      }));
      setEligibleClinicians(fallbackList);
      if (!forwardToUserId && fallbackList[0]?.id) {
        setForwardToUserId(fallbackList[0].id);
      }
    }
  };

  const handleInitiateSendForApproval = async () => {
    const missing = validateFieldsForSubmission();
    if (missing) return;
    await loadEligibleClinicians();
    setShowForwardModal(true);
  };

  const validateFieldsForSubmission = (): boolean => {
    const newErrors: {
      patient?: string;
      symptoms?: string;
      diagnosis?: string;
      medicines?: string;
      general?: string;
    } = {};

    const missingList: { field: string; message: string; refKey: 'patient' | 'symptoms' | 'diagnosis' | 'medicines' }[] = [];

    if (!selectedPatientId) {
      newErrors.patient = 'Please select a patient animal before proceeding.';
      missingList.push({
        field: 'Patient Animal',
        message: 'A patient animal must be selected to proceed.',
        refKey: 'patient',
      });
    }

    if (!symptoms.trim()) {
      newErrors.symptoms = 'Symptoms / clinical presentation is required.';
      missingList.push({
        field: 'Symptoms / Clinical Presentation',
        message: 'Presenting complaints, vitals, or clinical findings are required.',
        refKey: 'symptoms',
      });
    }
    if (!diagnosis.trim()) {
      newErrors.diagnosis = 'Diagnosis is required.';
      missingList.push({
        field: 'Clinical Diagnosis',
        message: 'A confirmed or provisional diagnosis is required before submission.',
        refKey: 'diagnosis',
      });
    }
    if (items.length === 0) {
      newErrors.medicines = 'Please add at least one prescribed medicine.';
      missingList.push({
        field: 'Prescribed Medicines',
        message: 'Add at least one medicine with approved dosage to the prescription.',
        refKey: 'medicines',
      });
    }

    if (missingList.length > 0) {
      console.warn('[VetRx] Validation prevented submission — missing fields:', missingList);
      newErrors.general = `Please complete all required fields (${missingList.map((m) => m.field).join(', ')}).`;
      setErrors(newErrors);
      setErrorMsg(newErrors.general);
      setValidationErrors(missingList);
      setShowValidationModal(true);
      return true;
    }

    setErrors({});
    setErrorMsg(null);
    setValidationErrors([]);
    return false;
  };

  // ── Save Prescription (Draft, Pending Approval, or Approved) ───────────────────────
  const handleSave = async (targetStatus: 'Draft' | 'Pending Approval' | 'Approved') => {
    console.log('[VetRx] Prescription save requested', {
      targetStatus,
      selectedPatientId,
      canApprove,
    });

    if (mode === 'edit' && existingRx && existingRx.status !== 'Draft' && existingRx.status !== 'Changes Requested') {
      const msg = `${existingRx.status} prescriptions are read-only. Clone the prescription to create a new clinical record.`;
      setGenerationError(msg);
      setShowGenerationErrorModal(true);
      return;
    }

    if (targetStatus === 'Draft') {
      if (!selectedPatientId) {
        setErrors({ patient: 'Please select a patient animal before proceeding.', general: 'Please select a patient animal.' });
        setErrorMsg('Please select a patient animal before saving draft.');
        setValidationErrors([{ field: 'Patient Animal', message: 'A patient animal must be selected.', refKey: 'patient' }]);
        setShowValidationModal(true);
        return;
      }
      await executeSave('Draft');
      return;
    }

    // Validation for submission / approval
    const hasMissing = validateFieldsForSubmission();
    if (hasMissing) return;

    // Staff cannot approve directly
    if (targetStatus === 'Approved') {
      if (!canApprove) {
        // Redirect to forward workflow for staff
        await handleInitiateSendForApproval();
        return;
      }
      setShowIssueConfirmModal(true);
      return;
    }

    if (targetStatus === 'Pending Approval') {
      await handleInitiateSendForApproval();
    }
  };

  const executeSave = async (
    targetStatus: 'Draft' | 'Pending Approval' | 'Approved',
    forwardOptions?: { targetClinicianId: string; forwardingRemarks?: string }
  ) => {
    setIsSaving(true);
    console.log('[VetRx] executeSave running', { targetStatus, patientId: selectedPatientId });

    try {
      const now = new Date();

      // Resilient practitioner lookup: check store, fallback to Dexie
      let practitionerId = practitioner?.id;
      if (!practitionerId) {
        const firstDoc = await db.practitioners.toCollection().first();
        if (firstDoc?.id) {
          practitionerId = firstDoc.id;
        }
      }

      if (!practitionerId) {
        const msg = 'Please configure the veterinarian profile in Settings before creating or generating a prescription.';
        console.error('[VetRx] Generate failed:', msg);
        setErrorMsg(msg);
        setGenerationError(msg);
        setShowGenerationErrorModal(true);
        return;
      }

      const ownerId = selectedPatient?.ownerId;
      if (!ownerId) {
        const msg = 'The selected patient has no valid owner association. Please check the patient record in Patients.';
        console.error('[VetRx] Generate failed:', msg, selectedPatient);
        setErrorMsg(msg);
        setGenerationError(msg);
        setShowGenerationErrorModal(true);
        return;
      }

      if (!selectedPatientId) {
        const msg = 'Please select a patient animal before proceeding.';
        console.error('[VetRx] Generate failed:', msg);
        setErrorMsg(msg);
        setGenerationError(msg);
        setShowGenerationErrorModal(true);
        return;
      }
      const safePatientId: number = selectedPatientId;

      let rxId: number;
      const isResubmission = existingRx?.status === 'Changes Requested';

      // Setup workflow fields
      const isApproved = targetStatus === 'Approved';
      const isPending = targetStatus === 'Pending Approval';

      let targetClinicianUser: { id: string; name: string; email: string } | null = null;
      if (isPending && forwardOptions?.targetClinicianId) {
        const found = eligibleClinicians.find((c) => c.id === forwardOptions.targetClinicianId);
        targetClinicianUser = found || { id: forwardOptions.targetClinicianId, name: 'Veterinarian', email: '' };
      }

      const approverName = user?.name || practitioner?.name || 'Veterinarian';

      if (mode === 'edit' && id) {
        if (existingRx && existingRx.status !== 'Draft' && existingRx.status !== 'Changes Requested') {
          const msg = `${existingRx.status} prescriptions are read-only and cannot be modified. Please clone this prescription instead.`;
          console.error('[VetRx] Save failed:', msg);
          setErrorMsg(msg);
          setGenerationError(msg);
          setShowGenerationErrorModal(true);
          return;
        }
        rxId = parseInt(id, 10);

        const updatedHistory: PrescriptionWorkflowHistoryItem[] = [...(existingRx?.workflowHistory || [])];

        if (isPending && targetClinicianUser) {
          updatedHistory.push({
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
            version: existingRx?.version || 1,
            status: 'Pending Approval',
            action: isResubmission ? 'RESUBMITTED' : 'FORWARDED',
            actorUserId: user?.id || 'current-user',
            actorUser: { id: user?.id || 'current-user', name: user?.name || 'Staff', email: user?.email || '' },
            targetUserId: targetClinicianUser.id,
            targetUser: targetClinicianUser,
            remarks: forwardOptions?.forwardingRemarks?.trim() || (isResubmission ? 'Resubmitted for clinical approval after editing' : 'Submitted for clinical approval'),
            createdAt: now,
          });
        } else if (isApproved) {
          updatedHistory.push({
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
            version: existingRx?.version || 1,
            status: 'Approved',
            action: 'APPROVED',
            actorUserId: user?.id || 'current-user',
            actorUser: { id: user?.id || 'current-user', name: approverName, email: user?.email || '' },
            remarks: approvalRemarks.trim() || 'Direct Clinician Approval',
            createdAt: now,
          });
        }

        await db.prescriptions.update(rxId, {
          patientId: safePatientId,
          ownerId,
          practitionerId,
          symptoms: symptoms.trim() || undefined,
          diagnosis: diagnosis.trim() || undefined,
          instructions: advice.trim() || undefined,
          followUpDays: followUpDays,
          recheckIntervalPreset: recheckIntervalPreset || undefined,
          recheckIntervalCustom: recheckIntervalCustom.trim() || undefined,
          status: targetStatus,
          forwardedToUserId: isPending ? targetClinicianUser?.id : existingRx?.forwardedToUserId,
          forwardedToUser: isPending ? targetClinicianUser || undefined : existingRx?.forwardedToUser,
          forwardedByUserId: isPending ? user?.id : existingRx?.forwardedByUserId,
          forwardedByUser: isPending ? { id: user?.id || 'current-user', name: user?.name || 'Staff', email: user?.email || '' } : existingRx?.forwardedByUser,
          forwardingRemarks: isPending ? forwardOptions?.forwardingRemarks?.trim() || null : existingRx?.forwardingRemarks,
          forwardedAt: isPending ? now : existingRx?.forwardedAt,
          approvedByUserId: isApproved ? user?.id || null : existingRx?.approvedByUserId,
          approvedByUser: isApproved ? { id: user?.id || 'current-user', name: approverName, email: user?.email || '' } : existingRx?.approvedByUser,
          approvedAt: isApproved ? now : existingRx?.approvedAt,
          approvedVersion: isApproved ? existingRx?.version || 1 : existingRx?.approvedVersion,
          approvalRemarks: isApproved ? approvalRemarks.trim() || null : existingRx?.approvalRemarks,
          workflowHistory: updatedHistory,
          updatedAt: now,
        });

        // Replace prescription items
        await db.prescriptionItems.where('prescriptionId').equals(rxId).delete();
      } else {
        // Generate the next year-scoped prescription number without relying on row count.
        const year = now.getFullYear();
        const prefix = `RX-${year}-`;
        const existingNumbers = await db.prescriptions.where('rxNumber').startsWith(prefix).toArray();
        const maxSequence = existingNumbers.reduce((max, rx) => {
          const match = rx.rxNumber.match(new RegExp(`^RX-${year}-(\\d+)$`));
          const sequence = match ? Number(match[1]) : 0;
          return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
        }, 0);
        const rxNumber = `${prefix}${String(maxSequence + 1).padStart(4, '0')}`;

        const initialHistory: PrescriptionWorkflowHistoryItem[] = [];
        if (isPending && targetClinicianUser) {
          initialHistory.push({
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
            version: 1,
            status: 'Pending Approval',
            action: 'FORWARDED',
            actorUserId: user?.id || 'current-user',
            actorUser: { id: user?.id || 'current-user', name: user?.name || 'Staff', email: user?.email || '' },
            targetUserId: targetClinicianUser.id,
            targetUser: targetClinicianUser,
            remarks: forwardOptions?.forwardingRemarks?.trim() || 'Submitted for clinical approval upon creation',
            createdAt: now,
          });
        } else if (isApproved) {
          initialHistory.push({
            id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
            version: 1,
            status: 'Approved',
            action: 'APPROVED',
            actorUserId: user?.id || 'current-user',
            actorUser: { id: user?.id || 'current-user', name: approverName, email: user?.email || '' },
            remarks: approvalRemarks.trim() || 'Direct Clinician Approval',
            createdAt: now,
          });
        }

        rxId = (await db.prescriptions.add({
          rxNumber,
          patientId: safePatientId,
          ownerId,
          practitionerId,
          symptoms: symptoms.trim() || undefined,
          diagnosis: diagnosis.trim() || undefined,
          instructions: advice.trim() || undefined,
          followUpDays: followUpDays,
          recheckIntervalPreset: recheckIntervalPreset || undefined,
          recheckIntervalCustom: recheckIntervalCustom.trim() || undefined,
          status: targetStatus,
          version: 1,
          forwardedToUserId: isPending ? targetClinicianUser?.id : undefined,
          forwardedToUser: isPending ? targetClinicianUser || undefined : undefined,
          forwardedByUserId: isPending ? user?.id : undefined,
          forwardedByUser: isPending ? { id: user?.id || 'current-user', name: user?.name || 'Staff', email: user?.email || '' } : undefined,
          forwardingRemarks: isPending ? forwardOptions?.forwardingRemarks?.trim() || null : undefined,
          forwardedAt: isPending ? now : undefined,
          approvedByUserId: isApproved ? user?.id || null : undefined,
          approvedByUser: isApproved ? { id: user?.id || 'current-user', name: approverName, email: user?.email || '' } : undefined,
          approvedAt: isApproved ? now : undefined,
          approvedVersion: isApproved ? 1 : undefined,
          approvalRemarks: isApproved ? approvalRemarks.trim() || null : undefined,
          workflowHistory: initialHistory,
          createdAt: now,
          updatedAt: now,
        })) as number;
      }

      // Save line items & Auto-add new medicines to formulary (UAT Requirement 4)
      if (items.length > 0) {
        try {
          const formulary = await db.medicines.toArray();
          const assignedMedIds = new Map<number, number>();

          for (let i = 0; i < items.length; i++) {
            const itm = items[i];
            const normBrand = (itm.brandName || '').trim().toLowerCase();
            const normStrength = (itm.strengthVolume || itm.presentation || '').trim().toLowerCase();
            if (!normBrand) continue;

            const exists = formulary.some((m) => {
              const mBrand = (m.brandName || '').trim().toLowerCase();
              const mStrength = (m.strengthVolume || m.presentation || '').trim().toLowerCase();
              return mBrand === normBrand && (mStrength === normStrength || !normStrength);
            });

            if (!exists) {
              const newMedId = (await db.medicines.add({
                brandName: itm.brandName.trim(),
                genericName: itm.genericName?.trim() || undefined,
                presentation: itm.presentation || 'Tablet',
                strengthVolume: itm.strengthVolume || itm.presentation || '1 unit',
                defaultRoute: itm.route || 'PO (Oral)',
                defaultFrequency: itm.frequency || 'BID (q12h)',
                defaultDurationDays: itm.durationDays || 5,
                defaultUnit: itm.dispenseUnit || itm.unit || 'tablet',
                defaultDirections: itm.directions?.trim() || undefined,
                dosingMethod: 'none',
                source: 'prescription',
                isActive: true,
                createdAt: now,
                updatedAt: now,
              })) as number;

              if (!itm.medicineId) {
                assignedMedIds.set(i, newMedId);
              }

              formulary.push({
                id: newMedId,
                brandName: itm.brandName.trim(),
                presentation: itm.presentation || 'Tablet',
                strengthVolume: itm.strengthVolume || itm.presentation || '1 unit',
                isActive: true,
                createdAt: now,
                updatedAt: now,
              } as any);
            }
          }

          const lineItemsToInsert = items.map((itm, idx) => ({
            prescriptionId: rxId,
            medicineId: itm.medicineId || assignedMedIds.get(idx),
            brandName: itm.brandName,
            genericName: itm.genericName,
            presentation: itm.presentation,
            strengthVolume: itm.strengthVolume,
            dose: itm.dose || itm.strengthVolume,
            doseUnit: itm.doseUnit || extractDoseUnit(itm.dose) || 'mg',
            quantity: itm.quantity,
            unit: itm.dispenseUnit || itm.unit || 'tablet',
            dispenseQuantity: itm.quantity,
            dispenseUnit: itm.dispenseUnit || itm.unit || 'tablet',
            frequency: itm.frequency,
            durationDays: itm.durationDays,
            route: itm.route,
            directions: itm.directions,
            sortOrder: idx,
          }));

          await db.prescriptionItems.bulkAdd(lineItemsToInsert);
        } catch (fErr) {
          console.warn('[VetRx] Non-blocking: Could not auto-add new medicines to formulary:', fErr);
        }
      }

      console.log('[VetRx] Prescription generation completed successfully', { rxId, targetStatus });
      // Navigate to View / Preview page
      navigate(`/prescriptions/${rxId}`);
    } catch (err) {
      console.error('VetRx Generate failed:', err);
      const msg = err instanceof Error
        ? err.message
        : 'Unable to generate the prescription. Please check the entered details.';
      setErrorMsg(msg);
      setGenerationError(msg);
      setShowGenerationErrorModal(true);
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================================
  // VIEW 1: STEP 1 - SELECT ANIMAL (if no patient selected)
  // Matches Stitch: vetrx_select_animal_wireframe_flow
  // ============================================================
  if (!selectedPatientId) {
    return (
      <div className="rx-page-container">
        <div className="rx-select-animal-container">
          {/* Stepper Header */}
          <div className="rx-stepper-header">
            <div className="rx-stepper-top">
              <div className="rx-stepper-badge">
                <span className="rx-stepper-pulse-dot" />
                <span>Step 1 of 4 · Select Animal</span>
              </div>
              <span className="text-xs text-outline font-mono">Prescription Builder</span>
            </div>

            <div className="flex items-baseline justify-between mt-2">
              <div>
                <h1 className="rx-title">New Prescription</h1>
                <p className="rx-subtitle">Select an animal to start the prescription regimen.</p>
              </div>
              <div className="rx-stepper-track">
                <div className="rx-stepper-pill active" />
                <div className="rx-stepper-pill" />
                <div className="rx-stepper-pill" />
                <div className="rx-stepper-pill" />
              </div>
            </div>

            <div className="rx-stepper-breadcrumbs">
              <span className="rx-crumb-active">1. Select Animal</span>
              <span>→</span>
              <span>2. Clinical Details</span>
              <span>→</span>
              <span>3. Medicines</span>
              <span>→</span>
              <span>4. Generate</span>
            </div>
          </div>

          {/* Search Bar */}
          <div className="rx-select-animal-searchbar">
            <div className="rx-select-search-icon">
              <Icon name="search" size={22} />
            </div>
            <input
              type="search"
              placeholder="Search owner, animal, breed, or phone..."
              value={animalSearch}
              onChange={(e) => setAnimalSearch(e.target.value)}
              autoFocus
            />
            <div className="rx-kbd-hint">Press /</div>
          </div>

          {/* Filter Pills */}
          <div className="rx-quick-filter-pills">
            <span className="text-xs uppercase text-outline font-bold mr-1">Filter by:</span>
            {['All', 'Canine', 'Feline', 'Equine', 'Avian'].map((spec, idx) => (
              <button
                key={`spec-pill-${spec}-${idx}`}
                type="button"
                className={`btn btn-sm ${speciesFilter === spec ? 'btn-primary' : 'btn-secondary'}`}
                style={{ borderRadius: 'var(--radius-full)' }}
                onClick={() => setSpeciesFilter(spec)}
              >
                {spec}
              </button>
            ))}
          </div>

          {/* Guided Patient Selection Banner & Prominent Register Button */}
          <div className="rx-patient-guide-banner">
            <div className="flex items-center gap-3 min-w-0">
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 'var(--radius)',
                  background: 'rgba(0, 104, 95, 0.12)',
                  color: 'var(--color-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="paw" size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-xs uppercase font-bold text-primary tracking-wider">
                  Step 1: Patient Selection
                </span>
                <p className="rx-patient-guide-instruction">
                  Select the patient from the list or create a new patient to start the prescription.
                </p>
                <span style={{ fontSize: '11px', color: 'var(--color-outline)', marginTop: '2px' }}>
                  Please verify that the farmer is not present in the list below already.
                </span>
              </div>
            </div>

            {filteredPatients.length > 0 && (
              <button
                type="button"
                className="rx-register-btn-prominent"
                onClick={() => setRegisterWarningModalOpen(true)}
              >
                <Icon name="plus" size={16} />
                <span>Register New Patient</span>
              </button>
            )}
          </div>

          {/* Recent / Matching Animal Cards */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5 text-outline">
                <Icon name="history" size={16} />
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface">
                  Registered Animals
                </span>
              </div>
              <span className="text-xs text-outline font-mono">
                Showing {filteredPatients.length} animals
              </span>
            </div>

            <div className="rx-animal-cards-list">
              {filteredPatients.length === 0 ? (
                <div className="rx-patient-empty-state">
                  <div className="rx-patient-empty-icon-wrap">
                    <Icon name="paw" size={26} />
                  </div>
                  <h3 className="rx-patient-empty-title">
                    {animalSearch.trim()
                      ? `No animals match "${animalSearch}"`
                      : 'No animals found'}
                  </h3>
                  <p className="rx-patient-empty-sub">
                    Register a new patient or clear the search criteria.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => setRegisterWarningModalOpen(true)}
                  >
                    <Icon name="plus" size={16} />
                    <span>Register New Patient</span>
                  </button>
                </div>
              ) : (
                filteredPatients.map((patient, idx) => {
                  const owner = ownersMap.get(patient.ownerId);
                  const avatarLetter = (owner?.name || patient.name || patient.species || 'C').charAt(0).toUpperCase();
                  return (
                    <div key={`pat-card-${patient.id || patient.name}-${idx}`} className="rx-select-animal-card">
                      <div className="rx-select-card-left">
                        <div className="rx-select-card-avatar">
                          {avatarLetter}
                          <span className="rx-select-card-badge">
                            <Icon name="paw" size={11} />
                          </span>
                        </div>

                        <div className="rx-select-card-info">
                          <div className="rx-select-card-title-row">
                            <span className="rx-select-card-name">{formatOwnerPrimary(owner, 'Client')}</span>
                            {owner?.phone && (
                              <span style={{ fontSize: '12px', color: 'var(--color-on-surface-variant)', fontFamily: 'var(--font-data)' }}>
                                ({owner.phone})
                              </span>
                            )}
                            <span className="rx-select-card-id">#{patient.species.slice(0, 3).toUpperCase()}-{patient.id}</span>
                          </div>

                          <div className="rx-select-card-meta">
                            <span className="font-medium text-on-surface">{formatAnimalSubtitle(patient)}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => setSelectedPatientId(patient.id!)}
                      >
                        <span>Select &amp; Start Rx</span>
                        <Icon name="arrow-forward" size={16} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Duplicate Farmer/Client Prevention Warning Modal */}
        {registerWarningModalOpen && (
          <div
            className="rx-warning-modal-backdrop"
            onClick={() => setRegisterWarningModalOpen(false)}
          >
            <div
              className="rx-warning-modal-dialog"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="register-warning-title"
            >
              <div className="rx-warning-modal-header">
                <div className="flex items-center gap-2">
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 'var(--radius)',
                      background: 'rgba(186, 26, 26, 0.1)',
                      color: 'var(--color-error)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon name="warning" size={18} />
                  </div>
                  <h3
                    id="register-warning-title"
                    className="font-heading font-bold text-base text-on-surface"
                  >
                    Client Verification
                  </h3>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-icon btn-sm"
                  onClick={() => setRegisterWarningModalOpen(false)}
                >
                  <Icon name="x-mark" size={18} />
                </button>
              </div>

              <div className="rx-warning-modal-body">
                <p className="text-sm text-on-surface leading-relaxed">
                  Please verify that the farmer/client is not already present in the list below before registering a new patient.
                </p>
                <div className="p-3 bg-surface-container-low rounded-xl text-xs text-outline leading-relaxed border border-border">
                  <strong className="text-on-surface">Why check first?</strong> Registering duplicate clients scatters clinical history and prescription records. You can link new animals directly to an existing farmer account.
                </div>
              </div>

              <div className="rx-warning-modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setRegisterWarningModalOpen(false)}
                >
                  Back to List
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    setRegisterWarningModalOpen(false);
                    navigate('/patients/new?from=rx');
                  }}
                >
                  <span>Continue Registration</span>
                  <Icon name="arrow-forward" size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ============================================================
  // VIEW 2: STEP 2 & 3 - CLINICAL DETAILS & MEDICINES WORKSPACE
  // Matches Stitch: vetrx_new_prescription_clinical_details_desktop
  // ============================================================
  return (
    <div className="rx-page-container">
      {/* Stepper Header */}
      <div className="rx-stepper-header">
        <div className="rx-stepper-top">
          <div className="rx-stepper-badge">
            <span className="rx-stepper-pulse-dot" />
            <span>Step 2 &amp; 3 of 4 · Clinical Details &amp; Medicines</span>
          </div>
          <span className="font-mono text-xs px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-bold">
            {mode === 'edit' ? existingRx?.rxNumber : '#RX-2026-DRAFT'}
          </span>
        </div>

        <div className="flex items-baseline justify-between mt-1">
          <div>
            <h1 className="rx-title">
              {mode === 'edit' ? `Edit Prescription ${existingRx?.rxNumber || ''}` : 'New Prescription'}
            </h1>
            <p className="rx-subtitle">
              Document clinical presentation, confirm diagnosis, and configure pharmacotherapy.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleResetToNew}
              title="Start a fresh new prescription"
            >
              <Icon name="plus" size={14} />
              <span>New Prescription</span>
            </button>
            <div className="rx-stepper-track">
              <div className="rx-stepper-pill active" />
              <div className="rx-stepper-pill active" />
              <div className="rx-stepper-pill active" />
              <div className="rx-stepper-pill" />
            </div>
          </div>
        </div>

        <div className="rx-stepper-breadcrumbs">
          <span className="cursor-pointer hover:underline text-outline" onClick={() => setSelectedPatientId(null)}>
            1. Select Animal ({selectedPatient?.name})
          </span>
          <span>→</span>
          <span className="rx-crumb-active cursor-pointer hover:underline" onClick={() => symptomsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            2. Clinical Details
          </span>
          <span>→</span>
          <span className="rx-crumb-active cursor-pointer hover:underline" onClick={() => medicinesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
            3. Medicines
          </span>
          <span>→</span>
          <span
            className="rx-crumb-active cursor-pointer font-bold hover:underline"
            style={{ color: 'var(--color-primary)' }}
            onClick={() => handleSave(canApprove ? 'Approved' : 'Pending Approval')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSave(canApprove ? 'Approved' : 'Pending Approval'); }}
            title={canApprove ? 'Click to review and approve prescription' : 'Click to submit for veterinarian approval'}
          >
            4. {canApprove ? 'Approve & Sign' : 'Send for Approval'}
          </span>
        </div>
      </div>

      {mode === 'edit' && existingRx && existingRx.status !== 'Draft' && existingRx.status !== 'Changes Requested' && (
        <div
          style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-xl)',
            padding: '16px 20px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            color: '#991b1b',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Icon name="warning" size={24} color="#dc2626" />
            <div>
              <strong style={{ fontSize: '14px', display: 'block' }}>
                {existingRx.status === 'Approved' ? 'Approved Prescription (Legally Sealed)' : `${existingRx.status} Prescription (Read-Only)`}
              </strong>
              <span style={{ fontSize: '12.5px', color: '#7f1d1d' }}>
                {existingRx.status === 'Approved'
                  ? 'Approved prescriptions are sealed clinical records and cannot be edited.'
                  : `${existingRx.status} prescriptions cannot be modified directly.`}{' '}
                Clone this prescription to create a new editable version.
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => navigate(`/prescriptions/new?cloneFrom=${existingRx.id}`)}
            style={{ flexShrink: 0 }}
          >
            <Icon name="copy" size={16} />
            <span>Clone Prescription</span>
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3 bg-error-container text-on-error-container rounded-xl text-sm font-semibold flex items-center gap-2">
          <Icon name="warning" size={18} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Workspace (8fr / 4fr) */}
      <div className="rx-builder-grid">
        {/* ── LEFT COLUMN (8 cols) ──────────────────────────────── */}
        <div className="flex flex-col gap-space-lg">
          {/* 1. Patient Identity Card */}
          <div className="rx-patient-summary-card">
            <div className="rx-patient-left">
              <div className="rx-patient-badge-avatar">
                <Icon name="paw" size={24} />
                <span className="rx-patient-verified-tick">✓</span>
              </div>
              <div className="flex flex-col">
                <div className="rx-patient-title-group">
                  <span className="rx-patient-name-bold">{formatOwnerPrimary(selectedOwner, 'Client')}</span>
                  {selectedOwner?.phone && (
                    <span style={{ fontSize: '13px', fontFamily: 'var(--font-data)', color: 'var(--color-on-surface-variant)' }}>
                      ({selectedOwner.phone})
                    </span>
                  )}
                  {selectedPatient?.species && (
                    <span className="rx-species-pill">{selectedPatient.species}</span>
                  )}
                  {selectedPatient?.weightKg && (
                    <span className="rx-weight-pill">Weight: {selectedPatient.weightKg} kg</span>
                  )}
                </div>
                <div className="rx-signalment-subline">
                  <span className="font-medium text-on-surface">
                    {formatAnimalSubtitle(selectedPatient)}
                  </span>
                </div>
              </div>
            </div>

            {mode === 'new' && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setSelectedPatientId(null)}
              >
                <Icon name="swap-horiz" size={16} />
                <span>Change Animal</span>
              </button>
            )}
          </div>

          {/* 2. Clinical Details Card */}
          <div className="rx-clinical-card">
            <div className="rx-card-heading-row">
              <div style={{ color: 'var(--color-primary)' }}>
                <Icon name="stethoscope" size={20} />
              </div>
              <h2 className="rx-card-heading">Clinical Details</h2>
            </div>

            <div className="form-group">
              <ClinicalCombobox
                label="Symptoms / Clinical Presentation"
                value={symptoms}
                onChange={(val) => {
                  setSymptoms(val);
                  if (errors.symptoms) {
                    setErrors((prev) => ({ ...prev, symptoms: undefined, general: undefined }));
                    setErrorMsg(null);
                  }
                }}
                suggestions={suggestedSymptoms}
                placeholder="Describe presenting symptoms, physical findings, and relevant clinical observations…"
                required={true}
                isTextarea={true}
                rows={3}
                error={errors.symptoms}
              />
            </div>

            <div className="form-group">
              <ClinicalCombobox
                label="Diagnosis"
                value={diagnosis}
                onChange={(val) => {
                  setDiagnosis(val);
                  if (errors.diagnosis) {
                    setErrors((prev) => ({ ...prev, diagnosis: undefined, general: undefined }));
                    setErrorMsg(null);
                  }
                }}
                suggestions={suggestedDiagnoses}
                placeholder="Enter confirmed or tentative diagnosis (e.g. Canine Acute Otitis Externa)..."
                required={true}
                isTextarea={false}
                iconName="verified"
                error={errors.diagnosis}
              />
            </div>

          </div>

          {/* 3. Prescribed Medicines Section */}
          <div
            ref={medicinesRef}
            className={`rx-medicines-card ${errors.medicines ? 'rx-input-error' : ''}`}
          >
            <div className="rx-medicines-header-row">
              <div className="rx-medicines-title-group">
                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius)', background: 'var(--color-primary-container)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="pill" size={18} />
                </div>
                <div>
                  <h2 className="rx-card-heading rx-medicines-heading">
                    <span>Prescribed Medicines</span>{' '}
                    <span className="rx-medicines-count-badge">
                      • {items.length} added
                    </span>
                  </h2>
                  <p className="text-xs text-outline" style={{ margin: 0, marginTop: '2px', fontSize: '12px', color: 'var(--color-outline)' }}>
                    Active pharmaceutical items to be dispensed with instructions
                  </p>
                </div>
              </div>

              <div className="rx-medicines-actions">
                {/* Apply Treatment Package Trigger */}
                <div className="relative" ref={pkgPopoverRef}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowPkgPopover(!showPkgPopover)}
                    title="Apply reusable treatment template"
                  >
                    <Icon name="sparkles" size={16} />
                    <span>Apply Treatment Package</span>
                    <Icon name="chevron-down" size={14} />
                  </button>

                  {/* Popover */}
                  {showPkgPopover && (
                    <div className="rx-pkg-popover" style={{ minWidth: 320, maxWidth: 360 }}>
                      <div className="rx-pkg-popover-header">
                        <span>Treatment Packages</span>
                        <span className="font-mono text-xs">{treatmentPackages?.length || 0} available</span>
                      </div>
                      {!treatmentPackages || treatmentPackages.length === 0 ? (
                        <div className="p-3 text-xs text-outline text-center">
                          No packages available.
                        </div>
                      ) : (
                        treatmentPackages.map((pkg, idx) => {
                          const pkgSpeciesList =
                            pkg.targetSpecies && pkg.targetSpecies.length > 0
                              ? pkg.targetSpecies
                              : pkg.species
                              ? [pkg.species]
                              : ['General'];
                          const isGeneral = pkgSpeciesList.some(
                            (s) => s.toLowerCase() === 'general' || s.toLowerCase() === 'universal'
                          );
                          const isMismatch =
                            selectedPatient &&
                            !isGeneral &&
                            !pkgSpeciesList.some(
                              (s) => s.toLowerCase() === selectedPatient.species.toLowerCase()
                            );

                          return (
                            <div
                              key={`pkg-item-${pkg.id || pkg.name}-${idx}`}
                              className="rx-pkg-item"
                              style={{ alignItems: 'flex-start', padding: '10px 12px' }}
                            >
                              <div className="flex flex-col min-w-0 flex-1 pr-2">
                                <span className="rx-pkg-name truncate" style={{ fontWeight: 600 }}>
                                  {pkg.name}
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                  <span className="rx-pkg-sub truncate">
                                    {pkg.category || 'Clinical Protocol'}
                                  </span>
                                  <span className="text-outline-variant">•</span>
                                  <span
                                    className="text-xs"
                                    style={{
                                      color: isMismatch ? 'var(--color-error)' : 'var(--color-primary)',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {pkgSpeciesList.join(', ')}
                                  </span>
                                </div>
                                {isMismatch && (
                                  <span
                                    className="text-xs"
                                    style={{ color: 'var(--color-error)', marginTop: 3, fontWeight: 500 }}
                                  >
                                    ⚠️ Mismatch for {selectedPatient.species}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                className={`btn btn-sm ${isMismatch ? 'btn-secondary' : 'btn-primary'}`}
                                style={{ height: 26, padding: '0 10px', fontSize: 11, flexShrink: 0 }}
                                onClick={() => handleApplyPackage(pkg)}
                              >
                                {isMismatch ? 'Override' : 'Apply'}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>

                {/* Primary Add Medicine Button */}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={openAddMedModal}
                >
                  <Icon name="plus" size={16} />
                  <span>Add Medicine</span>
                </button>
              </div>
            </div>

            {errors.medicines && (
              <div className="rx-field-error rx-medicines-error" id="medicines-error" role="alert">
                <Icon name="warning" size={14} />
                <span>{errors.medicines}</span>
              </div>
            )}

            {/* Prescribed Items List */}
            {items.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-surface-container-low border border-dashed border-outline-variant text-outline">
                <Icon name="pill" size={28} className="mx-auto mb-2 text-primary" />
                <p className="font-heading font-bold text-on-surface text-sm mb-1">
                  No medicines prescribed yet
                </p>
                <p className="text-xs text-outline mb-3">
                  Click "Add Medicine" or apply a standard Treatment Package to populate.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={openAddMedModal}
                >
                  <Icon name="plus" size={14} />
                  <span>Add First Medicine</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {items.map((itm, idx) => (
                  <div key={`med-item-card-${itm.medicineId || itm.brandName}-${idx}`} className="rx-med-item-card">
                    <div className="rx-med-item-left">
                      <div className="rx-med-badge">Rx {idx + 1}</div>
                      <div className="rx-med-details">
                        <div className="rx-med-title-row">
                          <span className="rx-med-name">{itm.brandName}</span>
                          <span className="rx-med-qty-badge">
                            Dispense: {itm.quantity} {itm.dispenseUnit || itm.unit}
                          </span>
                        </div>

                        <div className="rx-med-regimen-pills">
                          {itm.dose && (
                            <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>
                              Dose: {itm.dose} {itm.doseUnit || ''}
                            </span>
                          )}
                          {itm.route && (
                            <>
                              <span>•</span>
                              <span>{itm.route}</span>
                            </>
                          )}
                          {itm.frequency && (
                            <>
                              <span>•</span>
                              <span>{itm.frequency}</span>
                            </>
                          )}
                          {itm.durationDays && (
                            <>
                              <span>•</span>
                              <span>{itm.durationDays} days</span>
                            </>
                          )}
                        </div>

                        {itm.directions && (
                          <div className="rx-med-sig-box">
                            <strong>Sig: </strong> {itm.directions}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rx-med-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => openEditMedModal(idx)}
                        title="Edit medicine"
                      >
                        <Icon name="edit" size={15} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-destructive btn-sm"
                        onClick={() => handleRemoveItem(idx)}
                        title="Remove medicine"
                      >
                        <Icon name="trash" size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 4. Owner Advice & Follow-Up Card */}
          <div className="rx-advice-card">
            <div className="form-group">
              <div className="flex items-center gap-2 mb-1">
                <Icon name="info" size={18} className="text-secondary" />
                <label className="form-label mb-0">Advice &amp; Client Instructions</label>
              </div>
              <textarea
                className="rx-textarea"
                rows={3}
                placeholder="Instructions and home care advice for the owner (e.g. Keep ears dry, feed with meal, use e-collar if scratching)..."
                value={advice}
                onChange={(e) => setAdvice(e.target.value)}
              />
            </div>

            <div className="rx-followup-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
              <div>
                <span className="text-xs font-bold uppercase text-on-surface block">
                  Recheck Recommended
                </span>
                <span className="text-xs text-outline">Clinical re-evaluation interval</span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', width: '100%' }}>
                <select
                  className="form-select"
                  style={{ maxWidth: '200px' }}
                  value={recheckIntervalPreset}
                  onChange={(e) => {
                    const val = e.target.value;
                    setRecheckIntervalPreset(val);
                    if (val === 'None') setFollowUpDays(0);
                    else if (val === '3 days') setFollowUpDays(3);
                    else if (val === '5 days') setFollowUpDays(5);
                    else if (val === '7 days') setFollowUpDays(7);
                    else if (val === '14 days') setFollowUpDays(14);
                  }}
                >
                  <option value="None">None</option>
                  <option value="3 days">3 days</option>
                  <option value="5 days">5 days</option>
                  <option value="7 days">7 days</option>
                  <option value="14 days">14 days</option>
                  <option value="Custom">Custom</option>
                </select>

                {recheckIntervalPreset === 'Custom' && (
                  <input
                    type="text"
                    className="form-input"
                    style={{ flex: 1, minWidth: '180px' }}
                    placeholder="e.g. 10 days, after blood work, next Monday"
                    value={recheckIntervalCustom}
                    onChange={(e) => setRecheckIntervalCustom(e.target.value)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: SUMMARY LEDGER (4 cols sticky) ──────── */}
        <div className="rx-summary-column">
          <div className="rx-summary-ledger">
            <div className="rx-summary-header">
              <h3 className="rx-card-heading flex items-center gap-2">
                <Icon name="prescription" size={18} />
                <span>Prescription Summary</span>
              </h3>
              <span className="rx-status-pill issued">
                <span className="status-dot" />
                <span>{diagnosis ? 'Ready' : 'In Progress'}</span>
              </span>
            </div>

            <div className="rx-summary-grid-box">
              <div className="rx-summary-stat-row">
                <span className="rx-summary-stat-label">Patient:</span>
                <span className="rx-summary-stat-value">
                  {selectedPatient?.name || 'Patient'} ({selectedPatient?.species || 'Animal'})
                </span>
              </div>
              <div className="rx-summary-stat-row">
                <span className="rx-summary-stat-label">Diagnosis:</span>
                <span className="rx-summary-stat-value text-right truncate max-w-[170px]">
                  {diagnosis || 'Pending'}
                </span>
              </div>
              <div className="rx-summary-stat-row">
                <span className="rx-summary-stat-label">Recheck:</span>
                <span className="rx-summary-stat-value primary">
                  {recheckIntervalPreset === 'Custom' && recheckIntervalCustom
                    ? recheckIntervalCustom
                    : recheckIntervalPreset !== 'None'
                    ? recheckIntervalPreset
                    : followUpDays
                    ? `${followUpDays} days`
                    : 'None'}
                </span>
              </div>
              <div className="rx-summary-stat-row">
                <span className="rx-summary-stat-label">Items Prescribed:</span>
                <span className="rx-summary-stat-value">{items.length} items</span>
              </div>
            </div>

            {items.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs uppercase font-bold text-outline">
                  Itemized Schedule
                </span>
                <div className="rx-schedule-list">
                  {items.map((itm, i) => (
                    <div key={`sched-item-${itm.medicineId || itm.brandName}-${i}`} className="rx-schedule-row">
                      <span className="rx-schedule-med">{itm.brandName}</span>
                      <span className="rx-schedule-freq">
                        {itm.quantity} {itm.dispenseUnit || itm.unit} • {itm.frequency}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2 border-t border-surface-container">
              {errors.general && (
                <div className="rx-summary-error-banner" role="alert" style={{ cursor: 'pointer' }} onClick={() => setShowValidationModal(true)}>
                  <Icon name="warning" size={16} />
                  <span>{errors.general}</span>
                </div>
              )}

              {!canApprove && (
                <div
                  style={{
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-md, 8px)',
                    background: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    color: '#1e40af',
                    fontSize: '12px',
                    lineHeight: 1.4,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <Icon name="information-circle" size={16} color="#2563eb" />
                  <span>
                    Staff workflow: Prescriptions must be submitted to a licensed veterinarian for clinical approval and digital signing.
                  </span>
                </div>
              )}

              {canApprove ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ height: 46, width: '100%', background: '#059669', borderColor: '#047857' }}
                  disabled={isSaving}
                  onClick={() => handleSave('Approved')}
                  data-testid="generate-prescription-btn"
                  id="generate-prescription-btn"
                >
                  {isSaving ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                      <span>Approving Prescription…</span>
                    </>
                  ) : (
                    <>
                      <Icon name="check-circle" size={18} />
                      <span>Approve &amp; Sign Prescription</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{ height: 46, width: '100%' }}
                  disabled={isSaving}
                  onClick={() => handleSave('Pending Approval')}
                  data-testid="generate-prescription-btn"
                  id="generate-prescription-btn"
                >
                  {isSaving ? (
                    <>
                      <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                      <span>Submitting for Approval…</span>
                    </>
                  ) : (
                    <>
                      <Icon name="arrow-forward" size={18} />
                      <span>{existingRx?.status === 'Changes Requested' ? 'Resubmit for Veterinarian Approval' : 'Send for Veterinarian Approval'}</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: 42, width: '100%' }}
                disabled={isSaving}
                onClick={() => handleSave('Draft')}
              >
                <Icon name="save" size={16} />
                <span>Save as Draft</span>
              </button>

              <p className="text-center text-xs text-outline mt-1">
                {canApprove
                  ? 'Digitally signs prescription and seals clinical record'
                  : 'Forwards prescription to licensed veterinarian for review'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL: ADD / EDIT MEDICINE ─────────────────────────── */}
      {modalOpen && (
        <div className="rx-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="rx-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="rx-modal-header">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div style={{ width: 32, height: 32, minWidth: 32, minHeight: 32, borderRadius: 'var(--radius)', background: 'var(--color-primary)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon name="pill" size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading font-bold text-base text-on-surface truncate">
                    {editingItemIndex !== null ? 'Edit Medicine' : 'Add Medicine to Prescription'}
                  </h3>
                  <span className="text-xs text-outline block truncate">Search formulary or configure dosing</span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm shrink-0"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
              >
                <Icon name="x-mark" size={18} />
              </button>
            </div>

            <div className="rx-modal-body">
              {/* Search or Brand Name */}
              <div className="form-group">
                <label className="form-label">Search Formulation / Brand Name</label>
                <div style={{ position: 'relative', zIndex: 60 }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Amoxicillin, Enrofloxacin, Antibiotic..."
                    value={medModalSearch}
                    onChange={(e) => {
                      setMedModalSearch(e.target.value);
                      setHighlightedMedIndex(0);
                      setMedForm((p) => ({ ...p, brandName: e.target.value }));
                    }}
                    onKeyDown={(e) => {
                      const currentList = matchingMedicines.slice(0, 15);
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setHighlightedMedIndex((prev) => (currentList.length === 0 ? -1 : (prev + 1) % currentList.length));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHighlightedMedIndex((prev) => (currentList.length === 0 ? -1 : (prev <= 0 ? currentList.length - 1 : prev - 1)));
                      } else if (e.key === 'Enter') {
                        if (highlightedMedIndex >= 0 && highlightedMedIndex < currentList.length) {
                          e.preventDefault();
                          handleSelectMedRef(currentList[highlightedMedIndex]);
                        }
                      } else if (e.key === 'Escape') {
                        setMedModalSearch('');
                        setHighlightedMedIndex(-1);
                      }
                    }}
                    autoFocus
                  />

                  {/* Live Search Results / Empty State */}
                  {medModalSearch.trim().length > 0 && !selectedMedRef && (
                    matchingMedicines.length === 0 ? (
                      <div className="formulation-empty-state rx-live-med-empty" role="status" aria-live="polite">
                        <Icon name="search" size={16} />
                        <span>No matching medicines found.</span>
                      </div>
                    ) : (
                      <div className="rx-live-med-dropdown" role="listbox">
                        {matchingMedicines.slice(0, 15).map((med, idx) => (
                          <div
                            key={`search-med-${med.id}-${idx}`}
                            role="option"
                            aria-selected={highlightedMedIndex === idx}
                            className={`rx-live-med-item ${highlightedMedIndex === idx ? 'highlighted' : ''}`}
                            onMouseEnter={() => setHighlightedMedIndex(idx)}
                            onClick={() => handleSelectMedRef(med)}
                          >
                            <div className="rx-live-med-left">
                              <span className="rx-live-med-brand">{med.brandName}</span>
                              {med.genericName && (
                                <span className="rx-live-med-generic">{med.genericName}</span>
                              )}
                            </div>
                            <div className="rx-live-med-right">
                              {med.category && (
                                <span className="rx-live-med-cat">{med.category}</span>
                              )}
                              {(med.presentation || med.strengthVolume) && (
                                <span className="rx-live-med-specs">
                                  {med.strengthVolume || med.presentation}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </div>

                {/* Selected Medicine Banner */}
                {selectedMedRef && (
                  <div className="rx-selected-med-banner">
                    <div className="flex items-center gap-2 min-w-0">
                      <Icon name="check-circle" size={16} className="text-primary shrink-0" />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-on-surface truncate">
                          {selectedMedRef.brandName}
                        </span>
                        <span className="text-xs text-outline truncate">
                          {selectedMedRef.genericName ? `${selectedMedRef.genericName} • ` : ''}
                          {selectedMedRef.category || 'Medication'}
                          {selectedMedRef.strengthVolume ? ` • ${selectedMedRef.strengthVolume}` : ''}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm text-xs shrink-0"
                      onClick={() => {
                        setSelectedMedRef(null);
                        setMedModalSearch('');
                      }}
                    >
                      Change
                    </button>
                  </div>
                )}

                {/* ── Optional Dose Calculation Section (UAT Issue 3 & 4) ── */}
                <div className="rx-dose-calc-accordion">
                  <button
                    type="button"
                    className="rx-dose-calc-accordion-toggle"
                    onClick={() => setIsDoseCalcOpen(!isDoseCalcOpen)}
                  >
                    <div className="rx-dose-calc-header-left">
                      <div className="rx-dose-calc-icon">
                        <Icon name="calculator" size={16} />
                      </div>
                      <div className="rx-dose-calc-text-col">
                        <span className="rx-dose-calc-title">Optional dose calculation</span>
                        <span className="rx-dose-calc-subtitle">Weight-based dose, concentration &amp; quantity calculator</span>
                      </div>
                    </div>
                    <div className="rx-dose-calc-header-right">
                      <span>{isDoseCalcOpen ? 'Hide calculator' : 'Show calculator'}</span>
                      <Icon name={isDoseCalcOpen ? 'chevron-up' : 'chevron-down'} size={14} />
                    </div>
                  </button>

                  {isDoseCalcOpen && (
                    <div className="rx-dose-calc-accordion-body">
                      {/* Method Selector */}
                      <div className="form-group" style={{ marginBottom: '12px' }}>
                        <label className="form-label" style={{ fontSize: '11.5px', fontWeight: 600 }}>Calculation Method</label>
                        <select
                          className="form-select"
                          value={calcMethod}
                          onChange={(e) => handleCalcMethodChange(e.target.value as DosingMethod)}
                        >
                          {DOSING_METHOD_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="rx-dose-calc-grid">
                        {/* ── METHOD A: VOLUME PER BODY WEIGHT ── */}
                        {calcMethod === 'volume_per_weight' && (
                          <>
                            <DoseCalcNumericField
                              label="1. Patient Weight"
                              value={calcWeight}
                              onChange={(val) => {
                                setCalcWeight(val);
                                handleInlineWeightChange(val);
                              }}
                              unit="kg"
                              placeholder="e.g. 20"
                            />

                            <DoseCalcNumericField
                              label="2. Dose Volume"
                              value={calcDoseVolumeAmount}
                              onChange={setCalcDoseVolumeAmount}
                              unitOptions={availableUnits}
                              selectedUnit={calcDoseVolumeUnit}
                              onUnitChange={setCalcDoseVolumeUnit}
                              placeholder="e.g. 1"
                              min={0.01}
                            />

                            <DoseCalcNumericField
                              label="3. Weight Basis"
                              value={calcWeightBasis}
                              onChange={setCalcWeightBasis}
                              unit="kg"
                              placeholder="e.g. 20"
                              min={0.01}
                            />

                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11.5px' }}>4. Calculated Volume</label>
                              <div className="rx-calc-badge-display highlight">
                                {doseCalcMetrics.calculatedVolume > 0
                                  ? `${doseCalcMetrics.calculatedVolume} ${calcDoseVolumeUnit}`
                                  : '—'}
                              </div>
                            </div>
                          </>
                        )}

                        {/* ── METHOD B: RECONSTITUTED TABLET/UNIT -> LIQUID VOLUME ── */}
                        {calcMethod === 'reconstituted_liquid' && (
                          <>
                            <DoseCalcNumericField
                              label="1. Source Quantity"
                              value={calcReconSourceQty}
                              onChange={setCalcReconSourceQty}
                              unitOptions={availableUnits}
                              selectedUnit={calcReconSourceUnit}
                              onUnitChange={setCalcReconSourceUnit}
                              placeholder="e.g. 1"
                              min={0.01}
                            />

                            <DoseCalcNumericField
                              label="2. Diluent Volume"
                              value={calcReconDiluentVol}
                              onChange={setCalcReconDiluentVol}
                              unitOptions={availableUnits}
                              selectedUnit={calcReconDiluentUnit}
                              onUnitChange={setCalcReconDiluentUnit}
                              placeholder="e.g. 20"
                              min={0.01}
                            />

                            <DoseCalcNumericField
                              label="3. Dose Volume"
                              value={calcReconAdminVol}
                              onChange={setCalcReconAdminVol}
                              unitOptions={availableUnits}
                              selectedUnit={calcReconAdminUnit}
                              onUnitChange={setCalcReconAdminUnit}
                              placeholder="e.g. 1"
                              min={0.01}
                            />

                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11.5px' }}>4. Source Equivalent</label>
                              <div className="rx-calc-badge-display highlight">
                                {doseCalcMetrics.sourceEquiv || '—'}
                              </div>
                            </div>
                          </>
                        )}

                        {/* ── METHOD C: RECONSTITUTED TABLET/UNIT -> DROPS ── */}
                        {calcMethod === 'reconstituted_drops' && (
                          <>
                            <DoseCalcNumericField
                              label="1. Source Quantity"
                              value={calcReconSourceQty}
                              onChange={setCalcReconSourceQty}
                              unitOptions={availableUnits}
                              selectedUnit={calcReconSourceUnit}
                              onUnitChange={setCalcReconSourceUnit}
                              placeholder="e.g. 1"
                              min={0.01}
                            />

                            <DoseCalcNumericField
                              label="2. Diluent Volume"
                              value={calcReconDiluentVol}
                              onChange={setCalcReconDiluentVol}
                              unitOptions={availableUnits}
                              selectedUnit={calcReconDiluentUnit}
                              onUnitChange={setCalcReconDiluentUnit}
                              placeholder="e.g. 20"
                              min={0.01}
                            />

                            <DoseCalcNumericField
                              label="3. Drops per mL (Calibrated)"
                              required
                              value={calcDropsPerMl}
                              onChange={setCalcDropsPerMl}
                              unit="drops/mL"
                              placeholder="e.g. 20"
                              min={1}
                            />

                            <DoseCalcNumericField
                              label="4. Dose in Drops"
                              value={calcDoseDrops}
                              onChange={setCalcDoseDrops}
                              unit="drops"
                              placeholder="e.g. 20"
                              min={1}
                            />

                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11.5px' }}>5. Calculated Volume</label>
                              <div className="rx-calc-badge-display">
                                {doseCalcMetrics.calculatedVolume > 0 ? `${doseCalcMetrics.calculatedVolume} mL` : '—'}
                              </div>
                            </div>

                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11.5px' }}>6. Source Equivalent</label>
                              <div className="rx-calc-badge-display highlight">
                                {doseCalcMetrics.sourceEquiv || '—'}
                              </div>
                            </div>
                          </>
                        )}

                        {/* ── METHOD: WEIGHT-BASED (DEFAULT) ── */}
                        {calcMethod === 'weight_based' && (
                          <>
                            <DoseCalcNumericField
                              label="1. Patient Weight"
                              value={calcWeight}
                              onChange={(val) => {
                                setCalcWeight(val);
                                handleInlineWeightChange(val);
                              }}
                              unit="kg"
                              placeholder="e.g. 24"
                            />

                            <DoseCalcNumericField
                              label="2. Dose per kg"
                              value={calcDosePerKg}
                              onChange={setCalcDosePerKg}
                              unitOptions={availableUnits}
                              selectedUnit={calcDoseUnit}
                              onUnitChange={setCalcDoseUnit}
                              placeholder="e.g. 10"
                            />

                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11.5px' }}>3. Calculated Dose</label>
                              <div className="rx-calc-badge-display">
                                {doseCalcMetrics.calculatedDose > 0
                                  ? `${Math.round(doseCalcMetrics.calculatedDose * 100) / 100} ${calcDoseUnit}`
                                  : '—'}
                              </div>
                            </div>

                            <DoseCalcNumericField
                              label="4. Strength of Active Ingredient"
                              value={calcStrength}
                              onChange={setCalcStrength}
                              unitOptions={availableUnits}
                              selectedUnit={calcStrengthUnit}
                              onUnitChange={setCalcStrengthUnit}
                              placeholder="e.g. 5 or 250"
                            />

                            <DoseCalcNumericField
                              label="5. Base Volume"
                              value={calcBaseVolume}
                              onChange={setCalcBaseVolume}
                              unitOptions={availableUnits}
                              selectedUnit={calcVolumeUnit}
                              onUnitChange={setCalcVolumeUnit}
                              placeholder="1"
                            />

                            <div className="form-group rx-calc-row3-item">
                              <label className="form-label" style={{ fontSize: '11.5px' }}>6. Calculated Volume / Qty per Dose</label>
                              <div className="rx-calc-badge-display highlight">
                                {doseCalcMetrics.calculatedVolume > 0
                                  ? `${Math.round(doseCalcMetrics.calculatedVolume * 100) / 100} ${calcVolumeUnit}`
                                  : (doseCalcMetrics.calculatedDose > 0 ? `${Math.round(doseCalcMetrics.calculatedDose * 100) / 100} ${calcDoseUnit}` : '—')}
                              </div>
                            </div>
                          </>
                        )}

                        {/* ── METHOD: WEIGHT-BASED RANGE ── */}
                        {calcMethod === 'weight_range' && (
                          <>
                            <DoseCalcNumericField
                              label="1. Patient Weight"
                              value={calcWeight}
                              onChange={(val) => {
                                setCalcWeight(val);
                                handleInlineWeightChange(val);
                              }}
                              unit="kg"
                              placeholder="e.g. 24"
                            />

                            <DoseCalcNumericField
                              label="2. Min Dose per kg"
                              value={calcMinDosePerKg}
                              onChange={setCalcMinDosePerKg}
                              unitOptions={availableUnits}
                              selectedUnit={calcDoseUnit}
                              onUnitChange={setCalcDoseUnit}
                              placeholder="e.g. 10"
                            />

                            <DoseCalcNumericField
                              label="3. Max Dose per kg"
                              value={calcMaxDosePerKg}
                              onChange={setCalcMaxDosePerKg}
                              unit={calcDoseUnit}
                              placeholder="e.g. 20"
                            />

                            <div className="form-group rx-calc-row3-item">
                              <label className="form-label" style={{ fontSize: '11.5px' }}>4. Calculated Range</label>
                              <div className="rx-calc-badge-display highlight">
                                {doseCalcMetrics.displayDose}
                              </div>
                            </div>
                          </>
                        )}

                        {/* ── METHOD: WEIGHT-BAND ── */}
                        {calcMethod === 'weight_band' && (
                          <>
                            <DoseCalcNumericField
                              label="1. Patient Weight"
                              value={calcWeight}
                              onChange={(val) => {
                                setCalcWeight(val);
                                handleInlineWeightChange(val);
                              }}
                              unit="kg"
                              placeholder="e.g. 15"
                            />

                            {calcWeightBands && calcWeightBands.length > 0 ? (
                              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                <label className="form-label" style={{ fontSize: '11.5px' }}>Configured Bands</label>
                                <div style={{ fontSize: '11.5px', color: 'var(--color-on-surface-variant)', background: 'var(--color-surface-container-low)', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
                                  {calcWeightBands.map((b, i) => (
                                    <div key={i}>
                                      • {b.label || `${b.minWeightKg ?? 0}–${b.maxWeightKg ?? '∞'} kg`}: <strong>{b.doseValue} {b.doseUnit}</strong>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <>
                                <DoseCalcNumericField
                                  label="2. Minimum Band Range"
                                  value={calcBandMinWeight}
                                  onChange={setCalcBandMinWeight}
                                  unit="kg"
                                  placeholder="0"
                                  min={0}
                                />

                                <DoseCalcNumericField
                                  label="3. Maximum Band Range"
                                  value={calcBandMaxWeight}
                                  onChange={setCalcBandMaxWeight}
                                  unit="kg"
                                  placeholder="10"
                                  min={0.1}
                                />

                                <DoseCalcNumericField
                                  label="4. Band Dose & Unit"
                                  value={calcBandDoseValue}
                                  onChange={setCalcBandDoseValue}
                                  unitOptions={availableUnits}
                                  selectedUnit={calcBandDoseUnit}
                                  onUnitChange={setCalcBandDoseUnit}
                                  placeholder="1"
                                  min={0.01}
                                />
                              </>
                            )}

                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: '11.5px' }}>Matched Band Dose</label>
                              <div className="rx-calc-badge-display highlight">
                                {doseCalcMetrics.displayDose}
                              </div>
                            </div>
                          </>
                        )}

                        {/* ── METHOD: FIXED DOSE ── */}
                        {calcMethod === 'fixed' && (
                          <>
                            <DoseCalcNumericField
                              label="1. Fixed Dose Value"
                              value={calcFixedDose}
                              onChange={setCalcFixedDose}
                              unitOptions={availableUnits}
                              selectedUnit={calcFixedDoseUnit}
                              onUnitChange={(val) => {
                                setCalcFixedDoseUnit(val);
                                setMedForm((prev) => ({ ...prev, unit: val }));
                              }}
                              placeholder="e.g. 1"
                              min={0.01}
                            />

                            <div className="form-group rx-calc-row3-item">
                              <label className="form-label" style={{ fontSize: '11.5px' }}>Administer per Dose</label>
                              <div className="rx-calc-badge-display highlight">
                                {doseCalcMetrics.displayDose}
                              </div>
                            </div>
                          </>
                        )}

                        {/* ── METHOD: NONE (MANUAL) ── */}
                        {calcMethod === 'none' && (
                          <div style={{ gridColumn: '1 / -1', padding: '10px 14px', background: 'var(--color-surface-container-low)', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--color-outline-variant)' }}>
                            <p style={{ margin: 0, fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                              <strong>Manual Mode:</strong> No automated dosing formula is applied for this medication. Please enter the clinical dose, route, frequency, and dispense quantity manually in the medicine form above.
                            </p>
                          </div>
                        )}

                        {/* ── SHARED: Frequency, Duration, Total Dispense Qty, Apply Button ── */}
                        <div className="form-group rx-calc-row4-start">
                          <label className="form-label" style={{ fontSize: '11.5px' }}>Frequency</label>
                          <select
                            className="form-select"
                            value={calcFrequency}
                            onChange={(e) => setCalcFrequency(e.target.value)}
                          >
                            {availableFrequencies.map((f, idx) => (
                              <option key={`calc-freq-${f}-${idx}`} value={f}>{f}</option>
                            ))}
                          </select>
                        </div>

                        <DoseCalcNumericField
                          label="Duration (Days)"
                          value={calcDurationDays}
                          onChange={(val) => setCalcDurationDays(parseInt(val, 10) || 0)}
                          unit="days"
                          placeholder="e.g. 5"
                          min={1}
                        />

                        <div className="form-group">
                          <label className="form-label" style={{ fontSize: '11.5px' }}>Total Dispense Qty</label>
                          <div className="rx-calc-badge-display grand">
                            {doseCalcMetrics.totalDispenseQty > 0
                              ? `${doseCalcMetrics.totalDispenseQty} ${
                                  calcMethod === 'volume_per_weight'
                                    ? calcDoseVolumeUnit
                                    : calcMethod === 'reconstituted_liquid'
                                    ? calcReconAdminUnit
                                    : calcMethod === 'reconstituted_drops'
                                    ? 'drops'
                                    : calcVolumeUnit || medForm.unit
                                }`
                              : '—'}
                          </div>
                        </div>

                        <div className="form-group rx-calc-action-cell">
                          <label className="form-label rx-calc-action-label" style={{ fontSize: '11.5px', visibility: 'hidden' }}>Apply</label>
                          <button
                            type="button"
                            className="btn btn-secondary rx-apply-calc-btn"
                            onClick={handleApplyDoseCalculation}
                            title="Apply calculated dose, unit, frequency, duration and quantity into prescription medicine fields"
                          >
                            <Icon name="check" size={15} />
                            <span>Apply to Medicine</span>
                          </button>
                        </div>

                        {/* Formula & Warning Feedback */}
                        {doseCalcMetrics.formula && (
                          <div style={{ gridColumn: '1 / -1', fontSize: '11.5px', color: 'var(--color-primary)', background: 'var(--color-primary-container-low, #f0fdf4)', border: '1px solid #bbf7d0', padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontWeight: 500 }}>
                            <strong>Formula: </strong>{doseCalcMetrics.formula}
                          </div>
                        )}
                        {doseCalcMetrics.warning && (
                          <div style={{ gridColumn: '1 / -1', fontSize: '11.5px', color: '#b91c1c', background: '#fee2e2', border: '1px solid #fecaca', padding: '6px 10px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Icon name="warning" size={14} />
                            <span>{doseCalcMetrics.warning}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Quick suggestions from formulary when search field is empty */}
                {(!medModalSearch.trim() || !selectedMedRef) && availableMedicines && availableMedicines.length > 0 && !selectedMedRef && (
                  <div style={{ marginTop: 8 }}>
                    <div className="text-xs text-outline mb-1.5 flex items-center gap-1">
                      <Icon name="sparkles" size={12} />
                      <span>Quick suggestions from formulary:</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {availableMedicines.slice(0, 6).map((med, idx) => (
                        <button
                          key={`sugg-${med.id}-${idx}`}
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ height: 26, fontSize: 11, borderRadius: 'var(--radius-full)' }}
                          onClick={() => handleSelectMedRef(med)}
                        >
                          <Icon name="plus" size={11} />
                          <span>{med.brandName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Dosing parameters */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-md)' }}>
                <div className="form-group">
                  <label className="form-label">Approved Dose</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="form-input font-bold"
                    style={{ color: 'var(--color-primary)' }}
                    placeholder="e.g. 1, 2.5, 240"
                    value={medForm.dose}
                    onChange={(e) => handleDoseInputChange(e.target.value)}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-outline)', marginTop: '2px', display: 'block' }}>
                    Numeric dose value only
                  </span>
                  {rangeValidationWarning && (
                    <span style={{ fontSize: '11px', color: 'var(--color-error)', marginTop: '2px', display: 'block' }}>
                      {rangeValidationWarning}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Dose Unit</label>
                  <select
                    className="form-select"
                    value={medForm.doseUnit || medForm.unit}
                    onChange={(e) => setMedForm({ ...medForm, doseUnit: e.target.value, unit: e.target.value })}
                  >
                    {availableUnits.map((u, idx) => (
                      <option key={`medform-unit-${u}-${idx}`} value={u}>{u}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '11px', color: 'var(--color-outline)', marginTop: '2px', display: 'block' }}>
                    Clinical dose unit (e.g. mg, mL, mg/kg)
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Route</label>
                  <select
                    className="form-select"
                    value={medForm.route}
                    onChange={(e) => setMedForm({ ...medForm, route: e.target.value })}
                  >
                    {availableRoutes.map((r, idx) => (
                      <option key={`medform-route-${r}-${idx}`} value={r}>{r}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '11px', color: 'var(--color-outline)', marginTop: '2px', display: 'block' }}>
                    Administration route
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Frequency</label>
                  <select
                    className="form-select"
                    value={medForm.frequency}
                    onChange={(e) => setMedForm({ ...medForm, frequency: e.target.value })}
                  >
                    {availableFrequencies.map((f, idx) => (
                      <option key={`medform-freq-${f}-${idx}`} value={f}>{f}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '11px', color: 'var(--color-outline)', marginTop: '2px', display: 'block' }}>
                    Dosing interval
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Duration (Days)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-input"
                    placeholder="e.g. 5"
                    value={durationDaysStr}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setDurationDaysStr(val);
                      setMedForm((prev) => ({ ...prev, durationDays: val ? parseInt(val, 10) : 0 }));
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-outline)', marginTop: '2px', display: 'block' }}>
                    Total days course
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Dispense Quantity</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="form-input"
                    placeholder="e.g. 10"
                    value={quantityStr}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setQuantityStr(val);
                      setMedForm((prev) => ({ ...prev, quantity: val ? parseInt(val, 10) : 0 }));
                    }}
                  />
                  <span style={{ fontSize: '11px', color: 'var(--color-outline)', marginTop: '2px', display: 'block' }}>
                    Total units to dispense
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Dispense Unit</label>
                  <select
                    className="form-select"
                    value={medForm.dispenseUnit || 'tablet'}
                    onChange={(e) => setMedForm({ ...medForm, dispenseUnit: e.target.value })}
                  >
                    {DISPENSE_UNITS.map((u, idx) => (
                      <option key={`medform-dispenseunit-${u}-${idx}`} value={u}>{u}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '11px', color: 'var(--color-outline)', marginTop: '2px', display: 'block' }}>
                    Package form to dispense
                  </span>
                </div>

              </div>

              {/* Instructions / Sig */}
              <div className="form-group">
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

            <div className="rx-modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSaveMedModal}
              >
                <Icon name="plus" size={16} />
                <span>{editingItemIndex !== null ? 'Update Medicine' : 'Add to Prescription'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: CLINICIAN APPROVE & DIGITALLY SEAL ──── */}
      {showIssueConfirmModal && (
        <div className="rx-modal-backdrop" onClick={() => setShowIssueConfirmModal(false)} style={{ zIndex: 9999 }}>
          <div className="rx-modal-box" style={{ maxWidth: '480px', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#ecfdf5',
                  color: '#047857',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="check-circle" size={22} />
              </div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                Approve &amp; Digitally Seal Prescription?
              </h3>
            </div>
            <p style={{ fontSize: '13.5px', lineHeight: 1.5, color: 'var(--color-on-surface-variant)', marginBottom: '16px' }}>
              You are approving this prescription under your veterinary license. Once approved, this clinical record becomes immutable. Any future changes will require creating a new revision.
            </p>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" htmlFor="builder-approval-remarks">
                Approval Remarks / Seal Notes <span style={{ color: 'var(--color-outline)', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                id="builder-approval-remarks"
                className="form-textarea"
                rows={2}
                placeholder="e.g. Doses confirmed against patient weight and clinical condition."
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                style={{ fontSize: '13px', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: '42px', minWidth: '110px' }}
                onClick={() => setShowIssueConfirmModal(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ height: '42px', minWidth: '160px', background: '#059669', borderColor: '#047857' }}
                onClick={() => {
                  setShowIssueConfirmModal(false);
                  void executeSave('Approved');
                }}
                disabled={isSaving}
              >
                <Icon name="check-circle" size={16} />
                <span>{isSaving ? 'Approving...' : 'Approve & Sign'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: SEND FOR VETERINARIAN APPROVAL ──── */}
      {showForwardModal && (
        <div className="rx-modal-backdrop" onClick={() => setShowForwardModal(false)} style={{ zIndex: 9999 }}>
          <div className="rx-modal-box" style={{ maxWidth: '480px', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: '#eff6ff',
                  color: '#2563eb',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="arrow-forward" size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                  {existingRx?.status === 'Changes Requested' ? 'Resubmit for Veterinarian Approval' : 'Send for Veterinarian Approval'}
                </h3>
                <span style={{ fontSize: '12px', color: 'var(--color-outline)' }}>
                  Assign to a licensed veterinarian for clinical validation
                </span>
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label" htmlFor="builder-forward-clinician-select">
                Select Prescribing Veterinarian *
              </label>
              {loadingClinicians ? (
                <div style={{ fontSize: '13px', color: 'var(--color-outline)', padding: '8px 0' }}>
                  Loading eligible clinicians…
                </div>
              ) : (
                <select
                  id="builder-forward-clinician-select"
                  className="form-input"
                  value={forwardToUserId}
                  onChange={(e) => setForwardToUserId(e.target.value)}
                  style={{ width: '100%', height: '40px', fontSize: '13px' }}
                >
                  {eligibleClinicians.map((c) => (
                    <option key={c.id} value={c.id}>
                      Dr. {c.name} {c.email ? `(${c.email})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label" htmlFor="builder-forward-remarks">
                Clinical Remarks / Handover Notes <span style={{ color: 'var(--color-outline)', fontWeight: 400 }}>(optional)</span>
              </label>
              <textarea
                id="builder-forward-remarks"
                className="form-textarea"
                rows={3}
                placeholder="e.g. Prepared under Dr.'s telephone advice; dosage verified against weight..."
                value={forwardRemarks}
                onChange={(e) => setForwardRemarks(e.target.value)}
                style={{ fontSize: '13px', width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: '40px', minWidth: '100px' }}
                onClick={() => setShowForwardModal(false)}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ height: '40px', minWidth: '160px' }}
                onClick={() => {
                  setShowForwardModal(false);
                  void executeSave('Pending Approval', {
                    targetClinicianId: forwardToUserId,
                    forwardingRemarks: forwardRemarks,
                  });
                }}
                disabled={isSaving || !forwardToUserId}
              >
                {isSaving ? 'Submitting…' : (existingRx?.status === 'Changes Requested' ? 'Resubmit for Approval' : 'Send for Approval')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Validation Error Modal (Mobile and Desktop) ── */}
      {showValidationModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            className="rx-validation-modal-box"
            style={{
              background: 'var(--color-surface, #ffffff)',
              color: 'var(--color-on-surface, #1e293b)',
              borderRadius: 'var(--radius-xl, 16px)',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
              border: '1px solid var(--color-outline-variant, #e2e8f0)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="alert-circle" size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                  Required Information Missing
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-outline)' }}>
                  Please complete the following fields before generating the prescription:
                </p>
              </div>
            </div>

            <div
              style={{
                background: 'var(--color-surface-container-low, #f8fafc)',
                border: '1px solid var(--color-outline-variant, #e2e8f0)',
                borderRadius: 'var(--radius-md, 10px)',
                padding: '12px 14px',
                marginBottom: '20px',
                maxHeight: '260px',
                overflowY: 'auto',
              }}
            >
              <ul style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {validationErrors.map((err, idx) => (
                  <li key={`val-err-${idx}`} style={{ fontSize: '13.5px', color: '#b91c1c', fontWeight: 500 }}>
                    {err.message}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', height: '42px', fontWeight: 600 }}
                onClick={() => {
                  setShowValidationModal(false);
                  if (validationErrors.some((e) => e.refKey === 'patient')) {
                    setSelectedPatientId(null);
                  } else if (validationErrors.some((e) => e.refKey === 'symptoms' || e.refKey === 'diagnosis')) {
                    symptomsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  } else if (validationErrors.some((e) => e.refKey === 'medicines')) {
                    medicinesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }
                }}
              >
                Got It, Complete Missing Fields
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Generation Error Modal ── */}
      {showGenerationErrorModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            className="rx-validation-modal-box"
            style={{
              background: 'var(--color-surface, #ffffff)',
              color: 'var(--color-on-surface, #1e293b)',
              borderRadius: 'var(--radius-xl, 16px)',
              width: '100%',
              maxWidth: '480px',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--color-outline-variant, #e2e8f0)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: '#fee2e2',
                  color: '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name="x-circle" size={24} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--color-on-surface)' }}>
                  Generation Failed
                </h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--color-outline)' }}>
                  An unexpected error occurred while saving the prescription.
                </p>
              </div>
            </div>

            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md, 10px)',
                padding: '12px 14px',
                marginBottom: '20px',
                fontSize: '13px',
                color: '#991b1b',
                fontFamily: 'monospace',
                wordBreak: 'break-word',
              }}
            >
              {generationError || 'Database operation failed. Please try again.'}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ height: '42px', minWidth: '100px' }}
                onClick={() => setShowGenerationErrorModal(false)}
              >
                Dismiss
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ height: '42px', minWidth: '120px' }}
                onClick={() => {
                  setShowGenerationErrorModal(false);
                  void handleSave(canApprove ? 'Approved' : 'Pending Approval');
                }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Mobile Sticky Bottom Action Bar ── */}
      <div className="rx-mobile-bottom-bar" role="toolbar" aria-label="Prescription Mobile Actions">
        <button
          type="button"
          className="btn btn-secondary rx-mobile-draft-btn"
          onClick={() => handleSave('Draft')}
          disabled={isSaving}
          title="Save current progress as a draft"
        >
          <Icon name="save" size={16} />
          <span>Save Draft</span>
        </button>

        {canApprove ? (
          <button
            type="button"
            data-testid="mobile-generate-prescription-btn"
            className="btn btn-primary rx-mobile-gen-btn"
            style={{ background: '#059669', borderColor: '#047857' }}
            onClick={() => handleSave('Approved')}
            disabled={isSaving}
            title="Approve and digitally seal prescription"
          >
            {isSaving ? (
              <>
                <span className="spinner spinner-sm" aria-hidden="true" />
                <span>Approving...</span>
              </>
            ) : (
              <>
                <Icon name="check-circle" size={16} />
                <span>Approve &amp; Sign</span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            data-testid="mobile-generate-prescription-btn"
            className="btn btn-primary rx-mobile-gen-btn"
            onClick={() => handleSave('Pending Approval')}
            disabled={isSaving}
            title="Submit prescription for veterinarian approval"
          >
            {isSaving ? (
              <>
                <span className="spinner spinner-sm" aria-hidden="true" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <Icon name="arrow-forward" size={16} />
                <span>{existingRx?.status === 'Changes Requested' ? 'Resubmit' : 'Send for Approval'}</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
