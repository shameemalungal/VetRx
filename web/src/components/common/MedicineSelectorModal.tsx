// ==============================================================================
// VetRx Unified Medicine Selection Component
// Shared between Field Visits (Actual Usage) & Prescription Builder
// Preserves clinical identity, formulary link, and distinction between
// planned, prescribed, and actually administered medicines.
// ==============================================================================

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { Medicine } from '../../types';
import {
  Search,
  X,
  Pill,
  Check,
  Plus,
  AlertCircle,
} from 'lucide-react';

export interface SelectedMedicineData {
  medicineId?: number | string;
  brandName: string;
  genericName?: string;
  presentation: string;
  strength?: string;
  packSize?: string;
  quantity: number;
  unit: string;
  route: string;
  frequency?: string;
  durationDays?: number;
  batchNumber?: string;
  instructions?: string;
}

interface MedicineSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (data: SelectedMedicineData) => void;
  mode?: 'usage' | 'prescription';
  targetAnimalName?: string;
  initialValues?: Partial<SelectedMedicineData>;
  availableRoutes?: string[];
  availableFrequencies?: string[];
}

const DEFAULT_ROUTES = [
  'IM',
  'IV',
  'SC',
  'Oral',
  'Topical',
  'Intramammary',
  'Eye/Ear Drops',
  'Inhalation',
  'Intrauterine',
];

const DEFAULT_FREQUENCIES = [
  'Once daily (OD)',
  'Twice daily (BID / q12h)',
  'Thrice daily (TID / q8h)',
  'Four times daily (QID / q6h)',
  'Stat (Immediate single dose)',
  'As needed (PRN)',
  'Every 48 hours (q48h)',
  'Weekly',
];

const DEFAULT_PRESENTATIONS = [
  'Injection',
  'Tablet',
  'Bolus',
  'Oral Liquid / Suspension',
  'Powder / Sachet',
  'Topical Spray / Ointment',
  'Intramammary Infusion',
  'Pour-on',
  'Drops',
];

