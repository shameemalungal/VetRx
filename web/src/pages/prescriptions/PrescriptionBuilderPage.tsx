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
} from '../../types';
import { useSettingsStore } from '../../store/settingsStore';
import { Icon } from '../../components/ui/Icon';
import './Prescriptions.css';

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
  quantity: number;
  unit: string;
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

  // Step 3: Prescribed Medicines
  const [items, setItems] = useState<DraftItem[]>([]);

  // Package Popover state
  const [showPkgPopover, setShowPkgPopover] = useState(false);

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
  const [selectedMedRef, setSelectedMedRef] = useState<Medicine | null>(null);
  const [medForm, setMedForm] = useState({
    brandName: '',
    genericName: '',
    presentation: 'Tablet',
    doseUnit: '1 tablet',
    route: 'PO (Oral)',
    frequency: 'BID (q12h)',
    durationDays: 5,
    quantity: 10,
    unit: 'tabs',
    directions: 'Give after food with drinking water. Complete full course.',
  });

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
  const diagnosisRef = useRef<HTMLInputElement>(null);
  const medicinesRef = useRef<HTMLDivElement>(null);

  // Live medicine search filtering against Brand Name, Generic Name, and Therapeutic Category
  const matchingMedicines = useMemo(() => {
    if (!availableMedicines) return [];
    const q = medModalSearch.trim().toLowerCase();
    if (!q) return [];
    return availableMedicines.filter((m) => {
      const brand = (m.brandName || '').toLowerCase();
      const generic = (m.genericName || '').toLowerCase();
      const cat = (m.category || '').toLowerCase();
      return brand.includes(q) || generic.includes(q) || cat.includes(q);
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
    if (medForm.route && !active.includes(medForm.route)) {
      active.push(medForm.route);
    }
    return active.length > 0 ? active : fallback;
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
    if (medForm.frequency && !active.includes(medForm.frequency)) {
      active.push(medForm.frequency);
    }
    return active.length > 0 ? active : fallback;
  }, [masterFrequencies, medForm.frequency]);

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

  // ── Populate State for Edit Mode ──────────────────────────────
  useEffect(() => {
    if (mode === 'edit' && existingRx) {
      setSelectedPatientId(existingRx.patientId);
      setSymptoms(existingRx.symptoms || '');
      setDiagnosis(existingRx.diagnosis || '');
      setAdvice(existingRx.instructions || '');
      setFollowUpDays(existingRx.followUpDays);
    }
  }, [mode, existingRx]);

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
          quantity: item.quantity,
          unit: item.unit,
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
          quantity: item.quantity,
          unit: item.unit,
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
      return (
        p.name.toLowerCase().includes(q) ||
        p.species.toLowerCase().includes(q) ||
        p.breed?.toLowerCase().includes(q) ||
        owner?.name.toLowerCase().includes(q) ||
        owner?.phone.includes(q)
      );
    });
  }, [allPatients, ownersMap, animalSearch, speciesFilter]);

  // ── Modal Handlers ────────────────────────────────────────────
  const openAddMedModal = () => {
    setEditingItemIndex(null);
    setSelectedMedRef(null);
    setMedModalSearch('');
    setMedForm({
      brandName: '',
      genericName: '',
      presentation: 'Tablet',
      doseUnit: '1 tablet',
      route: 'PO (Oral)',
      frequency: 'BID (q12h)',
      durationDays: 5,
      quantity: 10,
      unit: 'tabs',
      directions: 'Give after food with water. Complete full course.',
    });
    setModalOpen(true);
  };

  const openEditMedModal = (index: number) => {
    const itm = items[index];
    setEditingItemIndex(index);
    setSelectedMedRef(null);
    setMedModalSearch(itm.brandName);
    setMedForm({
      brandName: itm.brandName,
      genericName: itm.genericName || '',
      presentation: itm.presentation || 'Tablet',
      doseUnit: itm.strengthVolume || '1 tablet',
      route: itm.route || 'PO (Oral)',
      frequency: itm.frequency || 'BID (q12h)',
      durationDays: itm.durationDays || 5,
      quantity: itm.quantity,
      unit: itm.unit,
      directions: itm.directions || '',
    });
    setModalOpen(true);
  };

  const handleSelectMedRef = (med: Medicine) => {
    setSelectedMedRef(med);
    setMedModalSearch(med.brandName);
    setMedForm((prev) => ({
      ...prev,
      brandName: med.brandName,
      genericName: med.genericName || '',
      presentation: med.presentation,
      doseUnit: med.strengthVolume || prev.doseUnit,
      unit: med.defaultUnit || prev.unit,
    }));
  };

  const handleSaveMedModal = () => {
    const brand = medForm.brandName.trim() || medModalSearch.trim();
    if (!brand) {
      alert('Please enter or select a medicine name.');
      return;
    }

    const newItem: DraftItem = {
      medicineId: selectedMedRef?.id,
      brandName: brand,
      genericName: medForm.genericName || selectedMedRef?.genericName,
      presentation: medForm.presentation,
      strengthVolume: medForm.doseUnit,
      quantity: Number(medForm.quantity) || 1,
      unit: medForm.unit || 'units',
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
  const handleApplyPackage = async (pkg: TreatmentPackage) => {
    if (!pkg.id) return;
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

  // ── Save Prescription (Draft or Issued) ───────────────────────
  const handleSave = async (targetStatus: 'Draft' | 'Issued') => {
    const newErrors: {
      patient?: string;
      symptoms?: string;
      diagnosis?: string;
      medicines?: string;
      general?: string;
    } = {};

    if (!selectedPatientId) {
      newErrors.patient = 'Please select a patient animal before proceeding.';
    }

    if (targetStatus === 'Issued') {
      if (!symptoms.trim()) {
        newErrors.symptoms = 'Symptoms / clinical presentation is required.';
      }
      if (!diagnosis.trim()) {
        newErrors.diagnosis = 'Diagnosis is required to generate prescription.';
      }
      if (items.length === 0) {
        newErrors.medicines = 'Please add at least one prescribed medicine before generating.';
      }
    }

    if (Object.keys(newErrors).length > 0) {
      newErrors.general = 'Please complete all required fields before generating the prescription.';
      setErrors(newErrors);
      setErrorMsg(newErrors.general);

      // Automatically focus or scroll to the first invalid field
      if (newErrors.symptoms) {
        symptomsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        symptomsRef.current?.focus();
      } else if (newErrors.diagnosis) {
        diagnosisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        diagnosisRef.current?.focus();
      } else if (newErrors.medicines) {
        medicinesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setErrors({});
    setErrorMsg(null);

    if (!selectedPatientId) {
      return;
    }

    setIsSaving(true);

    try {
      const now = new Date();
      const practitionerId = practitioner?.id || 1;
      const ownerId = selectedPatient?.ownerId || 1;

      let rxId: number;

      if (mode === 'edit' && id) {
        rxId = parseInt(id, 10);
        await db.prescriptions.update(rxId, {
          patientId: selectedPatientId,
          ownerId,
          practitionerId,
          symptoms: symptoms.trim() || undefined,
          diagnosis: diagnosis.trim() || undefined,
          instructions: advice.trim() || undefined,
          followUpDays: followUpDays,
          status: targetStatus,
          issuedAt: targetStatus === 'Issued' ? existingRx?.issuedAt || now : undefined,
          updatedAt: now,
        });

        // Replace prescription items
        await db.prescriptionItems.where('prescriptionId').equals(rxId).delete();
      } else {
        // Generate new prescription number e.g. RX-2026-XXXX
        const count = await db.prescriptions.count();
        const rxNumber = `RX-2026-${String(893 + count).padStart(4, '0')}`;

        rxId = (await db.prescriptions.add({
          rxNumber,
          patientId: selectedPatientId,
          ownerId,
          practitionerId,
          symptoms: symptoms.trim() || undefined,
          diagnosis: diagnosis.trim() || undefined,
          instructions: advice.trim() || undefined,
          followUpDays: followUpDays,
          status: targetStatus,
          issuedAt: targetStatus === 'Issued' ? now : undefined,
          createdAt: now,
          updatedAt: now,
        })) as number;
      }

      // Save line items
      if (items.length > 0) {
        const lineItemsToInsert = items.map((itm, idx) => ({
          prescriptionId: rxId,
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
        }));

        await db.prescriptionItems.bulkAdd(lineItemsToInsert);
      }

      // Navigate to View / Preview page
      navigate(`/prescriptions/${rxId}`);
    } catch (err) {
      console.error('Error saving prescription:', err);
      setErrorMsg('An unexpected error occurred while saving the prescription.');
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
            {['All', 'Canine', 'Feline', 'Equine', 'Avian'].map((spec) => (
              <button
                key={spec}
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
                  Select the patient from the list below or create a new patient to start the prescription.
                </p>
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
                filteredPatients.map((patient) => {
                  const owner = ownersMap.get(patient.ownerId);
                  return (
                    <div key={patient.id} className="rx-select-animal-card">
                      <div className="rx-select-card-left">
                        <div className="rx-select-card-avatar">
                          {patient.name.charAt(0).toUpperCase()}
                          <span className="rx-select-card-badge">
                            <Icon name="paw" size={11} />
                          </span>
                        </div>

                        <div className="rx-select-card-info">
                          <div className="rx-select-card-title-row">
                            <span className="rx-select-card-name">{patient.name}</span>
                            <span className="rx-select-card-id">#{patient.species.slice(0, 3).toUpperCase()}-{patient.id}</span>
                          </div>

                          <div className="rx-select-card-meta">
                            <span>{patient.species}</span>
                            {patient.breed && (
                              <>
                                <span>•</span>
                                <span className="font-semibold text-on-surface">{patient.breed}</span>
                              </>
                            )}
                            {patient.sex && (
                              <>
                                <span>•</span>
                                <span>{patient.sex}</span>
                              </>
                            )}
                            {patient.ageNote && (
                              <>
                                <span>•</span>
                                <span>{patient.ageNote}</span>
                              </>
                            )}
                            {patient.weightKg && (
                              <>
                                <span>•</span>
                                <span className="rx-select-weight-mono">{patient.weightKg} kg</span>
                              </>
                            )}
                          </div>

                          <div className="rx-select-owner-line">
                            <Icon name="user" size={13} />
                            <span>
                              Owner: <strong>{owner ? owner.name : 'Unknown'}</strong>
                              {owner?.phone && ` (${owner.phone})`}
                            </span>
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

          {/* Quick Register Footer */}
          {filteredPatients.length > 0 && (
            <div className="flex flex-col items-center justify-center pt-2 pb-8 gap-2 text-center">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setRegisterWarningModalOpen(true)}
              >
                <Icon name="user-plus" size={16} />
                <span>Register New Patient / Client</span>
              </button>
            </div>
          )}
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
          <span className="rx-crumb-active">2. Clinical Details</span>
          <span>→</span>
          <span className="rx-crumb-active">3. Medicines</span>
          <span>→</span>
          <span>4. Generate</span>
        </div>
      </div>

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
                  <span className="rx-patient-name-bold">{selectedPatient?.name || 'Patient'}</span>
                  <span className="rx-species-pill">{selectedPatient?.species || 'Animal'}</span>
                  {selectedPatient?.weightKg && (
                    <span className="rx-weight-pill">Weight: {selectedPatient.weightKg} kg</span>
                  )}
                </div>
                <div className="rx-signalment-subline">
                  {selectedPatient?.breed && <span>{selectedPatient.breed}</span>}
                  {selectedPatient?.sex && (
                    <>
                      <span>•</span>
                      <span>{selectedPatient.sex}</span>
                    </>
                  )}
                  {selectedPatient?.ageNote && (
                    <>
                      <span>•</span>
                      <span>{selectedPatient.ageNote}</span>
                    </>
                  )}
                  {selectedOwner && (
                    <>
                      <span>•</span>
                      <span className="font-medium text-on-surface">
                        Owner: {selectedOwner.name} ({selectedOwner.phone})
                      </span>
                    </>
                  )}
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
              <label className="form-label">
                Symptoms / Clinical Presentation <span className="text-error">*</span>
              </label>
              <textarea
                ref={symptomsRef}
                className={`rx-textarea ${errors.symptoms ? 'rx-input-error' : ''}`}
                rows={3}
                placeholder="Describe presenting symptoms, physical findings, and otoscopic/auscultatory observations..."
                value={symptoms}
                aria-invalid={!!errors.symptoms}
                aria-describedby={errors.symptoms ? 'symptoms-error' : undefined}
                onChange={(e) => {
                  setSymptoms(e.target.value);
                  if (errors.symptoms) {
                    setErrors((prev) => ({ ...prev, symptoms: undefined, general: undefined }));
                    setErrorMsg(null);
                  }
                }}
              />
              {errors.symptoms && (
                <div className="rx-field-error" id="symptoms-error" role="alert">
                  <Icon name="warning" size={14} />
                  <span>{errors.symptoms}</span>
                </div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">
                Diagnosis <span className="text-error">*</span>
              </label>
              <div className="rx-diagnosis-input-wrap">
                <div className="rx-diagnosis-icon">
                  <Icon name="verified" size={18} />
                </div>
                <input
                  ref={diagnosisRef}
                  type="text"
                  className={`rx-diagnosis-input ${errors.diagnosis ? 'rx-input-error' : ''}`}
                  placeholder="Enter confirmed or tentative diagnosis (e.g. Canine Acute Otitis Externa)..."
                  value={diagnosis}
                  aria-invalid={!!errors.diagnosis}
                  aria-describedby={errors.diagnosis ? 'diagnosis-error' : undefined}
                  onChange={(e) => {
                    setDiagnosis(e.target.value);
                    if (errors.diagnosis) {
                      setErrors((prev) => ({ ...prev, diagnosis: undefined, general: undefined }));
                      setErrorMsg(null);
                    }
                  }}
                />
              </div>
              {errors.diagnosis && (
                <div className="rx-field-error" id="diagnosis-error" role="alert">
                  <Icon name="warning" size={14} />
                  <span>{errors.diagnosis}</span>
                </div>
              )}
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
                      {items.length} added
                    </span>
                  </h2>
                  <p className="text-xs text-outline" style={{ margin: 0, marginTop: '2px', fontSize: '12px', color: 'var(--color-outline)' }}>
                    Active pharmaceutical items to be dispensed with instructions
                  </p>
                </div>
              </div>

              <div className="rx-medicines-actions">
                {/* Apply Treatment Package Trigger */}
                <div className="relative">
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
                    <div className="rx-pkg-popover">
                      <div className="rx-pkg-popover-header">
                        <span>Treatment Packages</span>
                        <span className="font-mono text-xs">{treatmentPackages?.length || 0} available</span>
                      </div>
                      {!treatmentPackages || treatmentPackages.length === 0 ? (
                        <div className="p-3 text-xs text-outline text-center">
                          No packages available.
                        </div>
                      ) : (
                        treatmentPackages.map((pkg) => (
                          <div key={pkg.id} className="rx-pkg-item">
                            <div className="flex flex-col min-w-0">
                              <span className="rx-pkg-name truncate">{pkg.name}</span>
                              <span className="rx-pkg-sub truncate">
                                {pkg.category || 'Clinical Protocol'}
                              </span>
                            </div>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ height: 26, padding: '0 8px', fontSize: 11 }}
                              onClick={() => handleApplyPackage(pkg)}
                            >
                              Apply
                            </button>
                          </div>
                        ))
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
                  <div key={idx} className="rx-med-item-card">
                    <div className="rx-med-item-left">
                      <div className="rx-med-badge">Rx {idx + 1}</div>
                      <div className="rx-med-details">
                        <div className="rx-med-title-row">
                          <span className="rx-med-name">{itm.brandName}</span>
                          <span className="rx-med-qty-badge">
                            Qty: {itm.quantity} {itm.unit}
                          </span>
                        </div>

                        <div className="rx-med-regimen-pills">
                          <span>{itm.strengthVolume || itm.presentation}</span>
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

            <div className="rx-followup-row">
              <div>
                <span className="text-xs font-bold uppercase text-on-surface block">
                  Follow-up Recheck
                </span>
                <span className="text-xs text-outline">Recommended clinical re-evaluation interval</span>
              </div>

              <div className="rx-followup-chips">
                {[
                  { label: 'None', days: 0 },
                  { label: '3 days', days: 3 },
                  { label: '5 days', days: 5 },
                  { label: '7 days', days: 7 },
                  { label: '14 days', days: 14 },
                ].map((chip) => (
                  <button
                    key={chip.days}
                    type="button"
                    className={`rx-followup-btn ${followUpDays === chip.days ? 'active' : ''}`}
                    onClick={() => setFollowUpDays(chip.days)}
                  >
                    {chip.label}
                  </button>
                ))}
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
                <span className="rx-summary-stat-label">Protocol:</span>
                <span className="rx-summary-stat-value primary">
                  {followUpDays ? `${followUpDays} days duration` : 'Standard regimen'}
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
                    <div key={i} className="rx-schedule-row">
                      <span className="rx-schedule-med">{itm.brandName}</span>
                      <span className="rx-schedule-freq">
                        {itm.quantity} {itm.unit} • {itm.frequency}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2 pt-2 border-t border-surface-container">
              {errors.general && (
                <div className="rx-summary-error-banner" role="alert">
                  <Icon name="warning" size={16} />
                  <span>{errors.general}</span>
                </div>
              )}

              <button
                type="button"
                className="btn btn-primary"
                style={{ height: 46, width: '100%' }}
                disabled={isSaving}
                onClick={() => handleSave('Issued')}
              >
                <span>{isSaving ? 'Issuing...' : 'Generate Prescription'}</span>
                <Icon name="arrow-forward" size={18} />
              </button>

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
                Generates printable medical stationery &amp; digital record
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
              <div className="flex items-center gap-2">
                <div style={{ width: 32, height: 32, borderRadius: 'var(--radius)', background: 'var(--color-primary)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name="pill" size={18} />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-base text-on-surface">
                    {editingItemIndex !== null ? 'Edit Medicine' : 'Add Medicine to Prescription'}
                  </h3>
                  <span className="text-xs text-outline">Search formulary or configure dosing</span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setModalOpen(false)}
              >
                <Icon name="x-mark" size={18} />
              </button>
            </div>

            <div className="rx-modal-body">
              {/* Search or Brand Name */}
              <div className="form-group">
                <label className="form-label">Search Formulation / Brand Name</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Amoxicillin, Enrofloxacin, Antibiotic..."
                    value={medModalSearch}
                    onChange={(e) => {
                      setMedModalSearch(e.target.value);
                      setMedForm((p) => ({ ...p, brandName: e.target.value }));
                    }}
                    autoFocus
                  />

                  {/* Live Search Results Dropdown */}
                  {medModalSearch.trim().length > 0 && !selectedMedRef && (
                    <div className="rx-live-med-dropdown">
                      {matchingMedicines.length === 0 ? (
                        <div className="rx-live-med-empty">
                          <Icon name="search" size={14} />
                          <span>No matching medicines found.</span>
                        </div>
                      ) : (
                        matchingMedicines.slice(0, 15).map((med) => (
                          <div
                            key={med.id}
                            className="rx-live-med-item"
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
                        ))
                      )}
                    </div>
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

                {/* Quick suggestions from formulary when search field is empty */}
                {(!medModalSearch.trim() || !selectedMedRef) && availableMedicines && availableMedicines.length > 0 && !selectedMedRef && (
                  <div style={{ marginTop: 8 }}>
                    <div className="text-xs text-outline mb-1.5 flex items-center gap-1">
                      <Icon name="sparkles" size={12} />
                      <span>Quick suggestions from formulary:</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {availableMedicines.slice(0, 6).map((med) => (
                        <button
                          key={med.id}
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
                  <label className="form-label">Dose &amp; Unit</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. 1 tab, 4 drops"
                    value={medForm.doseUnit}
                    onChange={(e) => setMedForm({ ...medForm, doseUnit: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Route</label>
                  <select
                    className="form-select"
                    value={medForm.route}
                    onChange={(e) => setMedForm({ ...medForm, route: e.target.value })}
                  >
                    {availableRoutes.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Frequency</label>
                  <select
                    className="form-select"
                    value={medForm.frequency}
                    onChange={(e) => setMedForm({ ...medForm, frequency: e.target.value })}
                  >
                    {availableFrequencies.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Duration &amp; Qty</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: 65, textAlign: 'center' }}
                      placeholder="Days"
                      value={medForm.durationDays}
                      onChange={(e) => setMedForm({ ...medForm, durationDays: parseInt(e.target.value, 10) || 0 })}
                    />
                    <input
                      type="number"
                      className="form-input"
                      style={{ width: 65, textAlign: 'center' }}
                      placeholder="Qty"
                      value={medForm.quantity}
                      onChange={(e) => setMedForm({ ...medForm, quantity: parseInt(e.target.value, 10) || 1 })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Dispense Unit</label>
                  <select
                    className="form-select"
                    value={medForm.unit}
                    onChange={(e) => setMedForm({ ...medForm, unit: e.target.value })}
                  >
                    {availableUnits.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
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
    </div>
  );
};
