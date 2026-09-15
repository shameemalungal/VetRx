// =============================================================
// VetRx — Medicine Form Modal (Add / Edit Medicine)
// Seamlessly integrates with Settings → Master Data (Medicine Units)
// =============================================================

import { useState, useEffect, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { Medicine, Species, DosingMethod, WeightBandRule } from '../../types';
import { Icon } from '../../components/ui/Icon';
import { formatControlledNumber } from '../../utils/doseCalculator';

interface MedicineFormModalProps {
  isOpen: boolean;
  medicine?: Medicine | null;
  onClose: () => void;
  onSaved: (medicineId: number) => void;
}

const ALL_SPECIES: Species[] = ['Canine', 'Feline', 'Avian', 'Bovine', 'Equine', 'Other'];

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

const DEFAULT_ACTIVE_INGREDIENT_UNITS = [
  'mg',
  'g',
  'mcg',
  'IU',
  'mL',
  'tablets',
  'capsules',
  'sachets',
  'drops',
  'Other',
];

const DEFAULT_VOLUME_UNITS = [
  'mL',
  'L',
  'tablet',
  'capsule',
  'drop',
  'vial',
  'ampoule',
  'bottle',
  'sachet',
  'tube',
  'bolus/boli',
  'Other',
];

const FALLBACK_ROUTES = [
  'PO (Oral)',
  'Topical',
  'Otic',
  'Ophthalmic',
  'SC (Subcutaneous)',
  'IM (Intramuscular)',
  'IV (Intravenous)',
  'Inhalation',
  'Intranasal',
  'Rectal',
  'Other',
];

const FALLBACK_FREQUENCIES = [
  'SID (q24h / Once daily)',
  'BID (q12h / Twice daily)',
  'TID (q8h / 3x daily)',
  'QID (q6h / 4x daily)',
  'PRN (As needed)',
  'Once',
  'Single Dose',
  'EOD (Every other day)',
  'Other',
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

  const masterRoutes = useLiveQuery(
    () =>
      db.masterDataItems
        .where('category')
        .equals('route')
        .and((item) => item.isActive)
        .sortBy('sortOrder'),
    []
  );

  const masterFrequencies = useLiveQuery(
    () =>
      db.masterDataItems
        .where('category')
        .equals('frequency')
        .and((item) => item.isActive)
        .sortBy('sortOrder'),
    []
  );

  const availableUnits =
    masterUnits && masterUnits.length > 0
      ? masterUnits.map((u) => u.name)
      : FALLBACK_UNITS;

  // Form State - Basic Specs
  const [brandName, setBrandName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [presentation, setPresentation] = useState('Tablet');
  const [strengthVolume, setStrengthVolume] = useState('');
  const [defaultUnit, setDefaultUnit] = useState('tablets');
  const [category, setCategory] = useState('Antibiotic / Antimicrobial');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);

  // Form State - Smart Dosing Rules
  const [dosingMethod, setDosingMethod] = useState<DosingMethod>('none');
  const [targetSpecies, setTargetSpecies] = useState<Species[]>(['Canine', 'Feline']);
  const [dosePerKg, setDosePerKg] = useState<string>('');
  const [minDosePerKg, setMinDosePerKg] = useState<string>('');
  const [maxDosePerKg, setMaxDosePerKg] = useState<string>('');
  const [fixedDose, setFixedDose] = useState<string>('1');
  const [doseUnit, setDoseUnit] = useState<string>('mg');
  const [weightBands, setWeightBands] = useState<WeightBandRule[]>([]);

  const availableDoseUnits = useMemo(() => {
    const units = [...availableUnits];
    if (doseUnit && !units.includes(doseUnit)) {
      units.push(doseUnit);
    }
    return units;
  }, [availableUnits, doseUnit]);

  // Method A: Volume per Body Weight
  const [doseVolumeAmount, setDoseVolumeAmount] = useState<string>('1');
  const [doseVolumeUnit, setDoseVolumeUnit] = useState<string>('mL');
  const [weightBasis, setWeightBasis] = useState<string>('20');
  const [weightBasisUnit, setWeightBasisUnit] = useState<string>('kg');

  // Method B & C: Reconstitution
  const [reconstitutionSourceQty, setReconstitutionSourceQty] = useState<string>('1');
  const [reconstitutionSourceUnit, setReconstitutionSourceUnit] = useState<string>('tablet');
  const [reconstitutionDiluentVolume, setReconstitutionDiluentVolume] = useState<string>('20');
  const [reconstitutionDiluentUnit, setReconstitutionDiluentUnit] = useState<string>('mL');
  const [reconstitutionAdminVolume, setReconstitutionAdminVolume] = useState<string>('1');
  const [reconstitutionAdminUnit, setReconstitutionAdminUnit] = useState<string>('mL');

  // Method C: Drops specific
  const [dropsPerMl, setDropsPerMl] = useState<string>('');
  const [doseDrops, setDoseDrops] = useState<string>('20');

  // Formulation / Concentration Conversion
  const [concentrationStrength, setConcentrationStrength] = useState<string>('');
  const [concentrationStrengthUnit, setConcentrationStrengthUnit] = useState<string>('mg');
  const [concentrationVolume, setConcentrationVolume] = useState<string>('1');
  const [concentrationVolumeUnit, setConcentrationVolumeUnit] = useState<string>('tablet');

  // Prescribing Defaults
  const [defaultRoute, setDefaultRoute] = useState<string>('PO (Oral)');
  const [defaultFrequency, setDefaultFrequency] = useState<string>('BID');
  const [defaultDurationDays, setDefaultDurationDays] = useState<string>('5');
  const [defaultDirections, setDefaultDirections] = useState<string>('');

  // Other dropdown selection states
  const [isOtherRoute, setIsOtherRoute] = useState(false);
  const [isOtherFrequency, setIsOtherFrequency] = useState(false);
  const [isOtherStrengthUnit, setIsOtherStrengthUnit] = useState(false);
  const [isOtherVolumeUnit, setIsOtherVolumeUnit] = useState(false);

  // Predefined veterinary options with preserved saved values
  const routeOptions = useMemo(() => {
    const list = masterRoutes && masterRoutes.length > 0
      ? masterRoutes.map((r) => r.name)
      : FALLBACK_ROUTES.filter((r) => r !== 'Other');
    const set = new Set(list);
    if (defaultRoute && defaultRoute !== 'Other' && !set.has(defaultRoute)) {
      set.add(defaultRoute);
    }
    return [...Array.from(set), 'Other'];
  }, [masterRoutes, defaultRoute]);

  const frequencyOptions = useMemo(() => {
    const list = masterFrequencies && masterFrequencies.length > 0
      ? masterFrequencies.map((f) => f.name)
      : FALLBACK_FREQUENCIES.filter((f) => f !== 'Other');
    const set = new Set(list);
    if (defaultFrequency && defaultFrequency !== 'Other' && !set.has(defaultFrequency)) {
      set.add(defaultFrequency);
    }
    return [...Array.from(set), 'Other'];
  }, [masterFrequencies, defaultFrequency]);

  const activeIngredientUnitOptions = useMemo(() => {
    const set = new Set(DEFAULT_ACTIVE_INGREDIENT_UNITS.filter((u) => u !== 'Other'));
    if (concentrationStrengthUnit && concentrationStrengthUnit !== 'Other' && !set.has(concentrationStrengthUnit)) {
      set.add(concentrationStrengthUnit);
    }
    return [...Array.from(set), 'Other'];
  }, [concentrationStrengthUnit]);

  const volumeUnitOptions = useMemo(() => {
    const set = new Set(DEFAULT_VOLUME_UNITS.filter((u) => u !== 'Other'));
    if (concentrationVolumeUnit && concentrationVolumeUnit !== 'Other' && !set.has(concentrationVolumeUnit)) {
      set.add(concentrationVolumeUnit);
    }
    return [...Array.from(set), 'Other'];
  }, [concentrationVolumeUnit]);

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

      // Dosing rules
      setDosingMethod(medicine.dosingMethod || 'none');
      setTargetSpecies(medicine.targetSpecies && medicine.targetSpecies.length > 0 ? medicine.targetSpecies : ['Canine', 'Feline']);
      setDosePerKg(medicine.dosePerKg !== undefined ? String(medicine.dosePerKg) : '');
      setMinDosePerKg(medicine.minDosePerKg !== undefined ? String(medicine.minDosePerKg) : '');
      setMaxDosePerKg(medicine.maxDosePerKg !== undefined ? String(medicine.maxDosePerKg) : '');
      setFixedDose(medicine.fixedDose !== undefined ? String(medicine.fixedDose) : '1');
      setDoseUnit(medicine.doseUnit || 'mg');
      setWeightBands(medicine.weightBands ? JSON.parse(JSON.stringify(medicine.weightBands)) : []);

      // Method A: Volume per Body Weight
      setDoseVolumeAmount(medicine.doseVolumeAmount !== undefined ? String(medicine.doseVolumeAmount) : '1');
      setDoseVolumeUnit(medicine.doseVolumeUnit || 'mL');
      setWeightBasis(medicine.weightBasis !== undefined ? String(medicine.weightBasis) : '20');
      setWeightBasisUnit(medicine.weightBasisUnit || 'kg');

      // Method B & C: Reconstitution
      setReconstitutionSourceQty(medicine.reconstitutionSourceQty !== undefined ? String(medicine.reconstitutionSourceQty) : '1');
      setReconstitutionSourceUnit(medicine.reconstitutionSourceUnit || 'tablet');
      setReconstitutionDiluentVolume(medicine.reconstitutionDiluentVolume !== undefined ? String(medicine.reconstitutionDiluentVolume) : '20');
      setReconstitutionDiluentUnit(medicine.reconstitutionDiluentUnit || 'mL');
      setReconstitutionAdminVolume(medicine.reconstitutionAdminVolume !== undefined ? String(medicine.reconstitutionAdminVolume) : '1');
      setReconstitutionAdminUnit(medicine.reconstitutionAdminUnit || 'mL');

      // Method C: Drops specific
      setDropsPerMl(medicine.dropsPerMl !== undefined ? String(medicine.dropsPerMl) : '');
      setDoseDrops(medicine.doseDrops !== undefined ? String(medicine.doseDrops) : '20');

      // Concentration conversion
      setConcentrationStrength(medicine.concentrationStrength !== undefined ? String(medicine.concentrationStrength) : '');
      setConcentrationStrengthUnit(medicine.concentrationStrengthUnit || 'mg');
      setConcentrationVolume(medicine.concentrationVolume !== undefined ? String(medicine.concentrationVolume) : '1');
      setConcentrationVolumeUnit(medicine.concentrationVolumeUnit || 'tablet');

      // Prescribing defaults
      setDefaultRoute(medicine.defaultRoute || 'PO (Oral)');
      setDefaultFrequency(medicine.defaultFrequency || 'BID');
      setDefaultDurationDays(medicine.defaultDurationDays !== undefined ? String(medicine.defaultDurationDays) : '5');
      setDefaultDirections(medicine.defaultDirections || '');
    } else {
      setBrandName('');
      setGenericName('');
      setPresentation('Tablet');
      setStrengthVolume('');
      setDefaultUnit('tablets');
      setCategory('Antibiotic / Antimicrobial');
      setNotes('');
      setIsActive(true);

      // Defaults for new medicine
      setDosingMethod('none');
      setTargetSpecies(['Canine', 'Feline']);
      setDosePerKg('');
      setMinDosePerKg('');
      setMaxDosePerKg('');
      setFixedDose('1');
      setDoseUnit('mg');
      setWeightBands([]);
      setDoseVolumeAmount('1');
      setDoseVolumeUnit('mL');
      setWeightBasis('20');
      setWeightBasisUnit('kg');
      setReconstitutionSourceQty('1');
      setReconstitutionSourceUnit('tablet');
      setReconstitutionDiluentVolume('20');
      setReconstitutionDiluentUnit('mL');
      setReconstitutionAdminVolume('1');
      setReconstitutionAdminUnit('mL');
      setDropsPerMl('');
      setDoseDrops('20');
      setConcentrationStrength('');
      setConcentrationStrengthUnit('mg');
      setConcentrationVolume('1');
      setConcentrationVolumeUnit('tablet');
      setDefaultRoute('PO (Oral)');
      setDefaultFrequency('BID');
      setDefaultDurationDays('5');
      setDefaultDirections('');
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
      const parsedDosePerKg = dosePerKg ? parseFloat(dosePerKg) : undefined;
      const parsedMinDosePerKg = minDosePerKg ? parseFloat(minDosePerKg) : undefined;
      const parsedMaxDosePerKg = maxDosePerKg ? parseFloat(maxDosePerKg) : undefined;
      const parsedFixedDose = fixedDose ? parseFloat(fixedDose) : undefined;
      const parsedConcStrength = concentrationStrength ? parseFloat(concentrationStrength) : undefined;
      const parsedConcVolume = concentrationVolume ? parseFloat(concentrationVolume) : undefined;
      const parsedDuration = defaultDurationDays ? parseInt(defaultDurationDays, 10) : undefined;

      const parsedDoseVolumeAmount = doseVolumeAmount ? parseFloat(doseVolumeAmount) : undefined;
      const parsedWeightBasis = weightBasis ? parseFloat(weightBasis) : undefined;
      const parsedReconstitutionSourceQty = reconstitutionSourceQty ? parseFloat(reconstitutionSourceQty) : undefined;
      const parsedReconstitutionDiluentVolume = reconstitutionDiluentVolume ? parseFloat(reconstitutionDiluentVolume) : undefined;
      const parsedReconstitutionAdminVolume = reconstitutionAdminVolume ? parseFloat(reconstitutionAdminVolume) : undefined;
      const parsedDropsPerMl = dropsPerMl ? parseFloat(dropsPerMl) : undefined;
      const parsedDoseDrops = doseDrops ? parseFloat(doseDrops) : undefined;

      const medicinePayload: Partial<Medicine> = {
        brandName: brandName.trim(),
        genericName: genericName.trim() || undefined,
        presentation: presentation.trim(),
        strengthVolume: strengthVolume.trim() || undefined,
        defaultUnit: defaultUnit.trim() || undefined,
        category: category.trim() || undefined,
        notes: notes.trim() || undefined,
        isActive,
        // Deterministic Formulary Dosing Rules
        dosingMethod,
        targetSpecies: targetSpecies.length > 0 ? targetSpecies : undefined,
        dosePerKg: parsedDosePerKg,
        minDosePerKg: parsedMinDosePerKg,
        maxDosePerKg: parsedMaxDosePerKg,
        fixedDose: parsedFixedDose,
        doseUnit: doseUnit.trim() || undefined,
        weightBands: weightBands.length > 0 ? weightBands : undefined,
        // Volume per body weight
        doseVolumeAmount: parsedDoseVolumeAmount,
        doseVolumeUnit: doseVolumeUnit.trim() || undefined,
        weightBasis: parsedWeightBasis,
        weightBasisUnit: weightBasisUnit.trim() || undefined,
        // Reconstitution
        reconstitutionSourceQty: parsedReconstitutionSourceQty,
        reconstitutionSourceUnit: reconstitutionSourceUnit.trim() || undefined,
        reconstitutionDiluentVolume: parsedReconstitutionDiluentVolume,
        reconstitutionDiluentUnit: reconstitutionDiluentUnit.trim() || undefined,
        reconstitutionAdminVolume: parsedReconstitutionAdminVolume,
        reconstitutionAdminUnit: reconstitutionAdminUnit.trim() || undefined,
        dropsPerMl: parsedDropsPerMl,
        doseDrops: parsedDoseDrops,
        // Concentration conversion
        concentrationStrength: parsedConcStrength,
        concentrationStrengthUnit: concentrationStrengthUnit.trim() || undefined,
        concentrationVolume: parsedConcVolume,
        concentrationVolumeUnit: concentrationVolumeUnit.trim() || undefined,
        defaultRoute: defaultRoute.trim() || undefined,
        defaultFrequency: defaultFrequency.trim() || undefined,
        defaultDurationDays: parsedDuration,
        defaultDirections: defaultDirections.trim() || undefined,
        updatedAt: now,
      };

      if (isEdit && medicine?.id) {
        // Edit existing medicine — preserves id & relationships
        await db.medicines.update(medicine.id, medicinePayload);
        onSaved(medicine.id);
      } else {
        // Add new medicine
        const newId = await db.medicines.add({
          ...medicinePayload,
          createdAt: now,
        } as Medicine);
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

  const handleAddWeightBand = () => {
    const lastBand = weightBands[weightBands.length - 1];
    const nextMin = lastBand && lastBand.maxWeightKg !== undefined ? lastBand.maxWeightKg + 0.01 : 0;
    const newBand: WeightBandRule = {
      id: 'wb_' + Date.now(),
      minWeightKg: nextMin,
      maxWeightKg: undefined,
      doseValue: 1,
      doseUnit: doseUnit || 'tablet',
      label: '',
    };
    setWeightBands((prev) => [...prev, newBand]);
  };

  const handleUpdateWeightBand = (index: number, field: keyof WeightBandRule, val: any) => {
    setWeightBands((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleRemoveWeightBand = (index: number) => {
    setWeightBands((prev) => prev.filter((_, i) => i !== index));
  };

  const handleToggleSpecies = (sp: Species) => {
    setTargetSpecies((prev) =>
      prev.includes(sp) ? prev.filter((s) => s !== sp) : [...prev, sp]
    );
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
                  {availableUnits.map((u, idx) => (
                    <option key={`med-form-unit-${u}-${idx}`} value={u}>
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

              {/* ── Smart Dosing Rules Configuration (Phase 7) ───────────────── */}
              <div className="medicine-form-group full-width" style={{ marginTop: 'var(--space-xs)' }}>
                <div className="medicine-dosing-config-card">
                  <div className="medicine-dosing-config-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div className="medicine-dosing-icon">
                        <Icon name="calculator" size={16} />
                      </div>
                      <div>
                        <h4 className="medicine-dosing-title">Formulary Smart Dosing Rules</h4>
                        <p className="medicine-dosing-subtitle">
                          Deterministic dose calculation rules configured explicitly for this medicine.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="medicine-dosing-config-body">
                    {/* Dosing Method */}
                    <div className="medicine-form-group full-width">
                      <label className="medicine-form-label" htmlFor="med-dosing-method">
                        Calculation Method <span className="required">*</span>
                      </label>
                      <select
                        id="med-dosing-method"
                        className="medicine-form-select"
                        value={dosingMethod}
                        onChange={(e) => setDosingMethod(e.target.value as DosingMethod)}
                      >
                        <option value="none">Manual Dosing (No Automated Calculation)</option>
                        <option value="weight_based">Weight-Based (Patient Weight × Dose per kg)</option>
                        <option value="weight_range">Weight-Based Range (min–max mg/kg)</option>
                        <option value="weight_band">Weight-Band (Tier-Based by Weight Range)</option>
                        <option value="volume_per_weight">Volume per Body Weight (e.g. 1 mL per 20 kg)</option>
                        <option value="reconstituted_liquid">Reconstituted Tablet/Unit → Liquid Volume</option>
                        <option value="reconstituted_drops">Reconstituted Tablet/Unit → Drops</option>
                        <option value="fixed">Fixed Dose (1 tablet/sachet/vial per dose)</option>
                      </select>
                      <span className="medicine-form-hint">
                        {dosingMethod === 'none' && 'Veterinarian will enter dose and quantity manually.'}
                        {dosingMethod === 'weight_based' && 'Calculates: Patient weight (kg) × configured dose per kg.'}
                        {dosingMethod === 'weight_range' && 'Calculates: Patient weight (kg) × min & max range; doctor selects final dose.'}
                        {dosingMethod === 'weight_band' && 'Selects pre-configured dose band corresponding to patient weight.'}
                        {dosingMethod === 'volume_per_weight' && 'Calculates: Patient Weight × (Dose Volume ÷ Weight Basis). e.g. 1 mL per 20 kg.'}
                        {dosingMethod === 'reconstituted_liquid' && 'Calculates administered liquid volume and source unit equivalent.'}
                        {dosingMethod === 'reconstituted_drops' && 'Calculates administered drops into volume and source equivalent using calibrated drops/mL.'}
                        {dosingMethod === 'fixed' && 'Applies fixed dose directly without weight multiplication.'}
                      </span>
                    </div>

                    {dosingMethod !== 'none' && (
                      <>
                        {/* Target Species Selector */}
                        <div className="medicine-form-group full-width">
                          <label className="medicine-form-label">
                            Target Species Applicability
                          </label>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {ALL_SPECIES.map((sp) => {
                              const isSelected = targetSpecies.includes(sp);
                              return (
                                <button
                                  key={sp}
                                  type="button"
                                  className={`species-pill-btn ${isSelected ? 'active' : ''}`}
                                  onClick={() => handleToggleSpecies(sp)}
                                >
                                  {isSelected && <Icon name="check" size={12} />}
                                  <span>{sp}</span>
                                </button>
                              );
                            })}
                          </div>
                          <span className="medicine-form-hint">
                            If a prescription is created for an unselected species, VetRx will show a warning and prompt for manual entry.
                          </span>
                        </div>

                        {/* WEIGHT-BASED FIELDS */}
                        {dosingMethod === 'weight_based' && (
                          <div className="medicine-form-grid full-width" style={{ marginTop: '6px' }}>
                            <div className="medicine-form-group">
                              <label className="medicine-form-label" htmlFor="med-dose-per-kg">
                                Standard Dose per kg <span className="required">*</span>
                              </label>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                  id="med-dose-per-kg"
                                  type="number"
                                  step="any"
                                  className="medicine-form-input"
                                  placeholder="e.g. 10"
                                  value={formatControlledNumber(dosePerKg)}
                                  onChange={(e) => setDosePerKg(e.target.value)}
                                />
                                <select
                                  className="medicine-form-select"
                                  style={{ width: '100px' }}
                                  value={doseUnit}
                                  onChange={(e) => setDoseUnit(e.target.value)}
                                >
                                  {availableDoseUnits.map((u, idx) => (
                                    <option key={`med-dose-unit-${u}-${idx}`} value={u}>{u}</option>
                                  ))}
                                </select>
                              </div>
                              <span className="medicine-form-hint">e.g. 10 mg/kg</span>
                            </div>

                            <div className="medicine-form-group">
                              <label className="medicine-form-label">
                                Dose Range Safety Limits (Optional)
                              </label>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <input
                                  type="number"
                                  step="any"
                                  className="medicine-form-input"
                                  placeholder="Min /kg"
                                  value={formatControlledNumber(minDosePerKg)}
                                  onChange={(e) => setMinDosePerKg(e.target.value)}
                                />
                                <span style={{ color: 'var(--color-outline)', fontSize: '12px' }}>to</span>
                                <input
                                  type="number"
                                  step="any"
                                  className="medicine-form-input"
                                  placeholder="Max /kg"
                                  value={formatControlledNumber(maxDosePerKg)}
                                  onChange={(e) => setMaxDosePerKg(e.target.value)}
                                />
                              </div>
                              <span className="medicine-form-hint">Warns if doctor inputs dose outside this range.</span>
                            </div>
                          </div>
                        )}

                        {/* WEIGHT-RANGE FIELDS */}
                        {dosingMethod === 'weight_range' && (
                          <div className="medicine-form-grid full-width" style={{ marginTop: '6px' }}>
                            <div className="medicine-form-group">
                              <label className="medicine-form-label">
                                Configured Range (per kg) <span className="required">*</span>
                              </label>
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <input
                                  type="number"
                                  step="any"
                                  className="medicine-form-input"
                                  placeholder="Min /kg"
                                  value={formatControlledNumber(minDosePerKg)}
                                  onChange={(e) => setMinDosePerKg(e.target.value)}
                                />
                                <span style={{ color: 'var(--color-outline)', fontSize: '12px' }}>–</span>
                                <input
                                  type="number"
                                  step="any"
                                  className="medicine-form-input"
                                  placeholder="Max /kg"
                                  value={formatControlledNumber(maxDosePerKg)}
                                  onChange={(e) => setMaxDosePerKg(e.target.value)}
                                />
                                <select
                                  className="medicine-form-select"
                                  style={{ width: '100px' }}
                                  value={doseUnit}
                                  onChange={(e) => setDoseUnit(e.target.value)}
                                >
                                  {availableDoseUnits.map((u, idx) => (
                                    <option key={`med-range-unit-${u}-${idx}`} value={u}>{u}</option>
                                  ))}
                                </select>
                              </div>
                              <span className="medicine-form-hint">e.g. 10–20 mg/kg</span>
                            </div>

                            <div className="medicine-form-group">
                              <label className="medicine-form-label" htmlFor="med-suggested-dose">
                                Default Suggested Dose / kg
                              </label>
                              <input
                                id="med-suggested-dose"
                                type="number"
                                step="any"
                                className="medicine-form-input"
                                placeholder="e.g. 15 (optional midpoint)"
                                value={formatControlledNumber(dosePerKg)}
                                onChange={(e) => setDosePerKg(e.target.value)}
                              />
                              <span className="medicine-form-hint">Pre-selected for the doctor in the prescription modal.</span>
                            </div>
                          </div>
                        )}

                        {/* WEIGHT-BAND FIELDS */}
                        {dosingMethod === 'weight_band' && (
                          <div className="medicine-form-group full-width" style={{ marginTop: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <label className="medicine-form-label" style={{ margin: 0 }}>
                                Configured Weight Bands <span className="required">*</span>
                              </label>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={handleAddWeightBand}
                                style={{ padding: '3px 8px', fontSize: '11px' }}
                              >
                                <Icon name="plus" size={12} />
                                <span>Add Band</span>
                              </button>
                            </div>

                            {weightBands.length === 0 ? (
                              <div style={{ padding: '12px', background: 'var(--color-surface-container-lowest)', borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-border)', textAlign: 'center' }}>
                                <p style={{ fontSize: '12px', color: 'var(--color-outline)', margin: 0 }}>
                                  No weight bands configured yet. Click "Add Band" to define weight ranges (e.g. ≤10 kg → 1 tab).
                                </p>
                              </div>
                            ) : (
                              <div className="medicine-weight-bands-list">
                                {weightBands.map((band, idx) => (
                                  <div key={band.id || idx} className="medicine-weight-band-row">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: '160px' }}>
                                      <input
                                        type="number"
                                        step="any"
                                        className="medicine-form-input"
                                        placeholder="Min kg"
                                        value={formatControlledNumber(band.minWeightKg)}
                                        onChange={(e) => handleUpdateWeightBand(idx, 'minWeightKg', e.target.value !== '' ? parseFloat(e.target.value) : undefined)}
                                        style={{ width: '80px' }}
                                      />
                                      <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>–</span>
                                      <input
                                        type="number"
                                        step="any"
                                        className="medicine-form-input"
                                        placeholder="Max kg (empty=∞)"
                                        value={formatControlledNumber(band.maxWeightKg)}
                                        onChange={(e) => handleUpdateWeightBand(idx, 'maxWeightKg', e.target.value !== '' ? parseFloat(e.target.value) : undefined)}
                                        style={{ width: '80px' }}
                                      />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: '160px' }}>
                                      <input
                                        type="number"
                                        step="any"
                                        className="medicine-form-input"
                                        placeholder="Dose"
                                        value={formatControlledNumber(band.doseValue)}
                                        onChange={(e) => handleUpdateWeightBand(idx, 'doseValue', parseFloat(e.target.value) || 0)}
                                        style={{ width: '70px' }}
                                      />
                                      <select
                                        className="medicine-form-select"
                                        value={band.doseUnit || doseUnit}
                                        onChange={(e) => handleUpdateWeightBand(idx, 'doseUnit', e.target.value)}
                                        style={{ width: '90px' }}
                                      >
                                        {availableDoseUnits.map((u, uIdx) => (
                                          <option key={`band-unit-${u}-${uIdx}`} value={u}>{u}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <input
                                      type="text"
                                      className="medicine-form-input"
                                      placeholder="Label (e.g. ≤10 kg)"
                                      value={band.label || ''}
                                      onChange={(e) => handleUpdateWeightBand(idx, 'label', e.target.value)}
                                      style={{ flex: 1, minWidth: '120px' }}
                                    />
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      onClick={() => handleRemoveWeightBand(idx)}
                                      title="Remove band"
                                      style={{ color: 'var(--color-error)', padding: '6px' }}
                                    >
                                      <Icon name="close" size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* FIXED DOSE FIELDS */}
                        {dosingMethod === 'fixed' && (
                          <div className="medicine-form-grid full-width" style={{ marginTop: '6px' }}>
                            <div className="medicine-form-group">
                              <label className="medicine-form-label" htmlFor="med-fixed-dose">
                                Fixed Dose Amount <span className="required">*</span>
                              </label>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                  id="med-fixed-dose"
                                  type="number"
                                  step="any"
                                  className="medicine-form-input"
                                  placeholder="e.g. 1"
                                  value={formatControlledNumber(fixedDose)}
                                  onChange={(e) => setFixedDose(e.target.value)}
                                />
                                <select
                                  id="med-fixed-dose-unit"
                                  className="medicine-form-select"
                                  style={{ width: '130px' }}
                                  value={doseUnit}
                                  onChange={(e) => setDoseUnit(e.target.value)}
                                >
                                  {availableDoseUnits.map((u, idx) => (
                                    <option key={`fixed-unit-${u}-${idx}`} value={u}>
                                      {u}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <span className="medicine-form-hint">e.g. 1 tablet, 1 sachet, 1 pipette per dose.</span>
                            </div>
                          </div>
                        )}

                        {/* VOLUME PER BODY WEIGHT FIELDS (e.g. 1 mL per 20 kg) */}
                        {dosingMethod === 'volume_per_weight' && (
                          <div className="medicine-form-grid full-width" style={{ marginTop: '6px' }}>
                            <div className="medicine-form-group">
                              <label className="medicine-form-label" htmlFor="med-vol-dose">
                                Dose Volume <span className="required">*</span>
                              </label>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                  id="med-vol-dose"
                                  type="number"
                                  step="any"
                                  min="0.01"
                                  className="medicine-form-input"
                                  placeholder="e.g. 1"
                                  value={formatControlledNumber(doseVolumeAmount)}
                                  onChange={(e) => setDoseVolumeAmount(e.target.value)}
                                />
                                <select
                                  className="medicine-form-select"
                                  style={{ width: '100px' }}
                                  value={doseVolumeUnit}
                                  onChange={(e) => setDoseVolumeUnit(e.target.value)}
                                >
                                  {availableDoseUnits.map((u, idx) => (
                                    <option key={`med-vol-unit-${u}-${idx}`} value={u}>{u}</option>
                                  ))}
                                </select>
                              </div>
                              <span className="medicine-form-hint">e.g. 1 mL</span>
                            </div>

                            <div className="medicine-form-group">
                              <label className="medicine-form-label" htmlFor="med-weight-basis">
                                Weight Basis <span className="required">*</span>
                              </label>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                  id="med-weight-basis"
                                  type="number"
                                  step="any"
                                  min="0.01"
                                  className="medicine-form-input"
                                  placeholder="e.g. 20"
                                  value={formatControlledNumber(weightBasis)}
                                  onChange={(e) => setWeightBasis(e.target.value)}
                                />
                                <span className="rx-unit-badge">kg</span>
                              </div>
                              <span className="medicine-form-hint">e.g. per 20 kg</span>
                            </div>
                          </div>
                        )}

                        {/* RECONSTITUTED TABLET/UNIT -> LIQUID VOLUME */}
                        {dosingMethod === 'reconstituted_liquid' && (
                          <div className="medicine-form-grid full-width" style={{ marginTop: '6px' }}>
                            <div className="medicine-form-group">
                              <label className="medicine-form-label" htmlFor="med-recon-source-qty">
                                Source Quantity & Unit <span className="required">*</span>
                              </label>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                  id="med-recon-source-qty"
                                  type="number"
                                  step="any"
                                  min="0.01"
                                  className="medicine-form-input"
                                  placeholder="e.g. 1"
                                  value={formatControlledNumber(reconstitutionSourceQty)}
                                  onChange={(e) => setReconstitutionSourceQty(e.target.value)}
                                />
                                <input
                                  type="text"
                                  className="medicine-form-input"
                                  style={{ width: '100px' }}
                                  placeholder="tablet / vial"
                                  value={reconstitutionSourceUnit}
                                  onChange={(e) => setReconstitutionSourceUnit(e.target.value)}
                                />
                              </div>
                              <span className="medicine-form-hint">e.g. 1 tablet</span>
                            </div>

                            <div className="medicine-form-group">
                              <label className="medicine-form-label" htmlFor="med-recon-dil-vol">
                                Diluent / Reconstitution Volume <span className="required">*</span>
                              </label>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                  id="med-recon-dil-vol"
                                  type="number"
                                  step="any"
                                  min="0.01"
                                  className="medicine-form-input"
                                  placeholder="e.g. 20"
                                  value={formatControlledNumber(reconstitutionDiluentVolume)}
                                  onChange={(e) => setReconstitutionDiluentVolume(e.target.value)}
                                />
                                <select
                                  className="medicine-form-select"
                                  style={{ width: '100px' }}
                                  value={reconstitutionDiluentUnit}
                                  onChange={(e) => setReconstitutionDiluentUnit(e.target.value)}
                                >
                                  {availableDoseUnits.map((u, idx) => (
                                    <option key={`recon-dil-u-${u}-${idx}`} value={u}>{u}</option>
                                  ))}
                                </select>
                              </div>
                              <span className="medicine-form-hint">e.g. dissolved in 20 mL water</span>
                            </div>

                            <div className="medicine-form-group">
                              <label className="medicine-form-label" htmlFor="med-recon-admin-vol">
                                Administration Dose Volume <span className="required">*</span>
                              </label>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                  id="med-recon-admin-vol"
                                  type="number"
                                  step="any"
                                  min="0.01"
                                  className="medicine-form-input"
                                  placeholder="e.g. 1"
                                  value={formatControlledNumber(reconstitutionAdminVolume)}
                                  onChange={(e) => setReconstitutionAdminVolume(e.target.value)}
                                />
                                <select
                                  className="medicine-form-select"
                                  style={{ width: '100px' }}
                                  value={reconstitutionAdminUnit}
                                  onChange={(e) => setReconstitutionAdminUnit(e.target.value)}
                                >
                                  {availableDoseUnits.map((u, idx) => (
                                    <option key={`recon-adm-u-${u}-${idx}`} value={u}>{u}</option>
                                  ))}
                                </select>
                              </div>
                              <span className="medicine-form-hint">e.g. give 1 mL (1/20 tablet equivalent)</span>
                            </div>
                          </div>
                        )}

                        {/* RECONSTITUTED TABLET/UNIT -> DROPS */}
                        {dosingMethod === 'reconstituted_drops' && (
                          <div className="medicine-form-grid full-width" style={{ marginTop: '6px' }}>
                            <div className="medicine-form-group">
                              <label className="medicine-form-label" htmlFor="med-recon-d-source-qty">
                                Source Quantity & Unit <span className="required">*</span>
                              </label>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                  id="med-recon-d-source-qty"
                                  type="number"
                                  step="any"
                                  min="0.01"
                                  className="medicine-form-input"
                                  placeholder="e.g. 1"
                                  value={formatControlledNumber(reconstitutionSourceQty)}
                                  onChange={(e) => setReconstitutionSourceQty(e.target.value)}
                                />
                                <input
                                  type="text"
                                  className="medicine-form-input"
                                  style={{ width: '100px' }}
                                  placeholder="tablet / vial"
                                  value={reconstitutionSourceUnit}
                                  onChange={(e) => setReconstitutionSourceUnit(e.target.value)}
                                />
                              </div>
                              <span className="medicine-form-hint">e.g. 1 tablet</span>
                            </div>

                            <div className="medicine-form-group">
                              <label className="medicine-form-label" htmlFor="med-recon-d-dil-vol">
                                Diluent Volume <span className="required">*</span>
                              </label>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <input
                                  id="med-recon-d-dil-vol"
                                  type="number"
                                  step="any"
                                  min="0.01"
                                  className="medicine-form-input"
                                  placeholder="e.g. 20"
                                  value={formatControlledNumber(reconstitutionDiluentVolume)}
                                  onChange={(e) => setReconstitutionDiluentVolume(e.target.value)}
                                />
                                <select
                                  className="medicine-form-select"
                                  style={{ width: '100px' }}
                                  value={reconstitutionDiluentUnit}
                                  onChange={(e) => setReconstitutionDiluentUnit(e.target.value)}
                                >
                                  {availableDoseUnits.map((u, idx) => (
                                    <option key={`recon-d-dil-u-${u}-${idx}`} value={u}>{u}</option>
                                  ))}
                                </select>
                              </div>
                              <span className="medicine-form-hint">e.g. 20 mL water</span>
                            </div>

                            <div className="medicine-form-group">
                              <label className="medicine-form-label" htmlFor="med-drops-per-ml">
                                Drops per mL (Calibrated) <span className="required">*</span>
                              </label>
                              <input
                                id="med-drops-per-ml"
                                type="number"
                                step="any"
                                min="1"
                                className="medicine-form-input"
                                placeholder="e.g. 20 (dropper calibration)"
                                value={formatControlledNumber(dropsPerMl)}
                                onChange={(e) => setDropsPerMl(e.target.value)}
                              />
                              <span className="medicine-form-hint">
                                Calibrated value required. System never assumes 20 drops = 1 mL.
                              </span>
                            </div>

                            <div className="medicine-form-group">
                              <label className="medicine-form-label" htmlFor="med-dose-drops">
                                Dose in Drops <span className="required">*</span>
                              </label>
                              <input
                                id="med-dose-drops"
                                type="number"
                                step="any"
                                min="1"
                                className="medicine-form-input"
                                placeholder="e.g. 20"
                                value={formatControlledNumber(doseDrops)}
                                onChange={(e) => setDoseDrops(e.target.value)}
                              />
                              <span className="medicine-form-hint">e.g. give 20 drops</span>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* EXPLICIT FORMULATION CONVERSION (Always visible for any medicine) */}
                    <div className="medicine-form-group full-width" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--color-border)' }}>
                          <label className="medicine-form-label">
                            Formulation Strength & Practical Quantity Conversion (Optional)
                          </label>
                          <div style={{ fontSize: '12px', color: 'var(--color-on-surface)', marginBottom: '8px', lineHeight: 1.5, background: 'var(--color-surface-container-low)', padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
                            <strong>Visible example:</strong><br />
                            Meloxicam 5 mg/1 mL<br />
                            Strength of active ingredient: 5<br />
                            Unit of active ingredient: mg<br />
                            Base Volume: 1<br />
                            Volume Unit: mL
                          </div>
                          <div className="medicine-dosing-grid-4">
                            <div className="medicine-form-group">
                              <label className="medicine-form-label">Strength of active ingredient <span className="required">*</span></label>
                              <input
                                type="number"
                                step="any"
                                className="medicine-form-input"
                                placeholder="Example: 5"
                                value={formatControlledNumber(concentrationStrength)}
                                onChange={(e) => setConcentrationStrength(e.target.value)}
                              />
                            </div>
                            <div className="medicine-form-group">
                              <label className="medicine-form-label">Unit of active ingredient</label>
                              <select
                                className="medicine-form-select"
                                value={isOtherStrengthUnit ? 'Other' : concentrationStrengthUnit}
                                onChange={(e) => {
                                  if (e.target.value === 'Other') {
                                    setIsOtherStrengthUnit(true);
                                  } else {
                                    setIsOtherStrengthUnit(false);
                                    setConcentrationStrengthUnit(e.target.value);
                                  }
                                }}
                              >
                                {activeIngredientUnitOptions.map((u, idx) => (
                                  <option key={`med-ing-unit-${u}-${idx}`} value={u}>{u}</option>
                                ))}
                              </select>
                              {isOtherStrengthUnit && (
                                <input
                                  type="text"
                                  className="medicine-form-input"
                                  style={{ marginTop: '4px' }}
                                  placeholder="Enter custom unit (e.g. mg)"
                                  value={concentrationStrengthUnit === 'Other' ? '' : concentrationStrengthUnit}
                                  onChange={(e) => setConcentrationStrengthUnit(e.target.value)}
                                  autoFocus
                                />
                              )}
                            </div>
                            <div className="medicine-form-group">
                              <label className="medicine-form-label">Base Volume</label>
                              <input
                                type="number"
                                step="any"
                                className="medicine-form-input"
                                placeholder="Example: 1"
                                value={formatControlledNumber(concentrationVolume)}
                                onChange={(e) => setConcentrationVolume(e.target.value)}
                              />
                            </div>
                            <div className="medicine-form-group">
                              <label className="medicine-form-label">Volume Unit</label>
                              <select
                                className="medicine-form-select"
                                value={isOtherVolumeUnit ? 'Other' : concentrationVolumeUnit}
                                onChange={(e) => {
                                  if (e.target.value === 'Other') {
                                    setIsOtherVolumeUnit(true);
                                  } else {
                                    setIsOtherVolumeUnit(false);
                                    setConcentrationVolumeUnit(e.target.value);
                                  }
                                }}
                              >
                                {volumeUnitOptions.map((u, idx) => (
                                  <option key={`med-vol-unit-${u}-${idx}`} value={u}>{u}</option>
                                ))}
                              </select>
                              {isOtherVolumeUnit && (
                                <input
                                  type="text"
                                  className="medicine-form-input"
                                  style={{ marginTop: '4px' }}
                                  placeholder="Enter custom volume unit (e.g. mL)"
                                  value={concentrationVolumeUnit === 'Other' ? '' : concentrationVolumeUnit}
                                  onChange={(e) => setConcentrationVolumeUnit(e.target.value)}
                                  autoFocus
                                />
                              )}
                            </div>
                          </div>
                          <span className="medicine-form-hint">
                            Allows VetRx to calculate practical dispense quantities when configured (e.g. 240 mg ÷ 5 mg/mL = 48 mL).
                          </span>
                        </div>

                        {/* PRESCRIBING DEFAULTS */}
                        <div className="medicine-dosing-grid-4" style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed var(--color-border)' }}>
                          <div className="medicine-form-group">
                            <label className="medicine-form-label" htmlFor="med-default-route">
                              Default Route
                            </label>
                            <select
                              id="med-default-route"
                              className="medicine-form-select"
                              value={isOtherRoute ? 'Other' : defaultRoute}
                              onChange={(e) => {
                                if (e.target.value === 'Other') {
                                  setIsOtherRoute(true);
                                } else {
                                  setIsOtherRoute(false);
                                  setDefaultRoute(e.target.value);
                                }
                              }}
                            >
                              {routeOptions.map((r, idx) => (
                                <option key={`med-def-route-${r}-${idx}`} value={r}>{r}</option>
                              ))}
                            </select>
                            {isOtherRoute && (
                              <input
                                type="text"
                                className="medicine-form-input"
                                style={{ marginTop: '4px' }}
                                placeholder="Enter custom route"
                                value={defaultRoute === 'Other' ? '' : defaultRoute}
                                onChange={(e) => setDefaultRoute(e.target.value)}
                                autoFocus
                              />
                            )}
                          </div>

                          <div className="medicine-form-group">
                            <label className="medicine-form-label" htmlFor="med-default-frequency">
                              Default Frequency
                            </label>
                            <select
                              id="med-default-frequency"
                              className="medicine-form-select"
                              value={isOtherFrequency ? 'Other' : defaultFrequency}
                              onChange={(e) => {
                                if (e.target.value === 'Other') {
                                  setIsOtherFrequency(true);
                                } else {
                                  setIsOtherFrequency(false);
                                  setDefaultFrequency(e.target.value);
                                }
                              }}
                            >
                              {frequencyOptions.map((f, idx) => (
                                <option key={`med-def-freq-${f}-${idx}`} value={f}>{f}</option>
                              ))}
                            </select>
                            {isOtherFrequency && (
                              <input
                                type="text"
                                className="medicine-form-input"
                                style={{ marginTop: '4px' }}
                                placeholder="Enter custom frequency"
                                value={defaultFrequency === 'Other' ? '' : defaultFrequency}
                                onChange={(e) => setDefaultFrequency(e.target.value)}
                                autoFocus
                              />
                            )}
                          </div>

                          <div className="medicine-form-group">
                            <label className="medicine-form-label" htmlFor="med-default-duration">
                              Default Duration (Days)
                            </label>
                            <input
                              id="med-default-duration"
                              type="number"
                              className="medicine-form-input"
                              placeholder="e.g. 5"
                              value={defaultDurationDays}
                              onChange={(e) => setDefaultDurationDays(e.target.value)}
                            />
                          </div>

                          <div className="medicine-form-group">
                            <label className="medicine-form-label" htmlFor="med-default-sig">
                              Default Directions / SIG
                            </label>
                            <input
                              id="med-default-sig"
                              type="text"
                              className="medicine-form-input"
                              placeholder="e.g. Give after food."
                              value={defaultDirections}
                              onChange={(e) => setDefaultDirections(e.target.value)}
                            />
                          </div>
                        </div>
                  </div>
                </div>
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
