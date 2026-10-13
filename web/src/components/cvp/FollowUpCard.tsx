// ==============================================================================
// VetRx Call & Visit Planner — FollowUpCard Component (Phase 8)
// Displays follow-up recommendation, recurrence link, triage, and mobile actions
// ==============================================================================

import React from 'react';
import type { FollowUp, FollowUpStatus } from '../../types/cvp';
import {
  Calendar,
  Clock,
  Phone,
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  CalendarCheck,
  ChevronRight,
  X,
  Stethoscope,
} from 'lucide-react';

interface FollowUpCardProps {
  followUp: FollowUp;
  onConvertToCall?: (f: FollowUp) => void;
  onConvertToVisit?: (f: FollowUp) => void;
  onWhatsApp?: (f: FollowUp) => void;
  onPhone?: (f: FollowUp) => void;
  onAcknowledge?: (f: FollowUp) => void;
  onPostpone?: (f: FollowUp) => void;
  onCancel?: (f: FollowUp) => void;
  onSelect?: (f: FollowUp) => void;
}

export const FollowUpCard: React.FC<FollowUpCardProps> = ({
  followUp,
  onConvertToCall,
  onConvertToVisit,
  onWhatsApp,
  onPhone,
  onAcknowledge,
  onPostpone,
  onCancel,
  onSelect,
}) => {
  const getStatusBadge = (status: FollowUpStatus) => {
    switch (status) {
      case 'OVERDUE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-rose-100 text-rose-900 border border-rose-300 animate-pulse">
            <AlertTriangle className="w-3 h-3 text-rose-700" />
            OVERDUE
          </span>
        );
      case 'DUE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-amber-100 text-amber-950 border border-amber-300">
            <Clock className="w-3 h-3 text-amber-800" />
            DUE TODAY
          </span>
        );
      case 'UPCOMING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300">
            <Calendar className="w-3 h-3 text-blue-700" />
            UPCOMING
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-100 text-teal-900 border border-teal-300">
            <CalendarCheck className="w-3 h-3 text-teal-700" />
            SCHEDULED
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            COMPLETED
          </span>
        );
      case 'POSTPONED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300">
            <RotateCcw className="w-3 h-3 text-purple-700" />
            POSTPONED
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
            <X className="w-3 h-3 text-slate-600" />
            CANCELLED
          </span>
        );
      default:
        return null;
    }
  };

  const getFriendlyReason = (reason: string) => {
    const map: Record<string, string> = {
      POST_TREATMENT_REVIEW: 'Post-Treatment Review',
      RECHECK: 'Clinical Recheck',
      VACCINATION: 'Vaccination',
      DEWORMING: 'Deworming',
      PREGNANCY_DIAGNOSIS: 'Pregnancy Diagnosis (PD)',
      ARTIFICIAL_INSEMINATION: 'Artificial Insemination (AI)',
      POST_OPERATIVE_REVIEW: 'Post-Op Review',
      OTHER: 'Veterinary Follow-up',
    };
    return map[reason] || reason;
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const recDate = typeof followUp.recommendedDate === 'string'
    ? followUp.recommendedDate.split('T')[0]
    : new Date(followUp.recommendedDate).toISOString().split('T')[0];

  const getRelativeDateText = () => {
    if (recDate === todayStr) return 'Today';
    const d1 = new Date(todayStr).getTime();
    const d2 = new Date(recDate).getTime();
    const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return `${Math.abs(diffDays)}d overdue`;
    if (diffDays === 1) return 'Tomorrow';
    return `In ${diffDays} days`;
  };

  const cleanPhone = (p?: string) => (p ? p.replace(/[^0-9+]/g, '') : '');

  const handlePhoneClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPhone) {
      onPhone(followUp);
    } else {
      const p = cleanPhone(followUp.ownerPhone);
      if (p) window.open(`tel:${p}`, '_self');
    }
  };

  const isTerminal = followUp.status === 'COMPLETED' || followUp.status === 'CANCELLED';

  return (
    <div
      className={`rounded-2xl border p-4 bg-white shadow-sm transition-all hover:shadow-md ${
        followUp.status === 'OVERDUE'
          ? 'border-rose-300 ring-1 ring-rose-200/50'
          : followUp.status === 'DUE'
          ? 'border-amber-300 ring-1 ring-amber-200/50'
          : 'border-slate-200'
      }`}
      onClick={() => onSelect && onSelect(followUp)}
    >
      {/* Top row: Badges */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {getStatusBadge(followUp.status)}
          {followUp.recurrenceRuleId && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              🔄 Recurring Series
            </span>
          )}
          {followUp.priority === 'EMERGENCY' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
              EMERGENCY
            </span>
          )}
          {followUp.priority === 'URGENT' && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-white">
              URGENT
            </span>
          )}
        </div>

        <div className="text-right">
          <span className="text-xs font-black text-slate-800">{recDate}</span>
          <span className="text-[11px] text-slate-500 block">{getRelativeDateText()}</span>
        </div>
      </div>

      {/* Title & Reason */}
      <div className="flex items-start gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0 mt-0.5">
          <Stethoscope className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-bold text-slate-900 text-sm truncate">
            {getFriendlyReason(followUp.reason)}
          </h4>
          <p className="text-xs text-slate-600 truncate">
            <span className="font-semibold text-slate-800">{followUp.ownerName || 'Unknown Owner'}</span>
            {followUp.patientName && ` • ${followUp.patientName}`}
            {followUp.species && ` (${followUp.species})`}
          </p>
        </div>
      </div>

      {/* Notes / Details */}
      {followUp.notes && (
        <p className="text-xs text-slate-600 bg-slate-50 rounded-lg p-2 mb-3 border border-slate-100">
          {followUp.notes}
        </p>
      )}

      {/* Reminder Acknowledgement Status */}
      <div className="flex items-center justify-between text-xs text-slate-500 mb-3 pt-1 border-t border-slate-100">
        <div>
          {followUp.acknowledgedAt ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Contacted ({new Date(followUp.acknowledgedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })})
            </span>
          ) : (
            <span className="text-amber-700 font-medium">
              Awaiting client confirmation
            </span>
          )}
        </div>
        {followUp.scheduledVisitId && (
          <span className="text-teal-700 font-semibold">Visit Linked</span>
        )}
        {followUp.scheduledCallId && (
          <span className="text-blue-700 font-semibold">Call Linked</span>
        )}
      </div>

      {/* Action Row */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
        {/* Communication triggers */}
        <div className="flex items-center gap-1.5">
          {followUp.ownerPhone && (
            <>
              <button
                type="button"
                onClick={handlePhoneClick}
                className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 active:scale-95 transition-all text-xs flex items-center gap-1"
                title="Call client"
              >
                <Phone className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Call</span>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onWhatsApp && onWhatsApp(followUp);
                }}
                className="p-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 active:scale-95 transition-all text-xs flex items-center gap-1"
                title="WhatsApp prefilled follow-up"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
            </>
          )}

          {!followUp.acknowledgedAt && !isTerminal && onAcknowledge && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAcknowledge(followUp);
              }}
              className="px-2 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-medium"
              title="Acknowledge contact"
            >
              Acknowledge
            </button>
          )}
        </div>

        {/* Workflow actions: Convert to Call or Visit */}
        {!isTerminal && followUp.status !== 'SCHEDULED' && (
          <div className="flex items-center gap-1.5 ml-auto">
            {onCancel && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel(followUp);
                }}
                className="px-2 py-1 rounded-lg border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 text-xs font-semibold"
                title="Cancel follow-up"
              >
                Cancel
              </button>
            )}
            {onPostpone && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onPostpone(followUp);
                }}
                className="px-2 py-1 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100 text-xs font-semibold"
              >
                Postpone
              </button>
            )}
            {onConvertToVisit && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onConvertToVisit(followUp);
                }}
                className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-black shadow-sm flex items-center gap-1 active:scale-95 transition-all"
              >
                <span>Plan Visit</span>
                <ChevronRight className="w-3 h-3" />
              </button>
            )}
            {onConvertToCall && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onConvertToCall(followUp);
                }}
                className="px-2 py-1 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-semibold"
              >
                Log Call
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
