import React from 'react';
import {
  Phone,
  User,
  PawPrint,
  MapPin,
  CheckCircle2,
  Edit2,
  Activity,
} from 'lucide-react';
import type { Call, CallPriority, VisitFlexibility } from '../../types/cvp';

interface CallSummaryViewProps {
  call: Partial<Call>;
  selectedPatients?: Array<{ id?: number | string; name: string; species: string }>;
  isSubmitting?: boolean;
  onEdit: () => void;
  onConfirm: () => void;
}

const PRIORITY_BADGES: Record<CallPriority, { label: string; bg: string; text: string; icon: string }> = {
  EMERGENCY: { label: 'EMERGENCY', bg: 'bg-red-600', text: 'text-white', icon: '🚨' },
  URGENT: { label: 'URGENT', bg: 'bg-amber-500', text: 'text-white', icon: '⚡' },
  COULD_NOT_ASSESS: { label: 'UNASSESSED', bg: 'bg-purple-600', text: 'text-white', icon: '❓' },
  PLANNED: { label: 'PLANNED', bg: 'bg-teal-600', text: 'text-white', icon: '📅' },
};

const FLEXIBILITY_LABELS: Record<VisitFlexibility, string> = {
  MUST_ATTEND_TODAY: 'Must Attend Today',
  CAN_POSTPONE_TODAY: 'Can Postpone If Urgent',
  PREFERRED_TODAY: 'Preferred Today',
  SPECIFIC_DATE: 'Specific Scheduled Date',
};

export const CallSummaryView: React.FC<CallSummaryViewProps> = ({
  call,
  selectedPatients = [],
  isSubmitting = false,
  onEdit,
  onConfirm,
}) => {
  const priorityInfo = call.priority
    ? PRIORITY_BADGES[call.priority as CallPriority] || PRIORITY_BADGES.PLANNED
    : PRIORITY_BADGES.PLANNED;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Top Priority Banner */}
      <div
        className={`p-4 rounded-2xl ${priorityInfo.bg} ${priorityInfo.text} shadow-md flex items-center justify-between gap-3`}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xl">{priorityInfo.icon}</span>
          <div>
            <div className="text-xs font-black uppercase tracking-wider opacity-90">
              Priority Triage
            </div>
            <div className="text-base font-extrabold">{priorityInfo.label} CASE</div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] font-semibold opacity-90">Flexibility</div>
          <div className="text-xs font-bold">
            {call.flexibility ? FLEXIBILITY_LABELS[call.flexibility as VisitFlexibility] : 'Must Attend Today'}
          </div>
        </div>
      </div>

      {/* Details Card */}
      <div className="p-4 sm:p-5 rounded-3xl bg-white border border-slate-200 shadow-sm space-y-4">
        {/* Client & Contact */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-bold shrink-0">
              <User className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">
                Farmer / Client
              </div>
              <h4 className="text-sm font-black text-slate-900 leading-tight">
                {call.tempOwnerName || call.ownerName || 'Direct Caller'}
              </h4>
              <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                <span className="flex items-center gap-1 font-semibold text-slate-700">
                  <Phone className="w-3 h-3 text-slate-400" />
                  <span>{call.callerPhone || 'No phone recorded'}</span>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-all"
            title="Edit call details"
          >
            <Edit2 className="w-4 h-4" />
          </button>
        </div>

        {/* Animals & Caseload */}
        <div className="pb-3 border-b border-slate-100">
          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <PawPrint className="w-3.5 h-3.5 text-teal-600" />
            <span>Animal / Herd Caseload</span>
          </div>

          {selectedPatients.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedPatients.map((p) => (
                <div
                  key={p.id || p.name}
                  className="px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs font-bold flex items-center gap-1.5"
                >
                  <span>🐾 {p.name}</span>
                  <span className="text-slate-400 font-normal">({p.species})</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-xs font-semibold text-slate-700">
              {call.tempPatientName || `${call.animalCount || 1} × ${call.species || 'Animal'}`}
            </div>
          )}
        </div>

        {/* Reported Symptoms & Tentative Assessment */}
        <div className="space-y-2.5 pb-3 border-b border-slate-100">
          <div>
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Reported Symptoms
            </div>
            <p className="text-xs font-medium text-slate-800 mt-0.5 leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              {call.symptoms || 'No symptoms noted'}
            </p>
          </div>

          {call.tentativeAssessment && (
            <div>
              <div className="text-[11px] font-bold text-teal-700 uppercase tracking-wider flex items-center gap-1">
                <Activity className="w-3 h-3" />
                <span>Doctor&apos;s Tentative Assessment</span>
              </div>
              <p className="text-xs font-semibold text-slate-900 mt-0.5 leading-relaxed">
                {call.tentativeAssessment}
              </p>
            </div>
          )}

          {call.plannedProcedure && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold">
              <span>💉 Procedure:</span>
              <span>{call.plannedProcedure}</span>
            </div>
          )}
        </div>

        {/* Location & Farm Address */}
        <div>
          <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-teal-600" />
            <span>Farm Visit Location</span>
          </div>
          <div className="text-xs font-semibold text-slate-800 leading-relaxed">
            {call.locationAddress || 'No location address recorded'}
          </div>
          {call.latitude && call.longitude && (
            <div className="mt-1 text-[11px] font-mono text-emerald-700 flex items-center gap-1 font-medium">
              <span>📍 Coordinates: {call.latitude.toFixed(5)}, {call.longitude.toFixed(5)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation CTA Footer */}
      <div className="pt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onEdit}
          disabled={isSubmitting}
          className="px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-all flex items-center gap-1.5"
        >
          <Edit2 className="w-3.5 h-3.5" />
          <span>Edit Details</span>
        </button>

        <button
          type="button"
          onClick={onConfirm}
          disabled={isSubmitting}
          className="px-6 py-3 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-black shadow-lg shadow-teal-700/25 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {isSubmitting ? (
            <span>Saving Call...</span>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>Confirm & Log Call (CVP-11)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
