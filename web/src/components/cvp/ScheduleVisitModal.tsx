// ==============================================================================
// VetRx Call & Visit Planner — Schedule Visit Modal
// Turns a logged Call into an explicit, confirmed Visit with patient/location mapping
// ==============================================================================

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  MapPin,
  AlertTriangle,
  X,
  CheckCircle2,
} from 'lucide-react';
import type { Call, CallPriority, VisitFlexibility } from '../../types/cvp';

interface ScheduleVisitModalProps {
  isOpen: boolean;
  call: Call | null;
  onClose: () => void;
  onConfirmSchedule: (scheduleData: {
    scheduledDate: string;
    priority: CallPriority;
    flexibility: VisitFlexibility;
    preferredTime?: string;
    address: string;
    latitude?: number;
    longitude?: number;
    notes?: string;
    plannedProcedure?: string;
    addToTodayPlan: boolean;
    patientName?: string;
    species?: string;
  }) => Promise<void>;
}

export const ScheduleVisitModal: React.FC<ScheduleVisitModalProps> = ({
  isOpen,
  call,
  onClose,
  onConfirmSchedule,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const [scheduledDate, setScheduledDate] = useState<string>(todayStr);
  const [preferredTime, setPreferredTime] = useState<string>('Morning (09:00 - 12:00)');
  const [priority, setPriority] = useState<CallPriority>('PLANNED');
  const [flexibility, setFlexibility] = useState<VisitFlexibility>('MUST_ATTEND_TODAY');
  const [address, setAddress] = useState<string>('');
  const [patientName, setPatientName] = useState<string>('');
  const [species, setSpecies] = useState<string>('Cattle');
  const [notes, setNotes] = useState<string>('');
  const [plannedProcedure, setPlannedProcedure] = useState<string>('');
  const [addToTodayPlan, setAddToTodayPlan] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (call) {
      const initialDate = call.preferredDate
        ? typeof call.preferredDate === 'string'
          ? call.preferredDate.split('T')[0]
          : call.preferredDate.toISOString().split('T')[0]
        : todayStr;

      setScheduledDate(initialDate);
      setPriority(call.priority || 'PLANNED');
      setFlexibility(call.flexibility || 'MUST_ATTEND_TODAY');
      setAddress(call.locationAddress || '');
      setPatientName(call.tempPatientName || (call.species ? `${call.species} #1` : ''));
      setSpecies(call.species || 'Cattle');
      setNotes(call.notes || '');
      setPlannedProcedure(call.plannedProcedure || '');
      setAddToTodayPlan(initialDate === todayStr);
      setErrorMessage(null);
    }
  }, [call, todayStr]);

  if (!isOpen || !call) return null;

  const isToday = scheduledDate === todayStr;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledDate) {
      setErrorMessage('Please select a visit date.');
      return;
    }
    if (!address.trim() && !call.callerPhone) {
      setErrorMessage('Please confirm a farm or clinic location.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onConfirmSchedule({
        scheduledDate,
        priority,
        flexibility,
        preferredTime,
        address: address.trim() || 'Client Location',
        latitude: call.latitude,
        longitude: call.longitude,
        notes: notes.trim() || undefined,
        plannedProcedure: plannedProcedure.trim() || undefined,
        addToTodayPlan: isToday && addToTodayPlan,
        patientName: patientName.trim() || undefined,
        species: species.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to schedule visit:', err);
      setErrorMessage(err?.message || 'Could not schedule visit. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-modal-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-700 text-white flex items-center justify-center shadow-md shadow-teal-700/20">
              <Calendar className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 id="schedule-modal-title" className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Schedule Visit
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {call.ownerName || call.tempOwnerName || 'Client Caller'} • {call.callerPhone}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-200/60 flex items-center justify-center text-slate-500 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Date & Time Window */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Visit Date *
              </label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => {
                  setScheduledDate(e.target.value);
                  if (e.target.value === todayStr) {
                    setAddToTodayPlan(true);
                  }
                }}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Time Window
              </label>
              <select
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium text-slate-800"
              >
                <option value="Morning (09:00 - 12:00)">Morning (09:00 - 12:00)</option>
                <option value="Afternoon (12:00 - 15:00)">Afternoon (12:00 - 15:00)</option>
                <option value="Evening (15:00 - 18:00)">Evening (15:00 - 18:00)</option>
                <option value="Immediate / Emergency">Immediate / Emergency</option>
                <option value="Flexible Anytime">Flexible Anytime</option>
              </select>
            </div>
          </div>

          {/* Priority & Flexibility */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as CallPriority)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium text-slate-800"
              >
                <option value="PLANNED">📅 Planned Routine</option>
                <option value="URGENT">⚡ Urgent (Today)</option>
                <option value="EMERGENCY">🚨 Critical Emergency</option>
                <option value="COULD_NOT_ASSESS">❓ Unassessed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Flexibility
              </label>
              <select
                value={flexibility}
                onChange={(e) => setFlexibility(e.target.value as VisitFlexibility)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium text-slate-800"
              >
                <option value="MUST_ATTEND_TODAY">Must Attend Today</option>
                <option value="PREFERRED_TODAY">Preferred Today</option>
                <option value="CAN_POSTPONE_TODAY">Can Postpone If Busy</option>
                <option value="SPECIFIC_DATE">Specific Date Only</option>
              </select>
            </div>
          </div>

          {/* Animal & Species */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Animal / Patient Name
              </label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="e.g. Gauri / Cow #1"
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium text-slate-800"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Species
              </label>
              <select
                value={species}
                onChange={(e) => setSpecies(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium text-slate-800"
              >
                <option value="Cattle">Cattle</option>
                <option value="Buffalo">Buffalo</option>
                <option value="Goat">Goat</option>
                <option value="Sheep">Sheep</option>
                <option value="Canine">Canine (Dog)</option>
                <option value="Feline">Feline (Cat)</option>
                <option value="Avian">Avian</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Location */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Visit / Farm Address *
            </label>
            <div className="relative">
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Near Milk Society, Ward 4"
                className="w-full pl-9 pr-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium text-slate-800"
              />
              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            </div>
          </div>

          {/* Planned Procedure & Chief Complaint */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Planned Procedure
            </label>
            <input
              type="text"
              value={plannedProcedure}
              onChange={(e) => setPlannedProcedure(e.target.value)}
              placeholder="e.g. Artificial Insemination, Wound Dressing, General Exam"
              className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium text-slate-800"
            />
          </div>

          {/* Symptoms Context (Read-only summary) */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">
              Reported Symptoms from Call
            </span>
            <p className="text-xs text-slate-700 font-medium leading-relaxed">
              {call.symptoms}
            </p>
          </div>

          {/* Additional Visit Notes */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Visit Instructions / Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special directions, gate code, or pre-visit instructions"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium text-slate-800 resize-none"
            />
          </div>

          {/* Option: Add to Today's Plan */}
          {isToday && (
            <label className="flex items-center gap-3 p-3 rounded-2xl bg-teal-50/60 border border-teal-200/80 cursor-pointer hover:bg-teal-50 transition-colors">
              <input
                type="checkbox"
                checked={addToTodayPlan}
                onChange={(e) => setAddToTodayPlan(e.target.checked)}
                className="w-4 h-4 rounded text-teal-700 focus:ring-teal-500 border-slate-300"
              />
              <div className="text-xs">
                <span className="font-bold text-teal-900 block">
                  Add directly to Today&apos;s Route Plan
                </span>
                <span className="text-teal-700 text-[11px]">
                  Inserts this visit into today&apos;s field route stops and capacity queue.
                </span>
              </div>
            </label>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="min-h-[44px] px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-sm font-bold transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-6 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 active:scale-95 text-white text-sm font-bold shadow-md shadow-teal-700/20 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>Scheduling...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
                  <span>Confirm &amp; Schedule Visit</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
