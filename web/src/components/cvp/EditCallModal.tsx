import React, { useState } from 'react';
import type { Call, CallPriority, VisitFlexibility, CallStatus } from '../../types/cvp';
import { cvpService } from '../../services/cvpService';
import {
  Edit3,
  X,
  Phone,
  User,
  PawPrint,
  AlertCircle,
  CheckCircle2,
  Clock,
  MapPin,
  FileText,
  AlertTriangle,
} from 'lucide-react';

interface EditCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  call: Call | null;
  onSaved: (updatedCall: Call) => void;
}

const COMMON_SYMPTOM_TAGS = [
  'Dystocia / Calving Stalled',
  'Acute Mastitis / Swollen Quarter',
  'Bloat / Tympanites',
  'High Fever / Off Feed',
  'Downer Cow / Milk Fever',
  'Wound / Trauma',
  'Anorexia / Dullness',
  'Artificial Insemination (AI)',
  'Deworming & Vaccination',
  'Routine Health Check',
];

const SPECIES_OPTIONS = [
  'Cattle',
  'Buffalo',
  'Caprine (Goat)',
  'Ovine (Sheep)',
  'Canine (Dog)',
  'Feline (Cat)',
  'Equine (Horse)',
  'Avian (Poultry)',
  'Other',
];

