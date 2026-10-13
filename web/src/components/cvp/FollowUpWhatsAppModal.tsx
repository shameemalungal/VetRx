// ==============================================================================
// VetRx Call & Visit Planner — FollowUpWhatsAppModal Component (Phase 8)
// Client WhatsApp reminder handoff via wa.me without claiming automated background send
// ==============================================================================

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { followUpService } from '../../services/followUpService';
import type { FollowUp } from '../../types/cvp';
import {
  MessageSquare,
  Copy,
  Check,
  X,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

interface FollowUpWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  followUp: FollowUp;
  doctorName?: string;
  practiceName?: string;
  onAcknowledge?: () => void;
}

export const FollowUpWhatsAppModal: React.FC<FollowUpWhatsAppModalProps> = ({
  isOpen,
  onClose,
  followUp,
  doctorName = 'Dr. Anand Sharma',
  practiceName = 'VetRx Practice',
  onAcknowledge,
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const { url, text, phone } = followUpService.generateWhatsAppFollowUpLink({
    followUp,
    doctorName,
    practiceName,
  });

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
    window.open(url, '_blank', 'noopener,noreferrer');
    if (onAcknowledge) {
      onAcknowledge();
    }
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      style={{ zIndex: 1050 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="followup-wa-title"
    >
      <div
        className="bg-white rounded-3xl shadow-2xl border border-emerald-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]"
        style={{ maxHeight: '85dvh' }}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="text-[10px] font-black tracking-wider uppercase text-emerald-100">
                Client Communication
              </div>
              <h2 id="followup-wa-title" className="text-lg font-black tracking-tight">
                WhatsApp Follow-up Note
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Recipient summary */}
          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs">
            <div>
              <span className="font-bold text-emerald-950 block">{followUp.ownerName || 'Client'}</span>
              <span className="text-emerald-700 font-mono">+{phone}</span>
            </div>
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
              Recommended: {followUp.recommendedDate}
            </span>
          </div>

          {/* Prefilled message preview */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-700">
                Prefilled Follow-up Message
              </label>
              <button
                type="button"
                onClick={handleCopy}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1 active:scale-95 transition-all"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed select-all">
              {text}
            </div>
          </div>

          {/* Important Regulatory / Clinical Boundary Notice */}
          <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl text-[11px] text-slate-600 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <p className="leading-tight">
              <strong>Transparent Delivery Notice:</strong> VetRx does not send background automated messages or incur SMS subscription fees. Clicking &quot;Open WhatsApp&quot; opens your device&apos;s WhatsApp client via standard <code className="text-slate-800">wa.me</code> protocol with your prefilled clinical message.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-black shadow-md transition-all flex items-center gap-1.5"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Open WhatsApp</span>
          </button>
        </div>
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
