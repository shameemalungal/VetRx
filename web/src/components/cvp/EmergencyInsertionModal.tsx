// ==============================================================================
// VetRx Call & Visit Planner (CVP) — Plan Change After New Emergency (CVP-49)
// Proposes revised route without automatic mutation until doctor explicitly approves
// ==============================================================================

import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  X,
  ShieldAlert,
} from 'lucide-react';
import type { EmergencyProposal, RouteStop } from '../../types/cvp';

interface EmergencyInsertionModalProps {
  isOpen: boolean;
  onClose: () => void;
  proposal: EmergencyProposal;
  onAcceptProposal: () => void;
  onManualAdjust: () => void;
}

export const EmergencyInsertionModal: React.FC<EmergencyInsertionModalProps> = ({
  isOpen,
  onClose,
  proposal,
  onAcceptProposal,
  onManualAdjust,
}) => {
  if (!isOpen) return null;

  const formatTime = (d?: Date | string | null) => {
    if (!d) return '--:--';
    const dateObj = typeof d === 'string' ? new Date(d) : d;
    return dateObj.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="emergency-proposal-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-red-300 max-w-2xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-red-600 to-rose-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 animate-pulse">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-black tracking-wider uppercase text-red-100">
                Route Disruption Triage (CVP-49)
              </div>
              <h2 id="emergency-proposal-title" className="text-lg font-black tracking-tight">
                New Emergency Call Received
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
          {/* Emergency Summary Banner */}
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-red-600 block">
                  Caller / Location
                </span>
                <strong className="text-sm font-black text-slate-900">
                  {proposal.emergencyCall.tempOwnerName ||
                    proposal.emergencyCall.ownerName ||
                    proposal.emergencyCall.callerPhone}
                </strong>
                <p className="text-xs text-slate-600 mt-0.5">
                  {proposal.emergencyCall.locationAddress || 'Client Location'}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full text-xs font-black bg-red-600 text-white shadow-sm">
                PRIORITY 1
              </span>
            </div>

            <div className="mt-2.5 pt-2 border-t border-red-200/60 text-xs text-red-950 font-medium">
              <strong>Symptoms:</strong> {proposal.emergencyCall.symptoms}
            </div>
          </div>

          {/* Explanation & Impact Summary */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-teal-700" />
              Proposed Impact Analysis
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {proposal.explanation}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              <div className="p-2 rounded-lg bg-white border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Insertion Slot
                </span>
                <span className="text-xs font-black text-slate-800">
                  Stop #{proposal.insertedAtOrder}
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Subsequent Shifts
                </span>
                <span className="text-xs font-black text-amber-700">
                  {proposal.affectedStopsCount} Stops
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Travel Delta
                </span>
                <span className="text-xs font-black text-slate-800">
                  +{proposal.travelMinutesDelta}m
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white border border-slate-200 text-center">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">
                  Capacity Status
                </span>
                <span
                  className={`text-xs font-black ${
                    proposal.newOverCapacity ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  {proposal.newOverCapacity
                    ? `+${proposal.newOverCapacityMinutes}m Over`
                    : 'Within Limits'}
                </span>
              </div>
            </div>
          </div>

          {/* Side-by-side or Sequence Preview */}
          <div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
              Proposed Revised Stop Order ({proposal.proposedStops.length} Stops)
            </h3>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {proposal.proposedStops.map((stop: RouteStop) => {
                const isEmergencyStop = stop.visit?.priority === 'EMERGENCY';
                return (
                  <div
                    key={stop.id}
                    className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                      isEmergencyStop
                        ? 'bg-red-50 border-red-300 font-bold'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black ${
                          isEmergencyStop
                            ? 'bg-red-600 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        #{stop.stopOrder}
                      </span>
                      <div className="truncate">
                        <span className="text-slate-900 font-bold block truncate">
                          {stop.visit?.ownerName}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {stop.visit?.address}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-mono text-xs text-slate-800 font-bold block">
                        ETA: {formatTime(stop.estimatedArrival)}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {stop.visit?.estimatedDurationMinutes}m visit
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Safety Notice */}
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-xs text-amber-900">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>
              Your active confirmed route will <strong>not</strong> change automatically. You can
              accept this proposal, adjust it manually in the planner, or keep your existing plan.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 hover:bg-white text-slate-700 text-xs font-bold transition-colors"
          >
            Keep Current Route
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onManualAdjust}
              className="flex-1 sm:flex-initial px-4 py-2 rounded-xl border border-teal-300 bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold transition-colors"
            >
              Adjust Manually
            </button>

            <button
              type="button"
              onClick={onAcceptProposal}
              className="flex-1 sm:flex-initial px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-md shadow-red-600/20 transition-all flex items-center justify-center gap-1.5"
            >
              <span>Accept Revised Route</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
