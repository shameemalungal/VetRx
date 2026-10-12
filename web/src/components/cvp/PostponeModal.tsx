import React, { useState } from 'react';
import type { Call } from '../../types/cvp';
import { X, Calendar, Clock, AlertTriangle, Send } from 'lucide-react';

interface PostponeModalProps {
  call: Call | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (callId: string, postponeDate: string, reason: string) => Promise<void>;
}

export const PostponeModal: React.FC<PostponeModalProps> = ({
  call,
  isOpen,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !call) return null;

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const in2Days = new Date(today);
  in2Days.setDate(in2Days.getDate() + 2);
  const in2DaysStr = in2Days.toISOString().split('T')[0];

  const in3Days = new Date(today);
  in3Days.setDate(in3Days.getDate() + 3);
  const in3DaysStr = in3Days.toISOString().split('T')[0];

  const [selectedDate, setSelectedDate] = useState<string>(tomorrowStr);
  const [reason, setReason] = useState<string>('Owner requested later time');
  const [customReason, setCustomReason] = useState<string>('');
  const [notifyWhatsApp, setNotifyWhatsApp] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(false);

  const quickReasons = [
    'Owner requested later time',
    'Emergency override required',
    'Severe weather / road blocked',
    'Specialist medicine awaited',
    'Farmer unavailable today',
  ];

  const handlePostpone = async () => {
    try {
      setLoading(true);
      const finalReason = reason === 'Other' ? customReason : reason;
      await onConfirm(String(call.id), selectedDate, finalReason);

      if (notifyWhatsApp && call.callerPhone) {
        const cleanPhone = call.callerPhone.replace(/[^0-9]/g, '');
        const formattedDate = new Date(selectedDate).toLocaleDateString('en-IN', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
        const msg = encodeURIComponent(
          `Namaste ${call.tempOwnerName || 'Sir/Madam'}, your VetRx farm visit for ${call.tempPatientName || 'your animal'} has been rescheduled to ${formattedDate} due to: ${finalReason}. For urgent concerns, please call back.`
        );
        window.open(`https://wa.me/${cleanPhone.length === 10 ? '91' + cleanPhone : cleanPhone}?text=${msg}`, '_blank');
      }

      onClose();
    } catch (err) {
      console.error('Failed to postpone call:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="postpone-modal-title"
      >
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-amber-700">
            <Clock className="w-5 h-5" />
            <h2 id="postpone-modal-title" className="text-lg font-bold text-slate-800">
              Postpone Visit
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close postpone dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Call Summary Banner */}
        <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex justify-between items-start">
            <div>
              <p className="font-semibold text-slate-800 text-sm">
                {call.tempOwnerName || 'Unknown Owner'} • {call.tempPatientName || 'Animal'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {call.locationAddress || 'Farm location'}
              </p>
            </div>
            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
              call.priority === 'EMERGENCY' ? 'bg-red-100 text-red-700' :
              call.priority === 'URGENT' ? 'bg-amber-100 text-amber-800' :
              'bg-blue-100 text-blue-700'
            }`}>
              {call.priority}
            </span>
          </div>

          {call.priority === 'EMERGENCY' && (
            <div className="mt-2.5 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-800">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>Warning: Postponing an EMERGENCY call. Ensure owner is notified!</span>
            </div>
          )}
        </div>

        {/* New Date Picker */}
        <div className="mt-5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
            Reschedule To
          </label>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <button
              type="button"
              onClick={() => setSelectedDate(tomorrowStr)}
              className={`py-2 px-3 text-xs font-medium rounded-xl border text-center transition-all ${
                selectedDate === tomorrowStr
                  ? 'border-teal-600 bg-teal-50 text-teal-800 font-bold shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Tomorrow
              <span className="block text-[10px] text-slate-500">
                {tomorrow.toLocaleDateString('en-IN', { weekday: 'short' })}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(in2DaysStr)}
              className={`py-2 px-3 text-xs font-medium rounded-xl border text-center transition-all ${
                selectedDate === in2DaysStr
                  ? 'border-teal-600 bg-teal-50 text-teal-800 font-bold shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              In 2 Days
              <span className="block text-[10px] text-slate-500">
                {in2Days.toLocaleDateString('en-IN', { weekday: 'short' })}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedDate(in3DaysStr)}
              className={`py-2 px-3 text-xs font-medium rounded-xl border text-center transition-all ${
                selectedDate === in3DaysStr
                  ? 'border-teal-600 bg-teal-50 text-teal-800 font-bold shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              In 3 Days
              <span className="block text-[10px] text-slate-500">
                {in3Days.toLocaleDateString('en-IN', { weekday: 'short' })}
              </span>
            </button>
          </div>

          <div className="relative mt-2">
            <input
              type="date"
              value={selectedDate}
              min={tomorrowStr}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full text-sm py-2 px-3 pl-9 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none bg-slate-50 text-slate-800 font-medium"
            />
            <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          </div>
        </div>

        {/* Postpone Reason */}
        <div className="mt-5">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
            Reason for Postponement
          </label>
          <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
            {quickReasons.map((r) => (
              <label
                key={r}
                className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                  reason === r
                    ? 'border-teal-500 bg-teal-50/50 text-teal-900 font-semibold'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <input
                  type="radio"
                  name="postponeReason"
                  checked={reason === r}
                  onChange={() => setReason(r)}
                  className="accent-teal-600"
                />
                <span>{r}</span>
              </label>
            ))}
            <label
              className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                reason === 'Other'
                  ? 'border-teal-500 bg-teal-50/50 text-teal-900 font-semibold'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <input
                type="radio"
                name="postponeReason"
                checked={reason === 'Other'}
                onChange={() => setReason('Other')}
                className="accent-teal-600"
              />
              <span>Other custom reason</span>
            </label>
          </div>

          {reason === 'Other' && (
            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="State reason for postponement..."
              rows={2}
              className="mt-2 w-full p-2.5 text-xs border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
            />
          )}
        </div>

        {/* WhatsApp Notification Option */}
        {call.callerPhone && (
          <div className="mt-4 p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Send className="w-4 h-4 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-900">Notify Owner on WhatsApp</p>
                <p className="text-[10px] text-emerald-700">Prepares a courteous rescheduling message</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={notifyWhatsApp}
              onChange={(e) => setNotifyWhatsApp(e.target.checked)}
              className="w-4 h-4 accent-emerald-600 rounded"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePostpone}
            disabled={loading || !selectedDate || (reason === 'Other' && !customReason.trim())}
            className="flex-1 py-2.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 rounded-xl shadow-md shadow-amber-600/20 transition-all flex items-center justify-center gap-1.5"
          >
            {loading ? 'Saving...' : 'Confirm Postpone'}
          </button>
        </div>
      </div>
    </div>
  );
};
