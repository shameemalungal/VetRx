// ==============================================================================
// VetRx Call & Visit Planner (CVP) — WhatsApp Postponement Handoff (CVP-18)
// Phone-level wa.me handoff without paid APIs or message spying
// ==============================================================================

import React, { useState } from 'react';
import {
  MessageSquare,
  ExternalLink,
  Check,
  X,
  Copy,
  AlertCircle,
} from 'lucide-react';
import { CvpRouteEngine } from '../../services/cvpRouteEngine';
import type { Visit } from '../../types/cvp';

interface WhatsAppHandoffModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit: Visit;
  newScheduledDate: string | Date;
  postponementReason?: string;
  doctorName?: string;
  practiceName?: string;
}

export const WhatsAppHandoffModal: React.FC<WhatsAppHandoffModalProps> = ({
  isOpen,
  onClose,
  visit,
  newScheduledDate,
  postponementReason,
  doctorName = 'Dr. Anand Sharma',
  practiceName = 'VetRx Practice',
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const patientNames = (visit.cases || []).map((c) => c.patientName || c.species).join(', ');

  const { text } = CvpRouteEngine.generateWhatsAppMessage({
    ownerName: visit.ownerName,
    patientName: patientNames,
    locationAddress: visit.address,
    newScheduledDate,
    reason: postponementReason,
    doctorName,
    practiceName,
  });

  // Clean owner phone number
  const rawPhone = visit.ownerPhone || '';
  const cleanDigits = rawPhone.replace(/\D/g, '');
  // Default to Indian country code 91 if not starting with international code
  const formattedPhone = cleanDigits.length === 10 ? `91${cleanDigits}` : cleanDigits;
  const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(text)}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.warn('Clipboard copy failed:', err);
    }
  };

  const handleOpenWhatsApp = () => {
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsapp-handoff-title"
    >
      <div className="bg-white rounded-3xl shadow-2xl border border-emerald-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-black tracking-wider uppercase text-emerald-100">
                Client Notification (CVP-18)
              </div>
              <h2 id="whatsapp-handoff-title" className="text-lg font-black tracking-tight">
                WhatsApp Postponement Note
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
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
          {/* Owner info strip */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                Recipient
              </span>
              <strong className="text-slate-800 text-sm">{visit.ownerName || 'Client'}</strong>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Phone</span>
              <span className="font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-100">
                {rawPhone || 'No number'}
              </span>
            </div>
          </div>

          {/* Formatted message card */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Message Preview
              </span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs font-semibold text-teal-700 hover:text-teal-900 flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/50 border border-emerald-200 text-xs font-sans text-slate-800 whitespace-pre-line leading-relaxed shadow-inner">
              {text}
            </div>
          </div>

          {/* Policy Notice */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-2 text-xs text-slate-500">
            <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p>
              VetRx uses direct browser-to-WhatsApp handoff. No automated messaging fees apply.
              You can send the message or complete postponement without messaging.
            </p>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 hover:bg-white text-slate-700 text-xs font-bold transition-colors"
          >
            Done (Skip WhatsApp)
          </button>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            disabled={!cleanDigits}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-black shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-1.5"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );
};
