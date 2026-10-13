// ==============================================================================
// VetRx Call & Visit Planner — CreateFollowUpModal Component (Phase 8)
// Single Follow-up & Recurring Schedule Creator with Clinical Date Calculators
// ==============================================================================

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { followUpService } from '../../services/followUpService';
import type {
  FollowUpReason,
  RecurrenceFrequency,
  CallPriority,
  VisitFlexibility,
} from '../../types/cvp';
import {
  Repeat,
  X,
  Stethoscope,
  AlertCircle,
  Check,
} from 'lucide-react';

interface CreateFollowUpModalProps {
  isOpen: boolean;
  onClose: () => void;
  practiceId: string;
  defaultOwnerId?: string | number;
  defaultOwnerName?: string;
  defaultOwnerPhone?: string;
  defaultPatientId?: string | number;
  defaultPatientName?: string;
  defaultSpecies?: string;
  originVisitId?: string | number;
  onCreated?: () => void;
}

export const CreateFollowUpModal: React.FC<CreateFollowUpModalProps> = ({
  isOpen,
  onClose,
  practiceId,
  defaultOwnerId,
  defaultOwnerName,
  defaultOwnerPhone,
  defaultPatientId,
  defaultPatientName,
  defaultSpecies,
  originVisitId,
  onCreated,
}) => {
  // Load owners for autocomplete if not prefilled
  const owners = useLiveQuery(async () => await db.owners.toArray(), []) || [];

  const [isRecurring, setIsRecurring] = useState(false);
  const [selectedOwnerId, setSelectedOwnerId] = useState<string | number>(defaultOwnerId || '');
  const [ownerName, setOwnerName] = useState(defaultOwnerName || '');
  const [ownerPhone, setOwnerPhone] = useState(defaultOwnerPhone || '');
  const [patientId] = useState<string | number>(defaultPatientId || '');
  const [patientName, setPatientName] = useState(defaultPatientName || '');
  const [species, setSpecies] = useState(defaultSpecies || 'Cattle');

  const [reason, setReason] = useState<FollowUpReason>('POST_TREATMENT_REVIEW');
  const [customReason, setCustomReason] = useState('');
  const [priority, setPriority] = useState<CallPriority>('PLANNED');
  const [flexibility, setFlexibility] = useState<VisitFlexibility>('MUST_ATTEND_TODAY');

  // Date calculation
  const getOffsetDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const [recommendedDate, setRecommendedDate] = useState(getOffsetDate(3));
  const [notes, setNotes] = useState('');

  // Recurring options
  const [frequency, setFrequency] = useState<RecurrenceFrequency>('WEEKLY');
  const [intervalDays, setIntervalDays] = useState(7);
  const [recurrenceLimitType, setRecurrenceLimitType] = useState<'occurrences' | 'date'>('occurrences');
  const [maxOccurrences, setMaxOccurrences] = useState(4);
  const [endDate, setEndDate] = useState(getOffsetDate(60));

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  // Quick chips for recommended dates based on clinical procedure
  const handleChipClick = (days: number, newReason?: FollowUpReason) => {
    setRecommendedDate(getOffsetDate(days));
    if (newReason) setReason(newReason);
  };

  const handleOwnerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedOwnerId(val);
    const found = owners.find((o) => String(o.id) === String(val));
    if (found) {
      setOwnerName(found.name);
      setOwnerPhone(found.phone);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ownerName.trim()) {
      setErrorMsg('Please select or specify an owner name.');
      return;
    }
    if (!recommendedDate) {
      setErrorMsg('Please select a recommended date.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const finalReason = reason === 'OTHER' && customReason.trim() ? customReason.trim() : reason;

      if (isRecurring) {
        await followUpService.createRecurringSchedule({
          practiceId,
          ownerId: selectedOwnerId || `temp_${Date.now()}`,
          ownerName: ownerName.trim(),
          ownerPhone: ownerPhone.trim() || undefined,
          patientId: patientId || undefined,
          patientName: patientName.trim() || undefined,
          species,
          reason: finalReason,
          frequency,
          intervalDays: frequency === 'CUSTOM_INTERVAL' ? Number(intervalDays) || 7 : undefined,
          startDate: recommendedDate,
          endDate: recurrenceLimitType === 'date' ? endDate : undefined,
          maxOccurrences: recurrenceLimitType === 'occurrences' ? Number(maxOccurrences) || 4 : undefined,
          priority,
          flexibility,
          notes: notes.trim() || undefined,
        });
      } else {
        await followUpService.createFollowUp({
          practiceId,
          ownerId: selectedOwnerId || `temp_${Date.now()}`,
          ownerName: ownerName.trim(),
          ownerPhone: ownerPhone.trim() || undefined,
          patientId: patientId || undefined,
          patientName: patientName.trim() || undefined,
          species,
          originVisitId,
          reason: finalReason,
          recommendedDate,
          priority,
          flexibility,
          notes: notes.trim() || undefined,
        });
      }

      if (onCreated) onCreated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create follow-up.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      style={{ zIndex: 1050 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-followup-title"
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden flex flex-col max-h-[85dvh] sm:max-h-[90vh]"
        style={{ maxHeight: '85dvh' }}
      >
        {/* Modal Header */}
        <div className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-teal-700 to-emerald-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Stethoscope className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-black tracking-wider uppercase text-teal-200">
                Clinical Follow-up &amp; Recurrence
              </div>
              <h2 id="create-followup-title" className="text-lg font-black tracking-tight">
                {isRecurring ? 'Create Recurring Schedule' : 'Schedule Clinical Follow-up'}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1 min-h-0">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Recurrence Mode Toggle */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                <Repeat className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Recurring Visit Series</span>
                <span className="text-[11px] text-slate-500">
                  {isRecurring ? 'Repeats on a scheduled interval' : 'Single follow-up check'}
                </span>
              </div>
            </div>
            <button
              id="toggle-recurring-series"
              aria-label="Toggle recurring visit series"
              type="button"
              onClick={() => setIsRecurring(!isRecurring)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                isRecurring ? 'bg-indigo-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isRecurring ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Owner & Patient Information */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Owner / Farmer <span className="text-rose-500">*</span>
              </label>
              {owners.length > 0 && !defaultOwnerName ? (
                <select
                  value={selectedOwnerId}
                  onChange={handleOwnerChange}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white font-medium"
                >
                  <option value="">-- Select Existing Owner --</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.phone})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder="Farmer name"
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 font-medium"
                  required
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Patient / Animal
              </label>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="e.g. Gauri / Cow #4"
                  className="col-span-2 text-xs rounded-xl border border-slate-300 p-2.5 font-medium"
                />
                <select
                  value={species}
                  onChange={(e) => setSpecies(e.target.value)}
                  className="text-xs rounded-xl border border-slate-300 p-2.5 font-medium bg-white"
                >
                  <option value="Cattle">Cattle</option>
                  <option value="Buffalo">Buffalo</option>
                  <option value="Goat">Goat</option>
                  <option value="Sheep">Sheep</option>
                  <option value="Canine">Canine</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Reason for Follow-up */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Reason for Follow-up <span className="text-rose-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as FollowUpReason)}
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white font-semibold"
            >
              <option value="POST_TREATMENT_REVIEW">Post-Treatment Health Review (2-3 days)</option>
              <option value="RECHECK">Clinical Recheck (5-7 days)</option>
              <option value="POST_OPERATIVE_REVIEW">Post-Operative Recovery Check (3-5 days)</option>
              <option value="VACCINATION">Vaccination Booster (21 days)</option>
              <option value="DEWORMING">Routine Deworming (90 days)</option>
              <option value="PREGNANCY_DIAGNOSIS">Pregnancy Diagnosis / PD (60-90 days)</option>
              <option value="ARTIFICIAL_INSEMINATION">Artificial Insemination (AI) Follow-up (21 days)</option>
              <option value="OTHER">Other Custom Follow-up</option>
            </select>
          </div>

          {reason === 'OTHER' && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Custom Reason Description
              </label>
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Describe reason..."
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 font-medium"
                required
              />
            </div>
          )}

          {/* Quick Date Shortcuts */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Recommended Clinical Date
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <button
                type="button"
                onClick={() => handleChipClick(3, 'POST_TREATMENT_REVIEW')}
                className="px-2.5 py-1 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 text-[11px] font-bold"
              >
                +3 Days (Review)
              </button>
              <button
                type="button"
                onClick={() => handleChipClick(7, 'RECHECK')}
                className="px-2.5 py-1 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800 text-[11px] font-bold"
              >
                +7 Days (Recheck)
              </button>
              <button
                type="button"
                onClick={() => handleChipClick(21, 'VACCINATION')}
                className="px-2.5 py-1 rounded-lg border border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800 text-[11px] font-bold"
              >
                +21 Days (Booster)
              </button>
              <button
                type="button"
                onClick={() => handleChipClick(60, 'PREGNANCY_DIAGNOSIS')}
                className="px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-800 text-[11px] font-bold"
              >
                +60 Days (PD)
              </button>
            </div>
            <input
              type="date"
              value={recommendedDate}
              onChange={(e) => setRecommendedDate(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 font-bold"
              required
            />
          </div>

          {/* Recurring Schedule Parameters (When Toggle Active) */}
          {isRecurring && (
            <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-2xl space-y-3">
              <div className="text-xs font-black text-indigo-900 uppercase tracking-wide">
                Recurrence Frequency & Boundaries
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as RecurrenceFrequency)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white font-medium"
                  >
                    <option value="DAILY">Daily</option>
                    <option value="WEEKLY">Weekly (7 days)</option>
                    <option value="BIWEEKLY">Every 2 Weeks (14 days)</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="CUSTOM_INTERVAL">Custom Days Interval</option>
                  </select>
                </div>

                {frequency === 'CUSTOM_INTERVAL' && (
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Interval (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={intervalDays}
                      onChange={(e) => setIntervalDays(Number(e.target.value) || 1)}
                      className="w-full text-xs rounded-xl border border-slate-300 p-2 font-medium"
                    />
                  </div>
                )}
              </div>

              {/* Stop Condition */}
              <div className="pt-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Series Limit
                </label>
                <div className="flex items-center gap-4 text-xs font-medium mb-2">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="limitType"
                      checked={recurrenceLimitType === 'occurrences'}
                      onChange={() => setRecurrenceLimitType('occurrences')}
                    />
                    <span>Number of Occurrences</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="limitType"
                      checked={recurrenceLimitType === 'date'}
                      onChange={() => setRecurrenceLimitType('date')}
                    />
                    <span>Until End Date</span>
                  </label>
                </div>

                {recurrenceLimitType === 'occurrences' ? (
                  <input
                    type="number"
                    min="2"
                    max="50"
                    value={maxOccurrences}
                    onChange={(e) => setMaxOccurrences(Number(e.target.value) || 2)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2 font-medium"
                    placeholder="e.g. 4 occurrences"
                  />
                ) : (
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2 font-medium"
                  />
                )}
              </div>
            </div>
          )}

          {/* Priority & Scheduling Flexibility */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as CallPriority)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white font-medium"
              >
                <option value="EMERGENCY">Emergency</option>
                <option value="URGENT">Urgent</option>
                <option value="PLANNED">Planned</option>
                <option value="ROUTINE">Routine</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Scheduling Flexibility
              </label>
              <select
                value={flexibility}
                onChange={(e) => setFlexibility(e.target.value as VisitFlexibility)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white font-medium"
              >
                <option value="MUST_ATTEND_TODAY">Must Attend Today</option>
                <option value="WINDOW_PREF_MORNING">Prefer Morning</option>
                <option value="WINDOW_PREF_AFTERNOON">Prefer Afternoon</option>
                <option value="ANYTIME_TODAY">Anytime Today</option>
                <option value="CAN_POSTPONE_IF_URGENT">Can Postpone If Urgent</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Clinical Instructions / Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Check temperature and wound healing; check milk yield..."
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 font-medium"
            />
          </div>

          {/* Clinical Notice */}
          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
            <span className="font-bold">Clinical Reminder:</span> This creates a recommended follow-up schedule. It does NOT automatically book a physical appointment or replace the veterinarian&apos;s daily route-planning judgment.
          </div>

          </div>

          {/* Pinned Action Footer */}
          <div className="shrink-0 p-3 sm:p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-black shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : isRecurring ? 'Create Recurring Series' : 'Schedule Follow-up'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
