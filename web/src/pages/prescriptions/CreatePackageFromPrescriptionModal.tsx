// =============================================================
// VetRx — Create Treatment Package from Prescription Modal
// Creates an atomic, editable package draft from any prescription.
// =============================================================

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { Prescription, PrescriptionItem, Medicine, TreatmentPackage } from '../../types';
import { Icon } from '../../components/ui/Icon';

interface CreatePackageFromPrescriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  prescription: Prescription;
  items: PrescriptionItem[];
  patientSpecies?: string;
  onSuccessToast: (msg: string) => void;
}

export interface EditableDraftMedicine {
  id: string; // client-side unique id for keying
  medicineId?: number;
  brandName: string;
  genericName?: string;
  presentation: string;
  strengthVolume?: string;
  dose: string;
  unit: string;
  route: string;
  frequency: string;
  durationDays: number;
  quantity: number;
  directions: string;
}

const ALL_TARGET_SPECIES = [
  'General',
  'Canine',
  'Feline',
  'Bovine',
  'Caprine',
  'Ovine',
  'Equine',
  'Swine',
  'Avian',
  'Rabbit',
  'Other',
];

const DEFAULT_ROUTES = [
  'PO (Oral)',
  'Topical',
  'Otic',
  'Ophthalmic',
  'SC (Subcutaneous)',
  'IM (Intramuscular)',
  'IV (Intravenous)',
  'Inhalation',
  'Rectal',
  'Other',
];

const DEFAULT_FREQUENCIES = [
  'SID (q24h / Once daily)',
  'BID (q12h / Twice daily)',
  'TID (q8h / 3x daily)',
  'QID (q6h / 4x daily)',
  'q48h (Every alternate day)',
  'PRN (As needed)',
  'Single Dose',
  'Once weekly',
  'Twice weekly',
  'Other',
];

const DEFAULT_UNITS = [
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
  'Other',
];

