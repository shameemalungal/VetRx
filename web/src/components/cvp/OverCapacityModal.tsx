// ==============================================================================
// VetRx Call & Visit Planner (CVP) — Over Capacity Warning Modal (CVP-16)
// Clear, Doctor-Controlled Capacity Conflict Resolution with Postpone Suggestions
// ==============================================================================

import React from 'react';
import {
  AlertTriangle,
  Calendar,
  X,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import type { PostponableCandidate, Visit } from '../../types/cvp';

interface OverCapacityModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableMinutes: number;
  requiredMinutes: number;
  overCapacityMinutes: number;
  postponableCandidates: PostponableCandidate[];
  onSelectPostpone: (visit: Visit) => void;
  onAcceptException: () => void;
}

export const OverCapacityModal: React.FC<OverCapacityModalProps> = ({
  isOpen,
  onClose,
  availableMinutes,
  requiredMinutes,
  overCapacityMinutes,
  postponableCandidates,
  onSelectPostpone,
  onAcceptException,
}) => {
  if (!isOpen) return null;

  const formatHoursMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="over-capacity-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-red-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-black tracking-wider uppercase text-red-100">
                Capacity Warning (CVP-16)
              </div>
              <h2 id="over-capacity-title" className="text-lg font-black tracking-tight">
                Plan Exceeds Daily Capacity
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {/* Metrics Comparison Box */}
          <div className="p-4 rounded-2xl bg-red-50/70 border border-red-200 space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-white border border-red-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Available
                </span>
                <span className="text-sm font-black text-slate-800">
                  {formatHoursMins(availableMinutes)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-white border border-red-100">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Required
                </span>
                <span className="text-sm font-black text-red-700">
                  {formatHoursMins(requiredMinutes)}
                </span>
              </div>
              <div className="p-2 rounded-xl bg-red-100 border border-red-200">
                <span className="text-[10px] font-extrabold text-red-600 block uppercase">
                  Over By
                </span>
                <span className="text-sm font-black text-red-800">
                  +{formatHoursMins(overCapacityMinutes)}
                </span>
              </div>
            </div>

            <p className="text-xs text-red-900 font-medium leading-relaxed">
              Your route preparation contains more patient visits, travel time, and buffer than your
              available working hours. To avoid doctor fatigue and late arrivals, review recommended
              postponement options below.
            </p>
          </div>

          {/* Safety Rule Banner */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800 block">Strict Clinical Protection:</strong>
              Emergencies and urgent clinical cases are never automatically postponed. You must explicitly select each postponement decision.
            </div>
          </div>

          {/* Postponable Candidates List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                Suggested Postponable Visits ({postponableCandidates.length})
              </h3>
              <span className="text-[11px] font-semibold text-slate-400">
                Non-urgent routine cases
              </span>
            </div>

            {postponableCandidates.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-500">
                No safe postponement candidates found. All queued cases are emergencies or urgent.
              </div>
            ) : (
              <div className="space-y-2">
                {postponableCandidates.map((cand, idx) => (
                  <div
                    key={cand.visit.id || idx}
                    className="p-3 rounded-xl border border-slate-200 hover:border-teal-300 bg-white transition-all flex items-center justify-between gap-3 shadow-sm group"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-slate-900 truncate">
                          {cand.visit.ownerName}
                        </span>
                        <span className="text-[10px] font-semibold text-teal-800 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                          {cand.procedureCategory || 'Routine'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        {cand.reason}
                      </p>
                      <span className="text-[10px] font-bold text-emerald-700 mt-1 inline-block">
                        Frees ~{cand.savedMinutes} minutes
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectPostpone(cand.visit)}
                      className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1 shrink-0"
                    >
                      <Calendar className="w-3 h-3" />
                      <span>Postpone</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 hover:bg-white text-slate-700 text-xs font-bold transition-colors"
          >
            Review Route Manually
          </button>

          <button
            type="button"
            onClick={onAcceptException}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-black shadow-md shadow-amber-600/20 transition-all flex items-center justify-center gap-1.5"
          >
            <span>Accept Overtime Exception</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
