import React, { useState, useEffect } from 'react';
import type { Call } from '../../types/cvp';
import { cvpService } from '../../services/cvpService';
import { db } from '../../db/schema';
import {
  Trash2,
  AlertTriangle,
  ShieldAlert,
  X,
  Ban,
} from 'lucide-react';

interface DeleteCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  call: Call | null;
  onDeleted: (deletedId: string | number) => void;
  onCancelled?: (updatedCall: Call) => void;
}

export const DeleteCallModal: React.FC<DeleteCallModalProps> = ({
  isOpen,
  onClose,
  call,
  onDeleted,
  onCancelled,
}) => {
  if (!isOpen || !call || call.id == null) return null;
  const activeCallId: string | number = call.id;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('Accidental Entry / Cancelled by Staff');
  const [localVisits, setLocalVisits] = useState<any[]>(call.visits || []);

  useEffect(() => {
    let isMounted = true;
    if (call.visits && call.visits.length > 0) {
      setLocalVisits(call.visits);
    } else {
      db.visits.toArray().then((allVisits) => {
        if (!isMounted) return;
        const linked = allVisits.filter(
          (v) => String(v.callId) === String(call.id)
        );
        setLocalVisits(linked);
      }).catch(() => {});
    }
    return () => { isMounted = false; };
  }, [call]);

  // Inspect linked visits and dependent records
  const visits = localVisits;

  // Check 1: Protected clinical or financial records exist
  const hasClinicalOrFinancial = visits.some(
    (v: any) =>
      v.status === 'COMPLETED' ||
      (v.procedures && v.procedures.length > 0) ||
      (v.medicineUsages && v.medicineUsages.length > 0) ||
      (v.cases &&
        v.cases.some(
          (c: any) =>
            c.prescriptionId != null ||
            c.invoiceId != null ||
            c.prescription != null ||
            c.invoice != null
        ))
  );

  // Check 2: Active or scheduled visits exist
  const activeVisit = visits.find((v: any) =>
    ['REGISTERED', 'SCHEDULED', 'DISPATCHED', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'POSTPONED'].includes(
      v.status
    )
  );

  // Check 3: Any linked visits exist
  const hasLinkedVisits = visits.length > 0;

  // Check 4: Call is already scheduled, dispatched, in progress, or completed
  const isCallActiveOrProcessed = ['SCHEDULED', 'DISPATCHED', 'IN_PROGRESS', 'COMPLETED', 'POSTPONED'].includes(
    call.status as string
  );

  const isDeletionBlocked =
    hasClinicalOrFinancial || Boolean(activeVisit) || hasLinkedVisits || isCallActiveOrProcessed;

  // Handle destructive delete (permitted only for genuinely unlinked calls)
  const handleDelete = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await cvpService.deleteCall(activeCallId);
      onDeleted(activeCallId);
      onClose();
    } catch (err: any) {
      console.error('Failed to delete call:', err);
      setErrorMsg(err?.message || 'Could not delete call from server.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle safe cancellation / archive workflow when destructive deletion is blocked
  const handleSafeCancel = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      const updated = await cvpService.closeCall(
        activeCallId,
        cancelReason.trim() || 'Cancelled instead of destructive deletion'
      );
      if (onCancelled) {
        onCancelled(updated);
      } else {
        onDeleted(activeCallId);
      }
      onClose();
    } catch (err: any) {
      console.error('Failed to cancel call:', err);
      setErrorMsg(err?.message || 'Could not cancel call.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const callerDisplayName = call.ownerName || call.tempOwnerName || 'Unknown Caller';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-call-title"
    >
      <div className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-200 text-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div
              className={`p-2 rounded-xl border ${
                isDeletionBlocked
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-red-50 text-red-700 border-red-200'
              }`}
            >
              {isDeletionBlocked ? (
                <ShieldAlert className="w-5 h-5 text-amber-700" />
              ) : (
                <Trash2 className="w-5 h-5 text-red-700" />
              )}
            </div>
            <div>
              <h2 id="delete-call-title" className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                {isDeletionBlocked ? 'Deletion Blocked — Safe Action Required' : 'Delete Call Record'}
              </h2>
              <p className="text-xs text-slate-500">
                {isDeletionBlocked
                  ? 'Protecting active visits and clinical history'
                  : 'Confirm permanent removal of unlinked draft call'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Banner */}
        {errorMsg && (
          <div className="my-3 p-3 bg-red-50 border border-red-200 rounded-2xl text-red-800 text-xs flex items-center gap-2 animate-in fade-in">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-semibold">{errorMsg}</span>
          </div>
        )}

        {/* Body State A: Deletion Blocked by Clinical/Financial or Active Records */}
        {isDeletionBlocked ? (
          <div className="py-4 space-y-4">
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-amber-900 uppercase tracking-wider">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>
                  {hasClinicalOrFinancial
                    ? 'Clinical or Financial Records Exist'
                    : activeVisit
                    ? 'Active or Scheduled Visit Exists'
                    : 'Linked Visit History Exists'}
                </span>
              </div>
              <p className="text-xs text-amber-800 leading-relaxed font-medium">
                {hasClinicalOrFinancial
                  ? 'This call is associated with completed clinical visits, prescriptions, invoices, or medicine usage. In accordance with veterinary clinical regulations, completed medical and financial history cannot be permanently deleted.'
                  : activeVisit
                  ? `This call is linked to an active visit (Visit ID: ${activeVisit.id?.slice?.(0, 8) || activeVisit.id}, Status: ${activeVisit.status}). To prevent disruption to ongoing field care, destructive deletion is blocked.`
                  : 'This call has linked visit history. To preserve audit trails and avoid orphaned records, destructive deletion is blocked.'}
              </p>
            </div>

            {/* Safe Alternative: Cancel Call */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                <Ban className="w-4 h-4 text-teal-700" />
                <span>Recommended Action: Cancel / Archive Call</span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                You can safely mark this call as <strong>Cancelled</strong>. The record will be removed from your active triage queue while preserving historical audit trails.
              </p>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-1">
                  Cancellation Reason
                </label>
                <input
                  type="text"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="e.g. Farmer cancelled request, duplicate call entry"
                  className="w-full text-xs p-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white font-medium"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSafeCancel}
                disabled={isSubmitting}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Ban className="w-3.5 h-3.5 text-amber-400" />
                    <span>Cancel Call Safely</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Body State B: Genuinely Unlinked Draft Call (Safe to Delete) */
          <div className="py-4 space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              Are you sure you want to delete this triage call for{' '}
              <strong className="text-slate-900">{callerDisplayName}</strong>
              {call.callerPhone ? ` (${call.callerPhone})` : ''}?
            </p>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1.5 font-medium text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500">Reported Species:</span>
                <span className="font-bold text-slate-800">{call.species || 'Cattle'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Priority:</span>
                <span className="font-bold text-slate-800">{call.priority}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Intake Symptoms:</span>
                <span className="font-bold text-slate-800 truncate max-w-[200px]">{call.symptoms}</span>
              </div>
            </div>

            <div className="p-3 bg-red-50 border border-red-200 rounded-2xl text-[11px] text-red-800 font-medium">
              ⚠️ This is an unlinked draft call with no attached visits. Deleting it will permanently remove the record from PostgreSQL.
            </div>

            {/* Modal Actions */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Keep Call
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <span>Deleting...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
