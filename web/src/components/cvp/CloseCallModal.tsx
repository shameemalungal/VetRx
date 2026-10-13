// ==============================================================================
// VetRx Call & Visit Planner — Close Call Modal
// Closes a call without creating a visit, recording operational resolution
// ==============================================================================

import React, { useState } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';
import type { Call } from '../../types/cvp';

interface CloseCallModalProps {
  isOpen: boolean;
  call: Call | null;
  onClose: () => void;
  onConfirmClose: (reason: string, details?: string, notes?: string) => Promise<void>;
}

const CLOSURE_REASONS = [
  'Advice provided; no visit required',
  'Duplicate request',
  'Caller cancelled the request',
  'Request withdrawn / resolved independently',
  'Referred to emergency hospital',
  'Other reason',
];

export const CloseCallModal: React.FC<CloseCallModalProps> = ({
  isOpen,
  call,
  onClose,
  onConfirmClose,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>(CLOSURE_REASONS[0]);
  const [details, setDetails] = useState<string>('');
  const [clinicalNotes, setClinicalNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !call) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReason) {
      setErrorMessage('Please select a closure reason.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await onConfirmClose(selectedReason, details.trim() || undefined, clinicalNotes.trim() || undefined);
      onClose();
    } catch (err: any) {
      console.error('Failed to close call:', err);
      setErrorMessage(err?.message || 'Failed to close call. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-modal-title"
    >
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-slate-800 text-white flex items-center justify-center shadow-md">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 id="close-modal-title" className="text-base font-black text-slate-900 leading-tight">
                Close Case Without Visit
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {call.ownerName || call.tempOwnerName || 'Caller'} ({call.callerPhone})
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Reason for Closing Case *
            </label>
            <div className="space-y-1.5">
              {CLOSURE_REASONS.map((r) => (
                <label
                  key={r}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                    selectedReason === r
                      ? 'bg-teal-50/80 border-teal-600 text-teal-900 shadow-sm'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="closureReason"
                    value={r}
                    checked={selectedReason === r}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="w-4 h-4 text-teal-700 focus:ring-teal-500 border-slate-300"
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Resolution Details / Advice Given
            </label>
            <textarea
              rows={2}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="e.g. Advised oral rehydration and colostrum intake, farmer will observe"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium text-slate-800 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
              Clinical Assessment / Observations (Optional)
            </label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="Additional observations or reason for withholding visit"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-600 font-medium text-slate-800 resize-none"
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-amber-800 text-[11px] leading-relaxed">
            Closing this case preserves all caller and triage records for audit compliance, but will not schedule a physical visit or deduct inventory.
          </div>

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
              className="min-h-[44px] px-6 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-95 text-white text-sm font-bold shadow-md transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSubmitting ? <span>Closing...</span> : <span>Confirm &amp; Close Case</span>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
