import React, { useState } from 'react';
import { X, PawPrint, AlertCircle, Check } from 'lucide-react';
import { cvpService } from '../../services/cvpService';

interface QuickNewPatientModalProps {
  ownerId: number;
  ownerName?: string;
  isOpen: boolean;
  onClose: () => void;
  onCreated: (patient: any) => void;
}

const COMMON_SPECIES = [
  'Bovine',
  'Caprine',
  'Canine',
  'Feline',
  'Equine',
  'Avian',
  'Other',
];

const COMMON_SEXES = [
  'Female',
  'Male',
  'Female (Intact)',
  'Male (Intact)',
  'Unknown',
];

export const QuickNewPatientModal: React.FC<QuickNewPatientModalProps> = ({
  ownerId,
  ownerName = 'Client',
  isOpen,
  onClose,
  onCreated,
}) => {
  const [name, setName] = useState('');
  const [species, setSpecies] = useState('Bovine');
  const [breed, setBreed] = useState('');
  const [sex, setSex] = useState('Female');
  const [ageNote, setAgeNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Animal / Tag name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const patient = await cvpService.quickCreatePatient({
        ownerId,
        name: name.trim(),
        species,
        breed: breed.trim(),
        sex,
        ageNote: ageNote.trim(),
      });
      onCreated(patient);
      onClose();
    } catch (err: any) {
      console.error('Failed to quick create patient:', err);
      setError(err?.message || 'Could not register patient. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-patient-title"
    >
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden transform transition-all animate-scale-up">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold">
              <PawPrint className="w-4 h-4" />
            </div>
            <div>
              <h3 id="quick-patient-title" className="text-base font-extrabold text-slate-900">
                Quick New Patient
              </h3>
              <p className="text-xs text-slate-500">
                Register animal under {ownerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 transition-all"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Animal Name / Ear Tag ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ganga (Ear Tag #402) or Bruno"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Species <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SPECIES.map((sp) => (
                <button
                  type="button"
                  key={sp}
                  onClick={() => setSpecies(sp)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    species === sp
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {sp}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Breed / Variety
              </label>
              <input
                type="text"
                value={breed}
                onChange={(e) => setBreed(e.target.value)}
                placeholder="e.g. HF Cross, Jersey"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Approximate Age
              </label>
              <input
                type="text"
                value={ageNote}
                onChange={(e) => setAgeNote(e.target.value)}
                placeholder="e.g. 3 years, 4 months"
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-all font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Sex
            </label>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SEXES.map((sx) => (
                <button
                  type="button"
                  key={sx}
                  onClick={() => setSex(sx)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    sex === sx
                      ? 'bg-slate-800 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {sx}
                </button>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Registering...</span>
              ) : (
                <>
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Add Patient</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
