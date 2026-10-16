import React, { useState } from 'react';
import { CallPriority, VisitStatus } from '../../types/cvp';
import {
  AlertTriangle,
  Clock,
  Calendar,
  HelpCircle,
  ShieldAlert,
  CheckCircle2,
  X,
  RefreshCw,
} from 'lucide-react';

interface ChangePriorityModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPriority: CallPriority;
  recordType?: 'call' | 'visit';
  recordId?: number | string;
  entityName?: string;
  visitStatus?: VisitStatus;
  onPriorityChanged?: (newPriority: CallPriority, reason?: string) => Promise<void>;
  onConfirm?: (newPriority: CallPriority, reason?: string) => Promise<void>;
}

export const ChangePriorityModal: React.FC<ChangePriorityModalProps> = ({
  isOpen,
  onClose,
  currentPriority,
  recordType = 'call',
  recordId = '',
  entityName,
  visitStatus,
  onPriorityChanged,
  onConfirm,
}) => {
  void entityName;
  const [selectedPriority, setSelectedPriority] = useState<CallPriority>(currentPriority);
  const [reason, setReason] = useState('');
  const [downgradeConfirmed, setDowngradeConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isTerminalVisit = visitStatus === 'COMPLETED' || visitStatus === 'CANCELLED';
  const isDowngradingFromEmergency =
    currentPriority === 'EMERGENCY' &&
    (selectedPriority === 'URGENT' || selectedPriority === 'PLANNED' || selectedPriority === 'COULD_NOT_ASSESS');

  const priorityOptions: Array<{
    value: CallPriority;
    label: string;
    description: string;
    badgeBg: string;
    badgeText: string;
    icon: React.ReactNode;
  }> = [
    {
      value: 'EMERGENCY',
      label: 'Immediate Emergency (Today)',
      description: 'Life-threatening or critical clinical situation. Dispatched immediately with priority route buffer.',
      badgeBg: 'bg-red-100 border-red-300',
      badgeText: 'text-red-900',
      icon: <AlertTriangle className="w-4 h-4 text-red-600" />,
    },
    {
      value: 'URGENT',
      label: 'Urgent Care (Today)',
      description: 'Acute or distressing condition requiring clinical attention today, but without active life-threat.',
      badgeBg: 'bg-amber-100 border-amber-300',
      badgeText: 'text-amber-900',
      icon: <Clock className="w-4 h-4 text-amber-600" />,
    },
    {
      value: 'PLANNED',
      label: 'Planned / Scheduled Routine',
      description: 'Standard clinical visit, follow-up, vaccination, pregnancy diagnosis or elective procedure.',
      badgeBg: 'bg-teal-100 border-teal-300',
      badgeText: 'text-teal-900',
      icon: <Calendar className="w-4 h-4 text-teal-600" />,
    },
    {
      value: 'COULD_NOT_ASSESS',
      label: 'Could Not Assess Triage',
      description: 'Caller was unable to describe clinical symptoms adequately. Requires in-person triage evaluation.',
      badgeBg: 'bg-slate-100 border-slate-300',
      badgeText: 'text-slate-900',
      icon: <HelpCircle className="w-4 h-4 text-slate-600" />,
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPriority === currentPriority) {
      onClose();
      return;
    }

    if (isDowngradingFromEmergency && !downgradeConfirmed) {
      setErrorMsg('Please confirm the operational priority downgrade before saving.');
      return;
    }

    if (isTerminalVisit) {
      setErrorMsg(`Cannot change classification on a ${visitStatus} visit. Historical event sequence is preserved.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const callback = onPriorityChanged || onConfirm;
      if (callback) {
        await callback(selectedPriority, reason.trim() || undefined);
      }
      onClose();
    } catch (err: any) {
      console.error('Error changing priority:', err);
      setErrorMsg(err.message || 'Failed to update priority. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="priority-modal-title"
    >
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-700 text-white flex items-center justify-center shadow-md shadow-teal-700/20">
              <ShieldAlert className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 id="priority-modal-title" className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                Change Operational Priority
              </h2>
              <p className="text-xs text-slate-600 font-medium">
                Editing classification for {recordType === 'call' ? 'Call' : 'Visit'} #{recordId}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl hover:bg-slate-200/60 flex items-center justify-center text-slate-600 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isTerminalVisit && (
            <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold">
              Notice: This visit is already <span className="font-black">{visitStatus}</span>. State transition rules prevent retroactively altering completed clinical events.
            </div>
          )}

          {/* Current vs New Selector */}
          <div>
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 block mb-2">
              Select Classification
            </label>
            <div className="space-y-2">
              {priorityOptions.map((opt) => {
                const isSelected = selectedPriority === opt.value;
                const isCurrent = currentPriority === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={isTerminalVisit}
                    onClick={() => {
                      setSelectedPriority(opt.value);
                      if (currentPriority === 'EMERGENCY' && opt.value !== 'EMERGENCY') {
                        setDowngradeConfirmed(false);
                      }
                    }}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all flex items-start gap-3 ${
                      isSelected
                        ? 'border-teal-600 bg-teal-50/50 ring-2 ring-teal-600/20 shadow-xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    } ${isTerminalVisit ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="mt-0.5">{opt.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-900">
                          {opt.label}
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-800">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                        {opt.description}
                      </p>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Confirmation Step when Downgrading Emergency */}
          {isDowngradingFromEmergency && (
            <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-black text-amber-950 uppercase tracking-wide">
                    Confirmation Required: Downgrading Emergency
                  </h4>
                  <p className="text-xs text-amber-900 mt-1 leading-relaxed font-medium">
                    You are downgrading this case from <span className="font-black text-red-950">Immediate Emergency</span> to <span className="font-black text-slate-950">{selectedPriority}</span>. This removes the immediate dispatch buffer and returns the case to standard operational queue order.
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-2.5 pt-2 border-t border-amber-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={downgradeConfirmed}
                  onChange={(e) => setDowngradeConfirmed(e.target.checked)}
                  className="mt-0.5 rounded text-teal-700 focus:ring-teal-600 h-4 w-4"
                  id="confirm-emergency-downgrade-check"
                />
                <span className="text-xs text-amber-950 font-bold">
                  I confirm that patient status does not require immediate emergency dispatch and acknowledge the change in triage order.
                </span>
              </label>
            </div>
          )}

          {/* Reason / Clinical Notes */}
          <div>
            <label className="text-xs font-bold text-slate-800 block mb-1">
              Reason for Classification Change (Optional Audit Note)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Caller stabilized patient / Accidental emergency selection"
              className="w-full p-2.5 rounded-xl border border-slate-300 bg-white font-medium text-xs text-slate-800 focus:ring-2 focus:ring-teal-600 focus:outline-none"
              disabled={isTerminalVisit}
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs border border-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                isTerminalVisit ||
                selectedPriority === currentPriority ||
                (isDowngradingFromEmergency && !downgradeConfirmed)
              }
              className="px-5 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white font-black text-xs shadow-md shadow-teal-700/20 transition-all flex items-center gap-1.5"
              id="btn-confirm-priority-change"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating…</span>
                </>
              ) : (
                <span>Confirm Priority Change</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