export const EditCallModal: React.FC<EditCallModalProps> = ({
  isOpen,
  onClose,
  call,
  onSaved,
}) => {
  if (!isOpen || !call || call.id == null) return null;
  const activeCallId: string | number = call.id;

  // Form states initialized from existing call
  const [callerPhone, setCallerPhone] = useState(call.callerPhone || '');
  const [ownerName, setOwnerName] = useState(call.ownerName || call.tempOwnerName || '');
  const [patientName, setPatientName] = useState(
    call.tempPatientName || (call.selectedPatients?.[0]?.name) || ''
  );
  const [species, setSpecies] = useState(call.species || 'Cattle');
  const [animalCount, setAnimalCount] = useState<number>(call.animalCount || 1);
  const [symptoms, setSymptoms] = useState(call.symptoms || '');
  const [tentativeAssessment, setTentativeAssessment] = useState(call.tentativeAssessment || '');
  const [plannedProcedure, setPlannedProcedure] = useState(call.plannedProcedure || '');
  const [priority, setPriority] = useState<CallPriority>(call.priority || 'PLANNED');
  const [flexibility, setFlexibility] = useState<VisitFlexibility>(
    call.flexibility || 'MUST_ATTEND_TODAY'
  );
  const [preferredDate, setPreferredDate] = useState<string>(
    call.preferredDate ? String(call.preferredDate).split('T')[0] : ''
  );
  const [status, setStatus] = useState<CallStatus>(call.status || 'LOGGED');
  const [locationAddress, setLocationAddress] = useState(call.locationAddress || '');
  const [notes, setNotes] = useState(call.notes || '');

  // Submission & validation state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);

  // Track initial state to detect dirty edits
  const initialData = React.useMemo(() => ({
    callerPhone: call.callerPhone || '',
    ownerName: call.ownerName || call.tempOwnerName || '',
    patientName: call.tempPatientName || (call.selectedPatients?.[0]?.name) || '',
    species: call.species || 'Cattle',
    animalCount: call.animalCount || 1,
    symptoms: call.symptoms || '',
    tentativeAssessment: call.tentativeAssessment || '',
    plannedProcedure: call.plannedProcedure || '',
    priority: call.priority || 'PLANNED',
    flexibility: call.flexibility || 'MUST_ATTEND_TODAY',
    preferredDate: call.preferredDate ? String(call.preferredDate).split('T')[0] : '',
    status: call.status || 'LOGGED',
    locationAddress: call.locationAddress || '',
    notes: call.notes || '',
  }), [call]);

  const isDirty =
    callerPhone !== initialData.callerPhone ||
    ownerName !== initialData.ownerName ||
    patientName !== initialData.patientName ||
    species !== initialData.species ||
    animalCount !== initialData.animalCount ||
    symptoms !== initialData.symptoms ||
    tentativeAssessment !== initialData.tentativeAssessment ||
    plannedProcedure !== initialData.plannedProcedure ||
    priority !== initialData.priority ||
    flexibility !== initialData.flexibility ||
    preferredDate !== initialData.preferredDate ||
    status !== initialData.status ||
    locationAddress !== initialData.locationAddress ||
    notes !== initialData.notes;

  const handleAttemptClose = () => {
    if (isDirty) {
      setShowDiscardPrompt(true);
    } else {
      onClose();
    }
  };

  const handleAddSymptomTag = (tag: string) => {
    if (!symptoms.trim()) {
      setSymptoms(tag);
    } else if (!symptoms.includes(tag)) {
      setSymptoms(`${symptoms}, ${tag}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!callerPhone.trim() && !ownerName.trim()) {
      setErrorMsg('Please enter either a caller phone number or owner name.');
      return;
    }
    if (!symptoms.trim()) {
      setErrorMsg('Please enter caller-reported symptoms or chief complaint.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);

      // Preserve existing owner & patient linkages unless explicitly changed
      const updates: Partial<Call> = {
        callerPhone: callerPhone.trim(),
        ownerId: call.ownerId, // Preserve authoritative owner link
        tempOwnerName: ownerName.trim() || undefined,
        ownerName: ownerName.trim() || undefined,
        tempPatientName: patientName.trim() || undefined,
        species: species.trim() || undefined,
        animalCount: Math.max(1, animalCount),
        symptoms: symptoms.trim(),
        tentativeAssessment: tentativeAssessment.trim() || undefined,
        plannedProcedure: plannedProcedure.trim() || undefined,
        priority,
        flexibility,
        preferredDate: preferredDate ? preferredDate : undefined,
        status,
        locationAddress: locationAddress.trim() || undefined,
        latitude: call.latitude,
        longitude: call.longitude,
        notes: notes.trim() || undefined,
      };

      const updated = await cvpService.updateCall(activeCallId, updates);
      onSaved(updated);
      onClose();
    } catch (err: any) {
      console.error('Failed to update call:', err);
      setErrorMsg(err?.message || 'Failed to update call on server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-call-title"
    >
      <div className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[92vh] flex flex-col animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5 text-teal-800">
            <div className="p-2 bg-teal-50 text-teal-700 rounded-xl border border-teal-200">
              <Edit3 className="w-5 h-5 text-teal-700" />
            </div>
            <div>
              <h2 id="edit-call-title" className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                Edit Call Details
              </h2>
              <p className="text-xs text-slate-500">
                Update intake details, caller-reported symptoms and triage priority
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAttemptClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Discard Changes Prompt */}
        {showDiscardPrompt && (
          <div className="my-3 p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 flex items-center justify-between gap-3 text-xs font-medium animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>You have unsaved changes. Discard them?</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowDiscardPrompt(false)}
                className="px-2.5 py-1 bg-white border border-amber-300 rounded-lg text-slate-700 font-bold hover:bg-amber-100"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardPrompt(false);
                  onClose();
                }}
                className="px-2.5 py-1 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-700"
              >
                Discard
              </button>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {errorMsg && (
          <div className="my-3 p-3 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs flex items-center gap-2 animate-in fade-in shrink-0">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pr-1 py-3 space-y-4 text-slate-800">
          {/* Section 1: Client & Caller */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-teal-700" />
                <span>Client &amp; Contact Info</span>
              </span>
              {call.ownerId && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  Linked Client ID: {String(call.ownerId).slice(0, 8)}...
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Caller Phone *
                </label>
                <div className="relative">
                  <Phone className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-400" />
                  <input
                    type="tel"
                    required
                    value={callerPhone}
                    onChange={(e) => setCallerPhone(e.target.value)}
                    placeholder="e.g. 9822012345"
                    className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Farmer / Owner Name *
                </label>
                <input
                  type="text"
                  required
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="e.g. Ramesh Patil"
                  className="w-full text-xs p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Patient / Animal Details */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <PawPrint className="w-3.5 h-3.5 text-teal-700" />
              <span>Animal / Patient Details</span>
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Species
                </label>
                <select
                  value={species}
                  onChange={(e) => setSpecies(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium"
                >
                  {SPECIES_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Animal Name / Tag
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="e.g. Lakshmi / Cow #4"
                  className="w-full text-xs p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Animal Count
                </label>
                <input
                  type="number"
                  min={1}
                  value={animalCount}
                  onChange={(e) => setAnimalCount(parseInt(e.target.value, 10) || 1)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Reported Symptoms & Triage Intake */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-teal-700" />
                <span>Caller-Reported Symptoms &amp; Intake</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium">Distinct from confirmed diagnosis</span>
            </div>

            {/* Quick symptom tags */}
            <div className="flex flex-wrap gap-1.5">
              {COMMON_SYMPTOM_TAGS.slice(0, 6).map((tag) => (
                <button
                  type="button"
                  key={tag}
                  onClick={() => handleAddSymptomTag(tag)}
                  className="px-2 py-0.5 rounded-lg bg-white hover:bg-teal-50 hover:text-teal-800 text-slate-700 text-[10px] font-semibold border border-slate-200 transition-colors"
                >
                  + {tag}
                </button>
              ))}
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Reported Symptoms / Complaints *
              </label>
              <textarea
                required
                rows={2}
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Describe caller-reported complaint..."
                className="w-full text-xs p-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Tentative Assessment (Intake)
                </label>
                <input
                  type="text"
                  value={tentativeAssessment}
                  onChange={(e) => setTentativeAssessment(e.target.value)}
                  placeholder="e.g. Suspected Milk Fever"
                  className="w-full text-xs p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Planned Procedure
                </label>
                <input
                  type="text"
                  value={plannedProcedure}
                  onChange={(e) => setPlannedProcedure(e.target.value)}
                  placeholder="e.g. IV Infusion / AI"
                  className="w-full text-xs p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Operational Priority, Schedule & Status */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-teal-700" />
              <span>Operational Priority &amp; Status</span>
            </span>

            {/* Priority selection pills */}
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Priority Classification
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'EMERGENCY', label: 'Emergency', badge: 'bg-red-50 text-red-800 border-red-200' },
                  { id: 'URGENT', label: 'Urgent', badge: 'bg-amber-50 text-amber-800 border-amber-200' },
                  { id: 'PLANNED', label: 'Planned', badge: 'bg-teal-50 text-teal-800 border-teal-200' },
                  { id: 'COULD_NOT_ASSESS', label: 'Unassessed', badge: 'bg-purple-50 text-purple-800 border-purple-200' },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPriority(item.id as CallPriority)}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all text-center ${
                      priority === item.id
                        ? `${item.badge} ring-2 ring-offset-1 ring-slate-400 font-extrabold shadow-xs`
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Flexibility
                </label>
                <select
                  value={flexibility}
                  onChange={(e) => setFlexibility(e.target.value as VisitFlexibility)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium"
                >
                  <option value="MUST_ATTEND_TODAY">Must Attend Today</option>
                  <option value="PREFERRED_TODAY">Preferred Today</option>
                  <option value="CAN_POSTPONE_TODAY">Can Postpone Today</option>
                  <option value="SPECIFIC_DATE">Specific Date</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Scheduled / Preferred Date
                </label>
                <input
                  type="date"
                  value={preferredDate}
                  onChange={(e) => setPreferredDate(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Call Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as CallStatus)}
                  className="w-full text-xs p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium"
                >
                  <option value="LOGGED">📥 Logged (In Triage)</option>
                  <option value="SCHEDULED">📅 Scheduled (Visit Planned)</option>
                  <option value="CANCELLED">✕ Cancelled / Closed</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 5: Location & Intake Notes */}
          <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-teal-700" />
                <span>Farm / Visit Location</span>
              </label>
              <input
                type="text"
                value={locationAddress}
                onChange={(e) => setLocationAddress(e.target.value)}
                placeholder="e.g. Near Milk Chilling Center, Village Wada"
                className="w-full text-xs p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                Intake Notes / Special Instructions
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional instructions or notes..."
                className="w-full text-xs p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium resize-none"
              />
            </div>
          </div>

          {/* Sticky Modal Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={handleAttemptClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs sm:text-sm font-extrabold shadow-md flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Saving to Server...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