export const CreatePackageFromPrescriptionModal: React.FC<CreatePackageFromPrescriptionModalProps> = ({
  isOpen,
  onClose,
  prescription,
  items: sourceItems,
  patientSpecies,
  onSuccessToast,
}) => {
  const navigate = useNavigate();

  // Queries for live master data and formulary
  const masterUnits = useLiveQuery(
    () => db.masterDataItems.where('category').equals('medicine_unit').sortBy('sortOrder'),
    []
  );
  const masterRoutes = useLiveQuery(
    () => db.masterDataItems.where('category').equals('route').sortBy('sortOrder'),
    []
  );
  const masterFrequencies = useLiveQuery(
    () => db.masterDataItems.where('category').equals('frequency').sortBy('sortOrder'),
    []
  );
  const availableMedicines = useLiveQuery(
    () => db.medicines.filter((m) => m.isActive !== false).toArray(),
    []
  );

  // Available options
  const unitOptions = useMemo(() => {
    if (!masterUnits || masterUnits.length === 0) return DEFAULT_UNITS;
    const active = masterUnits.filter((u) => u.isActive).map((u) => u.name);
    return Array.from(new Set([...DEFAULT_UNITS, ...active]));
  }, [masterUnits]);

  const routeOptions = useMemo(() => {
    if (!masterRoutes || masterRoutes.length === 0) return DEFAULT_ROUTES;
    const active = masterRoutes.filter((r) => r.isActive).map((r) => r.name);
    return Array.from(new Set([...DEFAULT_ROUTES, ...active]));
  }, [masterRoutes]);

  const frequencyOptions = useMemo(() => {
    if (!masterFrequencies || masterFrequencies.length === 0) return DEFAULT_FREQUENCIES;
    const active = masterFrequencies.filter((f) => f.isActive).map((f) => f.name);
    return Array.from(new Set([...DEFAULT_FREQUENCIES, ...active]));
  }, [masterFrequencies]);

  // Initial package name suggestion based on diagnosis or date
  const defaultPackageName = useMemo(() => {
    if (prescription.diagnosis && prescription.diagnosis.trim()) {
      return `${prescription.diagnosis.trim()} Protocol`;
    }
    return `Prescription Protocol (${prescription.rxNumber})`;
  }, [prescription]);

  // Initial target species: Match patient's species if known, else General
  const defaultTargetSpecies = useMemo(() => {
    if (patientSpecies) {
      const match = ALL_TARGET_SPECIES.find(
        (sp) => sp.toLowerCase() === patientSpecies.toLowerCase()
      );
      if (match && match !== 'General') return [match];
    }
    return ['General'];
  }, [patientSpecies]);

  // Form states
  const [packageName, setPackageName] = useState(defaultPackageName);
  const [targetSpecies, setTargetSpecies] = useState<string[]>(defaultTargetSpecies);
  const [clinicalIndication, setClinicalIndication] = useState(prescription.diagnosis || '');

  // Deep copy of prescription medicines into editable draft
  const [draftMedicines, setDraftMedicines] = useState<EditableDraftMedicine[]>(() => {
    return (sourceItems || []).map((item, idx) => {
      // Extract numeric dose cleanly if formatted as "10 mg"
      const rawDose = (item.dose || item.strengthVolume || '1').trim();
      const numMatch = rawDose.match(/^([0-9.]+)/);
      const cleanDose = numMatch ? numMatch[1] : rawDose;
      return {
        id: `med-${Date.now()}-${idx}`,
        medicineId: item.medicineId,
        brandName: item.brandName,
        genericName: item.genericName,
        presentation: item.presentation || 'Tablet',
        strengthVolume: item.strengthVolume,
        dose: cleanDose || '1',
        unit: item.unit || 'tablet',
        route: item.route || 'PO (Oral)',
        frequency: item.frequency || 'BID (q12h / Twice daily)',
        durationDays: item.durationDays ?? 5,
        quantity: item.quantity ?? 1,
        directions: item.directions ?? '',
      };
    });
  });

  // Medicine Inline Editor State (which medicine index is actively being edited)
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingForm, setEditingForm] = useState<EditableDraftMedicine | null>(null);

  // "+ Add Medicine" Drawer/Inline Form State
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [addSearchQuery, setAddSearchQuery] = useState('');
  const [selectedAddMed, setSelectedAddMed] = useState<Medicine | null>(null);
  const [newMedForm, setNewMedForm] = useState<EditableDraftMedicine>({
    id: '',
    brandName: '',
    genericName: '',
    presentation: 'Tablet',
    dose: '1',
    unit: 'tablet',
    route: 'PO (Oral)',
    frequency: 'BID (q12h / Twice daily)',
    durationDays: 5,
    quantity: 10,
    directions: '',
  });

  const [editingDurationStr, setEditingDurationStr] = useState<string>('5');
  const [editingQuantityStr, setEditingQuantityStr] = useState<string>('10');
  const [newDurationStr, setNewDurationStr] = useState<string>('5');
  const [newQuantityStr, setNewQuantityStr] = useState<string>('10');

  // Validation errors
  const [errors, setErrors] = useState<{
    packageName?: string;
    targetSpecies?: string;
    clinicalIndication?: string;
    medicines?: string;
    editingItem?: string;
    newItem?: string;
  }>({});

  const [isSaving, setIsSaving] = useState(false);

  // Formulary search matches for add new medicine (unconditional hook before early return)
  const matchingAddMedicines = useMemo(() => {
    if (!isOpen || !availableMedicines || !addSearchQuery.trim()) return [];
    const q = addSearchQuery.toLowerCase().trim();
    return availableMedicines.filter((m) => {
      return (
        m.brandName.toLowerCase().includes(q) ||
        (m.genericName && m.genericName.toLowerCase().includes(q)) ||
        (m.category && m.category.toLowerCase().includes(q)) ||
        (m.presentation && m.presentation.toLowerCase().includes(q))
      );
    });
  }, [isOpen, availableMedicines, addSearchQuery]);

  if (!isOpen) return null;

  // Species selection handler with General mutual exclusivity
  const handleToggleSpecies = (species: string) => {
    setErrors((prev) => ({ ...prev, targetSpecies: undefined }));
    if (species === 'General') {
      // Selecting General clears all specific species
      setTargetSpecies(['General']);
      return;
    }

    // Selecting a specific species clears General
    setTargetSpecies((prev) => {
      const withoutGeneral = prev.filter((s) => s !== 'General');
      if (withoutGeneral.includes(species)) {
        const remaining = withoutGeneral.filter((s) => s !== species);
        return remaining.length > 0 ? remaining : ['General']; // Default back to General if empty
      } else {
        return [...withoutGeneral, species];
      }
    });
  };

  // Medicine remove
  const handleRemoveMedicine = (id: string) => {
    setDraftMedicines((prev) => prev.filter((m) => m.id !== id));
    if (editingIndex !== null && draftMedicines[editingIndex]?.id === id) {
      setEditingIndex(null);
      setEditingForm(null);
    }
  };

  // Start editing a medicine
  const handleStartEdit = (index: number) => {
    setEditingIndex(index);
    const itm = draftMedicines[index];
    setEditingForm({ ...itm });
    setEditingDurationStr(String(itm.durationDays || 5));
    setEditingQuantityStr(String(itm.quantity || 10));
    setIsAddingNew(false);
  };

  // Save medicine changes
  const handleSaveEdit = () => {
    if (editingIndex === null || !editingForm) return;

    if (!editingForm.brandName.trim()) {
      setErrors((prev) => ({ ...prev, editingItem: 'Medicine name/formulation is required.' }));
      return;
    }
    const doseNum = parseFloat(editingForm.dose);
    if (!editingForm.dose.trim() || isNaN(doseNum) || doseNum <= 0) {
      setErrors((prev) => ({ ...prev, editingItem: 'Valid numeric dose is required.' }));
      return;
    }
    if (!editingForm.unit.trim()) {
      setErrors((prev) => ({ ...prev, editingItem: 'Unit is required.' }));
      return;
    }
    if (!editingForm.route.trim()) {
      setErrors((prev) => ({ ...prev, editingItem: 'Route is required.' }));
      return;
    }
    if (!editingForm.frequency.trim()) {
      setErrors((prev) => ({ ...prev, editingItem: 'Frequency is required.' }));
      return;
    }
    const durVal = parseInt(editingDurationStr, 10) || editingForm.durationDays || 1;
    const qtyVal = parseInt(editingQuantityStr, 10) || editingForm.quantity || 1;

    setDraftMedicines((prev) => {
      const updated = [...prev];
      updated[editingIndex] = {
        ...editingForm,
        durationDays: durVal,
        quantity: qtyVal,
      };
      return updated;
    });

    setEditingIndex(null);
    setEditingForm(null);
    setErrors((prev) => ({ ...prev, editingItem: undefined }));
  };

  const handleCancelEdit = () => {
    setEditingIndex(null);
    setEditingForm(null);
    setErrors((prev) => ({ ...prev, editingItem: undefined }));
  };

  // + Add Medicine Form Handlers
  const handleOpenAddMedicine = () => {
    setIsAddingNew(true);
    setEditingIndex(null);
    setEditingForm(null);
    setAddSearchQuery('');
    setSelectedAddMed(null);
    setNewDurationStr('5');
    setNewQuantityStr('10');
    setNewMedForm({
      id: `med-${Date.now()}`,
      brandName: '',
      genericName: '',
      presentation: 'Tablet',
      dose: '1',
      unit: 'tablet',
      route: 'PO (Oral)',
      frequency: 'BID (q12h / Twice daily)',
      durationDays: 5,
      quantity: 10,
      directions: '',
    });
    setErrors((prev) => ({ ...prev, newItem: undefined }));
  };

  const handleSelectFormularyMed = (med: Medicine) => {
    setSelectedAddMed(med);
    setAddSearchQuery(med.brandName);
    const chosenDur = med.defaultDurationDays || 5;
    setNewDurationStr(String(chosenDur));
    setNewQuantityStr('10');
    setNewMedForm((prev) => ({
      ...prev,
      medicineId: med.id,
      brandName: med.brandName,
      genericName: med.genericName || '',
      presentation: med.presentation || 'Tablet',
      strengthVolume: med.strengthVolume || '',
      dose: med.fixedDose ? String(med.fixedDose) : '1',
      unit: med.defaultUnit || med.doseUnit || 'tablet',
      route: med.defaultRoute || 'PO (Oral)',
      frequency: med.defaultFrequency || 'BID (q12h / Twice daily)',
      durationDays: chosenDur,
      directions: med.defaultDirections || '',
    }));
  };

  const handleSaveNewMedicine = () => {
    const brand = newMedForm.brandName.trim() || addSearchQuery.trim();
    if (!brand) {
      setErrors((prev) => ({ ...prev, newItem: 'Medicine name/formulation is required.' }));
      return;
    }
    const doseNum = parseFloat(newMedForm.dose);
    if (!newMedForm.dose.trim() || isNaN(doseNum) || doseNum <= 0) {
      setErrors((prev) => ({ ...prev, newItem: 'Valid numeric dose is required.' }));
      return;
    }
    if (!newMedForm.unit.trim()) {
      setErrors((prev) => ({ ...prev, newItem: 'Unit is required.' }));
      return;
    }
    if (!newMedForm.route.trim()) {
      setErrors((prev) => ({ ...prev, newItem: 'Route is required.' }));
      return;
    }
    if (!newMedForm.frequency.trim()) {
      setErrors((prev) => ({ ...prev, newItem: 'Frequency is required.' }));
      return;
    }
    const durVal = parseInt(newDurationStr, 10) || newMedForm.durationDays || 1;
    const qtyVal = parseInt(newQuantityStr, 10) || newMedForm.quantity || 1;

    const itemToAdd: EditableDraftMedicine = {
      ...newMedForm,
      id: `med-${Date.now()}`,
      brandName: brand,
      durationDays: durVal,
      quantity: qtyVal,
    };

    setDraftMedicines((prev) => [...prev, itemToAdd]);
    setIsAddingNew(false);
    setSelectedAddMed(null);
    setAddSearchQuery('');
    setErrors((prev) => ({ ...prev, newItem: undefined, medicines: undefined }));
  };


  // Main Save Package Submission
  const handleCreatePackage = async () => {
    // Validate required package fields
    const newErrors: typeof errors = {};
    if (!packageName.trim()) {
      newErrors.packageName = 'Package Name is required.';
    }
    if (!targetSpecies || targetSpecies.length === 0) {
      newErrors.targetSpecies = 'Target Species is required.';
    }
    if (!clinicalIndication.trim()) {
      newErrors.clinicalIndication = 'Clinical Indication is required.';
    }
    if (draftMedicines.length === 0) {
      newErrors.medicines = 'At least one medicine is required to create a treatment package.';
    }

    // Validate all medicines have required fields
    for (let i = 0; i < draftMedicines.length; i++) {
      const med = draftMedicines[i];
      const doseNum = parseFloat(med.dose);
      if (
        !med.brandName.trim() ||
        !med.dose.trim() ||
        isNaN(doseNum) ||
        doseNum <= 0 ||
        !med.unit.trim() ||
        !med.route.trim() ||
        !med.frequency.trim() ||
        isNaN(med.durationDays) ||
        med.durationDays <= 0 ||
        isNaN(med.quantity) ||
        med.quantity <= 0
      ) {
        newErrors.medicines = `Medicine #${i + 1} (${med.brandName || 'Unnamed'}) has incomplete or invalid dosing fields.`;
        break;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      let createdPackageId: number | undefined;

      // Atomic Dexie transaction ensuring package and all items are saved together
      await db.transaction('rw', [db.treatmentPackages, db.treatmentPackageItems], async () => {
        // 1. Create Treatment Package
        const pkgData: Omit<TreatmentPackage, 'id'> = {
          name: packageName.trim(),
          description: clinicalIndication.trim(),
          category: clinicalIndication.trim(),
          species: targetSpecies.length === 1 ? targetSpecies[0] : (targetSpecies.includes('General') ? 'General' : targetSpecies.join(', ')),
          targetSpecies: targetSpecies,
          sourcePrescriptionId: prescription.id,
          defaultInstructions: prescription.instructions || '',
          protocolCode: `PROTO-${Date.now().toString().slice(-4)}`,
          usageCount: 0,
          createdAt: now,
          updatedAt: now,
        };

        const pkgId = await db.treatmentPackages.add(pkgData as TreatmentPackage);
        createdPackageId = pkgId as number;

        // 2. Add Package Items deep-copied from the draft
        const itemsToInsert = draftMedicines.map((itm, idx) => ({
          packageId: pkgId as number,
          medicineId: itm.medicineId,
          brandName: itm.brandName.trim(),
          genericName: itm.genericName?.trim(),
          presentation: itm.presentation.trim() || 'Tablet',
          strengthVolume: itm.strengthVolume || itm.presentation,
          dose: itm.dose.trim(),
          quantity: itm.quantity,
          unit: itm.unit.trim(),
          frequency: itm.frequency.trim(),
          durationDays: itm.durationDays,
          route: itm.route.trim(),
          directions: itm.directions ? itm.directions.trim() : undefined,
          sortOrder: idx + 1,
        }));

        await db.treatmentPackageItems.bulkAdd(itemsToInsert);
      });

      onClose();
      onSuccessToast('Treatment package created successfully.');

      if (createdPackageId) {
        navigate(`/packages/${createdPackageId}`);
      }
    } catch (err) {
      console.error('Failed to create treatment package from prescription:', err);
      setErrors((prev) => ({
        ...prev,
        medicines: 'Database error occurred while saving the treatment package. Please try again.',
      }));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="rx-modal-backdrop" onClick={onClose} style={{ zIndex: 9999 }}>
      <div
        className="rx-modal-dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '840px', width: '94vw', maxHeight: '90vh' }}
      >
        {/* Modal Header */}
        <div className="rx-modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid var(--color-border)' }}>
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-lg, 10px)',
                background: 'var(--color-primary, #00685f)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Icon name="package" size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                style={{
                  fontFamily: 'var(--font-heading)',
                  fontWeight: 700,
                  fontSize: '17px',
                  color: 'var(--color-on-surface)',
                  margin: 0,
                }}
                className="truncate"
              >
                Create Treatment Package from Prescription
              </h2>
              <span style={{ fontSize: '12px', color: 'var(--color-outline)' }} className="block truncate">
                Source: Rx #{prescription.rxNumber} • Independent editable package draft
              </span>
            </div>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm shrink-0"
            onClick={onClose}
            aria-label="Close modal"
          >
            <Icon name="x-mark" size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="rx-modal-body" style={{ padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Section 1: Required Package Metadata */}
          <div
            style={{
              background: 'var(--color-surface-container-low, #f8fafc)',
              border: '1px solid var(--color-border, #e2e8f0)',
              borderRadius: 'var(--radius-xl, 14px)',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              {/* Package Name * */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12px', marginBottom: '5px' }}>
                  Package Name <span style={{ color: 'var(--color-error, #ba1a1a)' }}>*</span>
                </label>
                <input
                  type="text"
                  className={`form-input ${errors.packageName ? 'error' : ''}`}
                  placeholder="e.g. Acute Canine Gastroenteritis Protocol"
                  value={packageName}
                  onChange={(e) => {
                    setPackageName(e.target.value);
                    if (errors.packageName) setErrors((p) => ({ ...p, packageName: undefined }));
                  }}
                  style={{ height: '38px', borderRadius: '8px', fontSize: '13px' }}
                />
                {errors.packageName && (
                  <span style={{ fontSize: '11px', color: 'var(--color-error, #ba1a1a)', marginTop: '3px' }}>
                    {errors.packageName}
                  </span>
                )}
              </div>

              {/* Clinical Indication * */}
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12px', marginBottom: '5px' }}>
                  Clinical Indication <span style={{ color: 'var(--color-error, #ba1a1a)' }}>*</span>
                </label>
                <input
                  type="text"
                  className={`form-input ${errors.clinicalIndication ? 'error' : ''}`}
                  placeholder="e.g. Bacterial Otitis Externa / Post-Op Pain Management"
                  value={clinicalIndication}
                  onChange={(e) => {
                    setClinicalIndication(e.target.value);
                    if (errors.clinicalIndication) setErrors((p) => ({ ...p, clinicalIndication: undefined }));
                  }}
                  style={{ height: '38px', borderRadius: '8px', fontSize: '13px' }}
                />
                {errors.clinicalIndication && (
                  <span style={{ fontSize: '11px', color: 'var(--color-error, #ba1a1a)', marginTop: '3px' }}>
                    {errors.clinicalIndication}
                  </span>
                )}
              </div>
            </div>

            {/* Target Species * Multi-select with General mutual exclusivity */}
            <div className="form-group" style={{ margin: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label className="form-label" style={{ fontWeight: 600, fontSize: '12px', margin: 0 }}>
                  Target Species <span style={{ color: 'var(--color-error, #ba1a1a)' }}>*</span>
                </label>
                <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
                  "General" applies to any species. Selecting specific species unselects General.
                </span>
              </div>

              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {ALL_TARGET_SPECIES.map((sp) => {
                  const isSelected = targetSpecies.includes(sp);
                  return (
                    <button
                      key={sp}
                      type="button"
                      onClick={() => handleToggleSpecies(sp)}
                      style={{
                        padding: '5px 12px',
                        borderRadius: '9999px',
                        fontSize: '12px',
                        fontWeight: 600,
                        border: isSelected ? '1px solid var(--color-primary, #00685f)' : '1px solid var(--color-border, #cbd5e1)',
                        background: isSelected ? 'rgba(0, 104, 95, 0.12)' : 'var(--color-surface-container-lowest, #ffffff)',
                        color: isSelected ? 'var(--color-primary, #00685f)' : 'var(--color-on-surface-variant)',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {isSelected && <Icon name="check" size={12} />}
                      <span>{sp}</span>
                    </button>
                  );
                })}
              </div>
              {errors.targetSpecies && (
                <span style={{ fontSize: '11px', color: 'var(--color-error, #ba1a1a)', marginTop: '4px', display: 'block' }}>
                  {errors.targetSpecies}
                </span>
              )}
            </div>
          </div>

          {/* Section 2: Prescription Medicines Preview & Editing */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div>
                <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--color-on-surface)' }}>
                  Package Medicines ({draftMedicines.length})
                </h3>
                <span style={{ fontSize: '11.5px', color: 'var(--color-outline)' }}>
                  Copied from prescription. Edit, re-order, add, or remove medicines for this package.
                </span>
              </div>

              {!isAddingNew && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleOpenAddMedicine}
                  style={{ height: '32px', fontSize: '12px', fontWeight: 600 }}
                >
                  <Icon name="plus" size={14} />
                  <span>+ Add Medicine</span>
                </button>
              )}
            </div>

            {errors.medicines && (
              <div
                style={{
                  padding: '10px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '8px',
                  color: '#991b1b',
                  fontSize: '12.5px',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Icon name="warning" size={16} />
                <span>{errors.medicines}</span>
              </div>
            )}

            {/* Empty Medicines Case */}
            {draftMedicines.length === 0 && !isAddingNew ? (
              <div
                style={{
                  padding: '30px 20px',
                  textAlign: 'center',
                  background: 'var(--color-surface-container-low, #f8fafc)',
                  border: '1px dashed var(--color-border, #cbd5e1)',
                  borderRadius: '12px',
                }}
              >
                <div style={{ color: 'var(--color-outline)', marginBottom: '8px' }}>
                  <Icon name="pill" size={28} />
                </div>
                <p style={{ fontWeight: 600, fontSize: '13px', color: 'var(--color-on-surface)', margin: '0 0 4px 0' }}>
                  This prescription has no medicines to add to a treatment package.
                </p>
                <p style={{ fontSize: '12px', color: 'var(--color-outline)', margin: '0 0 12px 0' }}>
                  You can click "+ Add Medicine" below to configure medicines manually.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleOpenAddMedicine}
                >
                  <Icon name="plus" size={14} />
                  <span>+ Add Medicine</span>
                </button>
              </div>
            ) : (
              /* Medicines List */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {draftMedicines.map((med, idx) => {
                  const isEditingThis = editingIndex === idx;

                  if (isEditingThis && editingForm) {
                    // Inline Edit Form for this medicine
                    return (
                      <div
                        key={med.id}
                        style={{
                          background: 'var(--color-surface-container-lowest, #ffffff)',
                          border: '2px solid var(--color-primary, #00685f)',
                          borderRadius: '12px',
                          padding: '16px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '12px',
                          boxShadow: '0 4px 12px rgba(0, 104, 95, 0.08)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-primary, #00685f)' }}>
                            Editing Medicine #{idx + 1}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>All fields editable</span>
                        </div>

                        {errors.editingItem && (
                          <div style={{ fontSize: '12px', color: 'var(--color-error, #ba1a1a)', background: '#fef2f2', padding: '6px 10px', borderRadius: '6px' }}>
                            {errors.editingItem}
                          </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                          <div className="form-group" style={{ margin: 0, gridColumn: 'span 2' }}>
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                              Medicine Name / Formulation <span style={{ color: 'var(--color-error)' }}>*</span>
                            </label>
                            <input
                              type="text"
                              className="form-input"
                              value={editingForm.brandName}
                              onChange={(e) => setEditingForm({ ...editingForm, brandName: e.target.value })}
                              style={{ height: '36px', fontSize: '12.5px' }}
                            />
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                              Dose (Numeric) <span style={{ color: 'var(--color-error)' }}>*</span>
                            </label>
                            <input
                              type="number"
                              step="any"
                              className="form-input"
                              value={editingForm.dose}
                              onChange={(e) => setEditingForm({ ...editingForm, dose: e.target.value })}
                              style={{ height: '36px', fontSize: '12.5px' }}
                            />
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                              Unit <span style={{ color: 'var(--color-error)' }}>*</span>
                            </label>
                            <select
                              className="form-select"
                              value={editingForm.unit}
                              onChange={(e) => setEditingForm({ ...editingForm, unit: e.target.value })}
                              style={{ height: '36px', fontSize: '12.5px' }}
                            >
                              {unitOptions.map((u, idx) => (
                                <option key={`pkg-edit-unit-${u}-${idx}`} value={u}>{u}</option>
                              ))}
                            </select>
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                              Route <span style={{ color: 'var(--color-error)' }}>*</span>
                            </label>
                            <select
                              className="form-select"
                              value={editingForm.route}
                              onChange={(e) => setEditingForm({ ...editingForm, route: e.target.value })}
                              style={{ height: '36px', fontSize: '12.5px' }}
                            >
                              {routeOptions.map((r, idx) => (
                                <option key={`pkg-edit-route-${r}-${idx}`} value={r}>{r}</option>
                              ))}
                            </select>
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                              Frequency <span style={{ color: 'var(--color-error)' }}>*</span>
                            </label>
                            <select
                              className="form-select"
                              value={editingForm.frequency}
                              onChange={(e) => setEditingForm({ ...editingForm, frequency: e.target.value })}
                              style={{ height: '36px', fontSize: '12.5px' }}
                            >
                              {frequencyOptions.map((f, idx) => (
                                <option key={`pkg-edit-freq-${f}-${idx}`} value={f}>{f}</option>
                              ))}
                            </select>
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                              Duration (Days) <span style={{ color: 'var(--color-error)' }}>*</span>
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="form-input"
                              value={editingDurationStr}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setEditingDurationStr(val);
                                setEditingForm({ ...editingForm, durationDays: val ? parseInt(val, 10) : 0 });
                              }}
                              style={{ height: '36px', fontSize: '12.5px' }}
                            />
                          </div>

                          <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                              Dispense Qty <span style={{ color: 'var(--color-error)' }}>*</span>
                            </label>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="form-input"
                              value={editingQuantityStr}
                              onChange={(e) => {
                                const val = e.target.value.replace(/[^0-9]/g, '');
                                setEditingQuantityStr(val);
                                setEditingForm({ ...editingForm, quantity: val ? parseInt(val, 10) : 0 });
                              }}
                              style={{ height: '36px', fontSize: '12.5px' }}
                            />
                          </div>
                        </div>

                        <div className="form-group" style={{ margin: 0 }}>
                          <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                            Directions / SIG (Optional)
                          </label>
                          <textarea
                            rows={2}
                            className="form-input"
                            value={editingForm.directions}
                            onChange={(e) => setEditingForm({ ...editingForm, directions: e.target.value })}
                            placeholder="Exact administration instructions, e.g. Give with meal..."
                            style={{ height: 'auto', fontSize: '12px', resize: 'vertical' }}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={handleCancelEdit}
                            style={{ height: '32px', fontSize: '12px' }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={handleSaveEdit}
                            style={{ height: '32px', fontSize: '12px' }}
                          >
                            Save Medicine Changes
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // Read-only card preview with Edit & Remove actions
                  return (
                    <div
                      key={med.id}
                      style={{
                        background: 'var(--color-surface-container-low, #f8fafc)',
                        border: '1px solid var(--color-border, #e2e8f0)',
                        borderRadius: '10px',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: '13.5px', color: 'var(--color-on-surface)' }}>
                              {med.brandName}
                            </span>
                            {med.genericName && (
                              <span style={{ fontSize: '12px', color: 'var(--color-outline)', fontStyle: 'italic' }}>
                                ({med.genericName})
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: '11px',
                                background: 'rgba(0, 104, 95, 0.08)',
                                color: 'var(--color-primary, #00685f)',
                                padding: '1px 7px',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              {med.presentation}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--color-on-surface-variant)' }}>
                            <span><strong>Dose:</strong> {med.dose} {med.unit}</span>
                            <span>•</span>
                            <span><strong>Route:</strong> {med.route}</span>
                            <span>•</span>
                            <span><strong>Freq:</strong> {med.frequency}</span>
                            <span>•</span>
                            <span><strong>Duration:</strong> {med.durationDays} days</span>
                            <span>•</span>
                            <span><strong>Total Qty:</strong> {med.quantity} {med.unit}</span>
                          </div>

                          {med.directions && (
                            <div style={{ marginTop: '5px', fontSize: '11.5px', color: 'var(--color-on-surface-variant)', background: 'var(--color-surface-container-lowest, #ffffff)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--color-border, #e2e8f0)', whiteSpace: 'pre-wrap' }}>
                              <strong>SIG:</strong> {med.directions}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleStartEdit(idx)}
                            style={{ height: '30px', padding: '0 10px', fontSize: '11.5px' }}
                            title="Edit Medicine"
                          >
                            <Icon name="edit" size={13} />
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleRemoveMedicine(med.id)}
                            style={{ height: '30px', padding: '0 8px', fontSize: '11.5px', color: 'var(--color-error, #ba1a1a)' }}
                            title="Remove Medicine"
                          >
                            <Icon name="trash" size={13} />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* "+ Add Medicine" Form Panel */}
            {isAddingNew && (
              <div
                style={{
                  marginTop: '12px',
                  background: 'var(--color-surface-container-lowest, #ffffff)',
                  border: '2px dashed var(--color-primary, #00685f)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '13px', color: 'var(--color-primary, #00685f)' }}>
                    Add New Medicine to Package
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setIsAddingNew(false)}
                    style={{ fontSize: '11.5px' }}
                  >
                    Cancel
                  </button>
                </div>

                {errors.newItem && (
                  <div style={{ fontSize: '12px', color: 'var(--color-error, #ba1a1a)', background: '#fef2f2', padding: '6px 10px', borderRadius: '6px' }}>
                    {errors.newItem}
                  </div>
                )}

                {/* Formulary Search Input */}
                <div style={{ position: 'relative' }}>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                    Search Formulary / Enter Medicine Name <span style={{ color: 'var(--color-error)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Type brand name or generic (e.g. Amoxicillin, Meloxicam)..."
                    value={addSearchQuery}
                    onChange={(e) => {
                      setAddSearchQuery(e.target.value);
                      setNewMedForm((p) => ({ ...p, brandName: e.target.value }));
                    }}
                    style={{ height: '36px', fontSize: '12.5px' }}
                    autoFocus
                  />

                  {/* Dropdown matches */}
                  {addSearchQuery.trim() && !selectedAddMed && matchingAddMedicines.length > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 100,
                        background: '#ffffff',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                        maxHeight: '180px',
                        overflowY: 'auto',
                        padding: '4px',
                      }}
                    >
                      {matchingAddMedicines.slice(0, 8).map((med, idx) => (
                        <div
                          key={`pkg-add-med-${med.id}-${idx}`}
                          onClick={() => handleSelectFormularyMed(med)}
                          style={{
                            padding: '6px 10px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderRadius: '6px',
                            transition: 'background 0.1s',
                            fontSize: '12px',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0, 104, 95, 0.08)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <div>
                            <strong>{med.brandName}</strong>
                            {med.genericName && <span style={{ color: 'var(--color-outline)', marginLeft: '6px' }}>({med.genericName})</span>}
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--color-outline)' }}>
                            {med.category || med.targetSpecies?.join(', ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dosing parameters for new medicine */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                      Approved Dose <span style={{ color: 'var(--color-error)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. 1, 2.5"
                      value={newMedForm.dose}
                      onChange={(e) => setNewMedForm({ ...newMedForm, dose: e.target.value })}
                      style={{ height: '36px', fontSize: '12.5px' }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                      Unit <span style={{ color: 'var(--color-error)' }}>*</span>
                    </label>
                    <select
                      className="form-select"
                      value={newMedForm.unit}
                      onChange={(e) => setNewMedForm({ ...newMedForm, unit: e.target.value })}
                      style={{ height: '36px', fontSize: '12.5px' }}
                    >
                      {unitOptions.map((u, idx) => (
                        <option key={`pkg-add-unit-${u}-${idx}`} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                      Route <span style={{ color: 'var(--color-error)' }}>*</span>
                    </label>
                    <select
                      className="form-select"
                      value={newMedForm.route}
                      onChange={(e) => setNewMedForm({ ...newMedForm, route: e.target.value })}
                      style={{ height: '36px', fontSize: '12.5px' }}
                    >
                      {routeOptions.map((r, idx) => (
                        <option key={`pkg-add-route-${r}-${idx}`} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                      Frequency <span style={{ color: 'var(--color-error)' }}>*</span>
                    </label>
                    <select
                      className="form-select"
                      value={newMedForm.frequency}
                      onChange={(e) => setNewMedForm({ ...newMedForm, frequency: e.target.value })}
                      style={{ height: '36px', fontSize: '12.5px' }}
                    >
                      {frequencyOptions.map((f, idx) => (
                        <option key={`pkg-add-freq-${f}-${idx}`} value={f}>{f}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                      Duration (Days) <span style={{ color: 'var(--color-error)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-input"
                      value={newDurationStr}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setNewDurationStr(val);
                        setNewMedForm({ ...newMedForm, durationDays: val ? parseInt(val, 10) : 0 });
                      }}
                      style={{ height: '36px', fontSize: '12.5px' }}
                    />
                  </div>

                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                      Dispense Qty <span style={{ color: 'var(--color-error)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      className="form-input"
                      value={newQuantityStr}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        setNewQuantityStr(val);
                        setNewMedForm({ ...newMedForm, quantity: val ? parseInt(val, 10) : 0 });
                      }}
                      style={{ height: '36px', fontSize: '12.5px' }}
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label" style={{ fontSize: '11px', fontWeight: 600, marginBottom: '3px' }}>
                    Directions / SIG (Optional)
                  </label>
                  <textarea
                    rows={2}
                    className="form-input"
                    value={newMedForm.directions}
                    onChange={(e) => setNewMedForm({ ...newMedForm, directions: e.target.value })}
                    placeholder="Administration directions..."
                    style={{ height: 'auto', fontSize: '12px', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsAddingNew(false)}
                    style={{ height: '32px', fontSize: '12px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveNewMedicine}
                    style={{ height: '32px', fontSize: '12px' }}
                  >
                    Add to Package Draft
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div
          className="rx-modal-footer"
          style={{
            padding: '14px 20px',
            background: 'var(--color-surface-container-low, #f8fafc)',
            borderTop: '1px solid var(--color-border, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '10px',
          }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isSaving}
            style={{ height: '38px', fontSize: '13px' }}
          >
            Cancel
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={handleCreatePackage}
            disabled={isSaving || draftMedicines.length === 0}
            style={{ height: '38px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Icon name="package" size={16} />
            <span>{isSaving ? 'Creating Package...' : 'Create Treatment Package'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