export const MedicineSelectorModal: React.FC<MedicineSelectorModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  mode = 'usage',
  targetAnimalName,
  initialValues,
  availableRoutes = DEFAULT_ROUTES,
  availableFrequencies = DEFAULT_FREQUENCIES,
}) => {
  // Query authoritative medicines from local Dexie formulary
  const allMedicines = useLiveQuery(
    () => db.medicines.filter((m) => m.isActive !== false).toArray(),
    []
  ) || [];

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMed, setSelectedMed] = useState<Medicine | null>(null);

  // Form fields
  const [brandName, setBrandName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [presentation, setPresentation] = useState('Injection');
  const [strength, setStrength] = useState('');
  const [quantity, setQuantity] = useState<number>(1);
  const [unit, setUnit] = useState('ml');
  const [route, setRoute] = useState('IM');
  const [frequency, setFrequency] = useState('Once daily (OD)');
  const [durationDays, setDurationDays] = useState<number>(3);
  const [batchNumber, setBatchNumber] = useState('');
  const [instructions, setInstructions] = useState('');

  const [isCustomEntry, setIsCustomEntry] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialValues) {
        setBrandName(initialValues.brandName || '');
        setGenericName(initialValues.genericName || '');
        setPresentation(initialValues.presentation || (mode === 'usage' ? 'Injection' : 'Tablet'));
        setStrength(initialValues.strength || '');
        setQuantity(initialValues.quantity || 1);
        setUnit(initialValues.unit || (mode === 'usage' ? 'ml' : 'tablet'));
        setRoute(initialValues.route || (mode === 'usage' ? 'IM' : 'Oral'));
        setFrequency(initialValues.frequency || 'Once daily (OD)');
        setDurationDays(initialValues.durationDays || 3);
        setBatchNumber(initialValues.batchNumber || '');
        setInstructions(initialValues.instructions || '');
      } else {
        resetForm();
      }
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, initialValues, mode]);

  const resetForm = () => {
    setSearchTerm('');
    setSelectedMed(null);
    setBrandName('');
    setGenericName('');
    setPresentation(mode === 'usage' ? 'Injection' : 'Tablet');
    setStrength('');
    setQuantity(1);
    setUnit(mode === 'usage' ? 'ml' : 'tablet');
    setRoute(mode === 'usage' ? 'IM' : 'Oral');
    setFrequency('Once daily (OD)');
    setDurationDays(3);
    setBatchNumber('');
    setInstructions('');
    setIsCustomEntry(false);
  };

  // Filtered catalogue search
  const filteredMedicines = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return allMedicines.slice(0, 10);
    return allMedicines
      .filter((m) => {
        const brand = (m.brandName || '').toLowerCase();
        const generic = (m.genericName || '').toLowerCase();
        const pres = (m.presentation || '').toLowerCase();
        return brand.includes(q) || generic.includes(q) || pres.includes(q);
      })
      .slice(0, 15);
  }, [allMedicines, searchTerm]);

  const handlePickMedicine = (med: Medicine) => {
    setSelectedMed(med);
    setBrandName(med.brandName);
    setGenericName(med.genericName || '');
    setPresentation(med.presentation || (mode === 'usage' ? 'Injection' : 'Tablet'));
    setStrength(med.strength || '');
    setUnit(med.dispenseUnit || (med.presentation?.toLowerCase().includes('inj') ? 'ml' : 'tablet'));
    setRoute(med.defaultRoute || (med.presentation?.toLowerCase().includes('inj') ? 'IM' : 'Oral'));
    setIsCustomEntry(false);
  };

  const handleCreateCustom = () => {
    setSelectedMed(null);
    setBrandName(searchTerm.trim());
    setGenericName('');
    setIsCustomEntry(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalBrand = brandName.trim() || searchTerm.trim();
    if (!finalBrand) {
      alert('Please enter or select a medicine name.');
      return;
    }

    onSelect({
      medicineId: selectedMed?.id,
      brandName: finalBrand,
      genericName: genericName.trim() || undefined,
      presentation,
      strength: strength.trim() || undefined,
      packSize: selectedMed?.packSize,
      quantity: Number(quantity) || 1,
      unit: unit.trim() || 'dose',
      route,
      frequency: mode === 'prescription' ? frequency : undefined,
      durationDays: mode === 'prescription' ? Number(durationDays) || 1 : undefined,
      batchNumber: batchNumber.trim() || undefined,
      instructions: instructions.trim() || undefined,
    });

    onClose();
    resetForm();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-white rounded-3xl max-w-xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center border border-teal-100">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 leading-tight">
                {mode === 'usage' ? 'Record Medicine Administered' : 'Add Prescribed Medicine'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {targetAnimalName ? `For: ${targetAnimalName} • ` : ''}
                {mode === 'usage' ? 'Field usage & stock deduction' : 'Prescription therapy item'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto py-3 space-y-4 text-xs">
          {/* 1. Medicine Catalogue Search */}
          <div>
            <label className="font-bold text-slate-800 block mb-1">
              Search Formulary Medicine <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Type brand name or active chemical (e.g. Meloxicam, Enrofloxacin)..."
                className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Quick match dropdown list */}
            {searchTerm.trim().length > 0 && !selectedMed && (
              <div className="mt-1.5 max-h-48 overflow-y-auto rounded-2xl border border-teal-200 bg-slate-50 divide-y divide-slate-100 shadow-md">
                {filteredMedicines.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handlePickMedicine(m)}
                    className="w-full text-left p-2.5 hover:bg-teal-50/70 flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <div className="font-black text-slate-900">{m.brandName}</div>
                      <div className="text-[11px] text-slate-500">
                        {m.genericName || 'Formula'} • {m.presentation || 'Medicine'} {m.strength ? `(${m.strength})` : ''}
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-100 text-teal-900 border border-teal-200">
                      Select
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={handleCreateCustom}
                  className="w-full text-left p-2.5 bg-white hover:bg-slate-100 text-teal-800 font-bold flex items-center gap-1.5 text-xs"
                >
                  <Plus className="w-4 h-4" />
                  <span>Use custom entry: &ldquo;{searchTerm.trim()}&rdquo;</span>
                </button>
              </div>
            )}
          </div>

          {/* Selected Medicine Pill */}
          {(selectedMed || isCustomEntry || brandName) && (
            <div className="p-3 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-teal-700 stroke-[3]" />
                <div>
                  <span className="font-black text-teal-950 text-xs">
                    {brandName || selectedMed?.brandName}
                  </span>
                  {(genericName || selectedMed?.genericName) && (
                    <span className="text-[11px] text-teal-800 block">
                      {genericName || selectedMed?.genericName}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedMed(null);
                  setBrandName('');
                  setIsCustomEntry(false);
                }}
                className="text-[11px] font-bold text-teal-800 underline hover:text-teal-950"
              >
                Change
              </button>
            </div>
          )}

          {/* 2. Formulation & Presentation Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Presentation</label>
              <select
                value={presentation}
                onChange={(e) => setPresentation(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
              >
                {DEFAULT_PRESENTATIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Strength / Concentration</label>
              <input
                type="text"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                placeholder="e.g. 5 mg/ml, 500 mg, 10%"
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>
          </div>

          {/* 3. Quantity & Route */}
          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                {mode === 'usage' ? 'Administered Qty *' : 'Prescribed Qty *'}
              </label>
              <input
                type="number"
                min="0.1"
                step="any"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-black text-xs text-slate-900 focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Unit</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="ml, tablet, bolus"
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">Route</label>
              <select
                value={route}
                onChange={(e) => setRoute(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
              >
                {availableRoutes.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Prescription-Specific Fields: Frequency & Duration */}
          {mode === 'prescription' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
              <div>
                <label className="font-bold text-slate-700 block mb-1">Frequency</label>
                <select
                  value={frequency}
                  onChange={(e) => setFrequency(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
                >
                  {availableFrequencies.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">Duration (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="90"
                  value={durationDays}
                  onChange={(e) => setDurationDays(parseInt(e.target.value, 10) || 1)}
                  className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>
            </div>
          )}

          {/* 5. Batch & Directions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">Batch Number (Optional)</label>
              <input
                type="text"
                placeholder="e.g. B2401"
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                {mode === 'usage' ? 'Usage Notes' : 'Directions for Client'}
              </label>
              <input
                type="text"
                placeholder={mode === 'usage' ? 'e.g. Deep IM slowly' : 'e.g. Give with feed morning & evening'}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs focus:ring-2 focus:ring-teal-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Information Notice */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <span>
              {mode === 'usage'
                ? 'Recording actual usage logs field administration and prepares stock deduction for this visit kit. Prescriptions remain distinct.'
                : 'Adding to prescription specifies prescribed take-home pharmacotherapy for client guidance. It does not deduct field kit stock.'}
            </span>
          </div>

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-black text-xs shadow-md shadow-teal-700/20 transition-all flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[2.5]" />
              <span>{mode === 'usage' ? 'Save Actual Administration' : 'Add to Prescription'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
